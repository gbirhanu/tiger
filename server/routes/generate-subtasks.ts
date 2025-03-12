import { Router, Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = Router();

// Check for API key
const GEMINI_API_KEY = "AIzaSyAPNehyjmuB15YYzvq2yhbDiI8769TLChE"
if (!GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is not set in environment variables");
}

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || '');

router.post("/generate-subtasks", async (req: Request, res: Response) => {
  console.log("req.body", req.body)
  try {
    console.log("GEMINI_API_KEY", GEMINI_API_KEY)
    // Verify API key is available
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ 
        error: "Gemini API key is not configured",
        details: "Please set the GEMINI_API_KEY environment variable"
      });
    }

    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    // Get the generative model
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    console.log(prompt)
    // Generate content
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log("text", text)

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