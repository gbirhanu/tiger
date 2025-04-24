import { Router, Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { requireAuth } from "../lib/auth";
import { db } from "../../shared/db";
import { userSettings, adminSettings, subscriptions } from "../../shared/schema";
import { eq, and, gte } from "drizzle-orm";

const router = Router();

// Apply auth middleware
router.use(requireAuth);

// Fallback API key (will be used only if user doesn't have their own key)
const FALLBACK_GEMINI_API_KEY = process.env.GEMINI_API_KEY 

// Generate content endpoint
router.post("/", async (req: Request, res: Response) => {
  try {
    // Get user's settings to check subscription status and usage
    const userSetting = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.user_id, req.userId!))
      .get();
    
    // Get admin settings for max free calls and marketing
    const adminSetting = await db
      .select()
      .from(adminSettings)
      .limit(1)
      .get();
    
    // Get user's subscription status
    const now = Math.floor(Date.now() / 1000);
    const userSubscription = await db
      .select({
        plan: subscriptions.plan,
        status: subscriptions.status,
        end_date: subscriptions.end_date
      })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.user_id, req.userId!),
          eq(subscriptions.status, 'active'),
          gte(subscriptions.end_date, now)
        )
      )
      .get();
    
    const isPro = userSubscription?.plan === 'pro';
    
    // Default values from admin settings or hardcoded fallbacks
    const maxFreeCalls = adminSetting?.gemini_max_free_calls || 5;
    const enableMarketing = adminSetting?.enable_marketing || false;
    
    // Check if user has their own Gemini key - users with their own keys don't need to upgrade
    const hasOwnGeminiKey = !!userSetting?.gemini_key;
    
    // Only enforce limits if marketing is enabled AND user doesn't have their own key
    const shouldEnforceLimits = enableMarketing && !hasOwnGeminiKey;
    
    if (shouldEnforceLimits && userSetting) {
      // If not on pro plan, check usage limit
      if (!isPro) {
        const currentUsage = userSetting.gemini_calls_count || 0;
        
        // Strict comparison to ensure we don't exceed the limit
        if (currentUsage >= maxFreeCalls) {
          return res.status(403).json({
            error: "Usage limit reached",
            code: "USAGE_LIMIT_REACHED",
            details: `You've reached your free limit of ${maxFreeCalls} Gemini API calls. Please upgrade to Pro to continue using AI features.`,
            showUpgrade: true,
            maxFreeCalls,
            currentUsage
          });
        }
      }
    }
    
   
    
    // Use user's key if available, otherwise use fallback
    const GEMINI_API_KEY = userSetting?.gemini_key || FALLBACK_GEMINI_API_KEY;
    
    // Verify API key is available
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ 
        error: "Gemini API key is not configured",
        details: "Please set your Gemini API key in Settings or contact an administrator"
      });
    }

    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    // Initialize Gemini API with the appropriate key
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    
    // Get the generative model
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    // Generate content
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();
    
    // IMPORTANT: Always increment the counter for ALL users (except pro with valid subscription)
    try {
      // Determine if we should increment the counter
      // Only increment counter if marketing features are enabled, or if user is pro
      const shouldIncrement = shouldEnforceLimits && !isPro;
      
      if (shouldIncrement) {
        if (userSetting) {
          // User exists - update their count
          const currentCount = userSetting.gemini_calls_count || 0;
          const newCount = currentCount + 1;
          
          await db
            .update(userSettings)
            .set({ 
              gemini_calls_count: newCount,
              updated_at: Math.floor(Date.now() / 1000)
            })
            .where(eq(userSettings.user_id, req.userId!));
        } 
      }
    } catch (countError) {
      // Continue processing request despite counter error
    }
    
    // Clean up the response text
    text = text
      .replace(/^\s*\[|\]\s*$/g, '') // Remove opening/closing brackets
      .replace(/"/g, '') // Remove quotes
      .replace(/,\s*/g, '\n') // Replace commas with newlines
      .replace(/\\n/g, '\n'); // Replace escaped newlines

    res.json({ text });
  } catch (error) {
    res.status(500).json({ 
      error: "Failed to generate content",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export default router; 