import { addDays, isAfter, isBefore, differenceInHours, differenceInMinutes } from 'date-fns';

// Define the task interface for reminders
export interface TaskForReminder {
  id: string;
  title: string;
  description?: string | null;
  due_date?: number | null; // Unix timestamp
  priority?: string;
  completed?: boolean;
}

/**
 * Checks tasks for upcoming due dates and returns tasks that need reminders
 * @param tasks Array of tasks to check
 * @returns Array of tasks that need reminders
 */
export function checkTasksForReminders(tasks: TaskForReminder[]): TaskForReminder[] {
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
    
    // Check if the task is due within the next 24 hours and not overdue
    if (isAfter(dueDate, now) && isBefore(dueDate, addDays(now, 1))) {
      const hoursUntilDue = differenceInHours(dueDate, now);
      const minutesUntilDue = differenceInMinutes(dueDate, now);
      
      // Add reminders for tasks due in 1 hour, 3 hours, or 24 hours
      if (
        (hoursUntilDue <= 1 && minutesUntilDue >= 55) || // About 1 hour
        (hoursUntilDue === 3 && minutesUntilDue >= 175 && minutesUntilDue <= 185) || // About 3 hours
        (hoursUntilDue >= 23 && hoursUntilDue <= 24) // About 24 hours
      ) {
        tasksNeedingReminders.push(task);
      }
    }
  });

  return tasksNeedingReminders;
}

/**
 * Creates a reminder message based on the time until the task is due
 * @param task Task to create reminder for
 * @returns Object with title and message for the notification
 */
export function createReminderMessage(task: TaskForReminder): { title: string; message: string } {
  const dueDate = new Date(task.due_date! * 1000);
  const now = new Date();
  const hoursUntilDue = differenceInHours(dueDate, now);
  
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