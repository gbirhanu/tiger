// Test email sending functionality using CommonJS
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');

// Load environment variables
dotenv.config();

// Create test transporter for the test
async function createTestTransporter() {
  // Force use of Ethereal test account
  console.log('Creating Ethereal test account...');
  const testAccount = await nodemailer.createTestAccount();
  console.log('Test account created:', testAccount.user);
  
  return nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
}

// Test email template
const testTemplate = {
  subject: "Test Email from Tiger App",
  text: `Hello Test User, this is a test email from Tiger App to verify that the email service is working correctly.`,
  html: `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
      <h2 style="color: #4f46e5;">Tiger App Email Service</h2>
      <p>Hello Test User,</p>
      <p>This is a test email from Tiger App to verify that the email service is working correctly.</p>
      <p>If you received this email, it means the email notification system is working!</p>
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px;">
        <p>This is an automated message from Tiger App. Please do not reply to this email.</p>
      </div>
    </div>
  `,
};

async function sendTestEmail() {
  try {
    console.log('Email config:');
    console.log('- Host:', process.env.EMAIL_HOST);
    console.log('- Port:', process.env.EMAIL_PORT);
    console.log('- User:', process.env.EMAIL_USER);
    console.log('- From:', process.env.EMAIL_FROM);
    console.log('- Secure:', process.env.EMAIL_SECURE);
    
    // Create transporter
    const transporter = await createTestTransporter();
    console.log('Email transporter created');
    
    // Set up email data
    const recipientEmail = 'test@tiger.gbtecks.com'; // Test email for debugging
    console.log(`Sending test email to ${recipientEmail}...`);
    
    // Send email
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"Tiger App" <notifications@tigerapp.com>',
      to: recipientEmail,
      subject: testTemplate.subject,
      text: testTemplate.text,
      html: testTemplate.html,
    });
    
    console.log('Email sent successfully!');
    console.log('Message ID:', info.messageId);
    
    // If using ethereal, show preview URL
    if (info.messageId && info.messageId.includes('ethereal')) {
      console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
    }
    
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    console.error('Error message:', error.message);
    if (error.response) {
      console.error('SMTP Response:', error.response);
    }
    throw error;
  }
}

// Run the test
sendTestEmail()
  .then(() => {
    console.log('Test completed successfully');
  })
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  }); 