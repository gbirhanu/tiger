import { startNotificationSystem } from './services/email-notifications';

// console.log('Starting Tiger email notification service...');

// Start the notification system
startNotificationSystem()
  .then(() => {
    // console.log('Email notification system started successfully.');
  })
  .catch(error => {
    console.error('Failed to start email notification system:', error);
    process.exit(1);
  });

// Handle process termination gracefully
process.on('SIGINT', () => {
  // console.log('Shutting down email notification service...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  // console.log('Received SIGTERM. Shutting down email notification service...');
  process.exit(0);
}); 