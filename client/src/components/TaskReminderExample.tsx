import React, { useEffect } from 'react';
import { useNotifications } from '@/hooks/use-notifications';

// Example task data structure
interface Task {
  id: string;
  title: string;
  description?: string | null;
  due_date?: number | null; // Unix timestamp
  priority?: string;
  completed: boolean;
}

export function TaskReminderExample() {
  const { checkTaskReminders } = useNotifications();
  
  // Example tasks
  const exampleTasks: Task[] = [
    {
      id: '1',
      title: 'Overdue Task',
      description: 'This task is overdue',
      due_date: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      priority: 'high',
      completed: false
    },
    {
      id: '2',
      title: 'Due Soon Task',
      description: 'This task is due soon',
      due_date: Math.floor(Date.now() / 1000) + 1800, // 30 minutes from now
      priority: 'medium',
      completed: false
    },
    {
      id: '3',
      title: 'Due Tomorrow Task',
      description: 'This task is due tomorrow',
      due_date: Math.floor(Date.now() / 1000) + 86400, // 24 hours from now
      priority: 'low',
      completed: false
    },
    {
      id: '4',
      title: 'Completed Task',
      description: 'This task is completed',
      due_date: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      priority: 'medium',
      completed: true
    }
  ];
  
  // Check for task reminders when the component mounts
  useEffect(() => {
    try {
      checkTaskReminders(exampleTasks);
    } catch (error) {
      console.error('Error checking task reminders:', error);
    }
  }, [checkTaskReminders]);
  
  // Function to manually check for task reminders
  const checkReminders = () => {
    try {
      checkTaskReminders(exampleTasks);
    } catch (error) {
      console.error('Error checking task reminders:', error);
    }
  };
  
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Task Reminder Example</h2>
      <p className="text-muted-foreground">
        This component demonstrates how to use the task reminder functionality.
        It will check for task reminders when the component mounts and when you click the button below.
      </p>
      
      <button 
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        onClick={checkReminders}
      >
        Check for Task Reminders
      </button>
      
      <div className="space-y-2">
        <h3 className="text-xl font-semibold">Example Tasks</h3>
        <ul className="space-y-2">
          {exampleTasks.map(task => (
            <li key={task.id} className="p-3 border rounded-md">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">{task.title}</h4>
                  <p className="text-sm text-muted-foreground">{task.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    task.priority === 'high' ? 'bg-red-100 text-red-800' :
                    task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {task.priority}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    task.completed ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {task.completed ? 'Completed' : 'Active'}
                  </span>
                </div>
              </div>
              {task.due_date && (
                <p className="text-xs text-muted-foreground mt-1">
                  Due: {new Date(task.due_date * 1000).toLocaleString()}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// Example usage in TaskManager.tsx:
/*
import { useNotifications } from '@/hooks/use-notifications';

export default function TaskManager() {
  const { toast } = useToast();
  const { checkTaskReminders } = useNotifications();
  
  const { data: tasks } = useQuery({
    queryKey: [QUERY_KEYS.TASKS],
    queryFn: getTasks,
  });
  
  // Check for task reminders whenever tasks change
  useEffect(() => {
    if (tasks && Array.isArray(tasks)) {
      checkTaskReminders(tasks);
    }
  }, [tasks, checkTaskReminders]);
  
  // Rest of the component...
}
*/ 