import { Router, Request, Response } from "express";
import { db } from "../../shared/db";
import {
  pomodoroSettings,
  insertPomodoroSettingsSchema,
} from "../../shared/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { z } from "zod";

const router = Router();

// Apply auth middleware to all routes
router.use(requireAuth);

// Default pomodoro settings
const DEFAULT_POMODORO_SETTINGS = {
  work_duration: 25,
  break_duration: 5,
  long_break_duration: 15,
  sessions_before_long_break: 4
};

/**
 * Get pomodoro settings for the authenticated user
 * Returns default settings if none exist
 */
router.get("/pomodoro", async (req: Request, res: Response) => {
  try {
    // Find pomodoro settings for the authenticated user
    const userSettings = await db
      .select()
      .from(pomodoroSettings)
      .where(eq(pomodoroSettings.user_id, req.userId!))
      .get();

    if (userSettings) {
      return res.json(userSettings);
    } else {
      // Return default settings if none exist for this user
      return res.json({
        ...DEFAULT_POMODORO_SETTINGS,
        user_id: req.userId
      });
    }
  } catch (error) {
    console.error("Error fetching pomodoro settings:", error);
    return res.status(500).json({ 
      error: "Failed to fetch pomodoro settings",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Create new pomodoro settings for the authenticated user
 */
router.post("/pomodoro", async (req: Request, res: Response) => {
  try {
    // Validate request data using Zod schema
    const validationResult = insertPomodoroSettingsSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: "Invalid pomodoro settings data",
        details: validationResult.error.errors
      });
    }

    // Check if user already has settings
    const existingSettings = await db
      .select()
      .from(pomodoroSettings)
      .where(eq(pomodoroSettings.user_id, req.userId!))
      .get();

    if (existingSettings) {
      return res.status(409).json({ 
        error: "Pomodoro settings already exist for this user",
        message: "Use PUT or PATCH to update existing settings"
      });
    }

    // Create new settings
    const settingsData = {
      ...validationResult.data,
      user_id: req.userId!
    };

    const newSettings = await db
      .insert(pomodoroSettings)
      .values(settingsData)
      .returning()
      .get();

    return res.status(201).json(newSettings);
  } catch (error) {
    console.error("Error creating pomodoro settings:", error);
    return res.status(500).json({ 
      error: "Failed to create pomodoro settings",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Update all pomodoro settings for the authenticated user
 * Creates settings if none exist
 */
router.put("/pomodoro", async (req: Request, res: Response) => {
  try {
    // Validate request data using Zod schema
    const validationResult = insertPomodoroSettingsSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: "Invalid pomodoro settings data",
        details: validationResult.error.errors
      });
    }

    // Check if user already has settings
    const existingSettings = await db
      .select()
      .from(pomodoroSettings)
      .where(eq(pomodoroSettings.user_id, req.userId!))
      .get();

    if (existingSettings) {
      // Update existing settings
      const settingsData = {
        ...validationResult.data,
        updated_at: Math.floor(Date.now() / 1000)  
      };

      const updatedSettings = await db
        .update(pomodoroSettings)
        .set(settingsData)
        .where(eq(pomodoroSettings.user_id, req.userId!))
        .returning()
        .get();

      return res.json(updatedSettings);
    } else {
      // Create new settings if none exist
      const settingsData = {
        ...validationResult.data,
        user_id: req.userId!
      };

      const newSettings = await db
        .insert(pomodoroSettings)
        .values(settingsData)
        .returning()
        .get();

      return res.status(201).json(newSettings);
    }
  } catch (error) {
    console.error("Error updating pomodoro settings:", error);
    return res.status(500).json({ 
      error: "Failed to update pomodoro settings",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Partially update pomodoro settings for the authenticated user
 * Creates settings with defaults + updates if none exist
 */
router.patch("/pomodoro", async (req: Request, res: Response) => {
  try {
    // Validate request data using Zod schema
    const validationResult = insertPomodoroSettingsSchema.partial().safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: "Invalid pomodoro settings data",
        details: validationResult.error.errors
      });
    }

    // Check if user already has settings
    const existingSettings = await db
      .select()
      .from(pomodoroSettings)
      .where(eq(pomodoroSettings.user_id, req.userId!))
      .get();

    if (existingSettings) {
      // Update existing settings with just the fields provided
      const settingsData = {
        ...validationResult.data,
        updated_at: Math.floor(Date.now() / 1000)
      };

      const updatedSettings = await db
        .update(pomodoroSettings)
        .set(settingsData)
        .where(eq(pomodoroSettings.user_id, req.userId!))
        .returning()
        .get();

      return res.json(updatedSettings);
    } else {
      // Create new settings with defaults + provided values
      const settingsData = {
        ...DEFAULT_POMODORO_SETTINGS,
        ...validationResult.data,
        user_id: req.userId!
      };

      const newSettings = await db
        .insert(pomodoroSettings)
        .values(settingsData)
        .returning()
        .get();

      return res.status(201).json(newSettings);
    }
  } catch (error) {
    console.error("Error updating pomodoro settings:", error);
    return res.status(500).json({ 
      error: "Failed to update pomodoro settings",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Delete pomodoro settings for the authenticated user
 */
router.delete("/pomodoro", async (req: Request, res: Response) => {
  try {
    // Check if user has settings
    const existingSettings = await db
      .select()
      .from(pomodoroSettings)
      .where(eq(pomodoroSettings.user_id, req.userId!))
      .get();

    if (!existingSettings) {
      return res.status(404).json({ 
        error: "Pomodoro settings not found" 
      });
    }

    // Delete the settings
    await db
      .delete(pomodoroSettings)
      .where(eq(pomodoroSettings.user_id, req.userId!));

    return res.json({ 
      success: true,
      message: "Pomodoro settings deleted successfully" 
    });
  } catch (error) {
    console.error("Error deleting pomodoro settings:", error);
    return res.status(500).json({ 
      error: "Failed to delete pomodoro settings",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export default router;

