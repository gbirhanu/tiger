/**
 * SMTP Connection Test Script
 * 
 * This script tests your SMTP connection directly to diagnose email sending issues.
 * Run with: node scripts/test-smtp.cjs
 */

const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Test email recipient - change this to your email address
const TEST_RECIPIENT = 'your-email@example.com';

console.log('SMTP Connection Test');
console.log('===================');
console.log('');
console.log('SMTP Configuration:');
console.log(`- Host: ${process.env.EMAIL_HOST || '(not set)'}`);
console.log(`- Port: ${process.env.EMAIL_PORT || '(not set)'}`);
console.log(`- User: ${process.env.EMAIL_USER || '(not set)'}`);
console.log(`- Secure: ${process.env.EMAIL_SECURE || 'false'}`);
console.log('');

async function testConnection() {
  // Check for required credentials
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('❌ Missing email credentials in .env file!');
    console.log('Make sure EMAIL_HOST, EMAIL_USER, and EMAIL_PASS are all set in your .env file.');
    process.exit(1);
  }

  // For port 465, secure should always be true
  const port = parseInt(process.env.EMAIL_PORT || '465');
  const secure = port === 465 ? true : process.env.EMAIL_SECURE === 'true';

  console.log(`Testing connection to ${process.env.EMAIL_HOST}:${port} (secure=${secure})...`);

  // Create transporter
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: port,
    secure: secure,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    debug: true, // Show debug output
    logger: true, // Log information about the transport
    tls: {
      // Do not fail on invalid certs
      rejectUnauthorized: false
    }
  });

  try {
    console.log('Verifying SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP Connection successful!');
    
    console.log(`\nSending test email to ${TEST_RECIPIENT}...`);
    
    // Send a test email
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: TEST_RECIPIENT,
      subject: 'SMTP Test Email',
      text: 'If you are reading this, your SMTP server is working correctly!',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #4f46e5;">SMTP Test Email</h2>
          <p>If you are reading this, your SMTP server is working correctly!</p>
          <p>Configuration used:</p>
          <ul>
            <li>Host: ${process.env.EMAIL_HOST}</li>
            <li>Port: ${port}</li>
            <li>Secure: ${secure}</li>
            <li>User: ${process.env.EMAIL_USER}</li>
          </ul>
          <p>Timestamp: ${new Date().toISOString()}</p>
        </div>
      `,
    });
    
    console.log('✅ Test email sent successfully!');
    console.log('Message ID:', info.messageId);
    
    return true;
  } catch (error) {
    console.error('❌ SMTP Test failed:');
    console.error(`Error: ${error.message}`);
    
    if (error.code) {
      console.error(`Error code: ${error.code}`);
      
      // Provide troubleshooting advice based on error code
      switch (error.code) {
        case 'ECONNREFUSED':
          console.log('\nTroubleshooting:');
          console.log('- Check if the SMTP server is running');
          console.log('- Verify the hostname and port are correct');
          console.log('- Ensure your firewall is not blocking the connection');
          break;
        case 'ETIMEDOUT':
          console.log('\nTroubleshooting:');
          console.log('- The connection timed out - the server might be unreachable');
          console.log('- Check your network connection');
          console.log('- Verify the hostname and port are correct');
          break;
        case 'EAUTH':
          console.log('\nTroubleshooting:');
          console.log('- Authentication failed - check your username and password');
          console.log('- Make sure your account has permission to send emails');
          console.log('- Some providers require an app password instead of your regular password');
          break;
        case 'ESOCKET':
          console.log('\nTroubleshooting:');
          console.log('- Socket error - likely a TLS/SSL issue');
          console.log('- For port 465, set EMAIL_SECURE=true');
          console.log('- For port 587, TLS is usually negotiated');
          break;
        default:
          console.log('\nTroubleshooting:');
          console.log('- Review the full error message for clues');
          console.log('- Verify all your SMTP settings are correct');
          console.log('- Try testing with a different SMTP server (e.g., Gmail) to isolate the issue');
      }
    }
    
    if (error.response) {
      console.error('SMTP Response:', error.response);
    }
    
    return false;
  }
}

testConnection()
  .then((success) => {
    if (success) {
      console.log('\n✅ All tests passed! Your SMTP server is working correctly.');
    } else {
      console.log('\n❌ SMTP test failed. Please review the error messages above.');
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error('Unexpected error:', err);
    process.exit(1);
  }); 