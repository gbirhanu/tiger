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
  user_location: z.string().optional(),
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

    const { email, password, name, user_location } = registerSchema.parse(req.body);
    console.log('Parsed registration data:', { email, name, user_location });

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
    
    // Get IP and user agent
    const userAgent = req.headers['user-agent'] || '';
    const ip = req.ip || req.socket.remoteAddress || '';
    
    
    const [user] = await db.insert(users)
      .values({
        email,
        password: hashedPassword,
        name: name || null,
        role: "user",
        status: "active",
        last_login: Math.floor(Date.now() / 1000),
        login_count: 1,
        last_login_ip: ip,
        last_login_device: userAgent,
        user_location: user_location || null,
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000),
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

    // Check if user is active
    if (user.status === 'inactive' || user.status === 'suspended') {
      console.log(`Session validation failed: User account is ${user.status}`);
      return res.status(403).json({ valid: false, error: `Your account is ${user.status}. Please contact an administrator.` });
    }

    // Update user online status
    await db.update(users)
      .set({ is_online: true })
      .where(eq(users.id, userId));

    console.log(`Session validation successful for user: ${user.email}`);
    return res.json({ 
      valid: true, 
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
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

    // Check user status before proceeding
    if (user.status === 'inactive') {
      return res.status(403).json({ error: 'Account is deactivated. Please contact an administrator.' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Account is suspended. Please contact an administrator.' });
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update login information
    const userAgent = req.headers['user-agent'] || '';
    const ip = req.ip || req.socket.remoteAddress || '';
    
    // Try to get location from IP (simplified - in a real app you'd use a geolocation service)
    let location = user.user_location || null; // Keep existing location if we can't determine a new one
    
    // Update user information
    await db.update(users)
      .set({
        last_login: Math.floor(Date.now() / 1000),
        login_count: (user.login_count || 0) + 1,
        last_login_ip: ip,
        last_login_device: userAgent,
        user_location: location,
        is_online: true
      })
      .where(eq(users.id, user.id));

    // Create session
    const sessionId = await createSession(user.id);

    // Set cookie
    res.cookie('sessionId', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    // Get updated user data
    const updatedUser = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });

    res.json({
      user: {
        id: updatedUser?.id,
        email: updatedUser?.email,
        name: updatedUser?.name,
        role: updatedUser?.role,
        status: updatedUser?.status,
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

    return res.status(500).json({ error: 'An unexpected error occurred' });
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
    
    // Check if user is active
    if (user.status === 'inactive' || user.status === 'suspended') {
      console.log(`User account is ${user.status}, clearing session`);
      res.clearCookie('sessionId');
      return res.status(403).json({ 
        error: `Your account is ${user.status}. Please contact an administrator.` 
      });
    }

    // Get the session ID from the authorization header
    const authHeader = req.headers.authorization;
    const sessionId = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.split(' ')[1] 
      : req.cookies?.sessionId;
       
    console.log(`Returning user data with session ID: ${sessionId?.substring(0, 10)}...`);
    
    // Update user online status
    await db.update(users)
      .set({ is_online: true })
      .where(eq(users.id, req.userId!));
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        session: {
          id: sessionId,
          active: true
        }
      }
    });
  } catch (error) {
    console.error('Error fetching current user:', error);
    res.status(500).json({ error: 'Failed to fetch user data' });
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
    
    // Check user status
    if (user.status === 'inactive') {
      return res.status(403).json({ error: 'Account is deactivated. Please contact an administrator.' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Account is suspended. Please contact an administrator.' });
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

// Logout
router.post('/logout', requireAuth, async (req: Request, res: Response) => {
  try {
    // Get session ID from cookie or authorization header
    const sessionId = req.cookies?.sessionId || (
      req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.split(' ')[1]
        : null
    );

    if (sessionId) {
      // Delete the session
      await deleteSession(sessionId);
      
      // Update user's online status
      await db.update(users)
        .set({ is_online: false })
        .where(eq(users.id, req.userId!));
    }

    // Clear the cookie
    res.clearCookie('sessionId');
    
    res.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

export default router; 