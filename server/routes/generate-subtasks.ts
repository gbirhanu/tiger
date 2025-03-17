import { Router, Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "../../shared/db";
import { userSettings } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

// Apply auth middleware
router.use(requireAuth);

// Fallback API key (will be used only if user doesn't have their own key)
const FALLBACK_GEMINI_API_KEY = "AIzaSyAPNehyjmuB15YYzvq2yhbDiI8769TLChE";
if (!FALLBACK_GEMINI_API_KEY) {
  console.error("FALLBACK_GEMINI_API_KEY is not set in environment variables");
}

router.post("/generate-subtasks", async (req: Request, res: Response) => {
  console.log("req.body", req.body);
  try {
    // Get user's Gemini API key from settings
    const userSetting = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.user_id, req.userId!))
      .get();
    
    // Use user's key if available, otherwise use fallback
    const GEMINI_API_KEY = userSetting?.gemini_key || FALLBACK_GEMINI_API_KEY;
    
    console.log("Using Gemini API key:", GEMINI_API_KEY ? "Key is set" : "No key available");
    
    // Verify API key is available
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ 
        error: "Gemini API key is not configured",
        details: "Please set your Gemini API key in Settings"
      });
    }

    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    // Initialize Gemini API with the appropriate key
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    
    // Get the generative model
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Check if this is a request for markdown content generation
    const isMarkdownRequest = prompt.toLowerCase().includes("markdown") || 
                             prompt.toLowerCase().includes("generate a detailed note");

    // Create a more specific prompt for better results
    let enhancedPrompt = prompt;
    if (isMarkdownRequest) {
      enhancedPrompt = `${prompt}
      
      Please format your response as clean Markdown with:
      1. A clear title using # heading
      2. An introduction paragraph
      3. Several ## subheadings for key sections
      4. Bullet points using - for lists where appropriate
      5. Code blocks with proper syntax highlighting if relevant
      6. A brief conclusion
      
      Make the content informative, accurate, and well-structured.`;
    }

    console.log("Enhanced prompt:", enhancedPrompt);
    
    // Generate content
    const result = await model.generateContent(enhancedPrompt);
    const response = await result.response;
    let text = response.text();

    console.log("Raw text from Gemini:", text.substring(0, 200) + "...");
    
    // Clean up the response text
    // For markdown requests, preserve the formatting
    if (!isMarkdownRequest) {
      // Remove any JSON formatting characters if present
      text = text
        .replace(/^\s*\[|\]\s*$/g, '') // Remove opening/closing brackets
        .replace(/"/g, '') // Remove quotes
        .replace(/,\s*/g, '\n') // Replace commas with newlines
        .replace(/\\n/g, '\n'); // Replace escaped newlines
    }
    
    console.log("Cleaned text (first 200 chars):", text.substring(0, 200) + "...");

    res.json({ subtasks: text });
  } catch (error) {
    console.error("Error generating subtasks:", error);
    res.status(500).json({ 
      error: "Failed to generate subtasks",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export default router; 