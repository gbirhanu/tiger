import { Router, Request, Response } from "express";
import { db } from "../../shared/db";
import { 
  tasks, notes, appointments, meetings, pomodoroSettings, userSettings, subtasks,
  type Task, type Subtask,
  insertNoteSchema, longNotes, insertLongNoteSchema, type UserSettings, adminSettings, subscriptions, users
} from "../../shared/schema";
import { eq, sql, and, gte, desc } from "drizzle-orm";
import { z } from "zod";
import { addDays, addWeeks, addMonths, addYears } from "date-fns";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { requireAuth, requireAdmin } from "../lib/auth";

const router = Router();

// Apply auth middleware to all routes
router.use(requireAuth);

// Task validation schema
const taskSchema = z.object({
  user_id: z.number(),
  title: z.string().min(1),
  description: z.string().nullable(),
  priority: z.enum(["low", "medium", "high"]),
  completed: z.boolean(),
  due_date: z.number().nullable(),
  all_day: z.boolean(),
  recurrence_end_date: z.number().nullable(),
  recurrence_pattern: z.enum(["daily", "weekly", "monthly", "yearly"]).nullable(),
  recurrence_interval: z.number().nullable(),
  is_recurring: z.boolean(),
  parent_task_id: z.number().nullable(),
});

// Add helper function to calculate next occurrence
function getNextOccurrence(date: Date, pattern: string, interval: number): Date {
  switch (pattern) {
    case "daily":
      return addDays(date, interval);
    case "weekly":
      return addWeeks(date, interval);
    case "monthly":
      return addMonths(date, interval);
    case "yearly":
      return addYears(date, interval);
    default:
      throw new Error("Invalid recurrence pattern");
  }
}

// Check for API key
const GEMINI_API_KEY = "AIzaSyAPNehyjmuB15YYzvq2yhbDiI8769TLChE"
if (!GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is not set in environment variables");
}

// Tasks
router.get("/tasks", requireAuth, async (req: Request, res: Response) => {
  try {
    // Get all tasks for the current user
    
    const allTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.user_id, req.userId!));
    // Get all tasks that have subtasks and their completion counts
    const tasksWithSubtasks = await db
      .select({
        task_id: subtasks.task_id,
        total_subtasks: sql<number>`count(*)`,
        completed_subtasks: sql<number>`sum(case when ${subtasks.completed} = 1 then 1 else 0 end)`,
      })
      .from(subtasks)
      .innerJoin(tasks, eq(tasks.id, subtasks.task_id))
      .where(eq(tasks.user_id, req.userId!))
      .groupBy(subtasks.task_id);
    
    // Create a Map for efficient lookup of subtask info
    const subtasksMap = new Map(
      tasksWithSubtasks.map(t => [t.task_id, {
        has_subtasks: true,
        total_subtasks: Number(t.total_subtasks),
        completed_subtasks: Number(t.completed_subtasks),
      }])
    );
    
    // Map the tasks to include the has_subtasks property and handle dates
    const tasksWithSubtasksInfo = allTasks.map(task => {
      const subtaskInfo = subtasksMap.get(task.id) || { 
        has_subtasks: false,
        total_subtasks: 0,
        completed_subtasks: 0,
      };

      return {
        ...task,
        due_date: task.due_date ? Number(task.due_date) : null,
        recurrence_end_date: task.recurrence_end_date ? Number(task.recurrence_end_date) : null,
        ...subtaskInfo,
      };
    });

    res.json(tasksWithSubtasksInfo);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

// Route to get all tasks that have subtasks
router.get("/tasks/subtasks", requireAuth, async (_req: Request, res: Response) => {
  try {
    // Get all tasks that have subtasks
    const tasksWithSubtasks = await db
      .select({
        task_id: subtasks.task_id,
      })
      .from(subtasks)
      .groupBy(subtasks.task_id);
    
    // Extract just the task IDs that have subtasks
    const taskIdsWithSubtasks = tasksWithSubtasks.map(item => item.task_id);
    
    // Return as a proper JSON array
    res.json(taskIdsWithSubtasks);
  } catch (error) {
    console.error("Error fetching tasks with subtasks:", error);
    res.status(500).json({ error: "Failed to fetch tasks with subtasks" });
  }
});

// Route to get a specific task
router.get("/tasks/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.id);
    const task = await db.select().from(tasks).where(eq(tasks.id, taskId));
    
    if (task.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }
    
    res.json(task[0]);
  } catch (error) {
    console.error("Error fetching task:", error);
    res.status(500).json({ error: "Failed to fetch task" });
  }
});

router.post("/tasks", requireAuth, async (req: Request, res: Response) => {
  try {
    // Log incoming data for debugging
    
    
    // Validate and parse the task data
    const result = taskSchema.safeParse({
      ...req.body,
      user_id: req.userId!,
      // Ensure timestamps are in Unix format (seconds)
      due_date: req.body.due_date ? Math.floor(Number(req.body.due_date)) : null,
      recurrence_end_date: req.body.recurrence_end_date ? Math.floor(Number(req.body.recurrence_end_date)) : null
    });

    if (!result.success) {
      return res.status(400).json({ 
        error: "Invalid task data", 
        details: result.error.errors 
      });
    }

    // Convert boolean values to SQLite integers and prepare task values
    const taskValues = {
      ...result.data,
      // SQLite boolean fields need to be passed as booleans, not 0/1 integers
      // Other fields come correctly from the schema validation
    };
    
    
    
    const task = await db.insert(tasks).values(taskValues).returning().get();
    res.json(task);
  } catch (error) {
    console.error("Error creating task:", error);
    res.status(500).json({ error: "Failed to create task" });
  }
});

router.put("/tasks/:id", requireAuth, async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    
     
    // Check if task exists
    const existingTask = await db.select().from(tasks).where(eq(tasks.id, taskId));
    if (existingTask.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    // Get user's timezone from settings
    const userSetting = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.user_id, req.userId!))
      .get();

    const userTimezone = userSetting?.timezone || 'UTC';
    
    // Create a clean update object with just the properties we want to update
    const updateData: any = {
      updated_at: sql`datetime('now')` // Use the server's time - SQLite will convert to UTC
    };
    
    // Only include properties that are explicitly provided
    if ('completed' in req.body) {
      updateData.completed = req.body.completed === true;
    }
    if ('title' in req.body) updateData.title = req.body.title;
    if ('description' in req.body) updateData.description = req.body.description;
    if ('priority' in req.body) updateData.priority = req.body.priority;
    if ('due_date' in req.body) {
      updateData.due_date = req.body.due_date ? Math.floor(Number(req.body.due_date)) : null;
    }
    
    // Handle recurring task data with validation
    const isRecurring = 'is_recurring' in req.body ? req.body.is_recurring === true : existingTask[0].is_recurring;
    
    // Get recurrence pattern, considering both the request and existing data
    let recurrencePattern = existingTask[0].recurrence_pattern;
    if ('recurrence_pattern' in req.body) {
      recurrencePattern = req.body.recurrence_pattern;
    }
    
    // Validate recurrence data
    if (isRecurring) {
      // If task is recurring, ensure recurrence_pattern is valid
      const validPatterns = ['daily', 'weekly', 'monthly', 'yearly'];
      if (!recurrencePattern || !validPatterns.includes(recurrencePattern)) {
        return res.status(400).json({ 
          error: "Invalid recurrence pattern", 
          details: "Recurrence pattern must be one of: daily, weekly, monthly, yearly" 
        });
      }
      
      // Set recurrence fields
      updateData.is_recurring = true;
      updateData.recurrence_pattern = recurrencePattern;
      
      // Handle recurrence interval
      if ('recurrence_interval' in req.body) {
        updateData.recurrence_interval = req.body.recurrence_interval;
      } else if (!existingTask[0].recurrence_interval) {
        // Default to 1 if not provided
        updateData.recurrence_interval = 1;
      }
      
      // Handle recurrence end date
      if ('recurrence_end_date' in req.body) {
        updateData.recurrence_end_date = req.body.recurrence_end_date ? 
          Math.floor(Number(req.body.recurrence_end_date)) : null;
      }
    } else if ('is_recurring' in req.body && !req.body.is_recurring) {
      // If explicitly turning off recurring, clear related fields
      updateData.is_recurring = false;
      updateData.recurrence_pattern = null;
      updateData.recurrence_interval = null;
      updateData.recurrence_end_date = null;
    }

    // If this is a parent task and due_date was updated, update future instances
    if (updateData.due_date && !existingTask[0].parent_task_id) {
      const futureInstances = await db.select()
        .from(tasks)
        .where(eq(tasks.parent_task_id, taskId));
      // Delete existing future instances
      if (futureInstances.length > 0) {
        await db.delete(tasks)
          .where(eq(tasks.parent_task_id, taskId));
      }

      // If still recurring, create new future instances
      if (existingTask[0].is_recurring && existingTask[0].recurrence_pattern) {
        let currentDate = new Date(updateData.due_date * 1000);
        const endDate = existingTask[0].recurrence_end_date ? new Date(existingTask[0].recurrence_end_date * 1000) : null;
        const interval = existingTask[0].recurrence_interval || 1;

        for (let i = 0; i < 10; i++) {
          currentDate = getNextOccurrence(currentDate, existingTask[0].recurrence_pattern, interval);
          
          if (endDate && currentDate > endDate) break;

          await db.insert(tasks).values({
            title: existingTask[0].title,
            description: existingTask[0].description,
            priority: existingTask[0].priority,
            completed: false,
            due_date: Math.floor(currentDate.getTime() / 1000),
            parent_task_id: taskId,
            is_recurring: false,
            recurrence_pattern: null,
            recurrence_interval: null,
            recurrence_end_date: null,
            user_id: req.userId!, 
          });
        }
      }
    }

    
    res.json(updateData);
  } catch (error) {
    console.error("Error updating task:", error);
    res.status(500).json({ 
      error: "Failed to update task",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

router.patch("/tasks/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { update_all_recurring, ...requestBody } = req.body;
    
    // Get the current task
    const currentTask = await db.select().from(tasks).where(eq(tasks.id, id)).get();
    if (!currentTask) {
      return res.status(404).json({ error: "Task not found" });
    }

    // Get user's timezone from settings
    const userSetting = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.user_id, req.userId!))
      .get();

    const userTimezone = userSetting?.timezone || 'UTC';

    // Create a clean update object with just the properties we want to update
    const updateData: any = {
      updated_at: sql`datetime('now')` // Use the server's time - SQLite will convert to UTC
    };
    
    // Only include properties that are explicitly provided
    if ('completed' in requestBody) {
      updateData.completed = requestBody.completed === true;
    }
    if ('title' in requestBody) updateData.title = requestBody.title;
    if ('description' in requestBody) updateData.description = requestBody.description;
    if ('priority' in requestBody) updateData.priority = requestBody.priority;
    if ('due_date' in requestBody) {
      updateData.due_date = requestBody.due_date ? Math.floor(Number(requestBody.due_date)) : null;
    }
    
    // Handle recurring task data with validation
    const isRecurring = 'is_recurring' in requestBody ? requestBody.is_recurring === true : currentTask.is_recurring;
    
    // Get recurrence pattern, considering both the request and existing data
    let recurrencePattern = currentTask.recurrence_pattern;
    if ('recurrence_pattern' in requestBody) {
      recurrencePattern = requestBody.recurrence_pattern;
    }
    
    // Validate recurrence data
    if (isRecurring) {
      // If task is recurring, ensure recurrence_pattern is valid
      const validPatterns = ['daily', 'weekly', 'monthly', 'yearly'];
      if (!recurrencePattern || !validPatterns.includes(recurrencePattern)) {
        return res.status(400).json({ 
          error: "Invalid recurrence pattern", 
          details: "Recurrence pattern must be one of: daily, weekly, monthly, yearly" 
        });
      }
      
      // Set recurrence fields
      updateData.is_recurring = true;
      updateData.recurrence_pattern = recurrencePattern;
      
      // Handle recurrence interval
      if ('recurrence_interval' in requestBody) {
        updateData.recurrence_interval = requestBody.recurrence_interval;
      } else if (!currentTask.recurrence_interval) {
        // Default to 1 if not provided
        updateData.recurrence_interval = 1;
      }
      
      // Handle recurrence end date
      if ('recurrence_end_date' in requestBody) {
        updateData.recurrence_end_date = requestBody.recurrence_end_date ? 
          Math.floor(Number(requestBody.recurrence_end_date)) : null;
      }
    } else if ('is_recurring' in requestBody && !requestBody.is_recurring) {
      // If explicitly turning off recurring, clear related fields
      updateData.is_recurring = false;
      updateData.recurrence_pattern = null;
      updateData.recurrence_interval = null;
      updateData.recurrence_end_date = null;
    }

    // If this task is a child recurring instance (has parent_task_id) and we're not just updating completion status
    const isUpdatingRecurringInstance = currentTask.parent_task_id && 
      Object.keys(updateData).some(key => !['completed', 'updated_at'].includes(key));
    
    // Prepare shared data for recurring instances (excludes date-specific fields)
    let sharedUpdateData = null;
    if (isUpdatingRecurringInstance) {
      sharedUpdateData = { ...updateData };
      
      // Don't update date fields across instances
      delete sharedUpdateData.due_date;
      delete sharedUpdateData.start_time;
      delete sharedUpdateData.end_time;
      delete sharedUpdateData.completed;
    }

    // Update the current task
    const updatedTask = await db.update(tasks)
      .set(updateData)
      .where(eq(tasks.id, id))
      .returning()
      .get();

    // Update all related recurring instances if needed 
    if (isUpdatingRecurringInstance && sharedUpdateData) {
      // Update all other instances with the same parent_id (but not this one, which we just updated)
      await db.update(tasks)
        .set(sharedUpdateData)
        .where(
          and(
            eq(tasks.parent_task_id, currentTask.parent_task_id),
            sql`${tasks.id} != ${id}`,
            eq(tasks.user_id, req.userId!)
          )
        );
    }
    // If update_all_recurring is true and this task is a parent task
    else if (update_all_recurring === true && !currentTask.parent_task_id) {
      if (updateData.due_date) {
        // For recurring tasks: delete all existing recurring instances and recreate them
        await db.delete(tasks).where(eq(tasks.parent_task_id, id));
        
        // If still recurring, create new future instances
        if (currentTask.is_recurring && currentTask.recurrence_pattern) {
          let currentDate = new Date(updateData.due_date * 1000);
          const endDate = currentTask.recurrence_end_date ? new Date(currentTask.recurrence_end_date * 1000) : null;
          const interval = currentTask.recurrence_interval || 1;

          for (let i = 0; i < 10; i++) {
            currentDate = getNextOccurrence(currentDate, currentTask.recurrence_pattern, interval);
            
            if (endDate && currentDate > endDate) break;

            await db.insert(tasks).values({
              title: updateData.title || currentTask.title,
              description: updateData.description || currentTask.description,
              priority: updateData.priority || currentTask.priority,
              completed: false,
              due_date: Math.floor(currentDate.getTime() / 1000),
              parent_task_id: id,
              is_recurring: false,
              recurrence_pattern: null,
              recurrence_interval: null,
              recurrence_end_date: null,
              user_id: req.userId!
            });
          }
        }
      } else {
        // If no due_date change, just update all child instances with the non-date fields
        const sharedParentUpdateData = { ...updateData };
        delete sharedParentUpdateData.due_date;
        delete sharedParentUpdateData.completed;
        
        // Only update if there are fields to update
        if (Object.keys(sharedParentUpdateData).length > 1) { // > 1 because it always has updated_at
          await db.update(tasks)
            .set(sharedParentUpdateData)
            .where(
              and(
                eq(tasks.parent_task_id, id),
                eq(tasks.user_id, req.userId!)
              )
            );
        }
      }
    } 
    // Handle regular due_date updates if not using update_all_recurring
    else if (updateData.due_date && !currentTask.parent_task_id && !update_all_recurring) {
      const futureInstances = await db.select()
        .from(tasks)
        .where(eq(tasks.parent_task_id, id));
      // Delete existing future instances
      if (futureInstances.length > 0) {
        await db.delete(tasks)
          .where(eq(tasks.parent_task_id, id));
      }

      // If still recurring, create new future instances
      if (currentTask.is_recurring && currentTask.recurrence_pattern) {
        let currentDate = new Date(updateData.due_date * 1000);
        const endDate = currentTask.recurrence_end_date ? new Date(currentTask.recurrence_end_date * 1000) : null;
        const interval = currentTask.recurrence_interval || 1;

        for (let i = 0; i < 10; i++) {
          currentDate = getNextOccurrence(currentDate, currentTask.recurrence_pattern, interval);
          
          if (endDate && currentDate > endDate) break;

          await db.insert(tasks).values({
            title: currentTask.title,
            description: currentTask.description,
            priority: currentTask.priority,
            completed: false,
            due_date: Math.floor(currentDate.getTime() / 1000),
            parent_task_id: id,
            is_recurring: false,
            recurrence_pattern: null,
            recurrence_interval: null,
            recurrence_end_date: null,
            user_id: req.userId!
          });
        }
      }
    }

    res.json(updatedTask);
  } catch (error) {
    console.error("Error updating task:", error);
    res.status(400).json({ 
      error: "Invalid update data", 
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

router.delete("/tasks/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    
    // Get the task
    const task = await db.select().from(tasks).where(eq(tasks.id, id)).get();
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    // If it's a parent task, delete all child tasks
    if (!task.parent_task_id) {
      await db.delete(tasks).where(eq(tasks.parent_task_id, id));
    }

    // Delete the task itself
    await db.delete(tasks).where(eq(tasks.id, id));

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting task:", error);
    res.status(500).json({ error: "Failed to delete task" });
  }
});

// Notes
router.get("/notes", requireAuth, async (req: Request, res: Response) => {
  try {
    // Filter notes by the current user's ID instead of returning all notes
    const userNotes = await db
      .select()
      .from(notes)
      .where(eq(notes.user_id, req.userId!));
    
    res.json(userNotes);
  } catch (error) {
    console.error("Error fetching notes:", error);
    res.status(500).json({ error: "Failed to fetch notes" });
  }
});

router.get("/notes/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const noteId = parseInt(req.params.id);
    const note = await db
      .select()
      .from(notes)
      .where(and(
        eq(notes.id, noteId),
        eq(notes.user_id, req.userId!)
      ));
    
    if (note.length === 0) {
      return res.status(404).json({ error: "Note not found" });
    }
    
    res.json(note[0]);
  } catch (error) {
    console.error("Error fetching note:", error);
    res.status(500).json({ error: "Failed to fetch note" });
  }
});

router.post("/notes", requireAuth, async (req: Request, res: Response) => {
  try {
    const result = insertNoteSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ 
        error: "Invalid note data", 
        details: result.error.errors 
      });
    }

const noteData = result.data;
    const newNote = await db.insert(notes).values({
      ...noteData,
      user_id: req.userId!
    }).returning();
    res.json(newNote[0]);
  } catch (error) {
    console.error("Error creating note:", error);
    res.status(500).json({ error: "Failed to create note" });
  }
});

router.patch("/notes/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const noteId = parseInt(req.params.id);
    
    // Check if note exists and belongs to user
    const existingNote = await db
      .select()
      .from(notes)
      .where(and(
        eq(notes.id, noteId),
        eq(notes.user_id, req.userId!)
      ));
      
    if (existingNote.length === 0) {
      return res.status(404).json({ error: "Note not found" });
    }
    
    // Validate request body
    const result = insertNoteSchema.partial().safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ 
        error: "Invalid note data", 
        details: result.error.errors 
      });
    }

    const updatedNote = await db
      .update(notes)
      .set({
        ...result.data,
        updated_at: Math.floor(Date.now() / 1000)
      })
      .where(and(
        eq(notes.id, noteId),
        eq(notes.user_id, req.userId!)
      ))
      .returning();
    
    res.json(updatedNote[0]);
  } catch (error) {
    console.error("Error updating note:", error);
    res.status(500).json({ error: "Failed to update note" });
  }
});

router.delete("/notes/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const noteId = parseInt(req.params.id);
    
    // Check if note exists and belongs to user
    const existingNote = await db
      .select()
      .from(notes)
      .where(and(
        eq(notes.id, noteId),
        eq(notes.user_id, req.userId!)
      ));
      
    if (existingNote.length === 0) {
      return res.status(404).json({ error: "Note not found" });
    }
    
    await db
      .delete(notes)
      .where(and(
        eq(notes.id, noteId),
        eq(notes.user_id, req.userId!)
      ));
      
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting note:", error);
    res.status(500).json({ error: "Failed to delete note" });
  }
});

// Long Notes
router.get("/long-notes", requireAuth, async (req: Request, res: Response) => {
  try {
    
    const userLongNotes = await db
      .select()
      .from(longNotes)
      .where(eq(longNotes.user_id, req.userId!));
    
    res.json(userLongNotes);
  } catch (error) {
    console.error("Error fetching long notes:", error);
    res.status(500).json({ error: "Failed to fetch long notes" });
  }
});

router.get("/long-notes/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const noteId = parseInt(req.params.id);
    const note = await db
      .select()
      .from(longNotes)
      .where(and(
        eq(longNotes.id, noteId),
        eq(longNotes.user_id, req.userId!)
      ));
    
    if (note.length === 0) {
      return res.status(404).json({ error: "Long note not found" });
    }
    
    res.json(note[0]);
  } catch (error) {
    console.error("Error fetching long note:", error);
    res.status(500).json({ error: "Failed to fetch long note" });
  }
});

router.post("/long-notes", requireAuth, async (req: Request, res: Response) => {
  try {
    
    const result = insertLongNoteSchema.safeParse(req.body);
    if (!result.success) {
      console.error("Invalid long note data:", result.error.errors);
      return res.status(400).json({ 
        error: "Invalid long note data", 
        details: result.error.errors 
      });
    }

    const noteData = result.data;
    
    const newNote = await db.insert(longNotes).values({
      ...noteData,
      user_id: req.userId!
    }).returning();
    
    res.json(newNote[0]);
  } catch (error) {
    console.error("Error creating long note:", error);
    res.status(500).json({ error: "Failed to create long note" });
  }
});

router.patch("/long-notes/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const noteId = parseInt(req.params.id);
    
    // Check if note exists and belongs to user
    const existingNote = await db
      .select()
      .from(longNotes)
      .where(and(
        eq(longNotes.id, noteId),
        eq(longNotes.user_id, req.userId!)
      ));
      
    if (existingNote.length === 0) {
      return res.status(404).json({ error: "Long note not found" });
    }
    
    // Validate request body
    const result = insertLongNoteSchema.partial().safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ 
        error: "Invalid long note data", 
        details: result.error.errors 
      });
    }

    const updatedNote = await db
      .update(longNotes)
      .set({
        ...result.data,
        updated_at: Math.floor(Date.now() / 1000)
      })
      .where(and(
        eq(longNotes.id, noteId),
        eq(longNotes.user_id, req.userId!)
      ))
      .returning();
    
    res.json(updatedNote[0]);
  } catch (error) {
    console.error("Error updating long note:", error);
    res.status(500).json({ error: "Failed to update long note" });
  }
});

router.delete("/long-notes/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const noteId = parseInt(req.params.id);
    
    // Check if note exists and belongs to user
    const existingNote = await db
      .select()
      .from(longNotes)
      .where(and(
        eq(longNotes.id, noteId),
        eq(longNotes.user_id, req.userId!)
      ));
      
    if (existingNote.length === 0) {
      return res.status(404).json({ error: "Long note not found" });
    }
    
    await db
      .delete(longNotes)
      .where(and(
        eq(longNotes.id, noteId),
        eq(longNotes.user_id, req.userId!)
      ));
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting long note:", error);
    res.status(500).json({ error: "Failed to delete long note" });
  }
});

// Enhance note with Gemini API
router.post("/long-notes/:id/enhance", requireAuth, async (req: Request, res: Response) => {
  try {
    const noteId = parseInt(req.params.id);
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: "Enhancement prompt is required" });
    }
    
    // Check if note exists and belongs to user
    const existingNote = await db
      .select()
      .from(longNotes)
      .where(and(
        eq(longNotes.id, noteId),
        eq(longNotes.user_id, req.userId!)
      ));
      
    if (existingNote.length === 0) {
      return res.status(404).json({ error: "Long note not found" });
    }
    
    const note = existingNote[0];
    
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
    
    // Check if user is Pro using the is_pro field in userSettings
    const isPro = !!userSetting?.is_pro;
    
    // Default values from admin settings or hardcoded fallbacks
    const maxFreeCalls = adminSetting?.gemini_max_free_calls || 5;
    const enableMarketing = !!adminSetting?.enable_marketing;
    
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
    const GEMINI_API_KEY = userSetting?.gemini_key || process.env.FALLBACK_GEMINI_API_KEY;
    
    // Verify API key is available
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ 
        error: "Gemini API key is not configured",
        details: "Please set your Gemini API key in Settings"
      });
    }

    // Initialize Gemini API with the appropriate key
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    
    // Get the generative model
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Create prompt for enhancement
    const geminiPrompt = `
      I have the following note with title: "${note.title}" and content:
      
      ${note.content || ""}
      
      ${prompt}
      
      Return only the enhanced content in Markdown format without any additional explanations.
    `;

    // Generate enhanced content
    const result = await model.generateContent(geminiPrompt);
    const response = await result.response;
    const enhancedContent = response.text();

    // IMPORTANT: Always increment the counter for ALL users (except pro with valid subscription)
    try {
      // Determine if we should increment the counter
      const shouldIncrement = !isPro || !userSetting;
      
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
      console.error("Error incrementing counter:", countError);
      // Continue processing request despite counter error
    }

    // Return the enhanced content
    res.json({ content: enhancedContent });
  } catch (error) {
    console.error("Error enhancing note:", error);
    res.status(500).json({ 
      error: "Failed to enhance note",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Meetings
router.get("/meetings", requireAuth, async (req: Request, res: Response) => {
  try {
    const allMeetings = await db
      .select()
      .from(meetings)
      .where(eq(meetings.user_id, req.userId!));
    res.json(allMeetings);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch meetings" });
  }
});

router.get("/meetings/:id", requireAuth, async (req, res) => {
  try {
    const meetingId = parseInt(req.params.id);
    const meeting = await db.select().from(meetings).where(eq(meetings.id, meetingId));
    
    if (meeting.length === 0) {
      return res.status(404).json({ error: "Meeting not found" });
    }
    
    res.json(meeting[0]);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch meeting" });
  }
});

router.post("/meetings", requireAuth, async (req: Request, res: Response) => {
  try {
    const meetingData = {
      ...req.body,
      user_id: req.userId!,
      // Let SQLite handle timestamps via defaults
    };
    const newMeeting = await db.insert(meetings).values(meetingData).returning().get();
    res.json(newMeeting);
  } catch (error) {
    console.error("Error creating meeting:", error);
    res.status(500).json({ error: "Failed to create meeting" });
  }
});

router.patch("/meetings/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const meetingId = parseInt(req.params.id);
    const { update_all_recurring, ...updateData } = req.body;
    
    // Check if meeting exists and belongs to user
    const existingMeeting = await db
      .select()
      .from(meetings)
      .where(
        and(
          eq(meetings.id, meetingId),
          eq(meetings.user_id, req.userId!)
        )
      )
      .get();
    
    if (!existingMeeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }
    
    // Update the meeting
    const updatedMeeting = await db
      .update(meetings)
      .set(updateData)
      .where(
        and(
          eq(meetings.id, meetingId),
          eq(meetings.user_id, req.userId!)
        )
      )
      .returning()
      .get();
    
    // If update_all_recurring is true and this is a parent meeting (not a recurring instance),
    // update all child meetings with the same parent_meeting_id
    if (update_all_recurring && !existingMeeting.parent_meeting_id) {
      await db
        .update(meetings)
        .set(updateData)
        .where(
          and(
            eq(meetings.parent_meeting_id, meetingId),
            eq(meetings.user_id, req.userId!)
          )
        );
    }
    
    res.json(updatedMeeting);
  } catch (error) {
    console.error("Error updating meeting:", error);
    res.status(500).json({ error: "Failed to update meeting" });
  }
});

router.delete("/meetings/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const meetingId = parseInt(req.params.id);
    
    // Check if meeting exists and belongs to user
    const existingMeeting = await db
      .select()
      .from(meetings)
      .where(
        and(
          eq(meetings.id, meetingId),
          eq(meetings.user_id, req.userId!)
        )
      )
      .get();
    
    if (!existingMeeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }
    
    await db
      .delete(meetings)
      .where(
        and(
          eq(meetings.id, meetingId),
          eq(meetings.user_id, req.userId!)
        )
      );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete meeting" });
  }
});

// Appointments
router.get("/appointments", requireAuth, async (req: Request, res: Response) => {
  try {
    const allAppointments = await db
      .select()
      .from(appointments)
      .where(eq(appointments.user_id, req.userId!));
    res.json(allAppointments);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch appointments" });
  }
});

router.get("/appointments/:id", requireAuth, async (req, res) => {
  try {
    const appointmentId = parseInt(req.params.id);
    const appointment = await db.select().from(appointments).where(eq(appointments.id, appointmentId));
    
    if (appointment.length === 0) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    
    res.json(appointment[0]);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch appointment" });
  }
});

router.post("/appointments", requireAuth, async (req: Request, res: Response) => {
  try {
    const appointmentData = {
      ...req.body,
      user_id: req.userId!,
      // Let SQLite handle timestamps via defaults
    };
    const newAppointment = await db.insert(appointments).values(appointmentData).returning().get();
    res.json(newAppointment);
  } catch (error) {
    console.error("Error creating appointment:", error);
    res.status(500).json({ error: "Failed to create appointment" });
  }
});

router.patch("/appointments/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const appointmentId = parseInt(req.params.id);
    const { update_all_recurring, ...updateData } = req.body;
    
    // Check if appointment exists and belongs to user
    const existingAppointment = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.id, appointmentId),
          eq(appointments.user_id, req.userId!)
        )
      )
      .get();
    
    if (!existingAppointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    
    // Update the appointment
    const updatedAppointment = await db
      .update(appointments)
      .set(updateData)
      .where(
        and(
          eq(appointments.id, appointmentId),
          eq(appointments.user_id, req.userId!)
        )
      )
      .returning()
      .get();
    
    // If update_all_recurring is true and this is a parent appointment (not a recurring instance),
    // update all child appointments with the same parent_appointment_id
    if (update_all_recurring && !existingAppointment.parent_appointment_id) {
      await db
        .update(appointments)
        .set(updateData)
        .where(
          and(
            eq(appointments.parent_appointment_id, appointmentId),
            eq(appointments.user_id, req.userId!)
          )
        );
    }
    
    res.json(updatedAppointment);
  } catch (error) {
    console.error("Error updating appointment:", error);
    res.status(500).json({ error: "Failed to update appointment" });
  }
});

router.delete("/appointments/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const appointmentId = parseInt(req.params.id);
    
    // Check if appointment exists and belongs to user
    const existingAppointment = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.id, appointmentId),
          eq(appointments.user_id, req.userId!)
        )
      )
      .get();
    
    if (!existingAppointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    
    await db
      .delete(appointments)
      .where(
        and(
          eq(appointments.id, appointmentId),
          eq(appointments.user_id, req.userId!)
        )
      );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete appointment" });
  }
});

// Settings
router.get("/pomodoro-settings", requireAuth, async (req, res) => {
  try {
    const settings = await db.select().from(pomodoroSettings).limit(1);
    res.json(settings[0] || {});
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch pomodoro settings" });
  }
});

router.put("/pomodoro-settings", requireAuth, async (req, res) => {
  try {
    const settings = await db.select().from(pomodoroSettings).limit(1);
    if (settings.length === 0) {
      const newSettings = await db.insert(pomodoroSettings).values(req.body).returning();
      res.json(newSettings[0]);
    } else {
      const updatedSettings = await db
        .update(pomodoroSettings)
        .set(req.body)
        .where(eq(pomodoroSettings.id, settings[0].id))
        .returning();
      res.json(updatedSettings[0]);
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to update pomodoro settings" });
  }
});

router.patch("/pomodoro-settings", requireAuth, async (req, res) => {
  try {
    const settings = await db.select().from(pomodoroSettings).limit(1);
    if (settings.length === 0) {
      return res.status(404).json({ error: "Pomodoro settings not found" });
    }
    
    const updatedSettings = await db
      .update(pomodoroSettings)
      .set(req.body)
      .where(eq(pomodoroSettings.id, settings[0].id))
      .returning();
    res.json(updatedSettings[0]);
  } catch (error) {
    console.error("Error updating pomodoro settings:", error);
    res.status(500).json({ error: "Failed to update pomodoro settings" });
  }
});

router.get("/user-settings", requireAuth, async (req, res) => {
  try {
    
    const settings = await db.select().from(userSettings).where(eq(userSettings.user_id, req.userId!));
    
    if (settings.length === 0) {
      
      // Return default values if no settings exist
      return res.json({
        id: null,
        user_id: req.userId,
        timezone: "UTC",
        work_start_hour: 9,
        work_end_hour: 17,
        theme: "light",
        default_calendar_view: "month",
        show_notifications: true,
        notifications_enabled: true,
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000)
      });
    }
    
    
    res.json(settings[0]);
  } catch (error) {
    console.error("Error fetching user settings:", error);
    res.status(500).json({ error: "Failed to fetch user settings" });
  }
});

router.put("/user-settings", requireAuth, async (req, res) => {
  try {
    
    
    const settings = await db.select().from(userSettings).where(eq(userSettings.user_id, req.userId!));
    if (settings.length === 0) {
      
      const newSettings = await db.insert(userSettings).values({
        ...req.body,
        user_id: req.userId!
      }).returning();
      
      res.json(newSettings[0]);
    } else {
      
      const updatedSettings = await db
        .update(userSettings)
        .set(req.body)
        .where(eq(userSettings.user_id, req.userId!))
        .returning();
      
      res.json(updatedSettings[0]);
    }
  } catch (error) {
    console.error('Error updating user settings:', error);
    res.status(500).json({ error: "Failed to update user settings" });
  }
});

router.patch("/user-settings", requireAuth, async (req, res) => {
  try {
    console.log("🔄 PATCH user settings update for user ID:", req.userId, "with data:", {
      ...req.body,
      gemini_key: req.body.gemini_key ? "[REDACTED]" : undefined
    });
    
    if (!req.userId) {
      console.error("⚠️ No user ID found in request for PATCH settings update");
      return res.status(401).json({ error: "Unauthorized - No user ID" });
    }
    
    // Check if settings exist for this user
    const existingSettings = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.user_id, req.userId));
    
    console.log(`📊 Found ${existingSettings.length} existing settings records for user ID ${req.userId}`);
    
    // Process work hours - ensure they are valid hour values (0-24)
    let workStartHour = undefined;
    let workEndHour = undefined;
    
    // Handle work_start_hour specially
    if ('work_start_hour' in req.body) {
      if (req.body.work_start_hour !== null && typeof req.body.work_start_hour === 'number') {
        // Store the decimal value to preserve minutes (e.g., 9.5 for 9:30)
        // Just ensure it's within valid range
        workStartHour = Math.min(Math.max(0, Number(req.body.work_start_hour)), 23.99);
      }
    }
    
    // Handle work_end_hour specially
    if ('work_end_hour' in req.body) {
      if (req.body.work_end_hour !== null && typeof req.body.work_end_hour === 'number') {
        // Store the decimal value to preserve minutes (e.g., 17.5 for 17:30)
        // Just ensure it's within valid range
        workEndHour = Math.min(Math.max(1, Number(req.body.work_end_hour)), 24);
      }
    }
    
    // If no settings exist, create new settings
    if (existingSettings.length === 0) {
      console.log("🆕 No existing settings found, creating new settings for user ID:", req.userId);
      
      // Create default hour values for work hours if not provided
      if (workStartHour === undefined) {
        workStartHour = 9; // Default start hour: 9 AM
      }
      
      if (workEndHour === undefined) {
        workEndHour = 17; // Default end hour: 5 PM
      }
      
      // Create a new settings object with all possible fields
      const newSettingsData = {
        user_id: req.userId,
        timezone: 'timezone' in req.body ? req.body.timezone : "UTC",
        theme: 'theme' in req.body ? req.body.theme : "light",
        default_calendar_view: 'default_calendar_view' in req.body ? req.body.default_calendar_view : "month",
        show_notifications: 'show_notifications' in req.body ? Boolean(req.body.show_notifications) : true,
        notifications_enabled: 'notifications_enabled' in req.body ? Boolean(req.body.notifications_enabled) : true,
        gemini_key: 'gemini_key' in req.body ? req.body.gemini_key : null,
        subscription_plan: 'subscription_plan' in req.body ? req.body.subscription_plan : "free",
        subscription_expiry: 'subscription_expiry' in req.body ? req.body.subscription_expiry : null,
        gemini_calls_count: 'gemini_calls_count' in req.body ? Number(req.body.gemini_calls_count) : 0,
        work_start_hour: workStartHour,
        work_end_hour: workEndHour
      };
      
      console.log("📝 Creating new settings with data:", {
        ...newSettingsData,
        gemini_key: newSettingsData.gemini_key ? "[REDACTED]" : null
      });
      
      const newSettings = await db
        .insert(userSettings)
        .values(newSettingsData)
        .returning();
      
      console.log("✅ New settings created successfully for user ID:", req.userId);
      return res.json(newSettings[0]);
    }
    
    // Update existing settings
    console.log("🔄 Updating existing settings for user ID:", req.userId);
    
    // Create update object with only the fields that are provided
    const updateData: Record<string, any> = {
      // Set updated_at timestamp for every update
      updated_at: Math.floor(Date.now() / 1000)
    };
    
    // Add all possible user settings fields if they exist in the request body
    if ('timezone' in req.body) updateData.timezone = req.body.timezone;
    if ('theme' in req.body) updateData.theme = req.body.theme;
    if ('default_calendar_view' in req.body) updateData.default_calendar_view = req.body.default_calendar_view;
    if ('show_notifications' in req.body) updateData.show_notifications = Boolean(req.body.show_notifications);
    if ('notifications_enabled' in req.body) updateData.notifications_enabled = Boolean(req.body.notifications_enabled);
    if ('gemini_key' in req.body) updateData.gemini_key = req.body.gemini_key;
    if ('subscription_plan' in req.body) updateData.subscription_plan = req.body.subscription_plan;
    if ('subscription_expiry' in req.body) updateData.subscription_expiry = req.body.subscription_expiry;
    if ('gemini_calls_count' in req.body) updateData.gemini_calls_count = Number(req.body.gemini_calls_count);
    if (workStartHour !== undefined) updateData.work_start_hour = workStartHour;
    if (workEndHour !== undefined) updateData.work_end_hour = workEndHour;
    
    console.log("📝 Updating with data:", {
      ...updateData,
      gemini_key: updateData.gemini_key ? "[REDACTED]" : undefined
    });
    
    // Only update if there are fields to update
    if (Object.keys(updateData).length === 1) { // 1 because we always set updated_at
      console.log("ℹ️ No changes to update, returning existing settings for user ID:", req.userId);
      return res.json(existingSettings[0]);
    }
    
    const result = await db
      .update(userSettings)
      .set(updateData)
      .where(eq(userSettings.user_id, req.userId))
      .returning();
    
    console.log("✅ Settings updated successfully for user ID:", req.userId);
    res.json(result[0]);
    
  } catch (error) {
    console.error("❌ Error updating user settings:", error);
    res.status(500).json({ 
      error: "Failed to update user settings",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

router.post("/tasks/:id/subtasks", requireAuth, async (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.id);
    const { subtasks: subtasksList } = req.body;

    // Don't perform operations on existing subtasks
    // Only insert new ones that don't have an ID yet
    const newSubtasks = subtasksList.filter((s: any) => !s.id || typeof s.id !== 'number');
    
    if (newSubtasks.length === 0) {
      // If there are no new subtasks, just return the existing ones
      const existingSubtasks = await db
        .select()
        .from(subtasks)
        .where(eq(subtasks.task_id, taskId))
        .orderBy(subtasks.position);
      
      return res.json(existingSubtasks);
    }

    // Get the current maximum position
    const maxPositionResult = await db
      .select({ maxPosition: sql<number>`COALESCE(MAX(${subtasks.position}), -1)` })
      .from(subtasks)
      .where(eq(subtasks.task_id, taskId))
      .get();
    
    const startPosition = (maxPositionResult?.maxPosition ?? -1) + 1;

    // Insert only new subtasks with appropriate positions
    const subtaskValues = newSubtasks.map((subtask: { title: string; completed: boolean }, index: number) => ({
      title: subtask.title,
      task_id: taskId,
      position: startPosition + index,
      completed: Boolean(subtask.completed),
      user_id: req.userId,
      created_at: sql`CURRENT_TIMESTAMP`,
      updated_at: sql`CURRENT_TIMESTAMP`
    }));

    // Insert new subtasks if there are any
    const savedSubtasks = await db.insert(subtasks).values(subtaskValues).returning();
    
    // Return all subtasks for the task to keep client and server in sync
    const allSubtasks = await db
      .select()
      .from(subtasks)
      .where(eq(subtasks.task_id, taskId))
      .orderBy(subtasks.position);
    
    res.json(allSubtasks);
  } catch (error) {
    console.error("Error saving subtasks:", error);
    res.status(500).json({ error: "Failed to save subtasks" });
  }
});

router.get("/tasks/:id/subtasks", requireAuth, async (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.id);
    const taskSubtasks = await db
      .select()
      .from(subtasks)
      .where(eq(subtasks.task_id, taskId))
      .orderBy(subtasks.position);
    
    res.json(taskSubtasks);
  } catch (error) {
    console.error("Error fetching subtasks:", error);
    res.status(500).json({ error: "Failed to fetch subtasks" });
  }
});

// Add endpoint to update subtask
router.patch("/tasks/:taskId/subtasks/:subtaskId", requireAuth, async (req: Request, res: Response) => {
  try {
    const { taskId, subtaskId } = req.params;
    const { completed, title, position, position_only_update, updated_at } = req.body;

    // Validate IDs
    const taskIdNum = parseInt(taskId);
    const subtaskIdNum = parseInt(subtaskId);
    
    if (isNaN(taskIdNum) || taskIdNum <= 0) {
      console.error(`Invalid taskId: ${taskId}`);
      return res.status(400).json({ error: "Invalid task ID" });
    }
    
    if (isNaN(subtaskIdNum) || subtaskIdNum <= 0) {
      console.error(`Invalid subtaskId: ${subtaskId}`);
      return res.status(400).json({ error: "Invalid subtask ID" });
    }

    // Get user's timezone from settings
    const userSetting = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.user_id, req.userId!))
      .get();

    const userTimezone = userSetting?.timezone || 'UTC';
    
    // Create update data object - DON'T update timestamp for position changes
    const updateData: any = {};

    // Handle provided timestamp or auto-update
    if (updated_at) {
      // Allow explicit timestamp from client (for completion times)
      updateData.updated_at = sql`datetime(${new Date(updated_at * 1000).toISOString()})`;
    } else if ((title !== undefined || typeof completed === 'boolean') && !position_only_update) {
      // Only auto-update timestamp when content or completion status changes, and not a position-only update
      updateData.updated_at = sql`datetime('now')`;
    }

    if (typeof completed === 'boolean') {
      updateData.completed = completed;
    }

    if (title !== undefined) {
      updateData.title = title;
    }
    
    if (position !== undefined && typeof position === 'number') {
      updateData.position = position;
    }

    // If no valid fields provided, return error
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }
    
    // First, verify the subtask exists
    const existingSubtask = await db
      .select()
      .from(subtasks)
      .where(
        and(
          eq(subtasks.id, subtaskIdNum),
          eq(subtasks.task_id, taskIdNum),
          eq(subtasks.user_id, req.userId!)
        )
      )
      .get();
      
    if (!existingSubtask) {
      console.error(`Subtask ${subtaskIdNum} not found for task ${taskIdNum} and user ${req.userId}`);
      return res.status(404).json({ error: "Subtask not found" });
    }

    // Update the subtask
    const [updatedSubtask] = await db
      .update(subtasks)
      .set(updateData)
      .where(
        and(
          eq(subtasks.id, subtaskIdNum),
          eq(subtasks.task_id, taskIdNum),
          eq(subtasks.user_id, req.userId!)
        )
      )
      .returning();

    if (!updatedSubtask) {
      console.error(`Update failed for subtask ${subtaskIdNum}`);
      return res.status(404).json({ error: "Subtask update failed" });
    }

    res.json(updatedSubtask);
  } catch (error) {
    console.error("Error updating subtask:", error);
    res.status(500).json({ 
      error: "Failed to update subtask",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Add missing DELETE endpoint for subtasks
router.delete("/tasks/:taskId/subtasks/:subtaskId", requireAuth, async (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.taskId);
    const subtaskId = parseInt(req.params.subtaskId);
    
    // First verify the subtask exists and belongs to the task
    const existingSubtask = await db
      .select()
      .from(subtasks)
      .where(and(
        eq(subtasks.id, subtaskId),
        eq(subtasks.task_id, taskId)
      ))
      .get();

    if (!existingSubtask) {
      return res.status(404).json({ error: "Subtask not found" });
    }

    // Delete the subtask
    await db
      .delete(subtasks)
      .where(and(
        eq(subtasks.id, subtaskId),
        eq(subtasks.task_id, taskId)
      ));

    res.status(200).json({ success: true, message: "Subtask deleted successfully" });
  } catch (error) {
    console.error("Error deleting subtask:", error);
    res.status(500).json({ error: "Failed to delete subtask" });
  }
});

// Gemini usage endpoints
router.get("/gemini/usage", requireAuth, async (req: Request, res: Response) => {
  try {
    // Get user settings for subscription status and usage
    const userSetting = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.user_id, req.userId!))
      .get();

    // Get user's subscription info if available
    const userSubscription = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.user_id, req.userId!))
      .get();

    // Get admin settings for configuration values
    const adminConfig = await db
      .select()
      .from(adminSettings)
      .limit(1)
      .get();

    // Default settings if none exist
    const settings = userSetting || {
      gemini_calls_count: 0
    };

    // Get max free calls from admin settings, or default to 5
    const maxFreeCalls = adminConfig?.gemini_max_free_calls || 5;
    const enableMarketing = !!adminConfig?.enable_marketing;

    // Check if user is Pro using the is_pro field in userSettings
    const isPro = !!userSetting?.is_pro;
    
    // Check if subscription is expired
    const isExpired = userSubscription?.end_date ? 
      userSubscription.end_date < Math.floor(Date.now() / 1000) : true;
    
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

    // Respond with usage info
    res.json({
      canUseGemini: isPro ? !isExpired : !shouldEnforceLimits,
      currentUsage: userSetting?.gemini_calls_count || 0,
      maxFreeCalls,
      isPro,
      isExpired,
      showMarketing: enableMarketing,
      message: shouldEnforceLimits 
        ? `You've reached your free limit of ${maxFreeCalls} Gemini API calls. Please upgrade to Pro to continue using AI features. Payment will be processed after admin approval.`
        : null,
      showUpgrade: shouldEnforceLimits // Add flag to indicate that user should be prompted to upgrade
    });
  } catch (error) {
    console.error("Error checking Gemini usage:", error);
    res.status(500).json({ 
      error: "Failed to check Gemini usage",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

router.post("/gemini/increment-usage", requireAuth, async (req: Request, res: Response) => {
  try {
    // Get user settings
    const userSetting = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.user_id, req.userId!))
      .get();

    // Get user's subscription info
    const userSubscription = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.user_id, req.userId!))
      .get();

    if (!userSetting) {
      // Create default settings if none exist
      const newSettings = await db
        .insert(userSettings)
        .values({
          user_id: req.userId!,
          gemini_calls_count: 1
        })
        .returning()
        .get();
      
      return res.json({
        success: true,
        currentUsage: 1,
        settings: newSettings
      });
    }

    // Only increment if on free plan (Pro users have unlimited usage)
    if (!userSubscription || userSubscription.plan !== 'pro') {
      const currentCount = userSetting.gemini_calls_count || 0;
      
      // Update the usage count
      const updatedSettings = await db
        .update(userSettings)
        .set({ 
          gemini_calls_count: currentCount + 1,
          updated_at: Math.floor(Date.now() / 1000)
        })
        .where(eq(userSettings.user_id, req.userId!))
        .returning()
        .get();
      
      return res.json({
        success: true,
        currentUsage: currentCount + 1,
        settings: updatedSettings
      });
    }
    
    // Pro users don't need to increment
    return res.json({
      success: true,
      currentUsage: userSetting.gemini_calls_count || 0,
      settings: userSetting
    });
  } catch (error) {
    console.error("Error incrementing Gemini usage:", error);
    res.status(500).json({ 
      error: "Failed to increment Gemini usage",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Admin settings routes
router.post('/admin/settings', requireAuth, async (req, res) => {
  try {
    const settings = req.body;
    
    // Create a new admin settings record with Drizzle ORM
    const [newSettings] = await db.insert(adminSettings).values({
      gemini_max_free_calls: settings.gemini_max_free_calls,
      enable_marketing: !!settings.enable_marketing,
      bank_account: settings.bank_account || "",
      bank_owner: settings.bank_owner || "",
      subscription_amount: settings.subscription_amount || 0,
      default_currency: settings.default_currency || "ETB",
      created_at: Math.floor(Date.now() / 1000),
      updated_at: Math.floor(Date.now() / 1000)
    }).returning();
    
    res.json(newSettings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create admin settings' });
  }
});

router.put('/admin/settings/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const settings = req.body;
    
    // Update existing admin settings with Drizzle ORM
    await db.update(adminSettings)
      .set({
        gemini_max_free_calls: settings.gemini_max_free_calls,
        enable_marketing: !!settings.enable_marketing,
        bank_account: settings.bank_account || "",
        bank_owner: settings.bank_owner || "",
        subscription_amount: settings.subscription_amount || 0,
        default_currency: settings.default_currency || "ETB", 
        updated_at: Math.floor(Date.now() / 1000)
      })
      .where(eq(adminSettings.id, parseInt(id)));
    
    // Fetch the updated record to return
    const updatedSettings = await db.select()
      .from(adminSettings)
      .where(eq(adminSettings.id, parseInt(id)))
      .get();
    
    if (!updatedSettings) {
      return res.status(404).json({ error: 'Admin settings not found' });
    }
    
    res.json(updatedSettings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update admin settings' });
  }
});

// Add route to get admin settings - additional route to match client endpoint
router.get('/admin-settings', requireAuth, async (req, res) => {
  try {
    // Try to get the first admin settings record
    const settings = await db.select().from(adminSettings).limit(1).get();
    
    if (!settings) {
      return res.status(404).json({ error: 'Admin settings not found' });
    }
    
    res.json(settings);
  } catch (error) {
    console.error('Error fetching admin settings:', error);
    res.status(500).json({ error: 'Failed to fetch admin settings' });
  }
});

// Add route to update admin settings with PATCH
router.patch('/admin-settings', requireAuth, async (req, res) => {
  try {
    // Get existing settings
    const existingSettings = await db.select().from(adminSettings).limit(1).get();
    
    if (!existingSettings) {
      // If no settings exist, create new settings
      const newSettings = await db.insert(adminSettings).values({
        ...req.body,
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000)
      }).returning().get();
      
      return res.json(newSettings);
    }
    
    // Update existing settings
    const updatedSettings = await db.update(adminSettings)
      .set({
        ...req.body,
        updated_at: Math.floor(Date.now() / 1000)
      })
      .where(eq(adminSettings.id, existingSettings.id))
      .returning()
      .get();
    
    res.json(updatedSettings);
  } catch (error) {
    console.error('Error updating admin subscription settings:', error);
    res.status(500).json({ error: 'Failed to update admin subscription settings' });
  }
});

// Add routes with /api prefix for backward compatibility
router.get('/api/admin-settings', requireAuth, async (req, res) => {
  try {
    // Try to get the first admin settings record
    const settings = await db.select().from(adminSettings).limit(1).get();
    
    if (!settings) {
      return res.status(404).json({ error: 'Admin settings not found' });
    }
    
    res.json(settings);
  } catch (error) {
    console.error('Error fetching admin settings:', error);
    res.status(500).json({ error: 'Failed to fetch admin settings' });
  }
});

// Add route to update admin settings with PATCH - for backward compatibility
router.patch('/api/admin-settings', requireAuth, async (req, res) => {
  try {
    // Get existing settings
    const existingSettings = await db.select().from(adminSettings).limit(1).get();
    
    if (!existingSettings) {
      // If no settings exist, create new settings
      const newSettings = await db.insert(adminSettings).values({
        ...req.body,
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000)
      }).returning().get();
      
      return res.json(newSettings);
    }
    
    // Update existing settings
    const updatedSettings = await db.update(adminSettings)
      .set({
        ...req.body,
        updated_at: Math.floor(Date.now() / 1000)
      })
      .where(eq(adminSettings.id, existingSettings.id))
      .returning()
      .get();
    
    res.json(updatedSettings);
  } catch (error) {
    console.error('Error updating admin subscription settings:', error);
    res.status(500).json({ error: 'Failed to update admin subscription settings' });
  }
});

// Get all users (admin only)
router.get("/users", requireAdmin, async (req: Request, res: Response) => {
  try {
    const now = Math.floor(Date.now() / 1000);
    
    // Get users with their settings to determine subscription status
    const usersData = await db
      .select({
        user: users,
        settings: userSettings
      })
      .from(users)
      .leftJoin(userSettings, eq(users.id, userSettings.user_id))
      .orderBy(desc(users.created_at));
    
    // Format users with settings info
    const formattedUsers = usersData.map(data => {
      const isPro = !!(data.settings?.is_pro && 
                     data.settings?.subscription_end_date && 
                     data.settings.subscription_end_date > now);
      
      return {
        ...data.user,
        settings: {
          is_pro: isPro,
          subscription_end_date: data.settings?.subscription_end_date
        },
        gemini_calls_count: data.settings?.gemini_calls_count || 0,
        lastLoginFormatted: data.user.last_login ? new Date(data.user.last_login * 1000).toISOString() : null
      };
    });
    
    return res.json({ users: formattedUsers });
  } catch (error) {
    console.error("Error getting users:", error);
    return res.status(500).json({ error: "Failed to get users" });
  }
});

export default router;