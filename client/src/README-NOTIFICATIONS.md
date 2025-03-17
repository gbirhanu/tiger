# Tiger Notification System

This document provides an overview of the notification system implemented in the Tiger application.

## Overview

The notification system provides a way to display and manage notifications throughout the application. It includes:

- A centralized notification context for managing notifications
- A dropdown component for displaying notifications in the UI
- Task reminder functionality that automatically creates notifications for upcoming tasks
- A demo page to showcase and test the notification system

## Components

### NotificationsContext

The `NotificationsContext` is the core of the notification system. It provides:

- State management for notifications
- Methods for adding, marking as read, and clearing notifications
- Persistence of notifications in localStorage

```tsx
// Example usage
import { useNotifications } from '@/hooks/use-notifications';

function MyComponent() {
  const { 
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearNotifications
  } = useNotifications();
  
  // Add a notification
  const handleAddNotification = () => {
    addNotification({
      title: 'New Message',
      message: 'You have received a new message',
      type: 'system'
    });
  };
  
  return (
    <button onClick={handleAddNotification}>
      Create Notification
    </button>
  );
}
```

### NotificationsDropdown

The `NotificationsDropdown` component displays notifications in a dropdown menu. It shows:

- A badge with the number of unread notifications
- A list of notifications with their title, message, and timestamp
- Options to mark all as read and clear all notifications

### TaskReminderService

The `TaskReminderService` is a non-visual component that checks for upcoming tasks and creates notifications for them. It:

- Fetches tasks from the API
- Checks for tasks due within the next 24 hours
- Creates notifications for tasks due in 1 hour, 3 hours, or 24 hours

### NotificationDemo

The `NotificationDemo` component provides a UI for testing and demonstrating the notification system. It includes:

- A form for creating custom notifications
- Quick actions for creating predefined notifications
- A display of all current notifications

## Notification Types

The system supports different types of notifications:

- `system`: General system notifications
- `task`: Task-related notifications
- `meeting`: Meeting-related notifications
- `reminder`: General reminder notifications

Each type has its own icon and can be styled differently.

## Task Reminders

The task reminder functionality automatically creates notifications for tasks that are due soon:

- Tasks due in 1 hour
- Tasks due in 3 hours
- Tasks due in 24 hours

This helps users stay on top of their upcoming tasks.

## Integration

To use the notification system in your components:

1. Ensure the component is wrapped in the `NotificationsProvider`
2. Import the `useNotifications` hook
3. Use the hook to access notification functionality

```tsx
import { useNotifications } from '@/hooks/use-notifications';

function MyComponent() {
  const { addNotification } = useNotifications();
  
  // Add a notification
  addNotification({
    title: 'Hello',
    message: 'This is a notification',
    type: 'system',
    link: '/some-page' // Optional link to navigate to
  });
  
  return <div>My Component</div>;
}
```

## Styling

The notification system uses the application's theme and can be styled using Tailwind CSS classes. The notification dropdown and individual notifications follow the application's design system.

## Future Enhancements

Potential future enhancements for the notification system:

- Real-time notifications via WebSockets
- Push notifications for desktop/mobile
- More granular notification preferences
- Notification categories and filtering
- Sound alerts for important notifications 