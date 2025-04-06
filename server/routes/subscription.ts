import { Router, Request, Response } from "express";
import { db } from "../../shared/db";
import { 
  subscriptionPayments, userSettings, adminSettings, users, subscriptions
} from "../../shared/schema";
import { eq, and, desc, gte } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";
import { sql } from "drizzle-orm";
import { User } from "../../shared/schema";

// Extend Request to include user property
interface AuthRequest extends Request {
  userId?: number;
  user?: User;
}

const router = Router();

// Apply auth middleware to all routes
router.use(requireAuth);

// Get subscription status
router.get("/status", async (req: AuthRequest, res: Response) => {
  try {
    // Get admin settings for configuration
    const adminConfig = await db.select().from(adminSettings).limit(1).get();
    
    const userId = req.userId!;
    const now = Math.floor(Date.now() / 1000);
    
    // Get user settings for subscription status and API usage count
    const userSetting = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.user_id, userId))
      .get();
    
    if (!userSetting || !userSetting.is_pro || !userSetting.subscription_end_date || userSetting.subscription_end_date < now) {
      return res.json({
        subscription_plan: "free",
        is_pro: false,
        expiry_date: userSetting?.subscription_end_date || null,
        is_expired: userSetting?.subscription_end_date ? userSetting.subscription_end_date < now : false,
        max_free_calls: adminConfig?.gemini_max_free_calls || 5,
        used_calls: userSetting?.gemini_calls_count || 0
      });
    }
    
    res.json({
      subscription_plan: "pro",
      is_pro: true,
      expiry_date: userSetting.subscription_end_date,
      is_expired: false,
      max_free_calls: adminConfig?.gemini_max_free_calls || 5,
      used_calls: userSetting?.gemini_calls_count || 0
    });
  } catch (error) {
    console.error("Error checking subscription status:", error);
    res.status(500).json({ 
      error: "Failed to check subscription status",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Create a subscription (first step in the upgrade process)
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    console.log("Creating subscription with data:", req.body);
    const { plan = "pro", auto_renew = false } = req.body;
    const userId = req.userId!;
    
    // Calculate dates
    const now = Math.floor(Date.now() / 1000);
    const durationDays = plan === "pro" ? 30 : 0; // 30 days for pro plan
    const endDate = now + (durationDays * 24 * 60 * 60);
    
    // Create subscription with pending status
    const result = await db.insert(subscriptions).values({
      user_id: userId,
      plan: plan,
      status: "pending", // Payment must be approved to become active
      start_date: now,
      end_date: endDate,
      auto_renew: auto_renew,
      created_at: now,
      updated_at: now
    }).returning();
    
    console.log("Subscription created:", result);
    
    if (result && result.length > 0) {
      return res.status(201).json(result[0]);
    } else {
      throw new Error("Failed to create subscription");
    }
  } catch (error) {
    console.error("Error creating subscription:", error);
    return res.status(500).json({ 
      error: "Failed to create subscription",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Get current user's active subscription
router.get("/user", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const now = Math.floor(Date.now() / 1000);
    
    // Get user's active subscription
    const subscription = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.user_id, userId),
          eq(subscriptions.status, "active"),
          gte(subscriptions.end_date, now)
        )
      )
      .get();
    
    if (subscription) {
      return res.json(subscription);
    } else {
      return res.json({ status: "no_subscription" });
    }
  } catch (error) {
    console.error("Error getting user subscription:", error);
    return res.status(500).json({ 
      error: "Failed to get subscription",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Create a payment for subscription
router.post("/payment", async (req: AuthRequest, res: Response) => {
  try {
    console.log("Creating payment with data:", req.body);
    const {
      amount,
      currency,
      transaction_id,
      deposited_by,
      deposited_date,
      payment_method = "bank_transfer",
      notes
    } = req.body;
    
    const userId = req.userId!;
    const now = Math.floor(Date.now() / 1000);
    
    // Create the payment record - don't include subscription_id field
    const result = await db.insert(subscriptionPayments).values({
      user_id: userId,
      amount: amount,
      currency: currency,
      transaction_id: transaction_id,
      deposited_by: deposited_by,
      deposited_date: deposited_date,
      payment_method: payment_method,
      status: "pending", // All payments start as pending
      notes: notes,
      created_at: now,
      updated_at: now
    }).returning();
    
    console.log("Payment created:", result);
    
    if (result && result.length > 0) {
      return res.status(201).json(result[0]);
    } else {
      throw new Error("Failed to create payment");
    }
  } catch (error) {
    console.error("Error creating payment:", error);
    return res.status(500).json({ 
      error: "Failed to create payment",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Approve a payment and activate pro status (admin only)
router.post("/payments/:id/approve", requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const paymentId = parseInt(req.params.id);
    
    // Begin transaction
    await db.transaction(async (tx) => {
      // 1. Get the payment with user information
      const payment = await tx
        .select({
          payment: subscriptionPayments,
          user: {
            id: users.id,
            email: users.email
          }
        })
        .from(subscriptionPayments)
        .leftJoin(users, eq(subscriptionPayments.user_id, users.id))
        .where(eq(subscriptionPayments.id, paymentId))
        .get();
      
      if (!payment || !payment.payment) {
        throw new Error("Payment not found");
      }
      
      const now = Math.floor(Date.now() / 1000);
      const monthInSeconds = 30 * 24 * 60 * 60; // 30 days
      
      // 2. Update payment status to approved
      await tx
        .update(subscriptionPayments)
        .set({ 
          status: "approved",
          updated_at: now
        })
        .where(eq(subscriptionPayments.id, paymentId));
      
      // 3. Update user settings to pro
      // Get admin settings to check subscription duration
      const adminConfig = await tx.select().from(adminSettings).limit(1).get();
      
      // Get current user settings
      const userSetting = await tx
        .select()
        .from(userSettings)
        .where(eq(userSettings.user_id, payment.payment.user_id))
        .get();
      
      // Calculate end date - either extend current subscription or start new one
      let newEndDate = now + monthInSeconds; // Default 30 days
      
      if (userSetting && userSetting.is_pro && userSetting.subscription_end_date && userSetting.subscription_end_date > now) {
        // If user already has an active subscription, extend it
        newEndDate = userSetting.subscription_end_date + monthInSeconds;
        console.log(`Extending existing subscription until ${new Date(newEndDate * 1000)}`);
      } else {
        console.log(`New subscription until ${new Date(newEndDate * 1000)}`);
      }
      
      // Update user settings
      if (userSetting) {
        await tx
          .update(userSettings)
          .set({ 
            is_pro: true,
            subscription_start_date: now,
            subscription_end_date: newEndDate,
            gemini_calls_count: 0, // Reset API usage
            updated_at: now
          })
          .where(eq(userSettings.user_id, payment.payment.user_id));
      } else {
        // If user settings don't exist (unlikely), create them
        await tx
          .insert(userSettings)
          .values({
            user_id: payment.payment.user_id,
            is_pro: true,
            subscription_start_date: now,
            subscription_end_date: newEndDate,
            gemini_calls_count: 0,
            created_at: now,
            updated_at: now
          });
      }
      
      console.log(`User ${payment.payment.user_id} (${payment.user?.email}) is now PRO until ${new Date(newEndDate * 1000)}`);
    });
    
    return res.json({ 
      success: true, 
      message: "Payment approved and PRO status activated"
    });
  } catch (error) {
    console.error("Error approving payment:", error);
    return res.status(500).json({ 
      error: "Failed to approve payment",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Reject a payment (admin only)
router.post("/payments/:id/reject", requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const paymentId = parseInt(req.params.id);
    const { reason } = req.body;
    
    // Update payment status to rejected
    await db
      .update(subscriptionPayments)
      .set({ 
        status: "rejected",
        notes: reason ? `${subscriptionPayments.notes ? subscriptionPayments.notes + '; ' : ''}Rejected: ${reason}` : subscriptionPayments.notes,
        updated_at: Math.floor(Date.now() / 1000)
      })
      .where(eq(subscriptionPayments.id, paymentId));
    
    return res.json({ 
      success: true, 
      message: "Payment rejected"
    });
  } catch (error) {
    console.error("Error rejecting payment:", error);
    return res.status(500).json({ 
      error: "Failed to reject payment",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// ADMIN ROUTES

// Get all subscription payments (admin only)
router.get("/payments", requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const payments = await db
      .select({
        payment: subscriptionPayments,
        user: {
          name: users.name,
          email: users.email
        }
      })
      .from(subscriptionPayments)
      .leftJoin(users, eq(subscriptionPayments.user_id, users.id))
      .orderBy(desc(subscriptionPayments.created_at));
    
    return res.json(payments);
  } catch (error) {
    console.error("Error getting payments:", error);
    return res.status(500).json({ 
      error: "Failed to get payments",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Subscription plans routes for admins
router.get("/plans", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    // Instead of querying the database, return a default set of plans
    // This is a simplified approach since we're not using subscription plans
    const defaultPlans = [
      {
        id: 1,
        name: "Pro Monthly",
        price: 19.99,
        duration_months: 1,
        description: "Unlimited AI features and premium support",
        features: "Unlimited AI calls, Priority support, All features",
        is_active: true,
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000)
      }
    ];
    
    res.json(defaultPlans);
  } catch (error) {
    console.error("Error fetching subscription plans:", error);
    res.status(500).json({ 
      error: "Failed to fetch subscription plans",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Admin route to create a new plan
router.post("/plans", requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const isAdmin = req.user?.role === "admin";
    if (!isAdmin) {
      return res.status(403).json({ error: "Access denied. Admin privileges required." });
    }
    
    // Return a dummy response since we're not actually storing plans
    const now = Math.floor(Date.now() / 1000);
    const planData = {
      id: 2, // Generate a fake ID
      name: req.body.name,
      price: req.body.price,
      duration_months: req.body.duration_months,
      description: req.body.description || null,
      features: req.body.features || null,
      is_active: typeof req.body.is_active === 'boolean' ? req.body.is_active : true,
      created_at: now,
      updated_at: now
    };
    
    console.log(`New subscription plan created: ${planData.name} (simulated)`);
    res.status(201).json(planData);
  } catch (error) {
    console.error("Error creating subscription plan:", error);
    res.status(500).json({ 
      error: "Failed to create subscription plan",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Admin route to update a plan
router.patch("/plans/:id", requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const isAdmin = req.user?.role === "admin";
    if (!isAdmin) {
      return res.status(403).json({ error: "Access denied. Admin privileges required." });
    }
    
    const planId = parseInt(req.params.id);
    const updateData: any = {
      updated_at: Math.floor(Date.now() / 1000)
    };
    
    // Only include fields that are provided
    if (req.body.name) updateData.name = req.body.name;
    if (typeof req.body.price === 'number') updateData.price = req.body.price;
    if (typeof req.body.duration_months === 'number') updateData.duration_months = req.body.duration_months;
    if (req.body.description !== undefined) updateData.description = req.body.description;
    if (req.body.features !== undefined) updateData.features = req.body.features;
    if (typeof req.body.is_active === 'boolean') updateData.is_active = req.body.is_active;
    
    // Return a simulated response
    const updatedPlan = {
      id: planId,
      name: req.body.name || "Updated Plan",
      price: req.body.price || 19.99,
      duration_months: req.body.duration_months || 1,
      description: req.body.description || null,
      features: req.body.features || null,
      is_active: typeof req.body.is_active === 'boolean' ? req.body.is_active : true,
      created_at: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      updated_at: Math.floor(Date.now() / 1000)
    };
    
    console.log(`Subscription plan ${planId} updated (simulated)`);
    res.json(updatedPlan);
  } catch (error) {
    console.error("Error updating subscription plan:", error);
    res.status(500).json({ 
      error: "Failed to update subscription plan",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Admin route for manually granting Pro status
router.post("/grant-pro/:userId", requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const { duration = 30 } = req.body; // Duration in days, default to 30
    
    const now = Math.floor(Date.now() / 1000);
    const endDate = now + (duration * 24 * 60 * 60);
    
    // Get current user settings
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
          is_pro: true,
          subscription_start_date: now,
          subscription_end_date: endDate,
          updated_at: now
        })
        .where(eq(userSettings.user_id, userId));
    } else {
      // Create new settings if they don't exist
      await db
        .insert(userSettings)
        .values({
          user_id: userId,
          is_pro: true,
          subscription_start_date: now,
          subscription_end_date: endDate,
          created_at: now,
          updated_at: now
        });
    }
    
    return res.json({
      success: true,
      message: `Pro status granted until ${new Date(endDate * 1000).toISOString()}`
    });
  } catch (error) {
    console.error("Error granting pro status:", error);
    return res.status(500).json({ 
      error: "Failed to grant pro status",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Admin route for revoking Pro status
router.post("/revoke-pro/:userId", requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    
    // Update user settings
    await db
      .update(userSettings)
      .set({ 
        is_pro: false,
        subscription_end_date: Math.floor(Date.now() / 1000), // Set to current time (expired)
        updated_at: Math.floor(Date.now() / 1000)
      })
      .where(eq(userSettings.user_id, userId));
    
    return res.json({
      success: true,
      message: "Pro status revoked"
    });
  } catch (error) {
    console.error("Error revoking pro status:", error);
    return res.status(500).json({ 
      error: "Failed to revoke pro status",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export default router; 