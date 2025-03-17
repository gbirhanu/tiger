import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTasks, getAppointments, getMeetings } from '@/lib/api';
import { useNotifications } from '@/hooks/use-notifications';

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
}

interface Meeting {
  id: string;
  title: string;
  description?: string | null;
  start_time: number;
  end_time: number;
  meeting_link?: string | null;
}

interface Appointment {
  id: string;
  title: string;
  description?: string | null;
  due_date: number;
  location?: string | null;
  contact?: string | null;
}

/**
 * This component doesn't render anything visible but provides reminder functionality
 * It should be included once in your app, typically in a layout component
 */
export function TaskReminderService() {
  const { addNotification, checkTaskReminders, checkMeetingReminders, checkAppointmentReminders } = useNotifications();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [userInteracted, setUserInteracted] = useState(false);
  const [initialized, setInitialized] = useState(false);
  
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
      console.log('Notification sound loaded');
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
    // Only play sound if user has interacted with the page
    if (!userInteracted) {
      console.log('Cannot play sound until user interacts with the page');
      return;
    }
    
    if (audioRef.current) {
      // Reset the audio to the beginning if it's already playing
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      
      // Play the notification sound
      audioRef.current.play().then(() => {
        console.log('Notification sound played successfully');
      }).catch(error => {
        console.error('Failed to play notification sound:', error);
      });
    } else {
      console.error('Audio element not initialized');
    }
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
      recurrence_end_date: task.recurrence_end_date
    }));
  };
  
  const formatMeetings = (meetings: any[]): Meeting[] => {
    return meetings.map(meeting => ({
      id: String(meeting.id),
      title: meeting.title,
      description: meeting.description,
      start_time: meeting.start_time,
      end_time: meeting.end_time,
      meeting_link: meeting.meeting_link
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
      contact: appointment.attendees
    }));
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
  }, []);
  
  // Check for reminders whenever data changes
  useEffect(() => {
    if (!initialized) return;
    
    // Use the context functions to check for reminders
    if (tasksData && Array.isArray(tasksData)) {
      const formattedTasks = formatTasks(tasksData);
      checkTaskReminders(formattedTasks);
    }
    
    if (meetingsData && Array.isArray(meetingsData)) {
      const formattedMeetings = formatMeetings(meetingsData);
      checkMeetingReminders(formattedMeetings);
    }
    
    if (appointmentsData && Array.isArray(appointmentsData)) {
      const formattedAppointments = formatAppointments(appointmentsData);
      checkAppointmentReminders(formattedAppointments);
    }
    
  }, [tasksData, appointmentsData, meetingsData, checkTaskReminders, checkMeetingReminders, checkAppointmentReminders, initialized]);
  
  // This component doesn't render anything visible
  return null;
} 