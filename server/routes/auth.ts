import { Router, Request, Response } from 'express';
import { db } from '../lib/db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { hashPassword, verifyPassword, createSession, deleteSession, requireAuth, validateSession } from '../lib/auth';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';

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
    console.log('Registration request body:', req.body);
    
    if (!req.body) {
      console.error('No request body received');
      return res.status(400).json({ error: 'No request body provided' });
    }

    const { email, password, name } = registerSchema.parse(req.body);
    console.log('Parsed registration data:', { email, name });

    // Check if user exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser) {
      console.log('Registration failed: Email already exists');
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Create user
    const hashedPassword = await hashPassword(password);
    console.log('Attempting to create user...');
    const [user] = await db.insert(users)
      .values({
        email,
        password: hashedPassword,
        name: name || null
      })
      .returning();
    console.log('User created successfully:', { id: user.id, email: user.email });

    // Create session
    const sessionId = await createSession(user.id);
    console.log('Session created:', { sessionId });

    // Set cookie
    res.cookie('sessionId', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });
    
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
    console.error('Registration error details:', error);
    
    if (error instanceof z.ZodError) {
      console.error('Validation errors:', error.errors);
      return res.status(400).json({ 
        error: 'Invalid registration data', 
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      });
    }

    if (error instanceof Error) {
      console.error('Error message:', error.message);
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
    console.log(`Validating session token: ${sessionId.substring(0, 10)}...`);

    const userId = await validateSession(sessionId);
    if (!userId) {
      console.log('Session validation failed: Invalid or expired session');
      return res.status(401).json({ valid: false, error: 'Invalid or expired session' });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      console.log('Session validation failed: User not found');
      return res.status(401).json({ valid: false, error: 'User not found' });
    }

    console.log(`Session validation successful for user: ${user.email}`);
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
    console.error('Token validation error:', error);
    return res.status(500).json({ valid: false, error: 'Server error' });
  }
});

// Login
router.post('/login', async (req: Request<{}, {}, LoginRequest>, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    // Find user
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create session
    const sessionId = await createSession(user.id);

    // Set cookie
    res.cookie('sessionId', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

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
    console.error('Login error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid login data', 
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      });
    }

    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(400).json({ error: 'Invalid login data' });
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
      console.log(`Logging out session from authorization header: ${sessionId.substring(0, 10)}...`);
    } else {
      // Fallback to cookie
      sessionId = req.cookies?.sessionId;
      console.log(`Logging out session from cookie: ${sessionId ? sessionId.substring(0, 10) + '...' : 'none'}`);
    }

    if (sessionId) {
      await deleteSession(sessionId);
      res.clearCookie('sessionId');
    }

    console.log('Logout successful');
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

// Get current user
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    console.log(`Fetching current user data for user ID: ${req.userId}`);
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.userId!),
    });

    if (!user) {
      console.log('User not found in database, clearing session');
      res.clearCookie('sessionId');
      return res.json({ user: null });
    }

    // Get the session ID from the authorization header
    const authHeader = req.headers.authorization;
    const sessionId = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.split(' ')[1] 
      : req.cookies?.sessionId;
       
    console.log(`Returning user data with session ID: ${sessionId?.substring(0, 10)}...`);
    
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
    res.cookie('sessionId', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

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