import nodemailer from "nodemailer";

// Create a test account for development if no email credentials
let testAccount: any = null;

// Configure email transporter
let transporter: nodemailer.Transporter;

// Initialize the email service
export async function initializeEmailService() {
  // Check if we have email credentials in .env
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    // Use real credentials
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || "smtp.gmail.com",
      port: parseInt(process.env.EMAIL_PORT || "587"),
      secure: process.env.EMAIL_SECURE === "true",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
    
    console.log("Email service initialized with real credentials");
  } else {
    // For development - create a test account with ethereal.email
    testAccount = await nodemailer.createTestAccount();
    
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    
    console.log("Email service initialized with test account:", testAccount.user);
  }
}

// Send a notification email
export async function sendNotificationEmail(to: string, subject: string, text: string, html?: string) {
  try {
    // Initialize if not already done
    if (!transporter) {
      await initializeEmailService();
    }
    
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"Tiger App" <notifications@tigerapp.com>',
      to,
      subject,
      text,
      html: html || text,
    });
    
    // If using a test account, log the preview URL
    if (testAccount) {
      console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
    }
    
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}

// Templates
export const emailTemplates = {
  // Test email template
  test: (recipientName: string = "there") => ({
    subject: "Test Email from Tiger App",
    text: `Hello ${recipientName}, this is a test email from Tiger App to verify that the email service is working correctly.`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #4f46e5;">Tiger App Email Service</h2>
        <p>Hello ${recipientName},</p>
        <p>This is a test email from Tiger App to verify that the email service is working correctly.</p>
        <p>If you received this email, it means the email notification system is working!</p>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px;">
          <p>This is an automated message from Tiger App. Please do not reply to this email.</p>
        </div>
      </div>
    `,
  }),
  
  // Task reminder template
  taskReminder: (recipientName: string, taskTitle: string, dueDate?: number) => ({
    subject: `Reminder: Task "${taskTitle}" is due soon`,
    text: `Hello ${recipientName}, don't forget your task "${taskTitle}" is due ${dueDate ? `on ${new Date(dueDate * 1000).toLocaleString()}` : 'soon'}.`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #4f46e5;">Task Reminder</h2>
        <p>Hello ${recipientName},</p>
        <p>Don't forget your task <strong>"${taskTitle}"</strong> is due ${dueDate ? `on <strong>${new Date(dueDate * 1000).toLocaleString()}</strong>` : 'soon'}.</p>
        <a href="${process.env.APP_URL || 'http://localhost:3000'}/tasks" style="display: inline-block; background-color: #4f46e5; color: white; padding: 10px 15px; text-decoration: none; border-radius: 4px; margin-top: 15px;">View Task</a>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px;">
          <p>This is an automated message from Tiger App. Please do not reply to this email.</p>
          <p>You're receiving this because you have notifications enabled in your <a href="${process.env.APP_URL || 'http://localhost:3000'}/profile">profile settings</a>.</p>
        </div>
      </div>
    `,
  }),
  
  // Meeting reminder template
  meetingReminder: (recipientName: string, meetingTitle: string, startTime: number, meetingLink?: string) => ({
    subject: `Reminder: Meeting "${meetingTitle}" starts soon`,
    text: `Hello ${recipientName}, your meeting "${meetingTitle}" is scheduled to start at ${new Date(startTime * 1000).toLocaleString()}.${meetingLink ? ` Meeting link: ${meetingLink}` : ''}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #4f46e5;">Meeting Reminder</h2>
        <p>Hello ${recipientName},</p>
        <p>Your meeting <strong>"${meetingTitle}"</strong> is scheduled to start at <strong>${new Date(startTime * 1000).toLocaleString()}</strong>.</p>
        ${meetingLink ? `<p>Join using this link: <a href="${meetingLink}">${meetingLink}</a></p>` : ''}
        <a href="${process.env.APP_URL || 'http://localhost:3000'}/meetings" style="display: inline-block; background-color: #4f46e5; color: white; padding: 10px 15px; text-decoration: none; border-radius: 4px; margin-top: 15px;">View Calendar</a>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px;">
          <p>This is an automated message from Tiger App. Please do not reply to this email.</p>
          <p>You're receiving this because you have notifications enabled in your <a href="${process.env.APP_URL || 'http://localhost:3000'}/profile">profile settings</a>.</p>
        </div>
      </div>
    `,
  }),
}; 