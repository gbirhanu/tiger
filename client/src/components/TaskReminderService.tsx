import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTasks } from '@/lib/api';
import { useNotifications } from '@/hooks/use-notifications';

// Define the task interface for reminders
interface TaskForReminder {
  id: string;
  title: string;
  description?: string | null;
  due_date?: number | null; // Unix timestamp
  priority?: string;
  completed?: boolean;
}

/**
 * Checks tasks for upcoming due dates and returns tasks that need reminders
 */
function checkTasksForReminders(tasks: TaskForReminder[]): TaskForReminder[] {
  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
    return [];
  }

  const now = new Date();
  const tasksNeedingReminders: TaskForReminder[] = [];

  tasks.forEach(task => {
    // Skip completed tasks or tasks without due dates
    if (task.completed || !task.due_date) {
      return;
    }

    const dueDate = new Date(task.due_date * 1000); // Convert Unix timestamp to Date
    
    // Check if the task is due within the next 24 hours
    const hoursUntilDue = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60));
    
    // Add reminders for tasks due in 1 hour, 3 hours, or 24 hours
    if (hoursUntilDue > 0 && (hoursUntilDue === 1 || hoursUntilDue === 3 || hoursUntilDue === 24)) {
      tasksNeedingReminders.push(task);
    }
  });

  return tasksNeedingReminders;
}

/**
 * Creates a reminder message based on the time until the task is due
 */
function createReminderMessage(task: TaskForReminder): { title: string; message: string } {
  const dueDate = new Date(task.due_date! * 1000);
  const now = new Date();
  const hoursUntilDue = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60));
  
  let title = '';
  let message = '';
  
  if (hoursUntilDue <= 1) {
    title = 'Task Due Soon';
    message = `"${task.title}" is due in less than an hour`;
  } else if (hoursUntilDue <= 3) {
    title = 'Task Due Soon';
    message = `"${task.title}" is due in about ${hoursUntilDue} hours`;
  } else {
    title = 'Upcoming Task';
    message = `"${task.title}" is due tomorrow`;
  }
  
  return { title, message };
}

/**
 * This component doesn't render anything visible but provides task reminder functionality
 * It should be included once in your app, typically in a layout component
 */
export function TaskReminderService() {
  const { addNotification } = useNotifications();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [userInteracted, setUserInteracted] = useState(false);
  
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
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const response = await getTasks();
      return response;
    },
  });
  
  // Helper function to convert tasks to the format needed for reminders
  const formatTaskForReminders = (task: any): TaskForReminder => {
    return {
      id: String(task.id),
      title: task.title,
      description: task.description || null,
      due_date: task.due_date,
      priority: task.priority,
      completed: task.completed
    };
  };
  
  // Check for task reminders whenever tasks change
  useEffect(() => {
    if (tasks && Array.isArray(tasks)) {
      const formattedTasks = tasks.map(formatTaskForReminders);
      const tasksNeedingReminders = checkTasksForReminders(formattedTasks);
      
      // Create notifications for tasks needing reminders
      tasksNeedingReminders.forEach(task => {
        const { title, message } = createReminderMessage(task);
        addNotification({
          title,
          message,
          type: 'task',
          link: 'Tasks'
        });
        
        // Play notification sound with a small delay to ensure it works
        setTimeout(() => {
          playNotificationSound();
        }, 100);
      });
    }
  }, [tasks, addNotification]);
  
  // This component doesn't render anything visible
  return null;
} 