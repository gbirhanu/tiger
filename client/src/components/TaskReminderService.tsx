import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getTasks, getAppointments, getMeetings, getUserSettings } from '@/lib/api';
import { useNotifications } from '@/hooks/use-notifications';
import { QUERY_KEYS, queryClient } from '@/lib/queryClient';
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

// Define specific notification time points in milliseconds
const NOTIFICATION_TIME_POINTS = {
  ONE_DAY: 24 * 60 * 60 * 1000,    // 24 hours
  HALF_DAY: 12 * 60 * 60 * 1000,   // 12 hours
  ONE_HOUR: 60 * 60 * 1000,        // 1 hour
  THIRTY_MIN: 30 * 60 * 1000       // 30 minutes
};

// Enhanced notification record interface to track time points
interface NotificationRecord {
  notifiedTimePoints: {
    ONE_DAY?: boolean;
    HALF_DAY?: boolean;
    ONE_HOUR?: boolean;
    THIRTY_MIN?: boolean;
  };
  lastNotified: number;
  count: number;
  acknowledged?: boolean;
}

interface NotificationState {
  [id: string]: NotificationRecord;
}

interface NotificationHistoryStore {
  tasks: NotificationState;
  meetings: NotificationState;
  appointments: NotificationState;
  lastUpdated: number;
}

/**
 * This component doesn't render anything visible but provides reminder functionality
 * It should be included once in your app, typically in a layout component
 */
export function TaskReminderService() {
  const notificationsHook = useNotifications();
  const { addNotification, checkTaskReminders, checkMeetingReminders, checkAppointmentReminders } = notificationsHook;
  const { user } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [userInteracted, setUserInteracted] = useState(false);
  const [initialized, setInitialized] = useState(false);
  
  // Debug logging for component initialization
  useEffect(() => {
    // console.log("TaskReminderService component mounted"); // Removed log
    
    // Debug notifications hook
    // console.log("Notifications hook available:", { // Removed log
    //   hookAvailable: !!notificationsHook,
    //   addNotification: !!addNotification,
    //   functions: Object.keys(notificationsHook || {})
    // });
    
    return () => {
      // console.log("TaskReminderService component unmounted"); // Removed log
    };
  }, []);
  
  // Add ref to track interval ID
  const timerIntervalRef = useRef<number | null>(null);
  
  // Track previous data to detect changes
  const prevTasksRef = useRef<any[]>([]);
  const prevMeetingsRef = useRef<any[]>([]);
  const prevAppointmentsRef = useRef<any[]>([]);
  
  // State to hold notification history
  const [notificationHistory, setNotificationHistory] = useState<NotificationHistoryStore>({
    tasks: {},
    meetings: {},
    appointments: {},
    lastUpdated: Date.now()
  });
  
  // Load notification preferences from localStorage
  const [notificationPreferences, setNotificationPreferences] = useState({
    taskReminders: true,
    meetingReminders: true,
    appointmentReminders: true,
    desktopNotifications: true,
    emailNotifications: false, // Keep this for compatibility, but set default to false
  });
  
  // Get user settings
  const { data: userSettings } = useQuery({
    queryKey: [QUERY_KEYS.USER_SETTINGS],
    queryFn: getUserSettings,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  
  // Fetch tasks
  const { data: tasksData = [] } = useQuery({
    queryKey: [QUERY_KEYS.TASKS],
    queryFn: async () => {
      // console.log("Fetching tasks for notifications"); // Removed log
      const response = await getTasks();
      return response;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
  
  // Fetch appointments
  const { data: appointmentsData = [] } = useQuery({
    queryKey: [QUERY_KEYS.APPOINTMENTS],
    queryFn: async () => {
      // console.log("Fetching appointments for notifications"); // Removed log
      const response = await getAppointments();
      return response;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
  
  // Fetch meetings
  const { data: meetingsData = [] } = useQuery({
    queryKey: [QUERY_KEYS.MEETINGS],
    queryFn: async () => {
      // console.log("Fetching meetings for notifications"); // Removed log
      const response = await getMeetings();
      return response;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
  
  // Sync notification preferences with user settings from database
  useEffect(() => {
    if (userSettings) {
      try {
        // Get current preferences from localStorage
        const storedPreferences = localStorage.getItem('notificationPreferences');
        // console.log("Syncing DB settings. Current localStorage prefs:", storedPreferences ? JSON.parse(storedPreferences) : null); // Removed log
        let currentLocalStoragePrefs = storedPreferences ? JSON.parse(storedPreferences) : {
          tasks: true, meetings: true, appointments: true,
          desktop: true, email: false, useReminderService: true
        };

        // Determine enabled status based on DB settings
        const globalEnable = userSettings.notifications_enabled ?? true;
        const desktopEnable = globalEnable && (userSettings.show_notifications ?? true);
        // Keep this for localStorage compatibility, but don't use it
        const emailEnable = false;

        // Determine the state for the reminder checks based on global override
        const checkTasksState = globalEnable;
        const checkMeetingsState = globalEnable;
        const checkAppointmentsState = globalEnable;

        // Construct the preferences object to SAVE TO LOCALSTORAGE.
        const prefsToSave = {
          ...currentLocalStoragePrefs,
          tasks: globalEnable ? (currentLocalStoragePrefs.tasks ?? true) : false,
          meetings: globalEnable ? (currentLocalStoragePrefs.meetings ?? true) : false,
          appointments: globalEnable ? (currentLocalStoragePrefs.appointments ?? true) : false,
          desktop: desktopEnable,
          email: emailEnable, // Keep for compatibility, but always false
          useReminderService: true
        };

        // console.log("Saving preferences to localStorage (respects stored choices if globally enabled):", prefsToSave); // Removed log
        localStorage.setItem('notificationPreferences', JSON.stringify(prefsToSave));

        // Update component state FOR RUNNING CHECKS.
        const newState = {
          taskReminders: checkTasksState,
          meetingReminders: checkMeetingsState,
          appointmentReminders: checkAppointmentsState,
          desktopNotifications: desktopEnable,
          emailNotifications: false, // Always set to false
        };
        // console.log("Setting component state for checks (honors global override):", newState); // Removed log
        setNotificationPreferences(newState);

      } catch (error) {
        console.error('Failed to sync notification preferences with database:', error);
      }
    }
  }, [userSettings]);
  
  // Load notification history from localStorage when component mounts
  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem('notificationHistory');
      if (storedHistory) {
        const history = JSON.parse(storedHistory);
        setNotificationHistory(history);
      }
      
      // Remove email history loading
      
    } catch (error) {
      console.error('Failed to load notification history:', error);
    }
    setInitialized(true);
  }, []);
  
  // Save notification history to localStorage whenever it changes
  useEffect(() => {
    if (initialized) {
      try {
        localStorage.setItem('notificationHistory', JSON.stringify(notificationHistory));
      } catch (error) {
        console.error('Failed to save notification history:', error);
      }
    }
  }, [notificationHistory, initialized]);
  
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
    // console.log("Initializing notification sound"); // Removed log
    // Fix the audio path - ensure it starts with the correct path
    audioRef.current = new Audio('./assets/bell_not.wav');
    // Preload the audio
    if (audioRef.current) {
      audioRef.current.load();
      // console.log("Audio preloaded successfully"); // Removed log
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Function to play notification sound - auto-called by NotificationsContext event
  const playNotificationSound = useCallback(() => {
    // console.log("[Sound] Attempting to play notification sound..."); // Removed log
    
    // Check if notifications are globally enabled in DB
    const userNotificationsEnabled = userSettings?.notifications_enabled ?? true;
    if (!userNotificationsEnabled) {
      // console.warn("[Sound] Blocked: Notifications globally disabled in user settings."); // Removed warn
      return;
    }
    // console.log("[Sound] Global notifications enabled in DB."); // Removed log

    // Check if desktop notifications are enabled in DB
    const showDesktopNotifications = userSettings?.show_notifications ?? true;
    if (!showDesktopNotifications) {
      // console.warn("[Sound] Blocked: Desktop notifications disabled in user settings."); // Removed warn
      return;
    }
    // console.log("[Sound] Desktop notifications enabled in DB."); // Removed log

    // Check if desktop notifications are enabled in component state/localStorage
    if (!notificationPreferences.desktopNotifications) {
      // console.warn("[Sound] Blocked: Desktop notifications disabled in component preferences.", notificationPreferences); // Removed warn
      return;
    }
    // console.log("[Sound] Desktop notifications enabled in component state."); // Removed log

    // Is the audio element ready?
    if (audioRef.current) {
      console.log("[Sound] Audio element reference exists.", { 
        paused: audioRef.current.paused, 
        currentTime: audioRef.current.currentTime, 
        readyState: audioRef.current.readyState 
      });
      // Reset the audio to the beginning if it's already playing or finished
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      
      // Attempt to play
      // console.log("[Sound] Calling play()..."); // Removed log
      const playPromise = audioRef.current.play();

      if (playPromise !== undefined) {
        playPromise.then(_ => {
          // Automatic playback started!
          // console.log("[Sound] Playback started successfully."); // Removed log
        })
        .catch(error => {
          // Auto-play was prevented
          console.error('[Sound] Playback failed:', error);
          // Try again once after a small delay
          setTimeout(() => {
            if (audioRef.current) {
              // console.log("[Sound] Attempting to play sound again after delay..."); // Removed log
              audioRef.current.play().catch(e => 
                console.error('[Sound] Second playback attempt failed:', e)
              );
            }
          }, 500);
        });
      }
    } else {
      console.error("[Sound] Blocked: Audio reference (audioRef.current) is null or undefined.");
      // Re-initialize audio element if it's not available
      audioRef.current = new Audio('./assets/bell_not.wav');
      if (audioRef.current) {
        audioRef.current.load();
        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.play().catch(e => 
              console.error('[Sound] Playback after reinitializing failed:', e)
            );
          }
        }, 100);
      }
    }
  }, [userSettings, notificationPreferences]);

  // Effect for playing sound (triggered by context/event)
  useEffect(() => {
     // console.log("[Sound] Setting up 'tigerNotification' event listener."); // Removed log
     
     const handleNotification = (event: Event) => { 
       // console.log("[Sound] 'tigerNotification' event received.", (event as CustomEvent).detail); // Removed log
       playNotificationSound(); 
       
       // Also show a desktop notification if browser allows it
       // This ensures desktop notifications are shown regardless of useNotifications hook
       if (Notification && Notification.permission === "granted") {
         const detail = (event as CustomEvent).detail;
         if (detail) {
           const { title, message, type } = detail;
           try {
             const notification = new Notification(title || "Tiger Notification", {
               body: message || "You have a new notification",
               icon: "./assets/tiger_logo.png"
             });
             
             // Close the notification after 5 seconds
             setTimeout(() => {
               notification.close();
             }, 5000);
           } catch (error) {
             console.error("Error showing desktop notification:", error);
           }
         }
       } else if (Notification && Notification.permission !== "denied") {
         // Request permission
         Notification.requestPermission().then(permission => {
           // console.log("Notification permission status:", permission); // Removed log
           if (permission === "granted") {
             // User accepted permission, try to show the notification
             const detail = (event as CustomEvent).detail;
             if (detail) {
               const { title, message } = detail;
               try {
                 const notification = new Notification(title || "Tiger Notification", {
                   body: message || "You have a new notification",
                   icon: "./assets/tiger_logo.png"
                 });
                 
                 // Close the notification after 5 seconds
                 setTimeout(() => {
                   notification.close();
                 }, 5000);
               } catch (error) {
                 console.error("Error showing desktop notification after permission granted:", error);
               }
             }
           }
         });
       }
     };
     
     // Remove any existing listeners before adding a new one to prevent duplicates
     document.removeEventListener('tigerNotification', handleNotification);
     document.addEventListener('tigerNotification', handleNotification);
     
     return () => {
       // console.log("[Sound] Cleaning up 'tigerNotification' event listener."); // Removed log
       document.removeEventListener('tigerNotification', handleNotification);
     };
   }, [playNotificationSound]);
   
   // Add a function to deduplicate notifications
   const notificationTracker = useRef<Record<string, number>>({});
   
   // Wrap the addNotification function to prevent duplicates
   const addNotificationWithDeduplication = useCallback((notification: any) => {
     const { title, message, type } = notification;
     const notificationKey = `${type}:${title}:${message}`;
     const now = Date.now();
     
     // Check if we've shown this exact notification in the last 10 seconds
     if (notificationTracker.current[notificationKey] && 
         now - notificationTracker.current[notificationKey] < 10000) {
       // console.log(`Preventing duplicate notification: ${notificationKey}`); // Removed log
       return;
     }
     
     // Update the tracker with the current timestamp
     notificationTracker.current[notificationKey] = now;
     
     // Call the original addNotification function
     addNotification(notification);
   }, [addNotification]);
   
   // Helper function to determine if we should send a notification
   const shouldNotify = (
     id: string, 
     type: 'task' | 'meeting' | 'appointment', 
     currentTime: number,
     dueTime: number
   ): boolean => {
     // Get the appropriate notification state store from our localStorage-backed history
     const storeType = type === 'task' ? 'tasks' : 
                     type === 'meeting' ? 'meetings' : 'appointments';
                     
     const notificationStore = notificationHistory[storeType];
     
     // Calculate time remaining until event is due
     const timeUntilDue = dueTime * 1000 - currentTime; // Convert seconds to milliseconds
     
     // Determine which time point we're at
     let currentTimePoint: keyof typeof NOTIFICATION_TIME_POINTS | null = null;
     
     // Find the closest time point (allowing for small timing variations)
     // We use a 5-minute window to account for timer inaccuracies
     const FIVE_MINUTES = 5 * 60 * 1000;
     
     if (Math.abs(timeUntilDue - NOTIFICATION_TIME_POINTS.ONE_DAY) < FIVE_MINUTES) {
       currentTimePoint = 'ONE_DAY';
     } else if (Math.abs(timeUntilDue - NOTIFICATION_TIME_POINTS.HALF_DAY) < FIVE_MINUTES) {
       currentTimePoint = 'HALF_DAY';
     } else if (Math.abs(timeUntilDue - NOTIFICATION_TIME_POINTS.ONE_HOUR) < FIVE_MINUTES) {
       currentTimePoint = 'ONE_HOUR';
     } else if (Math.abs(timeUntilDue - NOTIFICATION_TIME_POINTS.THIRTY_MIN) < FIVE_MINUTES) {
       currentTimePoint = 'THIRTY_MIN';
     }
     
     // If we're not at a notification time point, don't notify
     if (!currentTimePoint) {
     return false;
   }
     
     // If no record exists, this is the first notification
     if (!notificationStore[id]) {
       // console.log(`First notification for ${type} ${id} at time point ${currentTimePoint}`); // Removed log
       setNotificationHistory(prev => ({
         ...prev,
         [storeType]: {
           ...prev[storeType],
           [id]: { 
             lastNotified: currentTime, 
             count: 1,
             notifiedTimePoints: {
               [currentTimePoint]: true
             }
           }
         },
         lastUpdated: currentTime
       }));
       return true;
     }
     
     const record = notificationStore[id];
     
     // Ensure backward compatibility - if notifiedTimePoints doesn't exist, initialize it
     if (!record.notifiedTimePoints) {
       // console.log(`Upgrading notification record for ${type} ${id} to include timePoints tracking`); // Removed log
       
       // Update the record to include the notifiedTimePoints structure
       setNotificationHistory(prev => ({
         ...prev,
         [storeType]: {
           ...prev[storeType],
           [id]: { 
             lastNotified: record.lastNotified,
             count: record.count,
             acknowledged: record.acknowledged,
             notifiedTimePoints: {
               // Initialize with current time point
               [currentTimePoint]: true
             }
           }
         },
         lastUpdated: currentTime
       }));
       
       // Allow notification since this is the first one with the new structure
       return true;
     }
     
     // If we've already notified for this time point, don't notify again
     if (record.notifiedTimePoints[currentTimePoint]) {
       // console.log(`Skipping notification for ${type} ${id} - already notified for time point ${currentTimePoint}`); // Removed log
       return false;
     }
     
     // console.log(`Sending notification for ${type} ${id} at time point ${currentTimePoint}`); // Removed log
     
     // Update the record to mark this time point as notified
     setNotificationHistory(prev => ({
       ...prev,
       [storeType]: {
         ...prev[storeType],
         [id]: { 
           lastNotified: currentTime,
           count: record.count + 1,
           acknowledged: record.acknowledged,
           notifiedTimePoints: {
             ...record.notifiedTimePoints,
             [currentTimePoint]: true
           }
         }
       },
       lastUpdated: currentTime
     }));
     
     return true;
   };
   
   // Helper functions to convert API data to the correct format
   const formatTasks = useCallback((tasks: any[]): Task[] => {
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
   }, []);
   
   const formatMeetings = useCallback((meetings: any[]): Meeting[] => {
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
   }, []);
   
   const formatAppointments = useCallback((appointments: any[]): Appointment[] => {
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
   }, []);
   
   // Custom function to check task reminders with time-point based notifications
   const customCheckTaskReminders = useCallback((tasks: Task[]) => {
     if (!notificationPreferences.taskReminders) {
       // console.log("Task reminders are disabled, skipping check"); // Removed log
       return;
     }
     
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
       
       // Check if task is due within our notification range
       // The longest notification is 24 hours + 5 minutes buffer
       const MAX_NOTIFICATION_RANGE = (NOTIFICATION_TIME_POINTS.ONE_DAY / 1000) + (5 * 60);
       return timeUntilDue > 0 && timeUntilDue <= MAX_NOTIFICATION_RANGE;
     });
     
     // Process each task that needs a reminder
     tasksNeedingReminders.forEach(task => {
       if (shouldNotify(task.id, 'task', now, task.due_date!)) {
         // Calculate time remaining
         const dueDate = task.due_date!;
         const timeUntilDue = dueDate - nowInSeconds;
         
         // Format time remaining for better readability
         let timeLeftText = '';
         if (timeUntilDue < 60 * 60) {
           // Less than an hour
           const minutesLeft = Math.floor(timeUntilDue / 60);
           timeLeftText = `${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''} left`;
         } else {
           // Hours left
           const hoursLeft = Math.floor(timeUntilDue / (60 * 60));
           const minutesLeft = Math.floor((timeUntilDue % (60 * 60)) / 60);
           timeLeftText = `${hoursLeft} hour${hoursLeft !== 1 ? 's' : ''}`;
           if (minutesLeft > 0) {
             timeLeftText += ` ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}`;
           }
           timeLeftText += ' left';
         }
         
         // Format due time
         const dueTimeText = new Date(dueDate * 1000).toLocaleTimeString([], { 
           hour: '2-digit', 
           minute: '2-digit'
         });
         
         // Create detailed message that includes description and due time
         let message = `Due at ${dueTimeText} (${timeLeftText})`;
         
         // Add task description if available
         if (task.description) {
           message += `\n${task.description}`;
         }
         
         // Add recurrence info if this is a recurring task instance
         if (task.is_recurring) {
           message += ' (Recurring)';
         }
         
         // Send a single, more informative notification with deduplication
         // console.log(`Sending notification for task: ${task.title}`); // Removed log
         addNotificationWithDeduplication({
           title: `${task.title}`,
           message,
           type: 'task'
         });
       }
     });
   }, [notificationPreferences.taskReminders, shouldNotify, addNotificationWithDeduplication]);
   
   // Add minimal meeting reminder function
   const customCheckMeetingReminders = useCallback((meetings: Meeting[]) => {
     if (!notificationPreferences.meetingReminders) {
       // console.log("Meeting reminders are disabled, skipping check"); // Removed log
       return;
     }
     
     // Log but don't actually process anything
     // console.log(`Processing ${meetings.length} meetings for desktop notifications only`); // Removed log
     // We removed email functionality but kept the skeleton
   }, [notificationPreferences.meetingReminders]);
   
   // Add minimal appointment reminder function  
   const customCheckAppointmentReminders = useCallback((appointments: Appointment[]) => {
     if (!notificationPreferences.appointmentReminders) {
       // console.log("Appointment reminders are disabled, skipping check"); // Removed log
       return;
     }
     
     // Log but don't actually process anything
     // console.log(`Processing ${appointments.length} appointments for desktop notifications only`); // Removed log
     // We removed email functionality but kept the skeleton
   }, [notificationPreferences.appointmentReminders]);
   
   // Watch for task data changes and reset notification history for edited tasks
   useEffect(() => {
     if (!initialized || !tasksData || !Array.isArray(tasksData)) return;
     
     // Check if any tasks were updated
     if (prevTasksRef.current.length > 0) {
       const editedTasks = tasksData.filter(task => {
         // Find the previous version of this task
         const prevTask = prevTasksRef.current.find(p => p.id === task.id);
         if (!prevTask) return false; // New task
         
         // Check if due date changed
         return prevTask.due_date !== task.due_date;
       });
       
       // Clear notification history for edited tasks
       if (editedTasks.length > 0) {
         setNotificationHistory(prev => {
           const newTasks = { ...prev.tasks };
           
           // Remove entries for edited tasks
           editedTasks.forEach(task => {
             // Use the ID directly as the key to match shouldNotify
             delete newTasks[task.id];
           });
           
           return {
             ...prev,
             tasks: newTasks,
             lastUpdated: Date.now()
           };
         });
         
         // Log which tasks were reset
         // console.log("Reset notification history for edited tasks:", editedTasks.map(t => t.title)); // Removed log
       }
     }
     
     // Update ref with current tasks
     prevTasksRef.current = [...tasksData];
   }, [tasksData, initialized]);
   
   // Watch for meeting data changes and reset notification history
   useEffect(() => {
     if (!initialized || !meetingsData || !Array.isArray(meetingsData)) return;
     
     // Check if any meetings were updated
     if (prevMeetingsRef.current.length > 0) {
       const editedMeetings = meetingsData.filter(meeting => {
         // Find the previous version of this meeting
         const prevMeeting = prevMeetingsRef.current.find(p => p.id === meeting.id);
         if (!prevMeeting) return false; // New meeting
         
         // Check if start time changed
         return prevMeeting.start_time !== meeting.start_time;
       });
       
       // Clear notification history for edited meetings
       if (editedMeetings.length > 0) {
         setNotificationHistory(prev => {
           const newMeetings = { ...prev.meetings };
           
           // Remove entries for edited meetings
           editedMeetings.forEach(meeting => {
             // Use the ID directly as the key to match shouldNotify
             delete newMeetings[meeting.id];
           });
           
           return {
             ...prev,
             meetings: newMeetings,
             lastUpdated: Date.now()
           };
         });
         
         // console.log("Reset notification history for edited meetings:", editedMeetings.map(m => m.title)); // Removed log
       }
     }
     
     // Update ref with current meetings
     prevMeetingsRef.current = [...meetingsData];
   }, [meetingsData, initialized]);
   
   // Watch for appointment data changes and reset notification history
   useEffect(() => {
     if (!initialized || !appointmentsData || !Array.isArray(appointmentsData)) return;
     
     // Check if any appointments were updated
     if (prevAppointmentsRef.current.length > 0) {
       const editedAppointments = appointmentsData.filter(appointment => {
         // Find the previous version of this appointment
         const prevAppointment = prevAppointmentsRef.current.find(p => p.id === appointment.id);
         if (!prevAppointment) return false; // New appointment
         
         // For appointments, check the start_time since that's what we use for due_date in formatting
         return prevAppointment.start_time !== appointment.start_time;
       });
       
       // Clear notification history for edited appointments
       if (editedAppointments.length > 0) {
         setNotificationHistory(prev => {
           const newAppointments = { ...prev.appointments };
           
           // Remove entries for edited appointments
           editedAppointments.forEach(appointment => {
             // Use the ID directly as the key to match shouldNotify
             delete newAppointments[appointment.id];
           });
           
           return {
             ...prev,
             appointments: newAppointments,
             lastUpdated: Date.now()
           };
         });
         
         // console.log("Reset notification history for edited appointments:", editedAppointments.map(a => a.title)); // Removed log
       }
     }
     
     // Update ref with current appointments
     prevAppointmentsRef.current = [...appointmentsData];
   }, [appointmentsData, initialized]);
   
   // Fix the data change effect
   useEffect(() => {
     if (!initialized) return;
     
     // This effect will run whenever task/meeting/appointment data changes 
     // to trigger an immediate check rather than waiting for interval
     // console.log("Data changed, triggering immediate notification check"); // Removed log
     
     const userNotificationsEnabled = userSettings?.notifications_enabled ?? true;
     const showDesktopNotifications = userSettings?.show_notifications ?? true;
     const desktopNotificationsEnabled = showDesktopNotifications && notificationPreferences.desktopNotifications;
     
     // Only run checks if notifications are enabled
     if (!userNotificationsEnabled || !desktopNotificationsEnabled) {
       // console.log("Notifications are disabled, skipping immediate check"); // Removed log
       return;
     }
     
     // Check tasks
     if (notificationPreferences.taskReminders && tasksData && Array.isArray(tasksData)) {
       // console.log(`Checking ${tasksData.length} tasks for reminders`); // Removed log
       const formattedTasks = formatTasks(tasksData);
       customCheckTaskReminders(formattedTasks);
     }
     
     // Check meetings
     if (notificationPreferences.meetingReminders && meetingsData && Array.isArray(meetingsData)) {
       // console.log(`Checking ${meetingsData.length} meetings for reminders`); // Removed log
       const formattedMeetings = formatMeetings(meetingsData);
       customCheckMeetingReminders(formattedMeetings);
     }
     
     // Check appointments
     if (notificationPreferences.appointmentReminders && appointmentsData && Array.isArray(appointmentsData)) {
       // console.log(`Checking ${appointmentsData.length} appointments for reminders`); // Removed log
       const formattedAppointments = formatAppointments(appointmentsData);
       customCheckAppointmentReminders(formattedAppointments);
     }
   }, [
     initialized,
     tasksData,
     meetingsData,
     appointmentsData,
     notificationPreferences.taskReminders,
     notificationPreferences.meetingReminders,
     notificationPreferences.appointmentReminders,
     userSettings?.notifications_enabled,
     userSettings?.show_notifications,
     // Add missing dependencies
     customCheckTaskReminders,
     customCheckMeetingReminders,
     customCheckAppointmentReminders,
     formatTasks,
     formatMeetings,
     formatAppointments
   ]);
   
   // Sync localStorage preferences when user settings change
   useEffect(() => {
     if (!initialized) return;
     
     // Check if notifications are enabled in user settings
     const userNotificationsEnabled = userSettings?.notifications_enabled ?? true;
     const showDesktopNotifications = userSettings?.show_notifications ?? true;
     // Keep the reference but don't use it
     const showEmailNotifications = false;
     
     // Update localStorage only (not state) to prevent infinite loop
     try {
       const storedPreferences = localStorage.getItem('notificationPreferences');
       if (storedPreferences) {
         const preferences = JSON.parse(storedPreferences);
         
         // Ensure localStorage matches database settings
         const updated = {
           ...preferences,
           desktop: userNotificationsEnabled && showDesktopNotifications,
           email: false // Always set to false
         };
         
         localStorage.setItem('notificationPreferences', JSON.stringify(updated));
         // We don't update component state here as it would cause an infinite loop
         // State is updated only in the userSettings effect
       }
     } catch (err) {
       console.error("Error updating preferences:", err);
     }
     
     // Log notification status for debugging
     // console.log("Notification Status:", { // Removed log
     //   global: userNotificationsEnabled,
     //   desktop: {
     //     database: showDesktopNotifications,
     //     localStorage: notificationPreferences.desktopNotifications,
     //     enabled: showDesktopNotifications && notificationPreferences.desktopNotifications
     //   }
     // });
   }, [
     initialized,
     userSettings?.notifications_enabled,
     userSettings?.show_notifications,
     notificationPreferences
   ]);
   
   // Fix the periodic check function
   const checkReminders = () => {
     // console.log("Periodic notification check running at", new Date().toLocaleTimeString()); // Removed log
     
     // Get latest notification settings
     const userNotificationsEnabled = userSettings?.notifications_enabled ?? true;
     const showDesktopNotifications = userSettings?.show_notifications ?? true;
     
     const desktopNotificationsEnabled = showDesktopNotifications && notificationPreferences.desktopNotifications;
     
     // Only proceed if notifications are enabled
     if (!userNotificationsEnabled || !desktopNotificationsEnabled) {
       // console.log("Notifications are disabled, skipping check"); // Removed log
       return;
     }
     
     // console.log("Checking for notifications with data:", { // Removed log
     //   tasksCount: tasksData?.length || 0,
     //   meetingsCount: meetingsData?.length || 0,
     //   appointmentsCount: appointmentsData?.length || 0,
     //   preferencesEnabled: {
     //     tasks: notificationPreferences.taskReminders,
     //     meetings: notificationPreferences.meetingReminders,
     //     appointments: notificationPreferences.appointmentReminders
     //   }
     // });
     
     try {
       // Check tasks
       if (notificationPreferences.taskReminders && tasksData && Array.isArray(tasksData)) {
         const formattedTasks = formatTasks(tasksData);
         const tasksNeedingReminders = formattedTasks.filter(task => {
           if (!task.due_date || task.completed) return false;
           
           const nowInSeconds = Math.floor(Date.now() / 1000);
           const dueDate = task.due_date;
           const timeUntilDue = dueDate - nowInSeconds;
           
           // Only remind for tasks that are upcoming and due within a day
           // Exclude tasks that are already overdue (timeUntilDue <= 0)
           return timeUntilDue > 0 && timeUntilDue < 24 * 60 * 60;
         });
         
         // console.log(`Found ${tasksNeedingReminders.length} tasks needing reminders out of ${formattedTasks.length} total tasks`); // Removed log
         customCheckTaskReminders(formattedTasks);
       }
     
       // Check meetings
       if (notificationPreferences.meetingReminders && meetingsData && Array.isArray(meetingsData)) {
         const formattedMeetings = formatMeetings(meetingsData);
         customCheckMeetingReminders(formattedMeetings);
       }
     
       // Check appointments
       if (notificationPreferences.appointmentReminders && appointmentsData && Array.isArray(appointmentsData)) {
         const formattedAppointments = formatAppointments(appointmentsData);
         customCheckAppointmentReminders(formattedAppointments);
       }
     } catch (error) {
       console.error("Error checking for reminders:", error);
     }
   };
   
   // Set up a timer to periodically check for reminders
   useEffect(() => {
     if (!initialized) return;
     
     // console.log("Setting up notification check timer"); // Removed log
     
     // Check for reminders every 2 minutes - more frequent checks to ensure timely notifications
     const checkInterval = 2 * 60 * 1000; // 2 minutes
     
     // Function to perform the reminder check
     const checkReminders = () => {
       // console.log("Periodic notification check running at", new Date().toLocaleTimeString()); // Removed log
       
       // Get latest notification settings
       const userNotificationsEnabled = userSettings?.notifications_enabled ?? true;
       const showDesktopNotifications = userSettings?.show_notifications ?? true;
       
       const desktopNotificationsEnabled = showDesktopNotifications && notificationPreferences.desktopNotifications;
       
       // Only proceed if notifications are enabled
       if (!userNotificationsEnabled || !desktopNotificationsEnabled) {
         // console.log("Notifications are disabled, skipping check"); // Removed log
         return;
       }
       
       // console.log("Checking for notifications with data:", { // Removed log
       //   tasksCount: tasksData?.length || 0,
       //   meetingsCount: meetingsData?.length || 0,
       //   appointmentsCount: appointmentsData?.length || 0,
       //   preferencesEnabled: {
       //     tasks: notificationPreferences.taskReminders,
       //     meetings: notificationPreferences.meetingReminders,
       //     appointments: notificationPreferences.appointmentReminders
       //   }
       // });
       
       try {
         // Check tasks
         if (notificationPreferences.taskReminders && tasksData && Array.isArray(tasksData)) {
           const formattedTasks = formatTasks(tasksData);
           const tasksNeedingReminders = formattedTasks.filter(task => {
             if (!task.due_date || task.completed) return false;
             
             const nowInSeconds = Math.floor(Date.now() / 1000);
             const dueDate = task.due_date;
             const timeUntilDue = dueDate - nowInSeconds;
             
             // Only remind for tasks that are upcoming and due within a day
             // Exclude tasks that are already overdue (timeUntilDue <= 0)
             return timeUntilDue > 0 && timeUntilDue < 24 * 60 * 60;
           });
           
           // console.log(`Found ${tasksNeedingReminders.length} tasks needing reminders out of ${formattedTasks.length} total tasks`); // Removed log
           customCheckTaskReminders(formattedTasks);
         }
       
         // Check meetings
         if (notificationPreferences.meetingReminders && meetingsData && Array.isArray(meetingsData)) {
           const formattedMeetings = formatMeetings(meetingsData);
           customCheckMeetingReminders(formattedMeetings);
         }
       
         // Check appointments
         if (notificationPreferences.appointmentReminders && appointmentsData && Array.isArray(appointmentsData)) {
           const formattedAppointments = formatAppointments(appointmentsData);
           customCheckAppointmentReminders(formattedAppointments);
         }
       } catch (error) {
         console.error("Error checking for reminders:", error);
       }
     };
     
     // Force refresh of the data before performing the check
     const refreshAndCheck = async () => {
       try {
         // Invalidate the queries to force a refresh
         queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TASKS] });
         queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MEETINGS] });
         queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.APPOINTMENTS] });
         
         // Allow a brief delay for queries to refresh
         setTimeout(() => {
           // console.log("Running notification check after data refresh"); // Removed log
           checkReminders();
         }, 1000);
       } catch (error) {
         console.error("Error refreshing data:", error);
         // Still run the check even if refresh fails
         checkReminders();
       }
     };
     
     // Force a notification check immediately
     setTimeout(() => {
       // console.log("Running immediate notification check after initialization"); // Removed log
       refreshAndCheck();
     }, 2000);
     
     // Set up the interval only if it's not already set
     if (!timerIntervalRef.current) {
       // Use shorter interval for more responsive notifications
       timerIntervalRef.current = window.setInterval(refreshAndCheck, checkInterval);
       // console.log("Notification check timer created with ID:", timerIntervalRef.current); // Removed log
     }
     
     // Clean up the interval when component unmounts
     return () => {
       if (timerIntervalRef.current) {
         window.clearInterval(timerIntervalRef.current);
         // console.log("Notification check timer cleared:", timerIntervalRef.current); // Removed log
         timerIntervalRef.current = null;
       }
     };
   }, [
     // Only include dependencies that should recreate the timer
     initialized,
   ]);
   
   // This component doesn't render anything visible
   return null;
} 