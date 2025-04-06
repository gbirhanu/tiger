import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTasks, getAppointments, getMeetings, getUserSettings } from '@/lib/api';
import { useNotifications } from '@/hooks/use-notifications';
import { QUERY_KEYS } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';

// Define interfaces to match the context interfaces
interface Task {
  id: string;
  title: string;
  description?: string | null;
  due_date?: number | null;
  priority?: string;
  completed: boolean;
  is_recurring?: boolean;
  recurrence_pattern?: string | null;
  recurrence_interval?: number | null;
  recurrence_end_date?: number | null;
  parent_task_id?: string | null;
}

interface Meeting {
  id: string;
  title: string;
  description?: string | null;
  start_time: number;
  end_time: number;
  meeting_link?: string | null;
  is_recurring?: boolean;
  recurrence_pattern?: string | null;
  recurrence_interval?: number | null;
  recurrence_end_date?: number | null;
  parent_meeting_id?: string | null;
}

interface Appointment {
  id: string;
  title: string;
  description?: string | null;
  due_date: number;
  location?: string | null;
  contact?: string | null;
  is_recurring?: boolean;
  recurrence_pattern?: string | null;
  recurrence_interval?: number | null;
  recurrence_end_date?: number | null;
  parent_appointment_id?: string | null;
}

// Store last notification time for each item to prevent repetitive notifications
interface NotificationState {
  [id: string]: {
    lastNotified: number;
    count: number;
  };
}

/**
 * This component doesn't render anything visible but provides reminder functionality
 * It should be included once in your app, typically in a layout component
 */
export function TaskReminderService() {
  const { addNotification, checkTaskReminders, checkMeetingReminders, checkAppointmentReminders } = useNotifications();
  const { user } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [userInteracted, setUserInteracted] = useState(false);
  const [initialized, setInitialized] = useState(false);
  
  // Create refs to store last notification times for different item types
  const taskNotificationsRef = useRef<NotificationState>({});
  const meetingNotificationsRef = useRef<NotificationState>({});
  const appointmentNotificationsRef = useRef<NotificationState>({});
  
  // Load notification preferences from localStorage
  const [notificationPreferences, setNotificationPreferences] = useState({
    taskReminders: true,
    meetingReminders: true,
    desktopNotifications: true,
    emailNotifications: true,
  });
  
  // Get user settings
  const { data: userSettings } = useQuery({
    queryKey: [QUERY_KEYS.USER_SETTINGS],
    queryFn: getUserSettings,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  
  // Load notification preferences
  useEffect(() => {
    try {
      const storedPreferences = localStorage.getItem('notificationPreferences');
      if (storedPreferences) {
        const preferences = JSON.parse(storedPreferences);
        setNotificationPreferences({
          taskReminders: preferences.tasks ?? true,
          meetingReminders: preferences.meetings ?? true,
          desktopNotifications: preferences.desktop ?? true,
          emailNotifications: preferences.email ?? true,
        });
      }
    } catch (error) {
      console.error('Failed to load notification preferences:', error);
    }
  }, []);
  
  // Generate a unique session ID on component mount
  useEffect(() => {
    const sessionId = Date.now().toString();
    localStorage.setItem('currentSessionId', sessionId);
    setInitialized(true);
  }, []);
  
  // Check for user interaction
  useEffect(() => {
    const handleInteraction = () => {
      setUserInteracted(true);
      // Remove event listeners after first interaction
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
    };
    
    document.addEventListener('click', handleInteraction);
    document.addEventListener('keydown', handleInteraction);
    
    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
    };
  }, []);
  
  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio('/assets/bell_not.wav');
    // Preload the audio
    if (audioRef.current) {
      audioRef.current.load();
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Function to play notification sound
  const playNotificationSound = () => {
    // Only play sound if user has interacted with the page and notifications are enabled
    if (!userInteracted || !notificationPreferences.desktopNotifications) {
      return;
    }
    
    if (audioRef.current) {
      // Reset the audio to the beginning if it's already playing
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      
      // Play the notification sound
      audioRef.current.play().catch(error => {
        console.error('Failed to play notification sound:', error);
      });
    }
  };
  
  // Function to send email notifications
  const sendEmailNotification = async (type: string, item: any) => {
    // Skip if email notifications are disabled
    if (!notificationPreferences.emailNotifications) {
      return;
    }
    
    // Get user email from auth context or localStorage
    const userEmail = user?.email;
    if (!userEmail) {
      return;
    }
    
    try {
      if (type === 'task' && item.title && item.due_date) {
        await fetch('/api/email/task-reminder', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: userEmail,
            taskTitle: item.title,
            dueDate: item.due_date,
            userId: user.id,
          }),
        });
      } else if (type === 'meeting' && item.title && item.start_time) {
        await fetch('/api/email/meeting-reminder', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: userEmail,
            meetingTitle: item.title,
            startTime: item.start_time,
            meetingLink: item.meeting_link,
            userId: user.id,
          }),
        });
      }
    } catch (error) {
      console.error('Error sending email notification:', error);
    }
  };
  
  // Helper function to determine if we should send a notification
  const shouldNotify = (
    id: string, 
    type: 'task' | 'meeting' | 'appointment', 
    currentTime: number
  ): boolean => {
    // Get the appropriate notification state store
    const notificationStore = 
      type === 'task' ? taskNotificationsRef.current :
      type === 'meeting' ? meetingNotificationsRef.current :
      appointmentNotificationsRef.current;
    
    // If no record exists, this is the first notification
    if (!notificationStore[id]) {
      notificationStore[id] = { lastNotified: currentTime, count: 1 };
      return true;
    }
    
    const record = notificationStore[id];
    
    // Calculate time since last notification
    const timeSinceLastNotification = currentTime - record.lastNotified;
    
    // Don't notify if it's been less than 30 minutes since the last notification
    // And we've already sent at least one notification
    if (timeSinceLastNotification < 30 * 60 * 1000 && record.count > 0) {
      return false;
    }
    
    // For appointments and meetings, limit to 3 notifications total
    if ((type === 'appointment' || type === 'meeting') && record.count >= 3) {
      return false;
    }
    
    // Update the record
    notificationStore[id] = { 
      lastNotified: currentTime,
      count: record.count + 1
    };
    
    return true;
  };
  
  // Fetch tasks
  const { data: tasksData = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const response = await getTasks();
      return response;
    },
  });
  
  // Fetch appointments
  const { data: appointmentsData = [] } = useQuery({
    queryKey: ['appointments'],
    queryFn: async () => {
      const response = await getAppointments();
      return response;
    },
  });
  
  // Fetch meetings
  const { data: meetingsData = [] } = useQuery({
    queryKey: ['meetings'],
    queryFn: async () => {
      const response = await getMeetings();
      return response;
    },
  });
  
  // Helper functions to convert API data to the correct format
  const formatTasks = (tasks: any[]): Task[] => {
    return tasks.map(task => ({
      id: String(task.id),
      title: task.title,
      description: task.description,
      due_date: task.due_date,
      priority: task.priority,
      completed: Boolean(task.completed),
      is_recurring: Boolean(task.is_recurring),
      recurrence_pattern: task.recurrence_pattern,
      recurrence_interval: task.recurrence_interval,
      recurrence_end_date: task.recurrence_end_date,
      parent_task_id: task.parent_task_id ? String(task.parent_task_id) : null
    }));
  };
  
  const formatMeetings = (meetings: any[]): Meeting[] => {
    return meetings.map(meeting => ({
      id: String(meeting.id),
      title: meeting.title,
      description: meeting.description,
      start_time: meeting.start_time,
      end_time: meeting.end_time,
      meeting_link: meeting.location,
      is_recurring: Boolean(meeting.is_recurring),
      recurrence_pattern: meeting.recurrence_pattern,
      recurrence_interval: meeting.recurrence_interval,
      recurrence_end_date: meeting.recurrence_end_date,
      parent_meeting_id: meeting.parent_meeting_id ? String(meeting.parent_meeting_id) : null
    }));
  };
  
  const formatAppointments = (appointments: any[]): Appointment[] => {
    return appointments.map(appointment => ({
      id: String(appointment.id),
      title: appointment.title,
      description: appointment.description,
      // Use start_time as due_date for appointments
      due_date: appointment.start_time,
      location: appointment.location,
      contact: appointment.attendees,
      is_recurring: Boolean(appointment.is_recurring),
      recurrence_pattern: appointment.recurrence_pattern,
      recurrence_interval: appointment.recurrence_interval,
      recurrence_end_date: appointment.recurrence_end_date,
      parent_appointment_id: appointment.parent_appointment_id ? String(appointment.parent_appointment_id) : null
    }));
  };
  
  // Custom function to check task reminders with anti-spam logic
  const customCheckTaskReminders = (tasks: Task[]) => {
    if (!notificationPreferences.taskReminders) return;
    
    const now = Date.now();
    const nowInSeconds = Math.floor(now / 1000);
    
    // Filter tasks that need reminders
    const tasksNeedingReminders = tasks.filter(task => {
      if (!task.due_date || task.completed) return false;
      
      const dueDate = task.due_date;
      const timeUntilDue = dueDate - nowInSeconds;
      
      // Skip if this is a recurring task that has ended
      if (task.is_recurring && task.recurrence_end_date && task.recurrence_end_date < nowInSeconds) {
        return false;
      }
      
      // For recurring tasks with parent_id, these are individual instances
      // For parent recurring tasks, we don't want to show reminders (children handle this)
      if (task.is_recurring && !task.parent_task_id) {
        return false;
      }
      
      // Only remind for tasks that are upcoming and due within a day
      // Exclude tasks that are already overdue (timeUntilDue <= 0)
      return timeUntilDue > 0 && timeUntilDue < 24 * 60 * 60;
    });
    
    // Process each task that needs a reminder
    tasksNeedingReminders.forEach(task => {
      if (shouldNotify(task.id, 'task', now)) {
        let message = task.description || 'This task is due soon';
        
        // Add recurrence info if this is a recurring task instance
        if (task.is_recurring) {
          message += ' (Recurring)';
        }
        
        addNotification({
          title: `Task Reminder: ${task.title}`,
          message,
          type: 'reminder'
        });
      }
    });
  };
  
  // Custom function to check meeting reminders with anti-spam logic
  const customCheckMeetingReminders = (meetings: Meeting[]) => {
    if (!notificationPreferences.meetingReminders) return;
    
    const now = Date.now();
    const nowInSeconds = Math.floor(now / 1000);
    
    // Filter meetings that need reminders
    const meetingsNeedingReminders = meetings.filter(meeting => {
      if (!meeting.start_time) return false;
      
      const timeUntilStart = meeting.start_time - nowInSeconds;
      
      // Skip if this is a recurring meeting that has ended
      if (meeting.is_recurring && meeting.recurrence_end_date && meeting.recurrence_end_date < nowInSeconds) {
        return false;
      }
      
      // For recurring meetings, we only want to remind about child instances
      // Parent recurring meetings should not trigger reminders themselves
      if (meeting.is_recurring && !meeting.parent_meeting_id) {
        return false;
      }
      
      // Only remind for upcoming meetings starting within the next hour
      // Skip meetings that have already started (timeUntilStart <= 0)
      return timeUntilStart > 0 && timeUntilStart < 60 * 60;
    });
    
    // Process each meeting that needs a reminder
    meetingsNeedingReminders.forEach(meeting => {
      if (shouldNotify(meeting.id, 'meeting', now)) {
        let message = `Meeting starts at ${new Date(meeting.start_time * 1000).toLocaleTimeString()}`;
        
        // Add recurrence info if this is a recurring meeting instance
        if (meeting.is_recurring) {
          message += ' (Recurring)';
        }
        
        addNotification({
          title: `Meeting Reminder: ${meeting.title}`,
          message,
          type: 'meeting'
        });
      }
    });
  };
  
  // Custom function to check appointment reminders with anti-spam logic
  const customCheckAppointmentReminders = (appointments: Appointment[]) => {
    if (!notificationPreferences.taskReminders) return; // Use task reminder setting for appointments
    
    const now = Date.now();
    const nowInSeconds = Math.floor(now / 1000);
    
    // Filter appointments that need reminders
    const appointmentsNeedingReminders = appointments.filter(appointment => {
      if (!appointment.due_date) return false;
      
      const timeUntilDue = appointment.due_date - nowInSeconds;
      
      // Skip if this is a recurring appointment that has ended
      if (appointment.is_recurring && appointment.recurrence_end_date && appointment.recurrence_end_date < nowInSeconds) {
        return false;
      }
      
      // For recurring appointments, we only want to remind about child instances
      // Parent recurring appointments should not trigger reminders themselves
      if (appointment.is_recurring && !appointment.parent_appointment_id) {
        return false;
      }
      
      // Only remind for upcoming appointments within the next day
      // Skip appointments that are already past (timeUntilDue <= 0)
      return timeUntilDue > 0 && timeUntilDue < 24 * 60 * 60;
    });
    
    // Process each appointment that needs a reminder
    appointmentsNeedingReminders.forEach(appointment => {
      if (shouldNotify(appointment.id, 'appointment', now)) {
        let messageBase = appointment.location 
          ? `At ${appointment.location} - ${new Date(appointment.due_date * 1000).toLocaleTimeString()}`
          : `At ${new Date(appointment.due_date * 1000).toLocaleTimeString()}`;
        
        // Add recurrence info if this is a recurring appointment instance
        let message = appointment.is_recurring 
          ? `${messageBase} (Recurring)` 
          : messageBase;
        
        addNotification({
          title: `Appointment Reminder: ${appointment.title}`,
          message,
          type: 'appointment'
        });
      }
    });
  };
  
  // Set up a listener for notifications to play sound
  useEffect(() => {
    // Create a custom event listener for notifications
    const handleNotification = () => {
      playNotificationSound();
    };
    
    // Add event listener
    document.addEventListener('tigerNotification', handleNotification);
    
    // Cleanup
    return () => {
      document.removeEventListener('tigerNotification', handleNotification);
    };
  }, [notificationPreferences.desktopNotifications]);
  
  // Check for reminders whenever data changes
  useEffect(() => {
    if (!initialized) return;
    
    // Check if notifications are enabled in user settings
    const userNotificationsEnabled = userSettings?.notifications_enabled ?? true;
    const showNotifications = userSettings?.show_notifications ?? true;
    
    // If notifications are disabled globally, don't proceed
    if (!userNotificationsEnabled || !showNotifications) {
      return;
    }
    
    // Use the context functions to check for reminders with our custom wrappers
    if (tasksData && Array.isArray(tasksData)) {
      const formattedTasks = formatTasks(tasksData);
      customCheckTaskReminders(formattedTasks);
    }
    
    if (meetingsData && Array.isArray(meetingsData)) {
      const formattedMeetings = formatMeetings(meetingsData);
      customCheckMeetingReminders(formattedMeetings);
    }
    
    if (appointmentsData && Array.isArray(appointmentsData)) {
      const formattedAppointments = formatAppointments(appointmentsData);
      customCheckAppointmentReminders(formattedAppointments);
    }
    
  }, [
    tasksData, 
    appointmentsData, 
    meetingsData, 
    initialized, 
    notificationPreferences,
    userSettings?.notifications_enabled,
    userSettings?.show_notifications
  ]);
  
  // This component doesn't render anything visible
  return null;
} 