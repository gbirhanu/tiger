import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getTasks, getAppointments, getMeetings, getUserSettings, getAuthToken,
         scheduleTaskReminder, scheduleMeetingReminder, scheduleAppointmentReminder } from '@/lib/api';
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

// Add a new interface to track email notification history with timestamps
interface EmailSentHistory {
  tasks: { [id: string]: { sent: boolean, timestamp: number } };
  meetings: { [id: string]: { sent: boolean, timestamp: number } };
  appointments: { [id: string]: { sent: boolean, timestamp: number } };
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
    console.log("TaskReminderService component mounted");
    
    // Debug notifications hook
    console.log("Notifications hook available:", {
      hookAvailable: !!notificationsHook,
      addNotification: !!addNotification,
      functions: Object.keys(notificationsHook || {})
    });
    
    return () => {
      console.log("TaskReminderService component unmounted");
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
  
  // Add state to track email notification history with timestamps
  const [emailSentHistory, setEmailSentHistory] = useState<EmailSentHistory>({
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
    emailNotifications: true,
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
      console.log("Fetching tasks for notifications");
      const response = await getTasks();
      return response;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
  
  // Fetch appointments
  const { data: appointmentsData = [] } = useQuery({
    queryKey: [QUERY_KEYS.APPOINTMENTS],
    queryFn: async () => {
      console.log("Fetching appointments for notifications");
      const response = await getAppointments();
      return response;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
  
  // Fetch meetings
  const { data: meetingsData = [] } = useQuery({
    queryKey: [QUERY_KEYS.MEETINGS],
    queryFn: async () => {
      console.log("Fetching meetings for notifications");
      const response = await getMeetings();
      return response;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
  
  // Set up mutations for email notifications
  const taskReminderMutation = useMutation({
    mutationFn: scheduleTaskReminder,
    onSuccess: (data) => {
      console.log("Task email reminder scheduled successfully:", data);
    },
    onError: (error) => {
      console.error("Failed to schedule task email reminder:", error);
    }
  });

  const meetingReminderMutation = useMutation({
    mutationFn: scheduleMeetingReminder,
    onSuccess: (data) => {
      console.log("Meeting email reminder scheduled successfully:", data);
    },
    onError: (error) => {
      console.error("Failed to schedule meeting email reminder:", error);
    }
  });

  const appointmentReminderMutation = useMutation({
    mutationFn: scheduleAppointmentReminder,
    onSuccess: (data) => {
      console.log("Appointment email reminder scheduled successfully:", data);
    },
    onError: (error) => {
      console.error("Failed to schedule appointment email reminder:", error);
    }
  });
  
  // Sync notification preferences with user settings from database
  useEffect(() => {
    if (userSettings) {
      try {
        // Get current preferences from localStorage
        const storedPreferences = localStorage.getItem('notificationPreferences');
        console.log("Syncing DB settings. Current localStorage prefs:", storedPreferences ? JSON.parse(storedPreferences) : null);
        let currentLocalStoragePrefs = storedPreferences ? JSON.parse(storedPreferences) : {
          tasks: true, meetings: true, appointments: true,
          desktop: true, email: true, useReminderService: true
        };

        // Determine enabled status based on DB settings
        const globalEnable = userSettings.notifications_enabled ?? true;
        const desktopEnable = globalEnable && (userSettings.show_notifications ?? true);
        const emailEnable = globalEnable && (userSettings.email_notifications_enabled ?? false);

        // Determine the state for the reminder checks based on global override
        // If globally enabled, all checks are enabled internally for the service.
        // If globally disabled, all are disabled.
        const checkTasksState = globalEnable;
        const checkMeetingsState = globalEnable;
        const checkAppointmentsState = globalEnable;

        // Construct the preferences object to SAVE TO LOCALSTORAGE.
        // This version still respects individual user choices stored previously, 
        // unless globally disabled.
        const prefsToSave = {
          ...currentLocalStoragePrefs, // Keep other potential settings
          tasks: globalEnable ? (currentLocalStoragePrefs.tasks ?? true) : false,
          meetings: globalEnable ? (currentLocalStoragePrefs.meetings ?? true) : false,
          appointments: globalEnable ? (currentLocalStoragePrefs.appointments ?? true) : false,
          desktop: desktopEnable,
          email: emailEnable,
          useReminderService: true // Mark service as active
        };

        console.log("Saving preferences to localStorage (respects stored choices if globally enabled):", prefsToSave);
        localStorage.setItem('notificationPreferences', JSON.stringify(prefsToSave));

        // Update component state FOR RUNNING CHECKS.
        // Use the globally overridden values here.
        const newState = {
          taskReminders: checkTasksState,
          meetingReminders: checkMeetingsState,
          appointmentReminders: checkAppointmentsState,
          desktopNotifications: desktopEnable,
          emailNotifications: emailEnable,
        };
        console.log("Setting component state for checks (honors global override):", newState);
        setNotificationPreferences(newState);

      } catch (error) {
        console.error('Failed to sync notification preferences with database:', error);
      }
    }
  }, [userSettings]); // Rerun only when userSettings change

  // Load notification preferences - FALLBACK if userSettings aren't available
  useEffect(() => {
    // Keep this logic as is - it loads directly from localStorage or sets defaults
    if (!userSettings) { 
      try {
        const storedPreferences = localStorage.getItem('notificationPreferences');
        console.log("Loading preferences from localStorage (DB settings unavailable):", storedPreferences ? JSON.parse(storedPreferences) : null);
        if (storedPreferences) {
          const preferences = JSON.parse(storedPreferences);
          const fallbackState = {
            taskReminders: preferences.tasks ?? true,
            meetingReminders: preferences.meetings ?? true,
            appointmentReminders: preferences.appointments ?? true,
            desktopNotifications: preferences.desktop ?? true,
            emailNotifications: preferences.email ?? true,
          };
          setNotificationPreferences(fallbackState);
          console.log("Fallback preferences loaded into state:", fallbackState);
          // Ensure service marker is set
          if (!preferences.useReminderService) {
            preferences.useReminderService = true;
            localStorage.setItem('notificationPreferences', JSON.stringify(preferences));
          }
        } else {
          const defaultPreferences = {
            tasks: true, meetings: true, appointments: true,
            desktop: true, email: true, useReminderService: true
          };
          console.log("No preferences found in localStorage, setting defaults:", defaultPreferences);
          localStorage.setItem('notificationPreferences', JSON.stringify(defaultPreferences));
          setNotificationPreferences({
            taskReminders: defaultPreferences.tasks,
            meetingReminders: defaultPreferences.meetings,
            appointmentReminders: defaultPreferences.appointments,
            desktopNotifications: defaultPreferences.desktop,
            emailNotifications: defaultPreferences.email,
          });
        }
      } catch (error) {
        console.error('Failed to load notification preferences (fallback): ', error);
      }
    }
  }, [userSettings]); // Keep dependency on userSettings
  
  // Load notification history from localStorage when component mounts
  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem('notificationHistory');
      if (storedHistory) {
        const history = JSON.parse(storedHistory);
        setNotificationHistory(history);
      }
      
      // Load email history from localStorage
      const storedEmailHistory = localStorage.getItem('emailNotificationHistory');
      if (storedEmailHistory) {
        try {
          const emailHistory = JSON.parse(storedEmailHistory);
          
          // Check if we need to upgrade the format from the old boolean format to the new object format
          let needsUpgrade = false;
          
          // Check if any of the entries are still in the old boolean format
          for (const type of ['tasks', 'meetings', 'appointments'] as const) {
            const typeRecords = emailHistory[type];
            if (typeRecords) {
              for (const id in typeRecords) {
                if (typeof typeRecords[id] === 'boolean') {
                  needsUpgrade = true;
                  break;
                }
              }
              if (needsUpgrade) break;
            }
          }
          
          if (needsUpgrade) {
            console.log("Upgrading email history format to include timestamps");
            // Convert from old format to new format
            const upgradedHistory: EmailSentHistory = {
              tasks: {},
              meetings: {},
              appointments: {},
              lastUpdated: emailHistory.lastUpdated || Date.now()
            };
            
            // Convert each type
            for (const type of ['tasks', 'meetings', 'appointments'] as const) {
              const typeRecords = emailHistory[type] || {};
              for (const id in typeRecords) {
                upgradedHistory[type][id] = {
                  sent: !!typeRecords[id],
                  timestamp: Date.now() - 12 * 60 * 60 * 1000 // Assume it was sent 12 hours ago
                };
              }
            }
            
            setEmailSentHistory(upgradedHistory);
          } else {
            // Already in the new format
            setEmailSentHistory(emailHistory);
          }
        } catch (error) {
          console.error("Error parsing email history, resetting:", error);
          // Initialize with empty data if there's an error
          const defaultEmailHistory = {
            tasks: {},
            meetings: {},
            appointments: {},
            lastUpdated: Date.now()
          };
          setEmailSentHistory(defaultEmailHistory);
        }
      }
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
  
  // Save email history to localStorage whenever it changes
  useEffect(() => {
    if (initialized) {
      try {
        localStorage.setItem('emailNotificationHistory', JSON.stringify(emailSentHistory));
      } catch (error) {
        console.error('Failed to save email notification history:', error);
      }
    }
  }, [emailSentHistory, initialized]);
  
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
    console.log("Initializing notification sound");
    // Fix the audio path - ensure it starts with the correct path
    audioRef.current = new Audio('./assets/bell_not.wav');
    // Preload the audio
    if (audioRef.current) {
      audioRef.current.load();
      console.log("Audio preloaded successfully");
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
    console.log("[Sound] Attempting to play notification sound...");
    
    // Check if notifications are globally enabled in DB
    const userNotificationsEnabled = userSettings?.notifications_enabled ?? true;
    if (!userNotificationsEnabled) {
      console.warn("[Sound] Blocked: Notifications globally disabled in user settings.");
      return;
    }
    console.log("[Sound] Global notifications enabled in DB.");

    // Check if desktop notifications are enabled in DB
    const showDesktopNotifications = userSettings?.show_notifications ?? true;
    if (!showDesktopNotifications) {
      console.warn("[Sound] Blocked: Desktop notifications disabled in user settings.");
      return;
    }
    console.log("[Sound] Desktop notifications enabled in DB.");

    // Check if desktop notifications are enabled in component state/localStorage
    if (!notificationPreferences.desktopNotifications) {
      console.warn("[Sound] Blocked: Desktop notifications disabled in component preferences.", notificationPreferences);
      return;
    }
    console.log("[Sound] Desktop notifications enabled in component state.");

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
      console.log("[Sound] Calling play()...");
      const playPromise = audioRef.current.play();

      if (playPromise !== undefined) {
        playPromise.then(_ => {
          // Automatic playback started!
          console.log("[Sound] Playback started successfully.");
        })
        .catch(error => {
          // Auto-play was prevented
          console.error('[Sound] Playback failed:', error);
          // Try again once after a small delay
          setTimeout(() => {
            if (audioRef.current) {
              console.log("[Sound] Attempting to play sound again after delay...");
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
     console.log("[Sound] Setting up 'tigerNotification' event listener.");
     
     const handleNotification = (event: Event) => { 
       console.log("[Sound] 'tigerNotification' event received.", (event as CustomEvent).detail);
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
           console.log("Notification permission status:", permission);
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
       console.log("[Sound] Cleaning up 'tigerNotification' event listener.");
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
       console.log(`Preventing duplicate notification: ${notificationKey}`);
       return;
     }
     
     // Update the tracker with the current timestamp
     notificationTracker.current[notificationKey] = now;
     
     // Call the original addNotification function
     addNotification(notification);
   }, [addNotification]);
   
   // Helper function to send email notification request to backend
   const sendEmailNotification = async (type: string, item: any) => {
     // First check if email notifications are enabled in user settings
     const emailNotificationsEnabled = userSettings?.email_notifications_enabled ?? false;
     // Also check if global notifications are enabled
     const notificationsEnabled = userSettings?.notifications_enabled ?? true;
     
     // Only proceed if both settings allow email notifications and notifications in general are enabled
     if (!emailNotificationsEnabled || !notificationsEnabled || !notificationPreferences.emailNotifications) {
       console.log("Email notifications are disabled - settings or preferences don't allow them");
       return;
     }
     
     const userEmail = user?.email;
     const userId = user?.id;
     
     // Validate that we have the necessary user information
     if (!userId || !userEmail) {
       console.error("Cannot schedule email notification: user ID or email not found");
       return;
     }
     
     // Check if email has already been sent for this item
     const itemId = item.id;
     const storeType = type === 'task' ? 'tasks' : 
                     type === 'meeting' ? 'meetings' : 'appointments';
                     
     // Get the existing email record for this item if it exists
     const existingRecord = emailSentHistory[storeType][itemId];
     
     // Check if we've already sent an email for this item within the last 23 hours
     // This prevents multiple emails even if the notification runs multiple times
     if (existingRecord && existingRecord.sent) {
       const timeSinceLastEmail = Date.now() - existingRecord.timestamp;
       const TWENTY_THREE_HOURS = 23 * 60 * 60 * 1000;
       
       if (timeSinceLastEmail < TWENTY_THREE_HOURS) {
         console.log(`Email already sent for ${type} ${itemId} ${timeSinceLastEmail/3600000} hours ago, skipping`);
         return;
       } else {
         console.log(`Previous email for ${type} ${itemId} was sent over 23 hours ago, allowing a new one`);
         // Continue processing as we're outside the cooldown period
       }
     }

     // Calculate time remaining until the event
     const now = Math.floor(Date.now() / 1000);
     let timeUntilEvent;
     let shouldSendEmail = false;

     // Check if we're at the right time point for email based on event type
     if (type === 'task' || type === 'appointment') {
       // For tasks and appointments, send emails at 24 hours before
       timeUntilEvent = (type === 'task' ? item.due_date : item.due_date) - now;
       const ONE_DAY_IN_SECONDS = 24 * 60 * 60;
       // Use a narrower 3-minute window to prevent multiple emails
       const THREE_MINUTES = 3 * 60;
       shouldSendEmail = Math.abs(timeUntilEvent - ONE_DAY_IN_SECONDS) < THREE_MINUTES;
       
       // For edited tasks with due dates very close to now, also send an immediate notification
       // This ensures edited tasks still get notifications if edited to be due soon
       if (!shouldSendEmail && timeUntilEvent > 0 && timeUntilEvent < ONE_DAY_IN_SECONDS) {
         // For due dates within 24 hours that were just edited
         const isRecentlyEdited = item._recentlyEdited || false;
         if (isRecentlyEdited) {
           console.log(`Task/appointment ${itemId} was recently edited with new due date, sending immediate notification`);
           shouldSendEmail = true;
         }
       }
     } else if (type === 'meeting') {
       // For meetings, send emails at 1 hour before
       timeUntilEvent = item.start_time - now;
       const ONE_HOUR_IN_SECONDS = 60 * 60;
       // Use a narrower 3-minute window to prevent multiple emails
       const THREE_MINUTES = 3 * 60;
       shouldSendEmail = Math.abs(timeUntilEvent - ONE_HOUR_IN_SECONDS) < THREE_MINUTES;
       
       // For edited meetings with start times very close to now, also send an immediate notification
       if (!shouldSendEmail && timeUntilEvent > 0 && timeUntilEvent < ONE_HOUR_IN_SECONDS) {
         const isRecentlyEdited = item._recentlyEdited || false;
         if (isRecentlyEdited) {
           console.log(`Meeting ${itemId} was recently edited with new start time, sending immediate notification`);
           shouldSendEmail = true;
         }
       }
     }

     // Only send email at the appropriate time point
     if (!shouldSendEmail) {
       console.log(`Not the right time to send email for ${type} ${itemId}, current timeUntilEvent: ${timeUntilEvent}`);
       return;
     }
     
     // Generate a unique key for this specific notification based on item ID and timestamp
     // This helps prevent duplicate emails being sent within seconds of each other
     const notificationKey = `${type}_${itemId}_${Math.floor(Date.now() / 1000 / 60)}`; // Round to minutes
     
     // Check if we've already tried to send this specific notification in this minute
     const recentNotificationAttempt = localStorage.getItem(notificationKey);
     if (recentNotificationAttempt) {
       console.log(`Email attempt for ${type} ${itemId} blocked - already attempted this specific notification`);
       return;
     }
     
     // Mark that we're attempting this specific notification
     localStorage.setItem(notificationKey, "true");
     // Set this to expire after 5 minutes
     setTimeout(() => localStorage.removeItem(notificationKey), 5 * 60 * 1000);
     
     // Check if we've already tried to send multiple emails within a short period
     // This is an additional safety check to prevent email storms
     const SHORT_COOLDOWN = 10 * 60 * 1000; // 10 minutes
     if (
       existingRecord && 
       Date.now() - existingRecord.timestamp < SHORT_COOLDOWN
     ) {
       console.log(`Email attempt for ${type} ${itemId} blocked - too many attempts within 10 minutes`);
       return;
     }
     
     try {
       console.log(`Scheduling ${type} reminder for: ${item.title}`);
       
       // Mark that we're attempting to send an email now, even before the API call
       // This prevents multiple simultaneous attempts
       setEmailSentHistory(prev => ({
         ...prev,
         [storeType]: {
           ...prev[storeType],
           [itemId]: {
             sent: true,
             timestamp: Date.now()
           }
         },
         lastUpdated: Date.now()
       }));
       
       // Use the appropriate mutation based on item type
       if (type === 'task' && item.title && item.due_date) {
         await taskReminderMutation.mutateAsync({
             email: userEmail,
             taskTitle: item.title,
             taskId: item.id,
             dueDate: item.due_date,
           userId: userId
         });
         
         console.log(`Successfully sent email for task ${itemId}: ${item.title}`);
         
       } else if (type === 'meeting' && item.title && item.start_time) {
         await meetingReminderMutation.mutateAsync({
             email: userEmail,
             meetingTitle: item.title,
             meetingId: item.id,
             startTime: item.start_time,
             meetingLink: item.meeting_link,
           userId: userId
         });
         
         console.log(`Successfully sent email for meeting ${itemId}: ${item.title}`);
         
       } else if (type === 'appointment' && item.title && item.due_date) {
         await appointmentReminderMutation.mutateAsync({
             email: userEmail,
             appointmentTitle: item.title,
             appointmentId: item.id,
             dueDate: item.due_date,
             location: item.location,
           userId: userId
         });
         
         console.log(`Successfully sent email for appointment ${itemId}: ${item.title}`);
         
       } else {
         console.log("Email notification not sent: Invalid item type or missing required fields");
         
         // Since we didn't actually send an email, update the record to reflect that
         setEmailSentHistory(prev => ({
           ...prev,
           [storeType]: {
             ...prev[storeType],
             [itemId]: {
               sent: false,
               timestamp: Date.now()
             }
           },
           lastUpdated: Date.now()
         }));
       }
     } catch (error) {
       console.error("Error scheduling email notification:", error);
       
       // If there was an error, mark that the email wasn't actually sent
       setEmailSentHistory(prev => ({
         ...prev,
         [storeType]: {
           ...prev[storeType],
           [itemId]: {
             sent: false,
             timestamp: Date.now()
           }
         },
         lastUpdated: Date.now()
       }));
     }
   };
   
   // Helper function to validate payload
   function validatePayload(payload: any, type: string): boolean {
     if (!payload.email || !payload.userId) return false;
     
     if (type === 'task') {
       return !!payload.taskTitle && !!payload.taskId && payload.dueDate !== undefined;
     } else if (type === 'meeting') {
       return !!payload.meetingTitle && !!payload.meetingId && payload.startTime !== undefined;
     } else if (type === 'appointment') {
       return !!payload.appointmentTitle && !!payload.appointmentId && payload.dueDate !== undefined;
     }
     
     return false;
   }
   
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
       console.log(`First notification for ${type} ${id} at time point ${currentTimePoint}`);
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
       console.log(`Upgrading notification record for ${type} ${id} to include timePoints tracking`);
       
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
       console.log(`Skipping notification for ${type} ${id} - already notified for time point ${currentTimePoint}`);
       return false;
     }
     
     console.log(`Sending notification for ${type} ${id} at time point ${currentTimePoint}`);
     
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
       console.log("Task reminders are disabled, skipping check");
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
         console.log(`Sending notification for task: ${task.title}`);
         addNotificationWithDeduplication({
           title: `${task.title}`,
           message,
           type: 'task'
         });
         
         // Schedule email notification if needed
         if (notificationPreferences.emailNotifications) {
           sendEmailNotification('task', task);
         }
       }
     });
   }, [notificationPreferences.taskReminders, shouldNotify, addNotificationWithDeduplication, notificationPreferences.emailNotifications, sendEmailNotification]);
   
   // Custom function to check meeting reminders with time-point based notifications
   const customCheckMeetingReminders = useCallback((meetings: Meeting[]) => {
     if (!notificationPreferences.meetingReminders) {
       console.log("Meeting reminders are disabled, skipping check");
       return;
     }
     
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
       
       // Check if meeting is starting within our notification range
       // The longest notification is 24 hours + 5 minutes buffer
       const MAX_NOTIFICATION_RANGE = (NOTIFICATION_TIME_POINTS.ONE_DAY / 1000) + (5 * 60);
       return timeUntilStart > 0 && timeUntilStart <= MAX_NOTIFICATION_RANGE;
     });
     
     // Process each meeting that needs a reminder
     meetingsNeedingReminders.forEach(meeting => {
       if (shouldNotify(meeting.id, 'meeting', now, meeting.start_time)) {
         // Calculate time remaining
         const startTime = meeting.start_time;
         const timeUntilStart = startTime - nowInSeconds;
         
         // Format time remaining for better readability
         let timeLeftText = '';
         if (timeUntilStart < 60 * 60) {
           // Less than an hour
           const minutesLeft = Math.floor(timeUntilStart / 60);
           timeLeftText = `${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''} left`;
         } else {
           // Hours left
           const hoursLeft = Math.floor(timeUntilStart / (60 * 60));
           const minutesLeft = Math.floor((timeUntilStart % (60 * 60)) / 60);
           timeLeftText = `${hoursLeft} hour${hoursLeft !== 1 ? 's' : ''}`;
           if (minutesLeft > 0) {
             timeLeftText += ` ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}`;
           }
           timeLeftText += ' left';
         }
         
         // Format start time
         const startTimeText = new Date(startTime * 1000).toLocaleTimeString([], { 
           hour: '2-digit', 
           minute: '2-digit'
         });
         
         // Create detailed message with start time and time left
         let message = `Starts at ${startTimeText} (${timeLeftText})`;
         
         // Add meeting location/link if available
         if (meeting.meeting_link) {
           message += `\nLocation: ${meeting.meeting_link}`;
         }
         
         // Add meeting description if available
         if (meeting.description) {
           message += `\n${meeting.description}`;
         }
         
         // Add recurrence info if this is a recurring meeting instance
         if (meeting.is_recurring) {
           message += ' (Recurring)';
         }
         
         // Send a single notification with comprehensive information
         console.log(`Sending notification for meeting: ${meeting.title}`);
         addNotificationWithDeduplication({
           title: `${meeting.title}`,
           message,
           type: 'meeting'
         });
         
         // Schedule email notification if needed
         if (notificationPreferences.emailNotifications) {
           sendEmailNotification('meeting', meeting);
         }
       }
     });
   }, [notificationPreferences.meetingReminders, shouldNotify, addNotificationWithDeduplication, notificationPreferences.emailNotifications, sendEmailNotification]);
   
   // Custom function to check appointment reminders with time-point based notifications
   const customCheckAppointmentReminders = useCallback((appointments: Appointment[]) => {
     if (!notificationPreferences.appointmentReminders) {
       console.log("Appointment reminders are disabled, skipping check");
       return;
     } 
     
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
       
       // Check if appointment is due within our notification range
       // The longest notification is 24 hours + 5 minutes buffer
       const MAX_NOTIFICATION_RANGE = (NOTIFICATION_TIME_POINTS.ONE_DAY / 1000) + (5 * 60);
       return timeUntilDue > 0 && timeUntilDue <= MAX_NOTIFICATION_RANGE;
     });
     
     // Process each appointment that needs a reminder
     appointmentsNeedingReminders.forEach(appointment => {
       if (shouldNotify(appointment.id, 'appointment', now, appointment.due_date)) {
         // Calculate time remaining
         const dueDate = appointment.due_date;
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
         
         // Format start time with better formatting
         const startTimeText = new Date(dueDate * 1000).toLocaleTimeString([], { 
           hour: '2-digit', 
           minute: '2-digit'
         });
         
         // Create a detailed message
         let message = `At ${startTimeText} (${timeLeftText})`;
         
         // Add location if available
         if (appointment.location) {
           message += `\nLocation: ${appointment.location}`;
         }
         
         // Add contact information if available
         if (appointment.contact) {
           message += `\nWith: ${appointment.contact}`;
         }
         
         // Add description if available
         if (appointment.description) {
           message += `\n${appointment.description}`;
         }
         
         // Add recurrence info if this is a recurring appointment
         if (appointment.is_recurring) {
           message += ' (Recurring)';
         }
         
         // Send a single notification with comprehensive information
         console.log(`Sending notification for appointment: ${appointment.title}`);
         addNotificationWithDeduplication({
           title: `${appointment.title}`,
           message,
           type: 'appointment'
         });
         
         // Schedule email notification if needed
         if (notificationPreferences.emailNotifications) {
           sendEmailNotification('appointment', appointment);
         }
       }
     });
   }, [notificationPreferences.appointmentReminders, shouldNotify, addNotificationWithDeduplication, notificationPreferences.emailNotifications, sendEmailNotification]);
   
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
         
         // Also reset email sent history for edited tasks
         setEmailSentHistory(prev => {
           const newEmailTasks = { ...prev.tasks };
           
           editedTasks.forEach(task => {
             delete newEmailTasks[task.id];
           });
           
           return {
             ...prev,
             tasks: newEmailTasks,
             lastUpdated: Date.now()
           };
         });
         
         // Mark edited tasks for immediate notification check by adding a temporary property
         const tasksWithEditFlag = tasksData.map(task => {
           if (editedTasks.some(editedTask => editedTask.id === task.id)) {
             return { ...task, _recentlyEdited: true };
           }
           return task;
         });
         
         // Trigger immediate check for the edited tasks
         const formattedTasks = formatTasks(tasksWithEditFlag);
         const editedFormattedTasks = formattedTasks.filter(task => 
           editedTasks.some(editedTask => editedTask.id.toString() === task.id.toString())
         );
         
         console.log(`Checking ${editedFormattedTasks.length} edited tasks for immediate email notification`);
         
         // Only check the edited tasks
         if (editedFormattedTasks.length > 0) {
           editedFormattedTasks.forEach(task => {
             if (task.due_date && !task.completed && 
                 notificationPreferences.emailNotifications) {
               sendEmailNotification('task', task);
             }
           });
         }
         
         // Log which tasks were reset
         console.log("Reset notification history for edited tasks:", editedTasks.map(t => t.title));
       }
     }
     
     // Update ref with current tasks
     prevTasksRef.current = [...tasksData];
   }, [tasksData, initialized, sendEmailNotification, notificationPreferences.emailNotifications, formatTasks]);
   
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
         
         // Also reset email sent history for edited meetings
         setEmailSentHistory(prev => {
           const newEmailMeetings = { ...prev.meetings };
           
           editedMeetings.forEach(meeting => {
             delete newEmailMeetings[meeting.id];
           });
           
           return {
             ...prev,
             meetings: newEmailMeetings,
             lastUpdated: Date.now()
           };
         });
         
         // Mark edited meetings for immediate notification check by adding a temporary property
         const meetingsWithEditFlag = meetingsData.map(meeting => {
           if (editedMeetings.some(editedMeeting => editedMeeting.id === meeting.id)) {
             return { ...meeting, _recentlyEdited: true };
           }
           return meeting;
         });
         
         // Trigger immediate check for the edited meetings
         const formattedMeetings = formatMeetings(meetingsWithEditFlag);
         const editedFormattedMeetings = formattedMeetings.filter(meeting => 
           editedMeetings.some(editedMeeting => editedMeeting.id.toString() === meeting.id.toString())
         );
         
         console.log(`Checking ${editedFormattedMeetings.length} edited meetings for immediate email notification`);
         
         // Only check the edited meetings
         if (editedFormattedMeetings.length > 0) {
           editedFormattedMeetings.forEach(meeting => {
             if (meeting.start_time && notificationPreferences.emailNotifications) {
               sendEmailNotification('meeting', meeting);
             }
           });
         }
         
         console.log("Reset notification history for edited meetings:", editedMeetings.map(m => m.title));
       }
     }
     
     // Update ref with current meetings
     prevMeetingsRef.current = [...meetingsData];
   }, [meetingsData, initialized, sendEmailNotification, notificationPreferences.emailNotifications, formatMeetings]);
   
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
         
         // Also reset email sent history for edited appointments
         setEmailSentHistory(prev => {
           const newEmailAppointments = { ...prev.appointments };
           
           editedAppointments.forEach(appointment => {
             delete newEmailAppointments[appointment.id];
           });
           
           return {
             ...prev,
             appointments: newEmailAppointments,
             lastUpdated: Date.now()
           };
         });
         
         // Mark edited appointments for immediate notification check by adding a temporary property
         const appointmentsWithEditFlag = appointmentsData.map(appointment => {
           if (editedAppointments.some(editedAppointment => editedAppointment.id === appointment.id)) {
             return { ...appointment, _recentlyEdited: true };
           }
           return appointment;
         });
         
         // Trigger immediate check for the edited appointments
         const formattedAppointments = formatAppointments(appointmentsWithEditFlag);
         const editedFormattedAppointments = formattedAppointments.filter(appointment => 
           editedAppointments.some(editedAppointment => editedAppointment.id.toString() === appointment.id.toString())
         );
         
         console.log(`Checking ${editedFormattedAppointments.length} edited appointments for immediate email notification`);
         
         // Only check the edited appointments
         if (editedFormattedAppointments.length > 0) {
           editedFormattedAppointments.forEach(appointment => {
             if (appointment.due_date && notificationPreferences.emailNotifications) {
               sendEmailNotification('appointment', appointment);
             }
           });
         }
         
         console.log("Reset notification history for edited appointments:", editedAppointments.map(a => a.title));
       }
     }
     
     // Update ref with current appointments
     prevAppointmentsRef.current = [...appointmentsData];
   }, [appointmentsData, initialized, sendEmailNotification, notificationPreferences.emailNotifications, formatAppointments]);
   
   // Add useEffect to respond to data changes and trigger checks immediately
   useEffect(() => {
     if (!initialized) return;
     
     // This effect will run whenever task/meeting/appointment data changes 
     // to trigger an immediate check rather than waiting for interval
     console.log("Data changed, triggering immediate notification check");
     
     const userNotificationsEnabled = userSettings?.notifications_enabled ?? true;
     const showDesktopNotifications = userSettings?.show_notifications ?? true;
     const desktopNotificationsEnabled = showDesktopNotifications && notificationPreferences.desktopNotifications;
     
     // Only run checks if notifications are enabled
     if (!userNotificationsEnabled || !desktopNotificationsEnabled) {
       console.log("Notifications are disabled, skipping immediate check");
       return;
     }
     
     // Check tasks
     if (notificationPreferences.taskReminders && tasksData && Array.isArray(tasksData)) {
       console.log(`Checking ${tasksData.length} tasks for reminders`);
       const formattedTasks = formatTasks(tasksData);
       customCheckTaskReminders(formattedTasks);
     }
     
     // Check meetings
     if (notificationPreferences.meetingReminders && meetingsData && Array.isArray(meetingsData)) {
       console.log(`Checking ${meetingsData.length} meetings for reminders`);
       const formattedMeetings = formatMeetings(meetingsData);
       customCheckMeetingReminders(formattedMeetings);
     }
     
     // Check appointments
     if (notificationPreferences.appointmentReminders && appointmentsData && Array.isArray(appointmentsData)) {
       console.log(`Checking ${appointmentsData.length} appointments for reminders`);
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
   
   // Clean up old email notification history periodically (same as regular notification cleanup)
   useEffect(() => {
     if (!initialized) return;
     
     const now = Date.now();
     const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
     
     // Run with same frequency as notification cleanup
     const lastCleanup = localStorage.getItem('lastNotificationCleanup');
     const lastCleanupTime = lastCleanup ? parseInt(lastCleanup, 10) : 0;
     
     if (now - lastCleanupTime < 24 * 60 * 60 * 1000) {
       return;
     }
     
     // Function to clean old email records
     const cleanOldEmailRecords = (records: { [id: string]: { sent: boolean, timestamp: number } }): { [id: string]: { sent: boolean, timestamp: number } } => {
       const newRecords: { [id: string]: { sent: boolean, timestamp: number } } = {};
       
       // Since we don't have timestamps for email records,
       // we'll just clear all email records during cleanup
       // This is safe since if a notification is still needed, it will
       // send another email after the cleanup
       return newRecords;
     };
     
     // Clean up old email notification records
     setEmailSentHistory(prev => ({
       tasks: cleanOldEmailRecords(prev.tasks),
       meetings: cleanOldEmailRecords(prev.meetings),
       appointments: cleanOldEmailRecords(prev.appointments),
       lastUpdated: now
     }));
   }, [initialized]);
   
   // Sync localStorage preferences when user settings change
   useEffect(() => {
     if (!initialized) return;
     
     // Check if notifications are enabled in user settings
     const userNotificationsEnabled = userSettings?.notifications_enabled ?? true;
     const showDesktopNotifications = userSettings?.show_notifications ?? true;
     const showEmailNotifications = userSettings?.email_notifications_enabled ?? false;
     
     // Update localStorage only (not state) to prevent infinite loop
     try {
       const storedPreferences = localStorage.getItem('notificationPreferences');
       if (storedPreferences) {
         const preferences = JSON.parse(storedPreferences);
         
         // Ensure localStorage matches database settings
         const updated = {
           ...preferences,
           desktop: userNotificationsEnabled && showDesktopNotifications,
           email: userNotificationsEnabled && showEmailNotifications
         };
         
         localStorage.setItem('notificationPreferences', JSON.stringify(updated));
         // We don't update component state here as it would cause an infinite loop
         // State is updated only in the userSettings effect
       }
     } catch (err) {
       console.error("Error updating preferences:", err);
     }
     
     // Log notification status for debugging
     console.log("Notification Status:", {
       global: userNotificationsEnabled,
       desktop: {
         database: showDesktopNotifications,
         localStorage: notificationPreferences.desktopNotifications,
         enabled: showDesktopNotifications && notificationPreferences.desktopNotifications
       },
       email: {
         database: showEmailNotifications,
         localStorage: notificationPreferences.emailNotifications,
         enabled: showEmailNotifications && notificationPreferences.emailNotifications
       }
     });
   }, [
     initialized,
     userSettings?.notifications_enabled,
     userSettings?.show_notifications,
     userSettings?.email_notifications_enabled,
     notificationPreferences
   ]);
   
   // Set up a timer to periodically check for reminders
   useEffect(() => {
     if (!initialized) return;
     
     console.log("Setting up notification check timer");
     
     // Check for reminders every 2 minutes - more frequent checks to ensure timely notifications
     const checkInterval = 2 * 60 * 1000; // 2 minutes
     
     // Function to perform the reminder check
     const checkReminders = () => {
       console.log("Periodic notification check running at", new Date().toLocaleTimeString());
       
       // Get latest notification settings
       const userNotificationsEnabled = userSettings?.notifications_enabled ?? true;
       const showDesktopNotifications = userSettings?.show_notifications ?? true;
       
       const desktopNotificationsEnabled = showDesktopNotifications && notificationPreferences.desktopNotifications;
       
       // Only proceed if notifications are enabled
       if (!userNotificationsEnabled || !desktopNotificationsEnabled) {
         console.log("Notifications are disabled, skipping check");
         return;
       }
       
       console.log("Checking for notifications with data:", {
         tasksCount: tasksData?.length || 0,
         meetingsCount: meetingsData?.length || 0,
         appointmentsCount: appointmentsData?.length || 0,
         preferencesEnabled: {
           tasks: notificationPreferences.taskReminders,
           meetings: notificationPreferences.meetingReminders,
           appointments: notificationPreferences.appointmentReminders
         }
       });
       
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
           
           console.log(`Found ${tasksNeedingReminders.length} tasks needing reminders out of ${formattedTasks.length} total tasks`);
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
           console.log("Running notification check after data refresh");
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
       console.log("Running immediate notification check after initialization");
       refreshAndCheck();
     }, 2000);
     
     // Set up the interval only if it's not already set
     if (!timerIntervalRef.current) {
       // Use shorter interval for more responsive notifications
       timerIntervalRef.current = window.setInterval(refreshAndCheck, checkInterval);
       console.log("Notification check timer created with ID:", timerIntervalRef.current);
     }
     
     // Clean up the interval when component unmounts
     return () => {
       if (timerIntervalRef.current) {
         window.clearInterval(timerIntervalRef.current);
         console.log("Notification check timer cleared:", timerIntervalRef.current);
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