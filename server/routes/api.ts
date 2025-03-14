import { Router, Request, Response } from "express";
import { db } from "../../shared/db";
import { 
  tasks, notes, appointments, meetings, pomodoroSettings, userSettings, subtasks,
  type Task, type Subtask,
  insertNoteSchema
} from "../../shared/schema";
import { eq, sql, and } from "drizzle-orm";
import { z } from "zod";
import { addDays, addWeeks, addMonths, addYears } from "date-fns";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { requireAuth } from "../lib/auth";

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
    console.log("Received task data:", JSON.stringify(req.body));
    
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
      completed: result.data.completed ? 1 : 0,
      all_day: result.data.all_day ? 1 : 0,
      is_recurring: result.data.is_recurring ? 1 : 0
    };
    
    console.log("Sanitized task values:", JSON.stringify(taskValues));
    
    const task = await db.insert(tasks).values(taskValues).returning().get();
    res.json(task);
  } catch (error) {
    console.error("Error creating task:", error);
    res.status(500).json({ error: "Failed to create task" });
  }
});

router.put("/tasks/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.id);
    console.log("Updating task. Current data:", req.body);
     
    // Check if task exists
    const existingTask = await db.select().from(tasks).where(eq(tasks.id, taskId));
    if (existingTask.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }
    
    // Create a clean update object with just the properties we want to update
    const updateData: Partial<typeof tasks.$inferInsert> = {};
    
    // Only include properties that are explicitly provided
    if ('completed' in req.body) {
      updateData.completed = Boolean(req.body.completed);
    }
    if ('title' in req.body) updateData.title = req.body.title;
    if ('description' in req.body) updateData.description = req.body.description;
    if ('priority' in req.body) updateData.priority = req.body.priority;
    if ('due_date' in req.body) {
      updateData.due_date = req.body.due_date ? Math.floor(Number(req.body.due_date)) : null;
    }
    if ('is_recurring' in req.body) {
      updateData.is_recurring = Boolean(req.body.is_recurring);
      // If turning off recurring, clear related fields
      if (!req.body.is_recurring) {
        updateData.recurrence_pattern = null;
        updateData.recurrence_interval = null;
        updateData.recurrence_end_date = null;
      }
    }
    if ('recurrence_pattern' in req.body) {
      updateData.recurrence_pattern = req.body.is_recurring === true ? req.body.recurrence_pattern : null;
    }
    if ('recurrence_interval' in req.body) {
      updateData.recurrence_interval = req.body.is_recurring === true ? req.body.recurrence_interval : null;
    }
    if ('recurrence_end_date' in req.body) {
      updateData.recurrence_end_date = req.body.is_recurring === true && req.body.recurrence_end_date ? 
        Math.floor(Number(req.body.recurrence_end_date)) : 
        null;
    }

    console.log("Processing update data:", updateData);

    // Let SQLite update the updated_at field automatically

    // Update the task
    const updatedTask = await db
      .update(tasks)
      .set(updateData)
      .where(eq(tasks.id, taskId))
      .returning()
      .get();

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
            completed: 0,
            due_date: Math.floor(currentDate.getTime() / 1000),
            parent_task_id: taskId,
            is_recurring: 0,
            recurrence_pattern: null,
            recurrence_interval: null,
            recurrence_end_date: null,
          });
        }
      }
    }

    console.log("Updated task:", updatedTask);
    res.json(updatedTask);
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
    console.log("Updating task. Current data:", req.body);
    
    // Get the current task
    const currentTask = await db.select().from(tasks).where(eq(tasks.id, id)).get();
    if (!currentTask) {
      return res.status(404).json({ error: "Task not found" });
    }

    // Create a clean update object with just the properties we want to update
    const updateData: Partial<typeof tasks.$inferInsert> = {};
    
    // Only include properties that are explicitly provided
    if ('completed' in req.body) {
      updateData.completed = req.body.completed === true ? 1 : 0;
    }
    if ('title' in req.body) updateData.title = req.body.title;
    if ('description' in req.body) updateData.description = req.body.description;
    if ('priority' in req.body) updateData.priority = req.body.priority;
    if ('due_date' in req.body) {
      updateData.due_date = req.body.due_date ? Math.floor(Number(req.body.due_date)) : null;
    }
    if ('is_recurring' in req.body) {
      updateData.is_recurring = req.body.is_recurring === true ? 1 : 0;
      // If turning off recurring, clear related fields
      if (!req.body.is_recurring) {
        updateData.recurrence_pattern = null;
        updateData.recurrence_interval = null;
        updateData.recurrence_end_date = null;
      }
    }
    if ('recurrence_pattern' in req.body) {
      updateData.recurrence_pattern = req.body.is_recurring === true ? req.body.recurrence_pattern : null;
    }
    if ('recurrence_interval' in req.body) {
      updateData.recurrence_interval = req.body.is_recurring === true ? req.body.recurrence_interval : null;
    }
    if ('recurrence_end_date' in req.body) {
      updateData.recurrence_end_date = req.body.is_recurring === true && req.body.recurrence_end_date ? 
        Math.floor(Number(req.body.recurrence_end_date)) : 
        null;
    }

    console.log("Processing update data:", updateData);

    // Update the task
    const updatedTask = await db.update(tasks)
      .set(updateData)
      .where(eq(tasks.id, id))
      .returning()
      .get();

    // If this is a parent task and due_date was updated, update future instances
    if (updateData.due_date && !currentTask.parent_task_id) {
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
            completed: 0,
            due_date: Math.floor(currentDate.getTime() / 1000),
            parent_task_id: id,
            is_recurring: 0,
            recurrence_pattern: null,
            recurrence_interval: null,
            recurrence_end_date: null,
          });
        }
      }
    }

    console.log("Updated task:", updatedTask);
    res.json(updatedTask);
  } catch (error) {
    console.error("Error updating task:", error);
    res.status(400).json({ error: "Invalid update data" });
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
router.get("/notes", requireAuth, async (_req: Request, res: Response) => {
  try {
    const allNotes = await db.select().from(notes);
    res.json(allNotes);
  } catch (error) {
    console.error("Error fetching notes:", error);
    res.status(500).json({ error: "Failed to fetch notes" });
  }
});

router.get("/notes/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const noteId = parseInt(req.params.id);
    const note = await db.select().from(notes).where(eq(notes.id, noteId));
    
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
    
    // Check if note exists
    const existingNote = await db.select().from(notes).where(eq(notes.id, noteId));
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
      .set(result.data)
      .where(eq(notes.id, noteId))
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
    
    // Check if note exists
    const existingNote = await db.select().from(notes).where(eq(notes.id, noteId));
    if (existingNote.length === 0) {
      return res.status(404).json({ error: "Note not found" });
    }
    
    await db.delete(notes).where(eq(notes.id, noteId));
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting note:", error);
    res.status(500).json({ error: "Failed to delete note" });
  }
});

// Appointments
router.get("/appointments", requireAuth, async (req, res) => {
  try {
    const allAppointments = await db.select().from(appointments);
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

router.post("/appointments", requireAuth, async (req, res) => {
  try {
    const newAppointment = await db.insert(appointments).values(req.body).returning();
    res.json(newAppointment[0]);
  } catch (error) {
    res.status(500).json({ error: "Failed to create appointment" });
  }
});

router.patch("/appointments/:id", requireAuth, async (req, res) => {
  try {
    const appointmentId = parseInt(req.params.id);
    
    // Check if appointment exists
    const existingAppointment = await db.select().from(appointments).where(eq(appointments.id, appointmentId));
    
    if (existingAppointment.length === 0) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    
    // Update only the fields provided in the request body
    const updatedAppointment = await db
      .update(appointments)
      .set(req.body)
      .where(eq(appointments.id, appointmentId))
      .returning();
    
    res.json(updatedAppointment[0]);
  } catch (error) {
    console.error("Error updating appointment:", error);
    res.status(500).json({ error: "Failed to update appointment" });
  }
});

router.delete("/appointments/:id", requireAuth, async (req, res) => {
  try {
    const appointmentId = parseInt(req.params.id);
    
    // Check if appointment exists
    const existingAppointment = await db.select().from(appointments).where(eq(appointments.id, appointmentId));
    
    if (existingAppointment.length === 0) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    
    await db.delete(appointments).where(eq(appointments.id, appointmentId));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete appointment" });
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
    
    const updateData = {
      ...req.body,
    };
    
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
    console.log('Fetching settings for user_id:', req.userId);
    const settings = await db.select().from(userSettings).where(eq(userSettings.user_id, req.userId!));
    
    if (settings.length === 0) {
      console.log('No settings found for user, returning default values');
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
    
    console.log('Found settings for user:', settings[0]);
    res.json(settings[0]);
  } catch (error) {
    console.error("Error fetching user settings:", error);
    res.status(500).json({ error: "Failed to fetch user settings" });
  }
});

router.put("/user-settings", requireAuth, async (req, res) => {
  try {
    console.log('Received user settings update:', req.body);
    
    const settings = await db.select().from(userSettings).where(eq(userSettings.user_id, req.userId!));
    if (settings.length === 0) {
      console.log('No existing settings found, creating new settings with user_id:', req.userId);
      const newSettings = await db.insert(userSettings).values({
        ...req.body,
        user_id: req.userId!
      }).returning();
      console.log('Created new settings:', newSettings[0]);
      res.json(newSettings[0]);
    } else {
      console.log('Updating existing settings for user_id:', req.userId);
      const updatedSettings = await db
        .update(userSettings)
        .set(req.body)
        .where(eq(userSettings.user_id, req.userId!))
        .returning();
      console.log('Updated settings:', updatedSettings[0]);
      res.json(updatedSettings[0]);
    }
  } catch (error) {
    console.error('Error updating user settings:', error);
    res.status(500).json({ error: "Failed to update user settings" });
  }
});

router.patch("/user-settings", requireAuth, async (req, res) => {
  try {
    console.log('Received settings update request:', JSON.stringify(req.body));
    
    // Check if settings exist for this user
    const existingSettings = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.user_id, req.userId!));
    
    // Process work hours - ensure they are valid hour values (0-24)
    let workStartHour = undefined;
    let workEndHour = undefined;
    
    // Handle work_start_hour specially
    if ('work_start_hour' in req.body) {
      console.log('Processing work_start_hour:', JSON.stringify(req.body.work_start_hour));
      if (req.body.work_start_hour !== null && typeof req.body.work_start_hour === 'number') {
        // Ensure it's a valid hour value (0-24)
        workStartHour = Math.min(Math.max(0, Math.floor(Number(req.body.work_start_hour))), 23);
        console.log('Using work_start_hour:', workStartHour);
      }
    }
    
    // Handle work_end_hour specially
    if ('work_end_hour' in req.body) {
      console.log('Processing work_end_hour:', JSON.stringify(req.body.work_end_hour));
      if (req.body.work_end_hour !== null && typeof req.body.work_end_hour === 'number') {
        // Ensure it's a valid hour value (0-24)
        workEndHour = Math.min(Math.max(1, Math.floor(Number(req.body.work_end_hour))), 24);
        console.log('Using work_end_hour:', workEndHour);
      }
    }
    
    // If no settings exist, create new settings
    if (existingSettings.length === 0) {
      console.log('No existing settings found, creating new settings');
      
      // Create default hour values for work hours if not provided
      if (workStartHour === undefined) {
        workStartHour = 9; // Default start hour: 9 AM
      }
      
      if (workEndHour === undefined) {
        workEndHour = 17; // Default end hour: 5 PM
      }
      
      // Create a new settings object with only the fields we need
      const newSettingsData = {
        user_id: req.userId!,
        timezone: 'timezone' in req.body ? req.body.timezone : "UTC",
        theme: 'theme' in req.body ? req.body.theme : "light",
        default_calendar_view: 'default_calendar_view' in req.body ? req.body.default_calendar_view : "month",
        show_notifications: 'show_notifications' in req.body ? req.body.show_notifications : true,
        notifications_enabled: 'notifications_enabled' in req.body ? req.body.notifications_enabled : true,
        work_start_hour: workStartHour,
        work_end_hour: workEndHour
      };
      
      console.log('Creating new settings with data:', JSON.stringify(newSettingsData));
      
      const newSettings = await db
        .insert(userSettings)
        .values(newSettingsData)
        .returning();
      
      console.log('Created new settings:', newSettings[0]);
      return res.json(newSettings[0]);
    }
    
    // Update existing settings
    console.log('Updating existing settings for user_id:', req.userId);
    
    // Create update object with only the fields that are provided
    const updateData: Record<string, any> = {};
    
    if ('timezone' in req.body) updateData.timezone = req.body.timezone;
    if ('theme' in req.body) updateData.theme = req.body.theme;
    if ('default_calendar_view' in req.body) updateData.default_calendar_view = req.body.default_calendar_view;
    if ('show_notifications' in req.body) updateData.show_notifications = req.body.show_notifications;
    if ('notifications_enabled' in req.body) updateData.notifications_enabled = req.body.notifications_enabled;
    if (workStartHour !== undefined) updateData.work_start_hour = workStartHour;
    if (workEndHour !== undefined) updateData.work_end_hour = workEndHour;
    
    console.log('Final update data:', JSON.stringify(updateData));
    
    // Only update if there are fields to update
    if (Object.keys(updateData).length === 0) {
      console.log('No fields to update');
      return res.json(existingSettings[0]);
    }
    
    const result = await db
      .update(userSettings)
      .set(updateData)
      .where(eq(userSettings.user_id, req.userId!))
      .returning();
    
    console.log('Updated settings:', result[0]);
    res.json(result[0]);
    
  } catch (error) {
    console.error("Error updating user settings:", error);
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

    // First, delete existing subtasks for this task
    await db.delete(subtasks).where(eq(subtasks.task_id, taskId));

    // Then insert new subtasks with positions and completion status
    const subtaskValues = subtasksList.map((subtask: { title: string; completed: boolean }, index: number) => ({
      title: subtask.title,
      task_id: taskId,
      position: index,
      completed: Boolean(subtask.completed),
      user_id: req.userId, // Add user_id from the auth middleware
    }));

    console.log("Creating subtasks with values:", subtaskValues);
    const savedSubtasks = await db.insert(subtasks).values(subtaskValues).returning();
    res.json(savedSubtasks);

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

// Add endpoint to update subtask completion status
router.patch("/tasks/:taskId/subtasks/:subtaskId", requireAuth, async (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.taskId);
    const subtaskId = parseInt(req.params.subtaskId);
    const { completed } = req.body;

    if (typeof completed !== 'boolean') {
      return res.status(400).json({ error: "Completed status must be a boolean" });
    }

    const updatedSubtask = await db
      .update(subtasks)
      .set({ completed: Boolean(completed) })
      .where(eq(subtasks.id, subtaskId))
      .returning()
      .get();

    res.json(updatedSubtask);
  } catch (error) {
    console.error("Error updating subtask:", error);
    res.status(500).json({ error: "Failed to update subtask" });
  }
});

export default router;