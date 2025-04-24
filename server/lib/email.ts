import nodemailer from "nodemailer";
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { format, formatDistanceToNow, isFuture } from 'date-fns';

// Load environment variables
dotenv.config();

// Create a test account for development if no email credentials
let testAccount: nodemailer.TestAccount | null = null;

// Configure email transporter
let transporter: nodemailer.Transporter | null = null;
let isInitializing = false; // Flag to prevent concurrent initialization

// Initialize the email service
export async function initializeEmailService() {
  try {
    // Check if we have email credentials in .env
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      // For port 465, secure should always be true
      const port = parseInt(process.env.EMAIL_PORT || "465");
      const secure = port === 465 ? true : process.env.EMAIL_SECURE === "true";
      
      // Use real credentials
      transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: port,
        secure: secure, // true for 465, false for other ports
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        tls: {
          // Do not fail on invalid certs
          rejectUnauthorized: false
        },
      });
      
      // Test SMTP connection
      try {
        await transporter.verify();
        return; // Successfully set up real email
      } catch (error) {
        console.error("SMTP connection test failed:", error);
        // Throw an error to indicate initialization failure with real credentials
        throw new Error(`Failed to verify SMTP connection: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      // If no credentials are provided, throw an error in production/deployment scenario
      console.error("Email credentials (EMAIL_USER, EMAIL_PASS) are missing. Cannot initialize email service.");
      throw new Error("Email service requires EMAIL_USER and EMAIL_PASS environment variables.");
    }

  } catch (error) {
    console.error("Email service initialization failed:", error); // Keep error log
    // Re-throw the specific error or a generic one
    throw new Error(`Email service initialization failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Send a notification email
export async function sendNotificationEmail(to: string, subject: string, text: string, html?: string) {
  try {
    // Check if transporter exists or if initialization is already in progress
    if (!transporter && !isInitializing) {
      isInitializing = true;
      try {
        await initializeEmailService(); // Assume this sets the module-level 'transporter'
        if (!transporter) {
           // This should ideally not happen if initializeEmailService throws on failure
           console.error("[Email Service] Initialization attempt completed but transporter is still null.");
           throw new Error("initializeEmailService completed but transporter is still null.");
        }
      } catch (initError) {
        console.error("[Email Service] Initialization failed during send attempt:", initError);
        // Reset flag on failure to allow retry later
        isInitializing = false;
        throw initError; // Re-throw initialization error
      } finally {
        isInitializing = false; // Ensure flag is reset whether success or failure
      }
    } else if (isInitializing) {
      // If initialization is already happening, log error and fail fast for production
      console.error("[Email Service] Initialization already in progress. Cannot send email at this time.");
      throw new Error("Email service is currently initializing. Please try again shortly.");
    }

    // Final check for transporter before sending
    if (!transporter) {
      // This could happen if initialization failed or is still in progress from another call
      console.error("[Email Service] Transporter is not available after check/initialization attempt.");
      throw new Error("Email service transporter is not available.");
    }
    
    // Validate email address
    if (!to || typeof to !== 'string' || !to.includes('@')) {
      console.error(`[Email Service] Invalid 'to' address provided: ${to}`);
      throw new Error(`Invalid email address: ${to}`);
    }
    
    // Send email
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"Tiger App" <notifications@tigerapp.com>',
      to,
      subject,
      text,
      html: html || text,
    });
    
    return info;
  } catch (error) {
    // Avoid logging the same error twice if it came from initialization
    if (!String(error).includes("Initialization failed") && !String(error).includes("transporter is not available")) {
      console.error(`[Email Service] Error sending email to ${to}:`, error);
    }
    // Re-throw the error so the calling service knows it failed
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
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; border: 1px solid #e0e0e0; border-radius: 8px;">
        <div style="background-color: #4f46e5; padding: 15px; border-radius: 6px 6px 0 0;">
          <h2 style="color: white; margin: 0;">Tiger App Email Service</h2>
        </div>
        <div style="padding: 20px;">
          <p>Hello ${recipientName},</p>
          <p>This is a test email from Tiger App to verify that the email service is working correctly.</p>
          <p>If you received this email, it means the email notification system is working!</p>
        </div>
        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px; text-align: center;">
          <p>This is an automated message from Tiger App. Please do not reply to this email.</p>
        </div>
      </div>
    `,
  }),
  
  // Task reminder template
  taskReminder: (recipientName: string, taskTitle: string, dueDate?: number) => {
    let relativeTimeText = "soon";
    let formattedDueDate = "an upcoming date";

    if (dueDate) {
      const dueDateMillis = dueDate * 1000;
      formattedDueDate = format(new Date(dueDateMillis), "EEEE, MMMM d, yyyy 'at' h:mm a");
      // Calculate relative time only if the date is in the future
      if (isFuture(new Date(dueDateMillis))) {
        relativeTimeText = formatDistanceToNow(new Date(dueDateMillis), { addSuffix: true });
      } else {
        // Handle cases where the reminder might be generated for a past due date (edge case)
        relativeTimeText = "now past due"; 
      }
    } 
    
    const subject = `Task Reminder: ${taskTitle}`;
    // Determine base URL based on environment
    const isProduction = process.env.NODE_ENV === 'production';
    const baseUrl = isProduction 
      ? (process.env.PRODUCTION_CLIENT_URL || 'http://localhost:3000') 
      : (process.env.CLIENT_URL || 'http://localhost:3000');
    const taskLink = `${baseUrl}/#tasks`; // Link to the tasks section
    
    // Style for the relative time
    const relativeTimeStyle = "font-style: italic; color: #555555; font-weight: normal;";

    const contentHtml = `
      <h1>Task Reminder</h1>
      <p>Hi ${recipientName},</p>
      <p>Just a friendly reminder that your task is due 
        <strong style="${relativeTimeStyle}">${relativeTimeText}</strong>:
      </p>
      <div class="details-box">
        <p><strong>Task:</strong> ${taskTitle}</p>
        <p><strong>Due Date:</strong> ${formattedDueDate} 
          ${dueDate ? `<span style="${relativeTimeStyle}">(${relativeTimeText})</span>` : ''} 
        </p>
      </div>
      <p>Stay focused and get it done!</p>
      <p style="text-align: center;">
        <a href="${taskLink}" target="_blank" class="button">View Task</a>
      </p>
      <p>Best,</p>
      <p>The Tiger App Team</p>
    `;
    const text = `Hi ${recipientName},\n\nTask Reminder: ${taskTitle}\nDue: ${formattedDueDate} (${relativeTimeText})\nView Task: ${taskLink}\n\nStay focused!\n- The Tiger App Team`;
    return { subject, text, html: createEmailHtml(subject, contentHtml) };
  },
  
  // Meeting reminder template
  meetingReminder: (recipientName: string, meetingTitle: string, startTime: number, meetingLink?: string | null) => {
    const formattedStartTime = format(new Date(startTime * 1000), "EEEE, MMMM d, yyyy 'at' h:mm a");
    const subject = `Meeting Reminder: ${meetingTitle}`;
    // Determine base URL based on environment
    const isProduction = process.env.NODE_ENV === 'production';
    const baseUrl = isProduction 
      ? (process.env.PRODUCTION_CLIENT_URL || 'http://localhost:3000') 
      : (process.env.CLIENT_URL || 'http://localhost:3000');
    const meetingsLink = `${baseUrl}/#meetings`; // Link to the meetings section
    
    let contentHtml = `
      <h1>Meeting Reminder</h1>
      <p>Hi ${recipientName},</p>
      <p>This is a reminder for your upcoming meeting:</p>
      <div class="details-box">
        <p><strong>Meeting:</strong> ${meetingTitle}</p>
        <p><strong>Starts:</strong> ${formattedStartTime}</p>
        ${meetingLink ? `<p><strong>Link/Location:</strong> <a href="${meetingLink}" target="_blank">${meetingLink}</a></p>` : ''}
      </div>
    `;
    // Add Join Meeting button if link exists, otherwise add View Meetings button
    if (meetingLink) {
      contentHtml += `<p style="text-align: center;"><a href="${meetingLink}" target="_blank" class="button">Join Meeting</a></p>`;
    } else {
      contentHtml += `<p style="text-align: center;"><a href="${meetingsLink}" target="_blank" class="button">View Meetings</a></p>`;
    }
    contentHtml += `
      <p>Please be prepared and join on time.</p>
      <p>Best,</p>
      <p>The Tiger App Team</p>
    `;
    
    const text = `Hi ${recipientName},\n\nMeeting Reminder: ${meetingTitle}\nStarts: ${formattedStartTime}\n${meetingLink ? `Join Link: ${meetingLink}\n` : `View Meetings: ${meetingsLink}\n`}\nPlease be prepared.\n- The Tiger App Team`;
    return { subject, text, html: createEmailHtml(subject, contentHtml) };
  },
  
  // Appointment reminder template
  appointmentReminder: (recipientName: string, appointmentTitle: string, dueDate: number, location?: string | null) => {
    const formattedDueDate = format(new Date(dueDate * 1000), "EEEE, MMMM d, yyyy 'at' h:mm a");
    const subject = `Appointment Reminder: ${appointmentTitle}`;
    // Determine base URL based on environment
    const isProduction = process.env.NODE_ENV === 'production';
    const baseUrl = isProduction 
      ? (process.env.PRODUCTION_CLIENT_URL || 'http://localhost:3000') 
      : (process.env.CLIENT_URL || 'http://localhost:3000');
    const appointmentsLink = `${baseUrl}/#appointments`; // Link to the appointments section
    
    const contentHtml = `
      <h1>Appointment Reminder</h1>
      <p>Hi ${recipientName},</p>
      <p>This is a reminder for your upcoming appointment:</p>
      <div class="details-box">
        <p><strong>Appointment:</strong> ${appointmentTitle}</p>
        <p><strong>Date & Time:</strong> ${formattedDueDate}</p>
        ${location ? `<p><strong>Location:</strong> ${location}</p>` : ''}
      </div>
      <p style="text-align: center;">
        <a href="${appointmentsLink}" target="_blank" class="button">View Appointment</a>
      </p>
      <p>We look forward to seeing you!</p>
      <p>Best,</p>
      <p>The Tiger App Team</p>
    `;
    const text = `Hi ${recipientName},\n\nAppointment Reminder: ${appointmentTitle}\nDate & Time: ${formattedDueDate}\n${location ? `Location: ${location}\n` : ''}\nView Appointment: ${appointmentsLink}\n\nWe look forward to seeing you!\n- The Tiger App Team`;
    return { subject, text, html: createEmailHtml(subject, contentHtml) };
  },
  
  // Password reset template
  passwordReset: (recipientName: string, resetToken: string) => ({
    subject: `Reset Your Tiger App Password`,
    text: `Hello ${recipientName || 'there'}, you recently requested to reset your password for your Tiger App account. Click the link below to reset it: ${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}. This link will expire in 1 hour. If you did not request a password reset, please ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; border: 1px solid #e0e0e0; border-radius: 8px;">
        <div style="background-color: #4f46e5; padding: 15px; border-radius: 6px 6px 0 0;">
          <h2 style="color: white; margin: 0;">Password Reset Request</h2>
        </div>
        <div style="padding: 20px;">
          <p>Hello ${recipientName || 'there'},</p>
          <p>You recently requested to reset your password for your Tiger App account. Click the button below to reset it:</p>
          <div style="margin: 25px 0; text-align: center;">
            <a href="${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}" style="display: inline-block; background-color: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">Reset Your Password</a>
          </div>
          <p>This link will expire in 1 hour.</p>
          <p>If you did not request a password reset, please ignore this email.</p>
        </div>
        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px; text-align: center;">
          <p>This is an automated message from Tiger App. Please do not reply to this email.</p>
        </div>
      </div>
    `,
  }),
};

// --- Enhanced Email HTML Template Structure ---

const createEmailHtml = (title: string, contentHtml: string): string => {
  // Determine base URL based on environment
  const isProduction = process.env.NODE_ENV === 'production';
  const baseUrl = isProduction 
    ? (process.env.PRODUCTION_CLIENT_URL || 'http://localhost:3000') // Fallback for safety
    : (process.env.CLIENT_URL || 'http://localhost:3000');
    
  const logoUrl = `${baseUrl}/assets/tiger_logo.png`; // Construct logo URL
  const appName = "Tiger App";
  const currentYear = new Date().getFullYear();
  const settingsLink = `${baseUrl}/#settings-notifications`; // Construct settings link

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    /* Base styles */
    body { 
      margin: 0; 
      padding: 0; 
      font-family: 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif; 
      background-color: #f8f9fa; 
      color: #333333; 
      line-height: 1.6;
    }
    
    /* Container styles */
    .email-container { 
      max-width: 600px; 
      margin: 20px auto; 
      background-color: #ffffff; 
      border-radius: 12px; 
      overflow: hidden; 
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
    }
    
    /* Header styles */
    .email-header { 
      background: linear-gradient(to right, #fef3c7, #fde68a); 
      padding: 24px 0; 
      text-align: center; 
      border-bottom: 1px solid #f2f2f2;
    }
    
    /* Logo container */
    .logo-container {
      display: inline-block;
      padding: 10px;
      background: linear-gradient(to bottom right, #f59e0b, #d97706);
      border-radius: 50%;
      box-shadow: 0 4px 10px rgba(217, 119, 6, 0.3);
      border: 2px solid rgba(245, 158, 11, 0.4);
      margin-bottom: 5px;
    }
    
    /* Logo image */
    .logo-container img { 
      width: 50px; 
      height: 50px;
      display: block;
    }
    
    /* Brand text */
    .brand-text {
      font-size: 24px;
      font-weight: 800;
      color: #92400e;
      letter-spacing: 0.5px;
      margin-top: 8px;
    }
    
    /* Content styles */
    .email-content { 
      padding: 32px; 
      line-height: 1.7; 
      font-size: 16px; 
      color: #374151;
    }
    
    /* Headings */
    .email-content h1 { 
      color: #1f2937; 
      font-size: 24px; 
      margin-top: 0; 
      margin-bottom: 20px; 
      border-bottom: 2px solid #f8f9fa;
      padding-bottom: 10px;
    }
    
    /* Paragraphs */
    .email-content p { 
      margin-bottom: 18px; 
    }
    
    /* Bold text */
    .email-content strong { 
      color: #111827; 
      font-weight: 600;
    }
    
    /* Links */
    .email-content a { 
      color: #f59e0b; 
      text-decoration: none; 
      font-weight: 500;
    }
    .email-content a:hover { 
      text-decoration: underline; 
      color: #d97706;
    }
    
    /* Footer styles */
    .email-footer { 
      background-color: #f9fafb; 
      padding: 24px; 
      text-align: center; 
      font-size: 13px; 
      color: #6b7280; 
      border-top: 1px solid #f2f2f2;
    }
    
    /* Details box for information */
    .details-box { 
      background-color: #f9fafb; 
      border-left: 4px solid #f59e0b; 
      border-radius: 6px; 
      padding: 18px; 
      margin: 24px 0; 
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
    }
    
    /* Button styles */
    .button { 
      display: inline-block; 
      background: linear-gradient(to right, #f59e0b, #d97706); 
      color: #ffffff !important; 
      padding: 12px 24px; 
      border-radius: 6px; 
      text-decoration: none !important; 
      font-weight: 600; 
      margin-top: 12px; 
      border: none; 
      box-shadow: 0 2px 8px rgba(245, 158, 11, 0.25);
    }
    .button:hover { 
      background: linear-gradient(to right, #d97706, #b45309); 
      text-decoration: none !important; 
    }
    
    /* Footer links */
    .footer-link { 
      color: #9ca3af; 
      text-decoration: underline; 
    }
    
    /* Social links section */
    .social-links {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #f2f2f2;
    }
    
    /* Social link icon */
    .social-icon {
      display: inline-block;
      margin: 0 8px;
      width: 32px;
      height: 32px;
    }
    
    /* Responsive styles */
    @media only screen and (max-width: 480px) {
      .email-content { 
        padding: 24px 16px; 
      }
      .details-box { 
        padding: 15px; 
      }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <div class="logo-container">
        <img src="${logoUrl}" alt="${appName} Logo">
      </div>
      <div class="brand-text">Tiger</div>
    </div>
    <div class="email-content">
      ${contentHtml} 
    </div>
    <div class="email-footer">
      <p>This is an automated message from ${appName}. Please do not reply.</p>
      <p>You're receiving this because notifications are enabled in your 
        <a href="${settingsLink}" target="_blank" class="footer-link">notification settings</a>.
      </p>
      <p>&copy; ${currentYear} ${appName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;
}; 