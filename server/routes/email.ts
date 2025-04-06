import { Router, Request, Response } from "express";
import { requireAuth } from "../lib/auth";
import { sendNotificationEmail, emailTemplates, initializeEmailService } from "../lib/email";
import { getUserByEmail } from "../lib/users";

const router = Router();

// Apply auth middleware to all routes
router.use(requireAuth);

// Initialize the email service when the server starts
initializeEmailService().catch(console.error);

// Test email route
router.post("/test", async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: "Email address is required" });
    }
    
    const user = await getUserByEmail(email);
    const name = user?.name || user?.username || "there";
    
    const template = emailTemplates.test(name);
    
    await sendNotificationEmail(
      email,
      template.subject,
      template.text,
      template.html
    );
    
    res.json({ success: true, message: "Test email sent successfully" });
  } catch (error) {
    console.error("Error sending test email:", error);
    res.status(500).json({ error: "Failed to send test email" });
  }
});

// Send task reminder email
router.post("/task-reminder", async (req: Request, res: Response) => {
  try {
    const { email, taskTitle, dueDate, userId } = req.body;
    
    if (!email || !taskTitle) {
      return res.status(400).json({ error: "Email and task title are required" });
    }
    
    // Get user name if we have a userId
    let name = "there";
    if (userId) {
      const user = await getUserByEmail(email);
      if (user) {
        name = user.name || user.username || "there";
      }
    }
    
    const template = emailTemplates.taskReminder(name, taskTitle, dueDate);
    
    await sendNotificationEmail(
      email,
      template.subject,
      template.text,
      template.html
    );
    
    res.json({ success: true, message: "Task reminder email sent successfully" });
  } catch (error) {
    console.error("Error sending task reminder email:", error);
    res.status(500).json({ error: "Failed to send task reminder email" });
  }
});

// Send meeting reminder email
router.post("/meeting-reminder", async (req: Request, res: Response) => {
  try {
    const { email, meetingTitle, startTime, meetingLink, userId } = req.body;
    
    if (!email || !meetingTitle || !startTime) {
      return res.status(400).json({ error: "Email, meeting title, and start time are required" });
    }
    
    // Get user name if we have a userId
    let name = "there";
    if (userId) {
      const user = await getUserByEmail(email);
      if (user) {
        name = user.name || user.username || "there";
      }
    }
    
    const template = emailTemplates.meetingReminder(name, meetingTitle, startTime, meetingLink);
    
    await sendNotificationEmail(
      email,
      template.subject,
      template.text,
      template.html
    );
    
    res.json({ success: true, message: "Meeting reminder email sent successfully" });
  } catch (error) {
    console.error("Error sending meeting reminder email:", error);
    res.status(500).json({ error: "Failed to send meeting reminder email" });
  }
});

export default router; 