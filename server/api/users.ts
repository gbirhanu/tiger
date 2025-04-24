import { Router, Request, Response } from 'express';
import { db } from '../lib/db';
import { users, userSettings } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../lib/auth';
import { z } from 'zod';

const router = Router();

// Get all users (admin only)
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const currentUser = await db.query.users.findFirst({
      where: eq(users.id, req.userId!),
    });

    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    // Get all users
    const allUsers = await db.query.users.findMany({
      orderBy: (users, { desc }) => [desc(users.created_at)],
    });

    // Remove password field for security
    const sanitizedUsers = allUsers.map(({ password, ...user }) => user);

    return res.json({ users: sanitizedUsers });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user by ID (admin or self)
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    
    // Check if user is admin or self
    const currentUser = await db.query.users.findFirst({
      where: eq(users.id, req.userId!),
    });

    if (!currentUser || (currentUser.role !== 'admin' && currentUser.id !== userId)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }

    // Get user
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Remove password field for security
    const { password, ...sanitizedUser } = user;

    return res.json({ user: sanitizedUser });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Update user status (admin only)
const updateStatusSchema = z.object({
  status: z.enum(['active', 'inactive', 'suspended']),
});

router.put('/:id/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const { status } = updateStatusSchema.parse(req.body);
    
    // Check if user is admin
    const currentUser = await db.query.users.findFirst({
      where: eq(users.id, req.userId!),
    });

    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    // Prevent self-modification
    if (currentUser.id === userId) {
      return res.status(400).json({ error: 'Cannot modify your own status' });
    }

    // Check if user exists
    const userToUpdate = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!userToUpdate) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update user status
    await db.update(users)
      .set({ status })
      .where(eq(users.id, userId));

    return res.json({ 
      success: true, 
      message: `User status updated to ${status}` 
    });
  } catch (error) {
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid status data', 
        details: error.errors 
      });
    }
    
    return res.status(500).json({ error: 'Failed to update user status' });
  }
});

// Update user role (admin only)
const updateRoleSchema = z.object({
  role: z.enum(['admin', 'user']),
});

router.put('/:id/role', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const { role } = updateRoleSchema.parse(req.body);
    
    // Check if user is admin
    const currentUser = await db.query.users.findFirst({
      where: eq(users.id, req.userId!),
    });

    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    // Prevent self-modification
    if (currentUser.id === userId) {
      return res.status(400).json({ error: 'Cannot modify your own role' });
    }

    // Check if user exists
    const userToUpdate = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!userToUpdate) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update user role
    await db.update(users)
      .set({ role })
      .where(eq(users.id, userId));

    return res.json({ 
      success: true, 
      message: `User role updated to ${role}` 
    });
  } catch (error) {
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid role data', 
        details: error.errors 
      });
    }
    
    return res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Update user subscription (admin only)
const updateSubscriptionSchema = z.object({
  subscription_plan: z.enum(['free', 'pro', 'enterprise']),
  subscription_expiry: z.number().optional()
});

router.put('/:id/subscription', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const { subscription_plan, subscription_expiry } = updateSubscriptionSchema.parse(req.body);
    
    // Check if user is admin
    const currentUser = await db.query.users.findFirst({
      where: eq(users.id, req.userId!),
    });

    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    // Check if user exists
    const userToUpdate = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!userToUpdate) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get the current user settings
    const currentUserSettings = await db.query.userSettings.findFirst({
      where: eq(userSettings.user_id, userId),
    });

    // Calculate expiry if provided or use default (30 days)
    const expiry = subscription_expiry || 
      (subscription_plan !== 'free' ? Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) : null);
    
    // Convert subscription_plan to is_pro boolean
    const is_pro = subscription_plan !== 'free';

    if (currentUserSettings) {
      // Update existing user settings
      await db.update(userSettings)
        .set({ 
          is_pro,
          subscription_end_date: expiry 
        })
        .where(eq(userSettings.user_id, userId));
    } else {
      // Create new user settings
      await db.insert(userSettings)
        .values({
          user_id: userId,
          is_pro,
          subscription_end_date: expiry,
          gemini_calls_count: 0,
          created_at: Math.floor(Date.now() / 1000),
          updated_at: Math.floor(Date.now() / 1000)
        });
    }

    return res.json({
      success: true,
      message: `User subscription updated to ${subscription_plan}`,
      userId,
      subscription_plan,
      subscription_expiry: expiry
    });
  } catch (error) {
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid subscription data', 
        details: error.errors 
      });
    }
    
    return res.status(500).json({ error: 'Failed to update user subscription' });
  }
});

// Reset user's Gemini API usage (admin only)
router.post('/:id/reset-gemini-usage', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    
    // Check if user is admin
    const currentUser = await db.query.users.findFirst({
      where: eq(users.id, req.userId!),
    });

    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    // Check if user exists
    const userToUpdate = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!userToUpdate) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get the current user settings
    const currentUserSettings = await db.query.userSettings.findFirst({
      where: eq(userSettings.user_id, userId),
    });

    if (currentUserSettings) {
      // Update existing user settings
      await db.update(userSettings)
        .set({ 
          gemini_calls_count: 0,
          updated_at: Math.floor(Date.now() / 1000)
        })
        .where(eq(userSettings.user_id, userId));
    } else {
      // Create new user settings
      await db.insert(userSettings)
        .values({
          user_id: userId,
          is_pro: false,
          gemini_calls_count: 0,
          created_at: Math.floor(Date.now() / 1000),
          updated_at: Math.floor(Date.now() / 1000)
        });
    }

    return res.json({
      success: true,
      message: `Gemini API usage reset for user`,
      userId
    });
  } catch (error) {
    return res.status(500).json({ 
      error: 'Failed to reset Gemini API usage',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 