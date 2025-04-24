// Simple startup script for shared hosting
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Get current directory
const currentDir = process.cwd();
const indexPath = path.join(currentDir, 'dist', 'index.js');

// Set environment variables
process.env.NODE_ENV = 'production';
process.env.NODE_OPTIONS = '--experimental-specifier-resolution=node';

// Create a log file
const logFile = fs.createWriteStream(path.join(currentDir, 'app.log'), { flags: 'a' });

console.log('Starting Tiger App...');
console.log('Log file: ' + path.join(currentDir, 'app.log'));

// Import and run the main application
import('./dist/index.js')
  .then(() => {
    console.log('Main application started successfully!');
    
    // Now start the email notification system
    import('./dist/services/email-notifications.js')
      .then(({ startNotificationSystem }) => {
        console.log('Starting email notification service...');
        startNotificationSystem()
          .then(() => {
            console.log('Email notification system started successfully!');
            logFile.write(`[${new Date().toISOString()}] Email notification service started successfully\n`);
          })
          .catch(err => {
            console.error('Failed to start email notification system:', err);
            logFile.write(`[${new Date().toISOString()}] Email notification error: ${err.message}\n${err.stack}\n`);
            // Don't exit process as that would stop the main app
          });
      })
      .catch(err => {
        console.error('Failed to import email notification module:', err);
        logFile.write(`[${new Date().toISOString()}] Email module import error: ${err.message}\n${err.stack}\n`);
      });
  })
  .catch(err => {
    console.error('Failed to start application:', err);
    logFile.write(`[${new Date().toISOString()}] Error: ${err.message}\n${err.stack}\n`);
  }); 