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
  requestNotificationPermissions: () => Promise<boolean>;
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
  
  // Request notification permission - don't auto-request on mount
  useEffect(() => {
    // Only check if permission is already granted, don't request automatically
    const checkExistingPermission = () => {
      if (areDesktopNotificationsSupported() && Notification.permission === 'granted') {
        setDesktopNotificationsEnabled(true);
      }
    };
    
    checkExistingPermission();
  }, []);
  
  // Function to request permissions (will be called on user interaction)
  const requestPermissions = useCallback(async () => {
    const hasPermission = await requestNotificationPermission();
    setDesktopNotificationsEnabled(hasPermission);
    return hasPermission;
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
    
    // Format the description to handle multiline text - replace newlines with <br> for HTML
    const formattedDescription = notification.message.replace(/\n/g, '<br>');
    
    // Show a toast notification with HTML support for line breaks
    toast({
      title: notification.title,
      description: (
        <div 
          className="max-w-sm" 
          dangerouslySetInnerHTML={{ __html: formattedDescription }}
        />
      ),
      variant: "default",
      duration: 7000 // Show longer to ensure user can read the full text
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
  
  // Create notification key helper
  const createNotificationKey = (id: string, type: string) => `${type}-${id}`;
  
  // Check task reminders
  const checkTaskReminders = useCallback((tasks: Task[]) => {
    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) return;
    
    const now = Date.now();
    const nowInSeconds = Math.floor(now / 1000);
    
    // Filter tasks that are upcoming and due
    tasks.filter(task => {
      if (!task.due_date || task.completed) return false;
      
      const dueDate = task.due_date;
      const timeUntilDue = dueDate - nowInSeconds;
      
      // Only remind for tasks due within the next 24 hours
      return timeUntilDue > 0 && timeUntilDue < 24 * 60 * 60;
    }).forEach(task => {
      const notificationKey = createNotificationKey(task.id, 'task');
      
      // Only notify once per task for a given due date
      if (!notifiedItemIds.has(notificationKey)) {
        const dueDate = new Date(task.due_date! * 1000);
        const dueTimeFormatted = dueDate.toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        const dueDateFormatted = dueDate.toLocaleDateString([], { 
          month: 'short', 
          day: 'numeric' 
        });
        
        addNotification({
          title: `Task Due Soon: ${task.title}`,
          message: `Due on ${dueDateFormatted} at ${dueTimeFormatted}`,
          type: 'task',
          link: '/tasks'
        });
        
        // Mark as notified
        setNotifiedItemIds(prev => {
          const newSet = new Set(Array.from(prev));
          newSet.add(notificationKey);
          return newSet;
        });
      }
    });
  }, [addNotification, notifiedItemIds]);
  
  // Check meeting reminders
  const checkMeetingReminders = useCallback((meetings: Meeting[]) => {
    if (!meetings || !Array.isArray(meetings) || meetings.length === 0) return;
    
    const now = Date.now();
    const nowInSeconds = Math.floor(now / 1000);
    
    // Filter meetings that start soon
    meetings.filter(meeting => {
      if (!meeting.start_time) return false;
      
      const timeUntilStart = meeting.start_time - nowInSeconds;
      
      // Only remind for meetings starting within the next hour
      return timeUntilStart > 0 && timeUntilStart < 60 * 60;
    }).forEach(meeting => {
      const notificationKey = createNotificationKey(meeting.id, 'meeting');
      
      // Only notify once per meeting
      if (!notifiedItemIds.has(notificationKey)) {
        const startTime = new Date(meeting.start_time * 1000);
        const startTimeFormatted = startTime.toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        
        addNotification({
          title: `Meeting Starting Soon: ${meeting.title}`,
          message: `Starting at ${startTimeFormatted}${meeting.meeting_link ? `\nLink: ${meeting.meeting_link}` : ''}`,
          type: 'meeting',
          link: '/meetings'
        });
        
        // Mark as notified
        setNotifiedItemIds(prev => {
          const newSet = new Set(Array.from(prev));
          newSet.add(notificationKey);
          return newSet;
        });
      }
    });
  }, [addNotification, notifiedItemIds]);
  
  // Check appointment reminders
  const checkAppointmentReminders = useCallback((appointments: Appointment[]) => {
    if (!appointments || !Array.isArray(appointments) || appointments.length === 0) return;
    
    const now = Date.now();
    const nowInSeconds = Math.floor(now / 1000);
    
    // Filter appointments coming up
    appointments.filter(appointment => {
      if (!appointment.due_date) return false;
      
      const timeUntilDue = appointment.due_date - nowInSeconds;
      
      // Only remind for appointments within the next day
      return timeUntilDue > 0 && timeUntilDue < 24 * 60 * 60;
    }).forEach(appointment => {
      const notificationKey = createNotificationKey(appointment.id, 'appointment');
      
      // Only notify once per appointment
      if (!notifiedItemIds.has(notificationKey)) {
        const appointmentTime = new Date(appointment.due_date * 1000);
        const timeFormatted = appointmentTime.toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        const dateFormatted = appointmentTime.toLocaleDateString([], { 
          month: 'short', 
          day: 'numeric' 
        });
        
        let message = `On ${dateFormatted} at ${timeFormatted}`;
        if (appointment.location) {
          message += `\nLocation: ${appointment.location}`;
        }
        if (appointment.contact) {
          message += `\nWith: ${appointment.contact}`;
        }
        
        addNotification({
          title: `Upcoming Appointment: ${appointment.title}`,
          message,
          type: 'appointment',
          link: '/appointments'
        });
        
        // Mark as notified
        setNotifiedItemIds(prev => {
          const newSet = new Set(Array.from(prev));
          newSet.add(notificationKey);
          return newSet;
        });
      }
    });
  }, [addNotification, notifiedItemIds]);

  return (
    <NotificationsContext.Provider 
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        clearNotifications,
        checkTaskReminders,
        checkMeetingReminders,
        checkAppointmentReminders,
        requestNotificationPermissions: requestPermissions
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
} 