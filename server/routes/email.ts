import { Router, Request, Response } from "express";
import { requireAuth } from "../lib/auth";
import { sendNotificationEmail, emailTemplates, initializeEmailService } from "../lib/email";
import { getUserByEmail } from "../lib/users";
import { db } from "../lib/db";
import { sql } from "drizzle-orm";

// Import client for raw SQL operations
import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

const router = Router();

// Load environment variables
dotenv.config();

// Get the Turso DB URL and auth token from environment variables
const tursoUrl = process.env.TURSO_DATABASE_URL 
const tursoAuthToken = process.env.TURSO_AUTH_TOKEN 

// Initialize Turso client for raw queries
const client = createClient({
  url: tursoUrl || "libsql://tiger-gadeba.aws-eu-west-1.turso.io",
  authToken: tursoAuthToken,
});

// Apply auth middleware to all routes
router.use(requireAuth);

// Ensure scheduled_notifications table exists
const ensureScheduledNotificationsTable = async () => {
  try {
    // Check if table exists
    const tableExists = await client.execute({ 
      sql: `SELECT name FROM sqlite_master WHERE type='table' AND name='scheduled_notifications'`
    });
    
    if (tableExists.rows.length === 0) {
      // Create table if it doesn't exist
      await client.execute({ 
        sql: `CREATE TABLE IF NOT EXISTS scheduled_notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          email TEXT NOT NULL,
          type TEXT NOT NULL,
          item_id TEXT NOT NULL,
          title TEXT NOT NULL,
          scheduled_time INTEGER NOT NULL,
          data TEXT,
          sent INTEGER DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER
        )`
      });
      
      // Create index for faster lookups
      await client.execute({ 
        sql: `CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_time 
              ON scheduled_notifications(scheduled_time, sent)`
      });
    } 
  } catch (error) {
    console.error("Error ensuring scheduled_notifications table:", error);
  }
};

// Call once on server startup
ensureScheduledNotificationsTable();

// Helper function to schedule an email notification
const scheduleNotification = async (
  userId: string | number,
  email: string,
  type: string,
  itemId: string,
  title: string,
  scheduledTime: number,
  data: any = {}
) => {
  try {
    // Convert to string if needed
    const userIdStr = userId.toString();
    const dataJson = JSON.stringify(data);
    const now = Math.floor(Date.now() / 1000);
    
    // Store in database using parameterized query
    await client.execute({ 
      sql: `INSERT INTO scheduled_notifications 
            (user_id, email, type, item_id, title, scheduled_time, data, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [userIdStr, email, type, itemId, title, scheduledTime, dataJson, now]
    });
    
    return true;
  } catch (error) {
    console.error("Error scheduling notification:", error);
    return false;
  }
};

// TASK REMINDER: Schedule task reminder email
router.post("/schedule-task-reminder", async (req: Request, res: Response) => {
  try {
    const { email, taskTitle, taskId, dueDate, userId } = req.body;
    
    if (!email || !taskTitle || !taskId || !userId || !dueDate) {
      return res.status(400).json({ 
        error: "Email, task title, task ID, user ID, and due date are required" 
      });
    }
    
    // Calculate when to send the reminder (30 minutes before due time)
    const dueTime = typeof dueDate === 'number' ? dueDate : parseInt(dueDate, 10);
    const reminderTime = dueTime - (30 * 60); // 30 minutes before due time
    
    // Schedule notification
    const scheduled = await scheduleNotification(
      userId,
      email,
      'task',
      taskId,
      taskTitle,
      reminderTime,
      { dueDate: dueTime }
    );
    
    if (!scheduled) {
      return res.status(500).json({ error: "Failed to schedule task reminder" });
    }
    
    // For immediate testing - send an immediate email as well
    try {
      // Get user name
      const user = await getUserByEmail(email);
      const name = user?.name || "there";
      
      // Create task template
      const template = emailTemplates.taskReminder(name, taskTitle, dueTime);
      
      // Send the email immediately for testing
      const emailResult = await sendNotificationEmail(
        email,
        template.subject,
        template.text,
        template.html
      );
    
    res.json({ 
      success: true, 
      message: "Task reminder scheduled successfully",
        scheduledTime: reminderTime,
        testEmailSent: true
      });
    } catch (emailError) {
      console.error("[Email Service] Error sending immediate test email:", emailError);
      res.json({ 
        success: true, 
        message: "Task reminder scheduled successfully but test email failed",
        scheduledTime: reminderTime,
        testEmailSent: false,
        error: emailError instanceof Error ? emailError.message : "Unknown error"
      });
    }
  } catch (error) {
    console.error("[Email Service] Error scheduling task reminder:", error);
    res.status(500).json({ error: "Failed to schedule task reminder" });
  }
});

// MEETING REMINDER: Schedule meeting reminder email
router.post("/schedule-meeting-reminder", async (req: Request, res: Response) => {
  try {
    const { email, meetingTitle, meetingId, startTime, meetingLink, userId } = req.body;
    
    if (!email || !meetingTitle || !meetingId || !userId || !startTime) {
      return res.status(400).json({ 
        error: "Email, meeting title, meeting ID, user ID, and start time are required" 
      });
    }
    
    // Calculate when to send the reminder (30 minutes before start time)
    const startTimeValue = typeof startTime === 'number' ? startTime : parseInt(startTime, 10);
    const reminderTime = startTimeValue - (30 * 60); // 30 minutes before start
    
    // Schedule notification
    const scheduled = await scheduleNotification(
      userId,
      email,
      'meeting',
      meetingId,
      meetingTitle,
      reminderTime,
      { 
        startTime: startTimeValue,
        meetingLink: meetingLink || null
      }
    );
    
    if (!scheduled) {
      return res.status(500).json({ error: "Failed to schedule meeting reminder" });
    }
    
    // For immediate testing - send an immediate email as well
    try {
      // Get user name
        const user = await getUserByEmail(email);
        const name = user?.name || "there";
        
      // Create meeting template
      const template = emailTemplates.meetingReminder(name, meetingTitle, startTimeValue, meetingLink);
      
      // Send the email immediately for testing
      const emailResult = await sendNotificationEmail(
        email,
        template.subject,
        template.text,
        template.html
      );
    
    res.json({
      success: true,
        message: "Meeting reminder scheduled successfully",
        scheduledTime: reminderTime,
        testEmailSent: true
      });
    } catch (emailError) {
      console.error("[Email Service] Error sending immediate test email:", emailError);
      res.json({ 
        success: true, 
        message: "Meeting reminder scheduled successfully but test email failed",
        scheduledTime: reminderTime,
        testEmailSent: false,
        error: emailError instanceof Error ? emailError.message : "Unknown error"
      });
    }
  } catch (error) {
    console.error("[Email Service] Error scheduling meeting reminder:", error);
    res.status(500).json({ error: "Failed to schedule meeting reminder" });
  }
});

// APPOINTMENT REMINDER: Schedule appointment reminder email
router.post("/schedule-appointment-reminder", async (req: Request, res: Response) => {
  try {
    const { email, appointmentTitle, appointmentId, dueDate, location, userId } = req.body;
    
    if (!email || !appointmentTitle || !appointmentId || !userId || !dueDate) {
      return res.status(400).json({ 
        error: "Email, appointment title, appointment ID, user ID, and due date are required" 
      });
    }
    
    // Calculate when to send the reminder (30 minutes before due time)
    const dueTime = typeof dueDate === 'number' ? dueDate : parseInt(dueDate, 10);
    const reminderTime = dueTime - (30 * 60); // 30 minutes before due time
    
    // Schedule notification
    const scheduled = await scheduleNotification(
      userId,
      email,
      'appointment',
      appointmentId,
      appointmentTitle,
      reminderTime,
      { 
        dueDate: dueTime,
        location: location || null
      }
    );
    
    if (!scheduled) {
      return res.status(500).json({ error: "Failed to schedule appointment reminder" });
    }
    
    // For immediate testing - send an immediate email as well
    try {
      // Get user name
        const user = await getUserByEmail(email);
        const name = user?.name || "there";
        
      // Create appointment template
      const template = emailTemplates.appointmentReminder(name, appointmentTitle, dueTime, location);
      
      // Send the email immediately for testing
      const emailResult = await sendNotificationEmail(
        email,
        template.subject,
        template.text,
        template.html
      );
    
    res.json({
      success: true,
        message: "Appointment reminder scheduled successfully",
        scheduledTime: reminderTime,
        testEmailSent: true
      });
    } catch (emailError) {
      console.error("[Email Service] Error sending immediate test email:", emailError);
      res.json({ 
        success: true, 
        message: "Appointment reminder scheduled successfully but test email failed",
        scheduledTime: reminderTime,
        testEmailSent: false,
        error: emailError instanceof Error ? emailError.message : "Unknown error"
      });
    }
  } catch (error) {
    console.error("[Email Service] Error scheduling appointment reminder:", error);
    res.status(500).json({ error: "Failed to schedule appointment reminder" });
  }
});

export default router; 