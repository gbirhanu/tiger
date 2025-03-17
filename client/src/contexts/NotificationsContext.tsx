import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { toast } from '@/hooks/use-toast';

// Define the notification type
export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'task' | 'meeting' | 'appointment' | 'reminder' | 'system';
  read: boolean;
  createdAt: string;
  link?: string;
}

// Task interface for reminders
interface Task {
  id: string;
  title: string;
  description?: string | null;
  due_date?: number | null; // Unix timestamp
  priority?: string;
  completed: boolean;
  // Add other optional fields that might be present
  user_id?: number;
  created_at?: number;
  updated_at?: number;
  all_day?: boolean;
  is_recurring?: boolean;
  recurrence_pattern?: string | null;
  recurrence_interval?: number | null;
  recurrence_end_date?: number | null;
  parent_task_id?: number | null;
}

// Meeting interface for reminders
interface Meeting {
  id: string;
  title: string;
  description?: string | null;
  start_time: number; // Unix timestamp
  end_time: number; // Unix timestamp
  meeting_link?: string | null;
}

// Appointment interface for reminders
interface Appointment {
  id: string;
  title: string;
  description?: string | null;
  due_date: number; // Unix timestamp
  location?: string | null;
  contact?: string | null;
}

// Define the context type
export interface NotificationsContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'read' | 'createdAt'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  checkTaskReminders: (tasks: Task[]) => void;
  checkMeetingReminders: (meetings: Meeting[]) => void;
  checkAppointmentReminders: (appointments: Appointment[]) => void;
}

// Create the context
export const NotificationsContext = createContext<NotificationsContextType | null>(null);

// Helper function to check if desktop notifications are supported
const areDesktopNotificationsSupported = () => {
  return 'Notification' in window;
};

// Helper function to request notification permission
const requestNotificationPermission = async () => {
  if (!areDesktopNotificationsSupported()) {
    return false;
  }
  
  if (Notification.permission === 'granted') {
    return true;
  }
  
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  
  return false;
};

// Create the provider component
export const NotificationsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [desktopNotificationsEnabled, setDesktopNotificationsEnabled] = useState(false);
  const [notifiedItemIds, setNotifiedItemIds] = useState<Set<string>>(new Set());
  
  // Calculate unread count
  const unreadCount = notifications.filter(notification => !notification.read).length;
  
  // Request notification permission on mount
  useEffect(() => {
    const checkPermission = async () => {
      const hasPermission = await requestNotificationPermission();
      setDesktopNotificationsEnabled(hasPermission);
    };
    
    checkPermission();
  }, []);
  
  // Load notifications from localStorage on mount
  useEffect(() => {
    const savedNotifications = localStorage.getItem('notifications');
    if (savedNotifications) {
      try {
        setNotifications(JSON.parse(savedNotifications));
      } catch (error) {
        console.error('Failed to parse notifications from localStorage', error);
        // If parsing fails, start with empty notifications
        setNotifications([]);
      }
    } else {
      // For demo purposes, create some sample notifications
      const sampleNotifications: Notification[] = [
        {
          id: '1',
          title: 'Task Due Soon',
          message: 'Your "Project Proposal" task is due in 2 hours',
          type: 'task',
          read: false,
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          link: '/tasks'
        },
        {
          id: '2',
          title: 'Meeting Reminder',
          message: 'Team standup meeting in 15 minutes',
          type: 'meeting',
          read: true,
          createdAt: new Date(Date.now() - 7200000).toISOString(),
          link: '/meetings'
        },
        {
          id: '3',
          title: 'System Update',
          message: 'Tiger has been updated to version 2.0',
          type: 'system',
          read: false,
          createdAt: new Date(Date.now() - 86400000).toISOString()
        }
      ];
      setNotifications(sampleNotifications);
    }
    
    // Load notified item IDs from localStorage
    const savedNotifiedItemIds = localStorage.getItem('notifiedItemIds');
    if (savedNotifiedItemIds) {
      try {
        setNotifiedItemIds(new Set(JSON.parse(savedNotifiedItemIds)));
      } catch (error) {
        console.error('Failed to parse notified item IDs', error);
      }
    }
  }, []);
  
  // Save notifications to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('notifications', JSON.stringify(notifications));
  }, [notifications]);
  
  // Save notified item IDs to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('notifiedItemIds', JSON.stringify(Array.from(notifiedItemIds)));
  }, [notifiedItemIds]);
  
  // Mark a notification as read
  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id 
          ? { ...notification, read: true } 
          : notification
      )
    );
  }, []);
  
  // Mark all notifications as read
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, read: true }))
    );
  }, []);
  
  // Clear all notifications
  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);
  
  // Add a new notification
  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'read' | 'createdAt'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      read: false,
      createdAt: new Date().toISOString()
    };
    
    setNotifications(prev => [newNotification, ...prev]);
    
    // Show a toast notification
    toast({
      title: notification.title,
      description: notification.message,
      variant: "default"
    });
    
    // Dispatch custom event for notification sound
    document.dispatchEvent(new CustomEvent('tigerNotification', { detail: notification }));
    
    // Show desktop notification if enabled
    if (desktopNotificationsEnabled) {
      try {
        const desktopNotification = new Notification(notification.title, {
          body: notification.message,
          icon: '/assets/tiger_logo.png'
        });
        
        // Handle click on desktop notification
        if (notification.link) {
          desktopNotification.onclick = () => {
            window.focus();
            localStorage.setItem('selectedNav', notification.link?.replace('/', '') || 'Dashboard');
            window.location.reload();
          };
        }
      } catch (error) {
        console.error('Failed to show desktop notification', error);
      }
    }
  }, [desktopNotificationsEnabled]);
  
  // Check for tasks that need reminders
  const checkTaskReminders = useCallback((tasks: Task[]) => {
    if (!tasks || !Array.isArray(tasks)) return;
    
    const now = Date.now() / 1000; // Current time in seconds
    const oneDayInSeconds = 24 * 60 * 60;
    const oneHourInSeconds = 60 * 60;
    
    // Get notification preferences from localStorage
    const storedPreferences = localStorage.getItem('notificationPreferences');
    let taskRemindersEnabled = true;
    
    if (storedPreferences) {
      try {
        const preferences = JSON.parse(storedPreferences);
        taskRemindersEnabled = preferences.tasks ?? true;
      } catch (error) {
        console.error('Failed to parse notification preferences', error);
      }
    }
    
    // Skip if task reminders are disabled
    if (!taskRemindersEnabled) return;
    
    // Check each task
    tasks.forEach(task => {
      // Skip completed tasks or tasks without due dates
      if (task.completed || !task.due_date) return;
      
      const dueDate = task.due_date;
      const timeUntilDue = dueDate - now;
      
      // Create notification key based on task ID and notification type
      const createNotificationKey = (taskId: string, type: string) => `task-${taskId}-${type}`;
      
      // Task is overdue
      if (timeUntilDue < 0 && timeUntilDue > -oneDayInSeconds) {
        const notificationKey = createNotificationKey(task.id, 'overdue');
        
        // Only notify if we haven't already notified for this task being overdue
        if (!notifiedItemIds.has(notificationKey)) {
          addNotification({
            title: 'Task Overdue',
            message: `"${task.title}" is now overdue`,
            type: 'task',
            link: '/tasks'
          });
          
          // Mark as notified
          setNotifiedItemIds(prev => {
            const newSet = new Set(prev);
            newSet.add(notificationKey);
            return newSet;
          });
        }
        return;
      }
      
      // Task is due within the next hour
      if (timeUntilDue > 0 && timeUntilDue < oneHourInSeconds) {
        const notificationKey = createNotificationKey(task.id, 'hour');
        
        // Only notify if we haven't already notified for this task being due within an hour
        if (!notifiedItemIds.has(notificationKey)) {
          addNotification({
            title: 'Task Due Soon',
            message: `"${task.title}" is due in less than an hour`,
            type: 'task',
            link: '/tasks'
          });
          
          // Mark as notified
          setNotifiedItemIds(prev => {
            const newSet = new Set(prev);
            newSet.add(notificationKey);
            return newSet;
          });
        }
        return;
      }
      
      // Task is due within the next day
      if (timeUntilDue > 0 && timeUntilDue < oneDayInSeconds) {
        const notificationKey = createNotificationKey(task.id, 'day');
        
        // Only notify if we haven't already notified for this task being due within a day
        if (!notifiedItemIds.has(notificationKey)) {
          addNotification({
            title: 'Task Due Tomorrow',
            message: `"${task.title}" is due within 24 hours`,
            type: 'task',
            link: '/tasks'
          });
          
          // Mark as notified
          setNotifiedItemIds(prev => {
            const newSet = new Set(prev);
            newSet.add(notificationKey);
            return newSet;
          });
        }
        return;
      }
    });
  }, [addNotification, notifiedItemIds]);
  
  // Check for meetings that need reminders
  const checkMeetingReminders = useCallback((meetings: Meeting[]) => {
    if (!meetings || !Array.isArray(meetings)) return;
    
    const now = Date.now() / 1000; // Current time in seconds
    const oneHourInSeconds = 60 * 60;
    const fifteenMinutesInSeconds = 15 * 60;
    
    // Get notification preferences from localStorage
    const storedPreferences = localStorage.getItem('notificationPreferences');
    let meetingRemindersEnabled = true;
    
    if (storedPreferences) {
      try {
        const preferences = JSON.parse(storedPreferences);
        meetingRemindersEnabled = preferences.meetings ?? true;
      } catch (error) {
        console.error('Failed to parse notification preferences', error);
      }
    }
    
    // Skip if meeting reminders are disabled
    if (!meetingRemindersEnabled) return;
    
    // Check each meeting
    meetings.forEach(meeting => {
      // Skip meetings without start time
      if (!meeting.start_time) return;
      
      const startTime = meeting.start_time;
      const timeUntilStart = startTime - now;
      
      // Create notification key based on meeting ID and notification type
      const createNotificationKey = (meetingId: string, type: string) => `meeting-${meetingId}-${type}`;
      
      // Meeting is starting in 15 minutes
      if (timeUntilStart > 0 && timeUntilStart < fifteenMinutesInSeconds) {
        const notificationKey = createNotificationKey(meeting.id, '15min');
        
        // Only notify if we haven't already notified for this meeting starting soon
        if (!notifiedItemIds.has(notificationKey)) {
          addNotification({
            title: 'Meeting Starting Soon',
            message: `"${meeting.title}" is starting in ${Math.floor(timeUntilStart / 60)} minutes`,
            type: 'meeting',
            link: '/meetings'
          });
          
          // Mark as notified
          setNotifiedItemIds(prev => {
            const newSet = new Set(prev);
            newSet.add(notificationKey);
            return newSet;
          });
        }
        return;
      }
      
      // Meeting is starting in 1 hour
      if (timeUntilStart > fifteenMinutesInSeconds && timeUntilStart < oneHourInSeconds) {
        const notificationKey = createNotificationKey(meeting.id, 'hour');
        
        // Only notify if we haven't already notified for this meeting starting in an hour
        if (!notifiedItemIds.has(notificationKey)) {
          addNotification({
            title: 'Upcoming Meeting',
            message: `"${meeting.title}" is starting in about an hour`,
            type: 'meeting',
            link: '/meetings'
          });
          
          // Mark as notified
          setNotifiedItemIds(prev => {
            const newSet = new Set(prev);
            newSet.add(notificationKey);
            return newSet;
          });
        }
        return;
      }
    });
  }, [addNotification, notifiedItemIds]);
  
  // Check for appointments that need reminders
  const checkAppointmentReminders = useCallback((appointments: Appointment[]) => {
    if (!appointments || !Array.isArray(appointments)) return;
    
    const now = Date.now() / 1000; // Current time in seconds
    const oneDayInSeconds = 24 * 60 * 60;
    const oneHourInSeconds = 60 * 60;
    
    // Get notification preferences from localStorage
    const storedPreferences = localStorage.getItem('notificationPreferences');
    let appointmentRemindersEnabled = true;
    
    if (storedPreferences) {
      try {
        const preferences = JSON.parse(storedPreferences);
        appointmentRemindersEnabled = preferences.appointments ?? true;
      } catch (error) {
        console.error('Failed to parse notification preferences', error);
      }
    }
    
    // Skip if appointment reminders are disabled
    if (!appointmentRemindersEnabled) return;
    
    // Check each appointment
    appointments.forEach(appointment => {
      // Skip appointments without due date
      if (!appointment.due_date) return;
      
      const dueDate = appointment.due_date;
      const timeUntilDue = dueDate - now;
      
      // Create notification key based on appointment ID and notification type
      const createNotificationKey = (appointmentId: string, type: string) => `appointment-${appointmentId}-${type}`;
      
      // Appointment is overdue
      if (timeUntilDue < 0 && timeUntilDue > -oneHourInSeconds) {
        const notificationKey = createNotificationKey(appointment.id, 'overdue');
        
        // Only notify if we haven't already notified for this appointment being overdue
        if (!notifiedItemIds.has(notificationKey)) {
          addNotification({
            title: 'Appointment Overdue',
            message: `"${appointment.title}" has started`,
            type: 'appointment',
            link: '/appointments'
          });
          
          // Mark as notified
          setNotifiedItemIds(prev => {
            const newSet = new Set(prev);
            newSet.add(notificationKey);
            return newSet;
          });
        }
        return;
      }
      
      // Appointment is due within the next hour
      if (timeUntilDue > 0 && timeUntilDue < oneHourInSeconds) {
        const notificationKey = createNotificationKey(appointment.id, 'hour');
        
        // Only notify if we haven't already notified for this appointment being due within an hour
        if (!notifiedItemIds.has(notificationKey)) {
          addNotification({
            title: 'Appointment Soon',
            message: `"${appointment.title}" is in less than an hour${appointment.location ? ` at ${appointment.location}` : ''}`,
            type: 'appointment',
            link: '/appointments'
          });
          
          // Mark as notified
          setNotifiedItemIds(prev => {
            const newSet = new Set(prev);
            newSet.add(notificationKey);
            return newSet;
          });
        }
        return;
      }
      
      // Appointment is due within the next day
      if (timeUntilDue > 0 && timeUntilDue < oneDayInSeconds) {
        const notificationKey = createNotificationKey(appointment.id, 'day');
        
        // Only notify if we haven't already notified for this appointment being due within a day
        if (!notifiedItemIds.has(notificationKey)) {
          addNotification({
            title: 'Appointment Tomorrow',
            message: `"${appointment.title}" is scheduled within 24 hours`,
            type: 'appointment',
            link: '/appointments'
          });
          
          // Mark as notified
          setNotifiedItemIds(prev => {
            const newSet = new Set(prev);
            newSet.add(notificationKey);
            return newSet;
          });
        }
        return;
      }
    });
  }, [addNotification, notifiedItemIds]);
  
  return (
    <NotificationsContext.Provider 
      value={{ 
        notifications, 
        unreadCount, 
        markAsRead, 
        markAllAsRead, 
        clearNotifications, 
        addNotification,
        checkTaskReminders,
        checkMeetingReminders,
        checkAppointmentReminders
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}; 