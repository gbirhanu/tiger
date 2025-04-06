import { Router, Request, Response } from 'express';
import { db } from '../lib/db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { hashPassword, verifyPassword, createSession, deleteSession, requireAuth, validateSession } from '../lib/auth';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { tasks, subtasks, notes, appointments, longNotes, userSettings, subscriptions, meetings } from '../../shared/schema';

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
    
    
    if (!req.body) {
      console.error('No request body received');
      return res.status(400).json({ error: 'No request body provided' });
    }

    const { email, password, name, user_location } = registerSchema.parse(req.body);
    

    // Check if user exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser) {
      
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Create user
    const hashedPassword = await hashPassword(password);
    
    
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

    // Check if user is active
    if (user.status === 'inactive' || user.status === 'suspended') {
      
      return res.status(403).json({ valid: false, error: `Your account is ${user.status}. Please contact an administrator.` });
    }

    // Update user online status
    await db.update(users)
      .set({ is_online: true })
      .where(eq(users.id, userId));

    
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
    
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.userId!),
    });

    if (!user) {
      
      res.clearCookie('sessionId');
      return res.json({ user: null });
    }
    
    // Check if user is active
    if (user.status === 'inactive' || user.status === 'suspended') {
      
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
      // Create new user with more Google profile data
      const [newUser] = await db.insert(users)
        .values({
          email: payload.email,
          name: payload.name || null,
          profile_image: payload.picture || null,
          last_login: Date.now(),
          // Set a random password since we won't use it
          password: await hashPassword(Math.random().toString(36).slice(-8)),
          auth_provider: 'google',
          is_online: true,
        })
        .returning();
      user = newUser;
      
      console.log('Created new user from Google login:', user.id);
    } else {
      // Update existing user with Google info if needed
      await db.update(users)
        .set({
          last_login: Date.now(),
          is_online: true,
          // Only update these if they were empty before
          name: user.name || payload.name || null,
          profile_image: user.profile_image || payload.picture || null,
        })
        .where(eq(users.id, user.id));
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
        role: user.role,
        profile_image: user.profile_image,
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

// Delete account endpoint
router.post("/delete-account", requireAuth, async (req: Request, res: Response) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: "Password is required for account deletion" });
    }
    
    // Get the user from the database
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.userId!),
    });
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // Verify password
    const isPasswordValid = await verifyPassword(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid password" });
    }
    
    // Begin transaction to delete all user data
    await db.transaction(async (tx) => {
      // Delete user's tasks
      await tx.delete(tasks).where(eq(tasks.user_id, req.userId!));
      
      // Delete user's subtasks
      await tx.delete(subtasks).where(eq(subtasks.user_id, req.userId!));
      
      // Delete user's notes
      await tx.delete(notes).where(eq(notes.user_id, req.userId!));
      
      // Delete user's long notes
      await tx.delete(longNotes).where(eq(longNotes.user_id, req.userId!));
      
      // Delete user's settings
      await tx.delete(userSettings).where(eq(userSettings.user_id, req.userId!));
      
      // Delete user's meetings
      await tx.delete(meetings).where(eq(meetings.user_id, req.userId!));
      
      // Delete user's appointments
      await tx.delete(appointments).where(eq(appointments.user_id, req.userId!));
      
      // Delete user's subscription
      await tx.delete(subscriptions).where(eq(subscriptions.user_id, req.userId!));
      
      // Finally, delete the user
      await tx.delete(users).where(eq(users.id, req.userId!));
    });
    
    // Delete session
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const sessionId = authHeader.split(' ')[1];
      await deleteSession(sessionId);
    }
    
    // Send success response
    res.json({ success: true, message: "Account successfully deleted" });
  } catch (error) {
    console.error("Error deleting account:", error);
    res.status(500).json({ error: "Failed to delete account" });
  }
});

// Update password endpoint
router.post("/update-password", requireAuth, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Validate inputs
    if (!currentPassword) {
      return res.status(400).json({ error: "Current password is required" });
    }
    
    if (!newPassword) {
      return res.status(400).json({ error: "New password is required" });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }
    
    // Get the user from the database
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.userId!),
    });
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // Verify current password
    const isPasswordValid = await verifyPassword(currentPassword, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }
    
    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);
    
    // Update the password in the database
    await db.update(users)
      .set({ 
        password: hashedPassword,
        updated_at: Math.floor(Date.now() / 1000)
      })
      .where(eq(users.id, req.userId!));
    
    // Return success response
    res.json({ 
      success: true, 
      message: "Password updated successfully" 
    });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

export default router; 