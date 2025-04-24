import dotenv from 'dotenv';
import { createClient, type Client } from '@libsql/client';
import { sendNotificationEmail, emailTemplates } from '../../lib/email';

// Add a set to track items currently being processed to detect concurrency
const currentlyProcessingItems = new Set<string>();

dotenv.config();

// Type definitions
interface User {
  id: number;
  email: string;
  name?: string;
}

interface Task {
  id: number;
  title: string;
  description?: string;
  due_date: number;
  priority?: string;
  completed: boolean;
  is_recurring: boolean;
  recurrence_pattern?: string;
  recurrence_interval?: number;
  recurrence_end_date?: number;
  parent_task_id?: number;
  user_id: number;
  email: string;
  name?: string;
}

interface Meeting {
  id: number;
  title: string;
  description?: string;
  start_time: number;
  end_time: number;
  location?: string;
  is_recurring: boolean;
  recurrence_pattern?: string;
  recurrence_interval?: number;
  recurrence_end_date?: number;
  parent_meeting_id?: number;
  user_id: number;
  email: string;
  name?: string;
}

interface Appointment {
  id: number;
  title: string;
  description?: string;
  start_time: number;
  location?: string;
  is_recurring: boolean;
  recurrence_pattern?: string;
  recurrence_interval?: number;
  recurrence_end_date?: number;
  parent_appointment_id?: number;
  user_id: number;
  email: string;
  name?: string;
}

interface NotificationLog {
  id: number;
  item_id: number;
  item_type: string;
  sent_at: number;
}

interface UserSettings {
  id: number;
  user_id: number;
  notifications_enabled: boolean;
  email_notifications_enabled: boolean;
  show_notifications: boolean;
}

type NotificationType = 'task' | 'meeting' | 'appointment';

// Initialize Turso client
const db: Client = createClient({
  url: process.env.TURSO_DATABASE_URL as string,
  authToken: process.env.TURSO_AUTH_TOKEN as string
});

// Get user notification settings
async function getUserSettings(userId: number): Promise<UserSettings | null> {
  try {
    const result = await db.execute({
      sql: `SELECT * FROM user_settings WHERE user_id = ?`,
      args: [userId]
    });

    if (result.rows.length === 0) {
      // If no settings found, return default settings with notifications enabled
      return {
        id: 0,
        user_id: userId,
        notifications_enabled: true,
        email_notifications_enabled: true,
        show_notifications: true
      };
    }

    return result.rows[0] as unknown as UserSettings;
  } catch (error) {
    console.error("Error fetching user settings:", error);
    return null;
  }
}

// Send an email notification using the existing email library
async function sendEmailNotification(
  type: NotificationType, 
  item: Task | Meeting | Appointment, 
  user: User
): Promise<boolean> {
  try {
    // Check user notification settings before sending
    const userSettings = await getUserSettings(user.id);
    
    // Skip sending if notifications are disabled or email notifications specifically are disabled
    if (!userSettings || !userSettings.notifications_enabled || !userSettings.email_notifications_enabled) {
      return false;
    }
    
    let emailData;
    
    // Use the existing email templates from email.ts based on type
    if (type === 'task') {
      const task = item as Task;
      emailData = emailTemplates.taskReminder(user.name || 'there', task.title, task.due_date);
    } 
    else if (type === 'meeting') {
      const meeting = item as Meeting;
      emailData = emailTemplates.meetingReminder(user.name || 'there', meeting.title, meeting.start_time, meeting.location);
    }
    else if (type === 'appointment') {
      const appointment = item as Appointment;
      emailData = emailTemplates.appointmentReminder(user.name || 'there', appointment.title, appointment.start_time, appointment.location);
    }
    else {
      throw new Error(`Unknown notification type: ${type}`);
    }
    
    // Send email using the existing email service
    await sendNotificationEmail(user.email, emailData.subject, emailData.text, emailData.html);
    return true;
  } 
  catch (error) {
    console.error(`Error sending ${type} email notification:`, error);
    return false;
  }
}

// Notification check for tasks
async function checkTaskNotifications(): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  
  try {
    // Find tasks due in approximately 24 hours
    // Use a 10-minute window to avoid missing anything due to job timing
    const TWENTY_FOUR_HOURS = 24 * 60 * 60;
    const windowStart = now + TWENTY_FOUR_HOURS - 5 * 60; // 23h55m from now
    const windowEnd = now + TWENTY_FOUR_HOURS + 5 * 60;   // 24h05m from now
    
    const result = await db.execute({
      sql: `
        SELECT 
          t.id, t.title, t.description, t.due_date, t.priority, t.completed, 
          t.is_recurring, t.recurrence_pattern, t.recurrence_interval, 
          t.recurrence_end_date, t.parent_task_id,
          u.id as user_id, u.email, u.name
        FROM tasks t
        JOIN users u ON t.user_id = u.id
        WHERE t.due_date BETWEEN ? AND ?
          AND t.completed = 0
          AND (t.parent_task_id IS NOT NULL OR t.is_recurring = 0)
      `,
      args: [windowStart, windowEnd]
    });
    
    // Process each task
    for (const task of result.rows as unknown as Task[]) {
      const itemKey = `task-${task.id}`;
      // --- Concurrency Check START ---
      if (currentlyProcessingItems.has(itemKey)) {
        continue; // Skip this task in this invocation
      }
      currentlyProcessingItems.add(itemKey);
      // --- Concurrency Check END ---
      
      try {
        // Check if we've already sent a notification for this task recently
        const logResult = await db.execute({
          sql: `SELECT 1 FROM notification_log 
                WHERE item_id = ? AND item_type = 'task' 
                AND sent_at > ? 
                LIMIT 1`, 
          args: [task.id, now - 23 * 60 * 60] // Last 23 hours
        });
        
        if (logResult.rows.length === 0) {
          const success = await sendEmailNotification('task', task, {
            id: task.user_id,
            email: task.email,
            name: task.name
          });
          
          if (success) {
            try {
               await db.execute({
                sql: `INSERT INTO notification_log (item_id, item_type, sent_at) 
                      VALUES (?, ?, ?)`, 
                args: [task.id, 'task', now]
              });
            } catch (logError) {
              console.error(`[PID: ${process.pid}] [LOG FAILURE] FAILED to log notification for task ${task.id} after sending email! Error:`, logError);
            }
          }
        }
      } finally {
        // --- Ensure item is removed from processing set --- 
        currentlyProcessingItems.delete(itemKey);
      }
    }
  } catch (error) {
    console.error(`[PID: ${process.pid}] Error checking task notifications:`, error);
  }
}

// Notification check for meetings
async function checkMeetingNotifications(): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  
  try {
    // Find meetings starting in approximately 1 hour
    const ONE_HOUR = 60 * 60;
    const windowStart = now + ONE_HOUR - 5 * 60; // 55min from now
    const windowEnd = now + ONE_HOUR + 5 * 60;   // 65min from now
    
    const result = await db.execute({
      sql: `
        SELECT 
          m.id, m.title, m.description, m.start_time, m.end_time, 
          m.location, m.is_recurring, m.recurrence_pattern, 
          m.recurrence_interval, m.recurrence_end_date, m.parent_meeting_id,
          u.id as user_id, u.email, u.name
        FROM meetings m
        JOIN users u ON m.user_id = u.id
        WHERE m.start_time BETWEEN ? AND ?
          AND (m.parent_meeting_id IS NOT NULL OR m.is_recurring = 0)
      `,
      args: [windowStart, windowEnd]
    });
    
    // Process each meeting
    for (const meeting of result.rows as unknown as Meeting[]) {
      const itemKey = `meeting-${meeting.id}`;
      // --- Concurrency Check START ---
      if (currentlyProcessingItems.has(itemKey)) {
        continue; 
      }
      currentlyProcessingItems.add(itemKey);
      // --- Concurrency Check END ---
      
      try {
        // Check log
        const logResult = await db.execute({
          sql: `SELECT 1 FROM notification_log 
                WHERE item_id = ? AND item_type = 'meeting' 
                AND sent_at > ? 
                LIMIT 1`,
          args: [meeting.id, now - 2 * 60 * 60] // Last 2 hours
        });
        
        if (logResult.rows.length === 0) {
          const success = await sendEmailNotification('meeting', meeting, {
            id: meeting.user_id,
            email: meeting.email,
            name: meeting.name
          });
          
          if (success) {
            try {
              await db.execute({
                sql: `INSERT INTO notification_log (item_id, item_type, sent_at) 
                      VALUES (?, ?, ?)`, 
                args: [meeting.id, 'meeting', now]
              });
            } catch (logError) {
               console.error(`[PID: ${process.pid}] [LOG FAILURE] FAILED to log notification for meeting ${meeting.id} after sending email! Error:`, logError);
            }
          }
        }
      } finally {
         // --- Ensure item is removed from processing set --- 
        currentlyProcessingItems.delete(itemKey);
      }
    }
  } catch (error) {
    console.error(`[PID: ${process.pid}] Error checking meeting notifications:`, error);
  }
}

// Notification check for appointments
async function checkAppointmentNotifications(): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  
  try {
    // Find appointments due in approximately 24 hours
    const TWENTY_FOUR_HOURS = 24 * 60 * 60;
    const windowStart = now + TWENTY_FOUR_HOURS - 5 * 60;
    const windowEnd = now + TWENTY_FOUR_HOURS + 5 * 60;
    
    const result = await db.execute({
      sql: `
        SELECT 
          a.id, a.title, a.description, a.start_time, a.location, 
          a.is_recurring, a.recurrence_pattern, 
          a.recurrence_interval, a.recurrence_end_date, a.parent_appointment_id,
          u.id as user_id, u.email, u.name
        FROM appointments a
        JOIN users u ON a.user_id = u.id
        WHERE a.start_time BETWEEN ? AND ?
          AND (a.parent_appointment_id IS NOT NULL OR a.is_recurring = 0)
      `,
      args: [windowStart, windowEnd]
    });
    
    // Process each appointment
    for (const appointment of result.rows as unknown as Appointment[]) {
      const itemKey = `appointment-${appointment.id}`;
      // --- Concurrency Check START ---
       if (currentlyProcessingItems.has(itemKey)) {
        continue;
      }
      currentlyProcessingItems.add(itemKey);
      // --- Concurrency Check END ---
      
      try {
        // Check log
        const logResult = await db.execute({
          sql: `SELECT 1 FROM notification_log 
                WHERE item_id = ? AND item_type = 'appointment' 
                AND sent_at > ? 
                LIMIT 1`,
          args: [appointment.id, now - 23 * 60 * 60]
        });
        
        if (logResult.rows.length === 0) {
          const success = await sendEmailNotification('appointment', appointment, {
            id: appointment.user_id,
            email: appointment.email,
            name: appointment.name
          });
          
          if (success) {
            try {
              await db.execute({
                sql: `INSERT INTO notification_log (item_id, item_type, sent_at) 
                      VALUES (?, ?, ?)`, 
                args: [appointment.id, 'appointment', now]
              });
            } catch (logError) {
               console.error(`[PID: ${process.pid}] [LOG FAILURE] FAILED to log notification for appointment ${appointment.id} after sending email! Error:`, logError);
            }
          }
        }
      } finally {
        // --- Ensure item is removed from processing set --- 
        currentlyProcessingItems.delete(itemKey);
      }
    }
  } catch (error) {
    console.error(`[PID: ${process.pid}] Error checking appointment notifications:`, error);
  }
}

// Run all notification checks
async function runNotificationChecks(): Promise<void> {
  const startTime = Date.now();
  
  // Run checks for all entity types
  await checkTaskNotifications();
  await checkMeetingNotifications();
  await checkAppointmentNotifications();
  
  const duration = (Date.now() - startTime) / 1000;
  
  // Schedule next run
  const delay = 15 * 60 * 1000; // 15 minutes
  setTimeout(runNotificationChecks, delay);
}

// Clean up old notification logs (keep last 30 days only)
async function cleanupNotificationLogs(): Promise<void> {
  try {
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
    
    const result = await db.execute({
      sql: "DELETE FROM notification_log WHERE sent_at < ?",
      args: [thirtyDaysAgo]
    });
  } catch (error) {
    console.error("Error cleaning up notification logs:", error);
  }
}

// Start the notification system
async function startNotificationSystem(): Promise<void> {
  try {
    // Create notification_log table if it doesn't exist
    await db.execute({
      sql: `
        CREATE TABLE IF NOT EXISTS notification_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          item_id INTEGER NOT NULL,
          item_type TEXT NOT NULL,
          sent_at INTEGER NOT NULL
        )
      `
    });
    
    // Create index if it doesn't exist (safely)
    try {
      await db.execute({
        sql: "CREATE INDEX idx_notification_item ON notification_log(item_id, item_type)"
      });
    } catch (err) {
      // Index probably already exists - ignore
    }
    
    // Clean up old notification logs on startup
    await cleanupNotificationLogs();
    
    // Set up daily cleanup
    setInterval(cleanupNotificationLogs, 24 * 60 * 60 * 1000);
    
    // Start notification checks
    runNotificationChecks();
  } catch (error) {
    console.error("Error starting notification system:", error);
    setTimeout(startNotificationSystem, 5 * 60 * 1000);
  }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  console.error("Uncaught exception:", err);
  // Continue running - don't crash the notification service
});

// Start the system
startNotificationSystem();

export {
  startNotificationSystem,
  sendEmailNotification,
  checkTaskNotifications,
  checkMeetingNotifications,
  checkAppointmentNotifications
}; 