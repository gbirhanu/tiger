import { Router, Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { requireAuth } from "../lib/auth";
import { db } from "../../shared/db";
import { userSettings, adminSettings, subscriptions } from "../../shared/schema";
import { eq, and, gte } from "drizzle-orm";

const router = Router();

// Apply auth middleware - only need it once
router.use(requireAuth);

// Fallback API key (will be used only if user doesn't have their own key)
const FALLBACK_GEMINI_API_KEY = process.env.GEMINI_API_KEY 

// Generate subtasks endpoint
router.post("/", async (req: Request, res: Response) => {
  try {
    // Check for user ID first - this should be set by the requireAuth middleware
    if (!req.userId) {
      return res.status(401).json({
        error: "Authentication required - no user ID",
        subtasks: []
      });
    }
    
    // Validate the request body
    const { task, count = 5 } = req.body;
    
    if (!task || !task.title) {
      return res.status(400).json({ 
        error: "Task details are required", 
        subtasks: [] // Include empty subtasks array to prevent client-side errors
      });
    }

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
            currentUsage,
            subtasks: [] // Include empty subtasks array to prevent client-side errors
          });
        }
      }
    }
    
    // If the user doesn't exist yet, create a user settings record
    if (!userSetting) {
      await db.insert(userSettings).values({
        user_id: req.userId!,
        gemini_calls_count: 0,
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000)
      });
    }
    
    // Use user's key if available, otherwise use fallback
    const GEMINI_API_KEY = userSetting?.gemini_key || FALLBACK_GEMINI_API_KEY;
    
    // Verify API key is available
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ 
        error: "Gemini API key is not configured", 
        details: "Please set your Gemini API key in Settings",
        subtasks: [] // Include empty subtasks array to prevent client-side errors
      });
    }

    // Ensure safe task title and description access
    const taskTitle = task.title || "Untitled Task";
    const taskDescription = task.description || "";

    // Initialize Gemini API with the appropriate key
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    
    // Get the generative model - prioritize 1.5 Pro if available
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    
    // Create a prompt for generating subtasks
    const prompt = `
      Please generate ${count} specific, actionable subtasks for the following task: "${taskTitle}".
      
      ${taskDescription ? `Additional task context: "${taskDescription}"` : ''}
      
      Each subtask should:
      1. Be clear and specific
      2. Be actionable (start with a verb when possible)
      3. Be reasonable in scope (completable in one sitting)
      4. Collectively help complete the main task
      5. Be of similar scale/scope to each other
      
      Format your response as a simple array of strings, e.g. ["Subtask 1", "Subtask 2"]. 
      DO NOT include any numbering, additional formatting, or explanation.
    `;
    
    
    // Generate content
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      let text = response.text();
      
      
      // Try to parse the response as JSON array
      try {
        // First, process text to ensure it's in valid JSON format:
        // 1. Strip any markdown code blocks if present
        text = text.replace(/```json\s*|\s*```/g, '');
        // 2. Ensure we have square brackets
        text = text.trim();
        if (!text.startsWith('[')) text = '[' + text;
        if (!text.endsWith(']')) text = text + ']';
        
        
        // Parse as JSON
        const subtasks = JSON.parse(text);
        
        
        
        if (!Array.isArray(subtasks)) {
          throw new Error("Response is not an array");
        }
        
        // IMPORTANT: Always increment the counter for ALL users (except pro with valid subscription)
        try {
          // Determine if we should increment the counter
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
            } else {
              // Create new user settings
              await db.insert(userSettings).values({
                user_id: req.userId!,
                gemini_calls_count: 1,
                created_at: Math.floor(Date.now() / 1000),
                updated_at: Math.floor(Date.now() / 1000)
              });
            }
          }
        } catch (countError) {
          // Continue processing request despite counter error
        }
        
        
        res.json({ subtasks });
      } catch (parseError) {
        // If parsing fails, return the raw text
        const fallbackSubtasks = text.replace(/^\[|\]$/g, '').split('\n').map(s => s.trim()).filter(Boolean);
        
        // Increment counter despite the parse error
        try {
          if (shouldEnforceLimits && !isPro && userSetting) {
            const currentCount = userSetting.gemini_calls_count || 0;
            await db
              .update(userSettings)
              .set({ 
                gemini_calls_count: currentCount + 1,
                updated_at: Math.floor(Date.now() / 1000)
              })
              .where(eq(userSettings.user_id, req.userId!));
          }
        } catch (countError) {
          // Ignore counter errors, still provide response
        }
        
        const finalSubtasks = fallbackSubtasks.length > 0 ? fallbackSubtasks : ["Review task details", "Organize resources", "Create outline", "Implement solution", "Test results"];
        
       
        
        res.json({ subtasks: finalSubtasks });
      }
    } catch (generationError) {
      // Provide fallback subtasks
      const fallbackSubtasks = ["Review task details", "Organize resources", "Create outline", "Implement solution", "Test results"];
      
      
      res.json({ 
        subtasks: fallbackSubtasks,
        error: "Failed to generate personalized subtasks" 
      });
    }
  } catch (error) {
    res.status(500).json({ 
      error: "Failed to generate subtasks",
      details: error instanceof Error ? error.message : "Unknown error",
      subtasks: ["Review task details", "Organize resources", "Create outline", "Implement solution", "Test results"]
    });
  }
});

export default router; 