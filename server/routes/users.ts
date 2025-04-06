import express, { Request, Response } from 'express';
import { db } from '../../shared/db';
import { users, userSettings } from '../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { requireAuth, requireAdmin } from '../lib/auth';

const router = express.Router();

// Add a route to manage a user's subscription status
router.post('/:userId/subscription', requireAuth, async (req: Request, res: Response) => {
  try {
    // Check if the authenticated user is an admin
    const adminUser = await db
      .select()
      .from(users)
      .where(and(eq(users.id, req.userId!), eq(users.role, "admin")))
      .get();
    
    if (!adminUser) {
      return res.status(403).json({ error: "Unauthorized access. Admin role required." });
    }
    
    const userId = parseInt(req.params.userId);
    const { subscription_plan, subscription_expiry } = req.body;
    
    // Validate subscription plan
    if (!['free', 'pro', 'enterprise'].includes(subscription_plan)) {
      return res.status(400).json({ error: "Invalid subscription plan" });
    }
    
    // Check if the user exists
    const userExists = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .get();
      
    if (!userExists) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // Import the subscriptionPayments table
    const { subscriptionPayments } = await import('../../shared/schema');
    
    // If granting a pro subscription, check if there's already a payment record
    if (subscription_plan === 'pro') {
      // Create a payment record in subscription_payments table
      const now = Math.floor(Date.now() / 1000);
      
      // Create a payment record (for tracking purposes)
      await db
        .insert(subscriptionPayments)
        .values({
          user_id: userId,
          amount: 0, // Admin granted subscription (no payment)
          currency: "USD",
          transaction_id: `admin-grant-${now}`,
          deposited_by: `admin-${adminUser.id}`,
          deposited_date: now,
          payment_method: "admin_grant",
          status: "approved",
          subscription_plan: "pro",
          duration_months: 1, // 30 days as specified
          notes: "Subscription granted by admin",
          created_at: now,
          updated_at: now
        });
    }
    
    // Update user's subscription in the user_settings table
    const userSetting = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.user_id, userId))
      .get();
    
    // Get current timestamp
    const now = Math.floor(Date.now() / 1000);
    
    if (userSetting) {
      // Update existing record
      await db
        .update(userSettings)
        .set({
          subscription_plan,
          subscription_expiry: subscription_expiry === null ? null : parseInt(String(subscription_expiry)),
          updated_at: now
        })
        .where(eq(userSettings.user_id, userId));
    } else {
      // Create new record
      await db
        .insert(userSettings)
        .values({
          user_id: userId,
          subscription_plan,
          subscription_expiry: subscription_expiry === null ? null : parseInt(String(subscription_expiry)),
          created_at: now,
          updated_at: now
        });
    }
    
    // Return updated info
    res.json({
      success: true,
      user_id: userId,
      subscription_plan,
      subscription_expiry
    });
    
  } catch (error) {
    console.error("Error updating subscription:", error);
    res.status(500).json({ 
      error: "Failed to update subscription",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Add a route to reset a user's Gemini API usage count
router.post('/:userId/reset-gemini-usage', requireAuth, async (req: Request, res: Response) => {
  try {
    // Check if the authenticated user is an admin
    const adminUser = await db
      .select()
      .from(users)
      .where(and(eq(users.id, req.userId!), eq(users.role, "admin")))
      .get();
    
    if (!adminUser) {
      return res.status(403).json({ error: "Unauthorized access. Admin role required." });
    }
    
    const userId = parseInt(req.params.userId);
    
    // Update user's Gemini API usage count
    const result = await db
      .update(userSettings)
      .set({
        gemini_calls_count: 0,
        updated_at: Math.floor(Date.now() / 1000)
      })
      .where(eq(userSettings.user_id, userId))
      .returning();
    
    // If no row was updated, user settings may not exist for this user
    if (result.length === 0) {
      // First check if the user exists
      const userExists = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .get();
        
      if (!userExists) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Create new user settings with gemini_calls_count set to 0
      await db
        .insert(userSettings)
        .values({
          user_id: userId,
          gemini_calls_count: 0,
          created_at: Math.floor(Date.now() / 1000),
          updated_at: Math.floor(Date.now() / 1000)
        });
    }
    
    res.json({
      success: true,
      message: `Gemini API usage reset for user`,
      user_id: userId
    });
    
  } catch (error) {
    console.error("Error resetting Gemini API usage:", error);
    res.status(500).json({ 
      error: "Failed to reset Gemini API usage",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Get all users
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    // Check if the authenticated user is an admin
    const adminUser = await db
      .select()
      .from(users)
      .where(and(eq(users.id, req.userId!), eq(users.role, "admin")))
      .get();
    
    if (!adminUser) {
      return res.status(403).json({ error: "Unauthorized access. Admin role required." });
    }
    
    // Import the subscriptionPayments table
    const { subscriptionPayments } = await import('../../shared/schema');
    
    // Get all users
    const basicUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        status: users.status,
        created_at: users.created_at,
        last_login: users.last_login,
        is_online: users.is_online,
        subscription_plan: userSettings.subscription_plan,
        subscription_expiry: userSettings.subscription_expiry,
        gemini_api_key: userSettings.gemini_key,
        gemini_calls_count: userSettings.gemini_calls_count
      })
      .from(users)
      .leftJoin(userSettings, eq(users.id, userSettings.user_id))
      .all();
    
    // Now get all approved subscription payments
    const approvedPayments = await db
      .select()
      .from(subscriptionPayments)
      .where(eq(subscriptionPayments.status, "approved"))
      .all();
    
    // Create a map of user ID to their latest payment
    const userPaymentsMap = new Map();
    for (const payment of approvedPayments) {
      const existingPayment = userPaymentsMap.get(payment.user_id);
      // Keep only the most recent payment for each user
      if (!existingPayment || payment.created_at > existingPayment.created_at) {
        userPaymentsMap.set(payment.user_id, payment);
      }
    }
    
    // Enhance user data with payment information
    const now = Math.floor(Date.now() / 1000);
    const allUsers = basicUsers.map(user => {
      const payment = userPaymentsMap.get(user.id);
      
      // If there's a payment and either no subscription_plan or it doesn't match
      if (payment) {
        const duration = payment.duration_months || 1;
        const paymentTime = payment.updated_at || payment.created_at;
        const expiryDate = paymentTime + (duration * 30 * 24 * 60 * 60);
        const isExpired = expiryDate < now;
        
        // If payment exists and is not expired
        if (!isExpired) {
          return {
            ...user,
            has_payment: true,
            payment_id: payment.id,
            payment_plan: payment.subscription_plan,
            payment_expiry: expiryDate,
            payment_expired: false,
            needs_sync: user.subscription_plan !== payment.subscription_plan || 
                       (user.subscription_expiry || 0) < expiryDate
          };
        } else {
          // Payment exists but is expired
          return {
            ...user,
            has_payment: true,
            payment_id: payment.id,
            payment_plan: payment.subscription_plan,
            payment_expiry: expiryDate,
            payment_expired: true,
            needs_sync: false
          };
        }
      }
      
      // No payment
      return {
        ...user,
        has_payment: false,
        needs_sync: false
      };
    });
    
    // Return users in the format the client expects
    res.json({ users: allUsers });
    
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ 
      error: "Failed to fetch users",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Add a route to sync a user's subscription with their payment records
router.post('/:userId/sync-subscription', requireAuth, async (req: Request, res: Response) => {
  try {
    // Check if the authenticated user is an admin
    const adminUser = await db
      .select()
      .from(users)
      .where(and(eq(users.id, req.userId!), eq(users.role, "admin")))
      .get();
    
    if (!adminUser) {
      return res.status(403).json({ error: "Unauthorized access. Admin role required." });
    }
    
    const userId = parseInt(req.params.userId);
    
    // Check if user exists
    const userExists = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .get();
      
    if (!userExists) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // Import the subscriptionPayments table
    const { subscriptionPayments } = await import('../../shared/schema');
    
    console.log(`Syncing subscription for user ID: ${userId}`);
    
    // Find the latest approved payment for this user
    const latestPayment = await db
      .select()
      .from(subscriptionPayments)
      .where(and(
        eq(subscriptionPayments.user_id, userId),
        eq(subscriptionPayments.status, "approved")
      ))
      .orderBy(desc(subscriptionPayments.created_at))
      .limit(1)
      .get();
    
    if (!latestPayment) {
      console.log(`No approved payment found for user ID: ${userId}`);
      return res.status(404).json({ 
        error: "No approved payment found for this user",
        details: "User has no approved subscription payments"
      });
    }
    
    console.log(`Found payment record: ${JSON.stringify(latestPayment)}`);
    
    // Calculate the expiry date based on payment date and duration
    const now = Math.floor(Date.now() / 1000);
    const duration = latestPayment.duration_months || 1;
    
    // Calculate when payment was processed (created_at or updated_at)
    const paymentTime = latestPayment.updated_at || latestPayment.created_at;
    
    // Calculate expiry = payment time + duration in seconds (approximately month in seconds)
    const expiryDate = paymentTime + (duration * 30 * 24 * 60 * 60); 
    
    console.log(`Calculated expiry date: ${new Date(expiryDate * 1000).toISOString()}`);
    console.log(`Current time: ${new Date(now * 1000).toISOString()}`);
    
    // Check if payment is still valid (not expired)
    const isExpired = expiryDate < now;
    if (isExpired) {
      console.log(`Payment is expired for user ID: ${userId}`);
      return res.status(400).json({ 
        error: "Payment found but subscription has expired",
        details: `Subscription expired on ${new Date(expiryDate * 1000).toISOString()}`
      });
    }
    
    // Update user settings with the payment information
    const userSetting = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.user_id, userId))
      .get();
    
    if (userSetting) {
      // Update existing record
      console.log(`Updating existing user settings for user ID: ${userId}`);
      await db
        .update(userSettings)
        .set({
          subscription_plan: latestPayment.subscription_plan,
          subscription_expiry: expiryDate,
          updated_at: now
        })
        .where(eq(userSettings.user_id, userId));
    } else {
      // Create new record
      console.log(`Creating new user settings for user ID: ${userId}`);
      await db
        .insert(userSettings)
        .values({
          user_id: userId,
          subscription_plan: latestPayment.subscription_plan,
          subscription_expiry: expiryDate,
          created_at: now,
          updated_at: now
        });
    }
    
    res.json({
      success: true,
      message: `User subscription synced successfully to ${latestPayment.subscription_plan}`,
      user_id: userId,
      subscription_plan: latestPayment.subscription_plan,
      subscription_expiry: expiryDate,
      payment_id: latestPayment.id
    });
    
  } catch (error) {
    console.error("Error syncing user subscription:", error);
    res.status(500).json({ 
      error: "Failed to sync user subscription",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Reset Gemini API usage count (admin only)
router.post("/:id/reset-gemini-usage", requireAdmin, async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const now = Math.floor(Date.now() / 1000);
    
    // Get user settings
    const userSetting = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.user_id, userId))
      .get();
    
    if (userSetting) {
      // Update existing settings
      await db
        .update(userSettings)
        .set({ 
          gemini_calls_count: 0,
          updated_at: now
        })
        .where(eq(userSettings.user_id, userId));
    } else {
      // Create new settings if they don't exist
      await db
        .insert(userSettings)
        .values({
          user_id: userId,
          gemini_calls_count: 0,
          created_at: now,
          updated_at: now
        });
    }
    
    return res.json({
      success: true,
      message: "Gemini API usage count reset to zero"
    });
  } catch (error) {
    console.error("Error resetting Gemini API usage:", error);
    return res.status(500).json({ 
      error: "Failed to reset Gemini API usage",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export default router; 