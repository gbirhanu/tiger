// Test email sending functionality using CommonJS
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

// Dynamically import ESM modules
(async function() {
  try {
    // Use dynamic import for ESM modules
    const emailModule = await import('../server/lib/email.js');
    const { sendNotificationEmail, initializeEmailService, emailTemplates } = emailModule;
    
    console.log('Initializing email service...');
    await initializeEmailService();
    
    console.log('Email service initialized, sending test email...');
    console.log('Using email configuration:');
    console.log(`- Host: ${process.env.EMAIL_HOST}`);
    console.log(`- Port: ${process.env.EMAIL_PORT}`);
    console.log(`- User: ${process.env.EMAIL_USER}`);
    console.log(`- From: ${process.env.EMAIL_FROM}`);
    console.log(`- Secure: ${process.env.EMAIL_SECURE}`);
    
    // Use your own email for testing
    const recipientEmail = 'test@tiger.gbtecks.com'; // Test email for debugging
    const testTemplate = emailTemplates.test('Test User');
    
    console.log(`Sending test email to ${recipientEmail}...`);
    
    // Send test email
    const result = await sendNotificationEmail(
      recipientEmail,
      testTemplate.subject,
      testTemplate.text,
      testTemplate.html
    );
    
    console.log('Email sent successfully!');
    console.log('Result:', result);
    
    if (result.previewURL) {
      console.log('Preview URL (for test accounts):', result.previewURL);
    }
  } catch (error) {
    console.error('Error in test script:', error);
    console.error('Error message:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    if (error.response) {
      console.error('SMTP Response:', error.response);
    }
    
    process.exit(1);
  }
})(); 