import { Router, Request, Response } from 'express';
import { db } from '../lib/db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { hashPassword, verifyPassword, createSession, deleteSession, requireAuth, validateSession } from '../lib/auth';
import { logger } from '../../shared/logger';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';

// Standardized cookie configuration
const COOKIE_CONFIG = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
};

const router = Router();
const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const googleLoginSchema = z.object({
  credential: z.string(),
});

type RegisterRequest = z.infer<typeof registerSchema>;
type LoginRequest = z.infer<typeof loginSchema>;
type GoogleLoginRequest = z.infer<typeof googleLoginSchema>;

// Register
router.post('/register', async (req: Request<{}, {}, RegisterRequest>, res: Response) => {
  try {
    
    if (!req.body) {
      return res.status(400).json({ error: 'No request body provided' });
    }

    const { email, password, name } = registerSchema.parse(req.body);

    // Check if user exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Create user
    const hashedPassword = await hashPassword(password);
    const [user] = await db.insert(users)
      .values({
        email,
        password: hashedPassword,
        name: name || null
      })
      .returning();

    // Create session
    const sessionId = await createSession(user.id);

    // Set cookie
    res.cookie('sessionId', sessionId, COOKIE_CONFIG);
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        session: {
          id: sessionId,
          active: true
        }
      }
    });
  } catch (error) {
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid registration data', 
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      });
    }

    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(400).json({ error: 'Invalid registration data' });
  }
});

// Validate Token
router.get('/validate-token', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ valid: false, error: 'No token provided' });
    }

    const sessionId = authHeader.split(' ')[1];

    const userId = await validateSession(sessionId);
    if (!userId) {
      return res.status(401).json({ valid: false, error: 'Invalid or expired session' });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return res.status(401).json({ valid: false, error: 'User not found' });
    }

    return res.json({ 
      valid: true, 
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        session: {
          id: sessionId,
          active: true
        }
      }
    });
  } catch (error) {
    return res.status(500).json({ valid: false, error: 'Server error' });
  }
});

// Login
router.post('/login', async (req: Request<{}, {}, LoginRequest>, res: Response) => {
  try {
    // Validate request body using schema
    const { email, password } = loginSchema.parse(req.body);
    console.log("I am here in login server", email, password);
    
    logger.info(`Login attempt for email: ${email}`);

    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
      columns: {
        id: true,
        email: true,
        password: true,
        name: true
      }
    });

    if (!user) {
      logger.warn(`Login attempt failed: user not found for email ${email}`);
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    const isValid = await verifyPassword(password, user.password);
    
    if (!isValid) {
      logger.warn(`Login attempt failed: invalid password for email ${email}`);
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Create session
    const sessionId = await createSession(user.id);

    // Set cookie
    res.cookie('sessionId', sessionId, COOKIE_CONFIG);

    logger.info(`User logged in successfully: ${email}`);
    
    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        session: {
          id: sessionId,
          active: true
        }
      }
    });

  } catch (error) {
    logger.error('Login error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid login data', 
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      });
    }

    return res.status(500).json({
      success: false,
      error: 'An error occurred during login'
    });
  }
});

// Logout
router.post('/logout', async (req: Request, res: Response) => {
  try {
    // First check header for Bearer token
    const authHeader = req.headers.authorization;
    let sessionId = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      sessionId = authHeader.split(' ')[1];
    } else {
      // Fallback to cookie
      sessionId = req.cookies?.sessionId;
    }

    if (sessionId) {
      await deleteSession(sessionId);
      res.clearCookie('sessionId', { 
        httpOnly: true, 
        secure: process.env.NODE_ENV === 'production', 
        sameSite: 'lax' 
      });
    }

    res.json({
      message: 'Logged out successfully',
      session: {
        active: false
      }
    });
  } catch (error) {
    console.error('Logout error:', error);
    if (error instanceof Error) {
      return res.status(500).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to logout' });
  }
});
router.get('/session', (req, res) => {
  const sessionId = req.cookies.sessionId; // Access the httpOnly cookie

  if (sessionId) {
    // Here, you could validate the sessionId against a database or session store
    // For this example, we'll assume it's valid if it exists
    res.json({
      isAuthenticated: true,
      message: 'Session is active',
      sessionId: sessionId, // Optional: only return this if needed
    });
  } else {
    res.status(401).json({
      isAuthenticated: false,
      message: 'No active session',
    });
  }
});
// Get current user
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.userId!),
    });

    if (!user) {
      res.clearCookie('sessionId', { 
        httpOnly: true, 
        secure: process.env.NODE_ENV === 'production', 
        sameSite: 'lax' 
      });
      return res.json({ user: null });
    }

    // Get the session ID from the authorization header
    const authHeader = req.headers.authorization;
    const sessionId = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.split(' ')[1] 
      : req.cookies?.sessionId;
       
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        session: {
          id: sessionId,
          active: true
        }
      }
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Google Login
router.post('/google', async (req: Request<{}, {}, GoogleLoginRequest>, res: Response) => {
  try {
    const { credential } = googleLoginSchema.parse(req.body);

    // Verify Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(400).json({ error: 'Invalid Google token' });
    }

    // Check if user exists
    let user = await db.query.users.findFirst({
      where: eq(users.email, payload.email),
    });

    if (!user) {
      // Create new user
      const [newUser] = await db.insert(users)
        .values({
          email: payload.email,
          name: payload.name || null,
          // Set a random password since we won't use it
          password: await hashPassword(Math.random().toString(36).slice(-8)),
        })
        .returning();
      user = newUser;
    }

    // Create session
    const sessionId = await createSession(user.id);

    // Set cookie
    res.cookie('sessionId', sessionId, COOKIE_CONFIG);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        session: {
          id: sessionId,
          active: true
        }
      }
    });
  } catch (error) {
    console.error('Google login error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid Google login data', 
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      });
    }

    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(400).json({ error: 'Invalid Google credentials' });
  }
});

export default router; 