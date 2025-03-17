import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardFooter, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormDescription,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useNotifications } from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";
import { queryClient, QUERY_KEYS, deepCopy, refreshTasks } from "@/lib/queryClient";
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  getSubtasks,
  updateSubtask,
  generateSubtasks as generateSubtasksApi,
  createSubtasks,
  getUserSettings,
  getTasksWithSubtasks
} from "@/lib/api";
import {
  Check,
  Clock,
  Trash2,
  Edit as Pencil,
  Plus,
  ChevronDown,
  ChevronUp,
  CalendarIcon,
  Loader2,
  RefreshCw,
  Filter,
  SortAsc,
  SortDesc,
  MoreVertical,
  Repeat,
  Sparkles,
  X,
  AlertCircle,
  CheckCircle2,
  Search,
  List,
  CheckSquare,
  GripVertical
} from "lucide-react";
import { formatDate, getNow } from "@/lib/timezone";
import { format } from "date-fns";
import { Task, Subtask, NewTask } from "@shared/schema";
import { TimeSelect } from "./TimeSelect";
import { createReminderMessage, TaskForReminder } from "@/lib/taskReminders";
// Import the schema from shared
const insertTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().nullable(),
  priority: z.enum(["low", "medium", "high"]),
  completed: z.boolean().default(false),
  due_date: z.date().nullable(),
  is_recurring: z.boolean().default(false),
  recurrence_pattern: z.enum(["daily", "weekly", "monthly", "yearly"]).nullable(),
  recurrence_interval: z.number().nullable(),
  recurrence_end_date: z.date().nullable(),
});

type FormData = {
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high";
  completed: boolean;
  due_date: Date | null;
  is_recurring: boolean;
  recurrence_pattern: "daily" | "weekly" | "monthly" | "yearly" | null;
  recurrence_interval: number | null;
  recurrence_end_date: Date | null;
};

type FilterType = 'all' | 'active' | 'completed' | 'overdue';
type PriorityFilter = 'all' | 'low' | 'medium' | 'high';
type DueDateFilter = 'all' | 'today' | 'tomorrow' | 'week' | 'month';
type SortOrder = 'none' | 'asc' | 'desc';

interface SubtasksResponse {
  subtasks: string[] | string;
}

// Define the TaskWithSubtasks interface
interface TaskWithSubtasks extends Task {
  subtasks: Subtask[];
  has_subtasks?: boolean;
  completed_subtasks?: number;
  total_subtasks?: number;
  position?: number; // Add position field
}

// TaskProgress component
const TaskProgress = ({ completed, total }: { completed: number; total: number }) => {
  if (total === 0 || completed === 0) return null;
  
  const percentage = (completed / total) * 100;
  let color = "bg-gradient-to-r";
  
  if (percentage < 33) {
    color += " from-red-500 via-red-400 to-yellow-500";
  } else if (percentage < 66) {
    color += " from-yellow-500 via-yellow-400 to-green-500";
  } else {
    color += " from-green-500 via-green-400 to-emerald-500";
  }
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="w-full h-1 bg-muted rounded-full overflow-hidden mt-2 cursor-help">
            <div
              className={`h-full ${color} transition-all duration-500 ease-in-out`}
              style={{ 
                width: `${percentage}%`,
                boxShadow: `0 0 8px ${percentage < 33 ? '#ef4444' : percentage < 66 ? '#eab308' : '#22c55e'}`
              }}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-sm">
            <span className="font-medium">{completed}</span> of <span className="font-medium">{total}</span> subtasks completed
            {percentage === 100 ? ' 🎉' : ''} ({Math.round(percentage)}%)
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Helper function to get priority styling
const getPriorityClass = (priority: "low" | "medium" | "high") => {
  switch (priority) {
    case "low":
      return {
        bg: "bg-[hsl(var(--task-low)/0.2)]",
        text: "text-[hsl(var(--task-low))]",
        border: "border-[hsl(var(--task-low)/0.3)]",
      };
    case "medium":
      return {
        bg: "bg-[hsl(var(--task-medium)/0.2)]",
        text: "text-[hsl(var(--task-medium))]",
        border: "border-[hsl(var(--task-medium)/0.3)]",
      };
    case "high":
      return {
        bg: "bg-[hsl(var(--task-high)/0.2)]",
        text: "text-[hsl(var(--task-high))]",
        border: "border-[hsl(var(--task-high)/0.3)]",
      };
    default:
      return {
        bg: "bg-[hsl(var(--task-medium)/0.2)]",
        text: "text-[hsl(var(--task-medium))]",
        border: "border-[hsl(var(--task-medium)/0.3)]",
      };
  }
};

// Helper function to ensure priority is one of the allowed values
const ensureValidPriority = (priority: string): "low" | "medium" | "high" => {
  if (priority === "low" || priority === "medium" || priority === "high") {
    return priority;
  }
  return "medium"; // Default to medium if invalid value
};

// Task Priority Badge
const PriorityBadge = ({ priority }: { priority: "low" | "medium" | "high" }) => {
  const priorityClass = getPriorityClass(priority);
  
  return (
    <div className={cn(
      "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
      priorityClass.bg,
      priorityClass.text
    )}>
      {priority === "high" && <AlertCircle className="h-3 w-3" />}
      {priority === "medium" && <Clock className="h-3 w-3" />}
      {priority === "low" && <CheckCircle2 className="h-3 w-3" />}
      <span className="capitalize">{priority}</span>
    </div>
  );
};

// Helper function for safely handling dates
const safeFormatDate = (timestamp: number | null | undefined) => {
  if (!timestamp) return null;
  
  try {
    // Ensure timestamp is a number
    const numericTimestamp = typeof timestamp === 'string' 
      ? parseInt(timestamp, 10) 
      : timestamp;
    
    console.log("Formatting timestamp:", numericTimestamp);
    
    // Convert Unix timestamp to JavaScript Date
    let date;
    
    // If it's a Unix timestamp (seconds), convert to milliseconds
    if (numericTimestamp < 10000000000) {
      date = new Date(numericTimestamp * 1000);
    } else {
      // Already in milliseconds
      date = new Date(numericTimestamp);
    }
    
    // Check if date is valid and not epoch
    if (isNaN(date.getTime()) || date.getFullYear() === 1970) {
      console.error("Invalid or epoch date:", numericTimestamp);
      
      // Try alternate approach for edge cases
      if (numericTimestamp < 10000000000) {
        const alternateDate = new Date(numericTimestamp);
        if (!isNaN(alternateDate.getTime()) && alternateDate.getFullYear() !== 1970) {
          return format(alternateDate, "PPP");
        }
      }
      
      return null;
    }
    
    // Format the date
    return format(date, "PPP");
  } catch (error) {
    console.error("Error formatting date:", error);
    return null;
  }
};

// Helper function to ensure timestamps are properly formatted
const ensureUnixTimestamp = (date: Date | null | undefined): number | null => {
  if (!date) return null;
  try {
    // Ensure it's a valid date
    if (Object.prototype.toString.call(date) !== '[object Date]' || isNaN(date.getTime())) {
      console.warn("Invalid date provided to ensureUnixTimestamp:", date);
      return null;
    }
    
    const timestamp = Math.floor(date.getTime() / 1000);
    console.log("Converted to Unix timestamp:", timestamp, "from", date.toISOString());
    return timestamp;
  } catch (error) {
    console.error("Error converting date to timestamp:", error);
    return null;
  }
};

// Format a date for display with timezone support
const formatDueDate = (timestamp: number | Date | null): string => {
  if (!timestamp) return "";
  
  let date: Date;
  
  if (timestamp instanceof Date) {
    date = timestamp;
  } else if (typeof timestamp === 'number') {
    // Handle both seconds and milliseconds timestamps
    if (timestamp < 10000000000) {
      date = new Date(timestamp * 1000);
    } else {
      date = new Date(timestamp);
    }
  } else {
    return "";
  }
  
  try {
    return formatDate(date, "PPP");
  } catch (error) {
    console.error("Error formatting date:", error);
    return formatDate(new Date(), "PPP");
  }
};

// Helper function to safely update FormData
const updateFormData = (prev: FormData | null, updates: Partial<FormData>): FormData | null => {
  if (!prev) return null;
  return {
    title: prev.title,
    description: prev.description,
    priority: prev.priority,
    completed: prev.completed,
    due_date: prev.due_date,
    is_recurring: prev.is_recurring,
    recurrence_pattern: prev.recurrence_pattern,
    recurrence_interval: prev.recurrence_interval,
    recurrence_end_date: prev.recurrence_end_date,
    ...updates
  };
};

// Helper function to convert tasks to the right format for the notification system
const convertTaskForNotifications = (task: any) => {
  // Ensure due_date is a Unix timestamp (seconds since epoch)
  let dueDate = null;
  if (task.due_date) {
    // If it's a Date object, convert to Unix timestamp
    if (task.due_date instanceof Date) {
      dueDate = Math.floor(task.due_date.getTime() / 1000);
    } 
    // If it's already a number (timestamp), ensure it's in seconds
    else if (typeof task.due_date === 'number') {
      // If timestamp is in milliseconds (13 digits), convert to seconds
      dueDate = task.due_date > 10000000000 ? Math.floor(task.due_date / 1000) : task.due_date;
    }
    // If it's a string, try to parse it
    else if (typeof task.due_date === 'string') {
      try {
        dueDate = Math.floor(new Date(task.due_date).getTime() / 1000);
      } catch (e) {
        console.error("Error parsing due_date:", e);
      }
    }
  }

  return {
    id: String(task.id),
    title: task.title,
    description: task.description || null,
    due_date: dueDate,
    priority: task.priority,
    completed: Boolean(task.completed), // Ensure it's a boolean
    user_id: task.user_id,
    created_at: task.created_at,
    updated_at: task.updated_at
  };
};

export default function TaskManager() {
  const { toast } = useToast();
  const { addNotification, checkTaskReminders } = useNotifications();
  const user = { id: 2 }; // Use the authenticated user ID from the error message
  const [date, setDate] = useState<Date | null>(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [editingTask, setEditingTask] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<FormData | null>(null);
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskWithSubtasks | null>(null);
  const [editedSubtasks, setEditedSubtasks] = useState<Subtask[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSubtasks, setGeneratedSubtasks] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [dueDateFilter, setDueDateFilter] = useState<DueDateFilter>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('none');
  const [activePage, setActivePage] = useState(1);
  const [overduePage, setOverduePage] = useState(1);
  const [completedPage, setCompletedPage] = useState(1);
  const [tasksPerPage, setTasksPerPage] = useState(5);
  const [showFilters, setShowFilters] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(0); // Add this state variable to force re-renders
  
  // Add state variables to control popover open states
  const [editDatePickerOpen, setEditDatePickerOpen] = useState(false);
  const [newTaskDatePickerOpen, setNewTaskDatePickerOpen] = useState(false);
  const [recurrenceEndDatePickerOpen, setRecurrenceEndDatePickerOpen] = useState(false);
  
  // Remove the general pagination and use separate pagination for each task type
  // const [currentPage, setCurrentPage] = useState(1);
  const [hasSubtasks, setHasSubtasks] = useState<Record<number, boolean>>({});
  
  const form = useForm<FormData>({
    resolver: zodResolver(insertTaskSchema),
    defaultValues: {
      title: "",
      description: null,
      priority: "medium",
      completed: false,
      due_date: null,
      is_recurring: false,
      recurrence_pattern: null,
      recurrence_interval: null,
      recurrence_end_date: null,
    },
  });

  const isRecurring = form.watch("is_recurring");
  const dueDate = form.watch("due_date");
  const recurrencePattern = form.watch("recurrence_pattern");
  const recurrenceInterval = form.watch("recurrence_interval");
  const recurrenceEndDate = form.watch("recurrence_end_date");

  React.useEffect(() => {
    if (dueDate) {
      setDate(new Date(dueDate));
    }
  }, [dueDate]);

  const { data: tasks, isLoading, isError, error: tasksError } = useQuery({
    queryKey: [QUERY_KEYS.TASKS],
    queryFn: getTasks,
  });

  // Check for task reminders whenever tasks change
  useEffect(() => {
    if (tasks && Array.isArray(tasks)) {
      try {
        // Format tasks for the notification system using the helper function
        const formattedTasks = tasks.map(convertTaskForNotifications);
        
        // Check for tasks that need reminders
        checkTaskReminders(formattedTasks);
      } catch (error) {
        console.error("Error checking task reminders:", error);
      }
    }
  }, [tasks, checkTaskReminders]);
  
  // FIXED: Add a useEffect to force re-render when tasks change
  useEffect(() => {
    if (tasks && Array.isArray(tasks)) {
      console.log("Tasks changed, forcing re-render");
      // This will trigger a re-render when tasks change
      setForceUpdate(prev => prev + 1);
    }
  }, [tasks]);
  
  // FIXED: Add a useEffect to handle forceUpdate changes
  useEffect(() => {
    if (forceUpdate > 0) {
      console.log("Force update triggered:", forceUpdate);
      // Force a refresh of the tasks data
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TASKS] });
    }
  }, [forceUpdate]);
  
  useEffect(() => {
    if (tasksError) {
      console.error("Error fetching tasks:", tasksError);
      toast({
        variant: "destructive", 
        title: "Failed to fetch tasks",
        description: tasksError instanceof Error ? tasksError.message : "An unknown error occurred"
      });
    }
  }, [tasksError, toast]);

  const { data: tasksWithSubtasksIds, error: subtasksError } = useQuery({
    queryKey: [QUERY_KEYS.TASKS_WITH_SUBTASKS],
    queryFn: getTasksWithSubtasks,
  });

  useEffect(() => {
    if (subtasksError) {
      console.error("Error fetching subtasks info:", subtasksError);
    }
  }, [subtasksError]);

  const { data: userSettings, error: settingsError } = useQuery({
    queryKey: ['user-settings'],
    queryFn: getUserSettings,
  });

  useEffect(() => {
    if (settingsError) {
      console.error("Error fetching user settings:", settingsError);
    }
  }, [settingsError]);

  const createTaskMutation = useMutation({
    mutationFn: createTask,
    onMutate: async (newTask) => {
      // Don't do any optimistic updates - they're causing issues
      // Just return the previous tasks for potential rollback
      const previousTasks = queryClient.getQueryData([QUERY_KEYS.TASKS]);
      return { previousTasks };
    },
    onError: (error, _variables, context) => {
      console.error("Error creating task:", error);
      
      // Rollback to previous state if available
      if (context?.previousTasks) {
        queryClient.setQueryData([QUERY_KEYS.TASKS], context.previousTasks);
      }
      
      toast({
        variant: "destructive",
        title: "Error creating task",
        description: error instanceof Error ? error.message : "An unknown error occurred",
      });
    },
    onSuccess: (newTask) => {
      console.log("Task created successfully:", newTask);
      
      // Simply fetch the tasks again from the server
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TASKS] });
      
      toast({
        title: "Task created",
        description: "Your task has been created successfully.",
      });
      
      form.reset();
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: updateTask,
    onMutate: async (updatedTask) => {
      // Don't do any optimistic updates - they're causing issues
      // Just return the previous tasks for potential rollback
      const previousTasks = queryClient.getQueryData([QUERY_KEYS.TASKS]);
      return { previousTasks };
    },
    onError: (error, _variables, context) => {
      console.error("Error updating task:", error);
      
      // Roll back to the previous state if there was an error
      if (context?.previousTasks) {
        queryClient.setQueryData([QUERY_KEYS.TASKS], context.previousTasks);
      }
      
      toast({
        variant: "destructive",
        title: "Error updating task",
        description: error instanceof Error ? error.message : "An unknown error occurred",
      });
    },
    onSuccess: (updatedTask) => {
      console.log("Task updated successfully:", updatedTask);
      
      // Simply fetch the tasks again from the server
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TASKS] });
      
      toast({
        title: "Task updated",
        description: "Your task has been updated successfully.",
      });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: deleteTask,
    onMutate: async (taskId) => {
      // Don't do any optimistic updates - they're causing issues
      // Just return the previous tasks for potential rollback
      const previousTasks = queryClient.getQueryData<TaskWithSubtasks[]>([QUERY_KEYS.TASKS]);
      const previousTasksWithSubtasks = queryClient.getQueryData<number[]>([QUERY_KEYS.TASKS_WITH_SUBTASKS]);
      return { previousTasks, previousTasksWithSubtasks };
    },
    onError: (error, taskId, context) => {
      console.error("Error deleting task:", error);
      
      // Roll back to the previous state if there was an error
      if (context?.previousTasks) {
        queryClient.setQueryData<TaskWithSubtasks[]>([QUERY_KEYS.TASKS], context.previousTasks);
      }
      
      if (context?.previousTasksWithSubtasks) {
        queryClient.setQueryData<number[]>([QUERY_KEYS.TASKS_WITH_SUBTASKS], context.previousTasksWithSubtasks);
      }
      
      toast({
        variant: "destructive",
        title: "Error deleting task",
        description: error instanceof Error ? error.message : "An unknown error occurred",
      });
    },
    onSuccess: (_, taskId) => {
      console.log("Task deleted successfully:", taskId);
      
      // Simply fetch the tasks again from the server
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TASKS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TASKS_WITH_SUBTASKS] });
      
      toast({
        title: "Task deleted",
        description: "Your task has been deleted successfully.",
      });
    },
  });

  const onSubmit = async (data: FormData) => {
    try {
      console.log('Form submitted with data:', data);
      
      // Validate required fields
      if (!data.title || data.title.trim() === "") {
        toast({
          variant: "destructive",
          title: "Missing title",
          description: "Please provide a title for the task.",
        });
        return;
      }
      
      // Create task with all required fields
      const taskData = {
        title: data.title.trim(),
        description: data.description || null,
        priority: data.priority || "medium",
        completed: false,
        due_date: ensureUnixTimestamp(data.due_date),
        all_day: true,
        parent_task_id: null,
        user_id: user.id, 
        is_recurring: Boolean(data.is_recurring),
        recurrence_pattern: data.is_recurring ? String(data.recurrence_pattern || "weekly") : null,
        recurrence_interval: data.is_recurring ? 1 : null,
        recurrence_end_date: ensureUnixTimestamp(data.recurrence_end_date),
        // Remove created_at and updated_at, let the server handle these
      };

      // Log what's being sent to the API
      console.log('Sending task data to API:', JSON.stringify(taskData));

      // Use the mutation with type assertion to bypass the type error
      const newTask = await createTaskMutation.mutateAsync(taskData as any);
      console.log("Task created result:", newTask);
      
      // Check for task reminders after creating a new task
      if (newTask) {
        // Convert task to the right format for the notification system
        const formattedTask = convertTaskForNotifications({
          ...newTask,
          completed: false
        });
        
        try {
          checkTaskReminders([formattedTask]);
        } catch (error) {
          console.error("Error checking task reminders:", error);
        }
      }
      
      // Reset form and close the add task panel
      form.reset();
      setShowAddTask(false);
      
      // Force a refresh of the tasks data
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TASKS] });
    } catch (error) {
      console.error('Submit error:', error);
      toast({
        variant: "destructive",
        title: "Error creating task",
        description: error instanceof Error ? error.message : "An unknown error occurred",
      });
    }
  };

  const startEditing = (task: TaskWithSubtasks) => {
    setEditingTask(task.id);
    
    // Convert Unix timestamp to Date object for the form
    let dueDate: Date | null = null;
    if (task.due_date) {
      dueDate = new Date(task.due_date * 1000);
    }
    
    // Convert Unix timestamp to Date object for recurrence end date
    let recurrenceEndDate: Date | null = null;
    if (task.recurrence_end_date) {
      recurrenceEndDate = new Date(task.recurrence_end_date * 1000);
    }
    
    console.log("Created date objects:", { dueDate, recurrenceEndDate });
    
    setEditForm({
      title: task.title || "",
      description: task.description || "",
      priority: task.priority as "low" | "medium" | "high",
      completed: task.completed, // Add the completed field
      due_date: dueDate,
      is_recurring: task.is_recurring || false,
      recurrence_pattern: task.recurrence_pattern as "daily" | "weekly" | "monthly" | "yearly" | null,
      recurrence_interval: task.recurrence_interval || 1,
      recurrence_end_date: recurrenceEndDate,
    });
  };

  const cancelEditing = () => {
    setEditingTask(null);
    setEditForm(null);
  };

  const saveEdit = async (taskId: number) => {
    setEditingTask(null);
    
    if (!editForm) return;
    
    try {
      // Find the current task to get its existing data
      const currentTask = tasks?.find(task => task.id === taskId);
      if (!currentTask) {
        console.error(`Task with ID ${taskId} not found`);
        toast({
          variant: "destructive",
          title: "Error updating task",
          description: "Task not found",
        });
        return;
      }
      
      // SIMPLIFIED: Create update data that keeps all existing fields
      const updateData = {
        ...currentTask,  // Start with ALL existing task data
        // Only override fields that have been edited
        title: editForm.title || currentTask.title,
        description: editForm.description !== undefined ? editForm.description : currentTask.description,
        priority: editForm.priority || currentTask.priority,
        due_date: ensureUnixTimestamp(editForm.due_date),
        is_recurring: typeof editForm.is_recurring === 'boolean' ? editForm.is_recurring : currentTask.is_recurring,
        recurrence_pattern: editForm.is_recurring ? editForm.recurrence_pattern : null,
        recurrence_interval: editForm.is_recurring && editForm.recurrence_interval ? Number(editForm.recurrence_interval) : null,
        recurrence_end_date: ensureUnixTimestamp(editForm.recurrence_end_date),
        completed: typeof editForm.completed === 'boolean' ? editForm.completed : currentTask.completed,
      };

      console.log("Updating task with ALL data preserved:", updateData);
      
      // Make sure we don't have duplicate id
      const { id, ...taskDataWithoutId } = updateData;
      
      // Update the task with ALL fields
      await updateTaskMutation.mutateAsync({
        id: taskId,
        ...taskDataWithoutId
      });

      // Force a re-render
      setForceUpdate((prev: number) => prev + 1);
      
      // Use the refreshTasks helper to ensure UI updates
      refreshTasks();

      // Reset the edit form
      setEditForm(null);
      
      toast({
        title: "Task updated",
        description: "Your task has been updated successfully.",
      });
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        variant: "destructive",
        title: "Error updating task",
        description: error instanceof Error ? error.message : "An unknown error occurred",
      });
    }
  };

  const generateSubtasks = async (task: TaskWithSubtasks) => {
    setSelectedTask(task);
    setShowSubtasks(true);
    setIsGenerating(true); // Start loading immediately
    
    try {
      // First, try to fetch existing subtasks
      const existingSubtasks = await getSubtasks(task.id);
      
      if (existingSubtasks && Array.isArray(existingSubtasks) && existingSubtasks.length > 0) {
        setEditedSubtasks(existingSubtasks.map(subtask => ({
          id: subtask.id,
          user_id: subtask.user_id,
          task_id: subtask.task_id,
          title: subtask.title,
          completed: subtask.completed,
          position: subtask.position,
          created_at: subtask.created_at,
          updated_at: subtask.updated_at
        })));
        setIsGenerating(false); // Stop loading if we have existing subtasks
      } else {
        const prompt = `
          Generate 5 clear and simple subtasks for this task. Each subtask should be a single, actionable item.
          
          Task: ${task.title}
          ${task.description ? `Description: ${task.description}` : ''}
          
          Return the subtasks as a simple list, one per line. Do not include any JSON formatting, quotes, brackets, or numbers.
        `;
        
        // Keep loading indicator on
        toast({
          title: "Generating subtasks",
          description: "Please wait while AI generates subtasks...",
        });
        
        try {
          const response = await generateSubtasksApi(prompt);
          setIsGenerating(false); // Stop loading after generation
          
          // Process the response text
          let subtasksText = response.subtasks;
          
          // Clean up the response if it's a string
          if (typeof subtasksText === 'string') {
            // Remove any JSON formatting characters
            subtasksText = subtasksText
              .replace(/^\s*\[|\]\s*$/g, '') // Remove opening/closing brackets
              .replace(/"/g, '') // Remove quotes
              .replace(/,\s*/g, '\n') // Replace commas with newlines
              .replace(/\\n/g, '\n'); // Replace escaped newlines
          }
          
          // Split by newlines and clean up each line
          const subtasksArray = (Array.isArray(subtasksText) ? subtasksText : subtasksText.split('\n'))
            .filter(line => line.trim().length > 0)
            .map((line, index) => ({
              id: -Date.now() - index, // Temporary negative ID
              user_id: task.user_id,
              task_id: task.id,
              title: line.replace(/^[-*•\d.]+\s*/, '').trim(), // Remove list markers
              completed: false,
              position: index,
              created_at: Math.floor(Date.now() / 1000),
              updated_at: Math.floor(Date.now() / 1000)
            }));
          
          console.log('Processed subtasks:', subtasksArray);
          setEditedSubtasks(subtasksArray);
          
          toast({
            title: "Subtasks generated",
            description: "AI has generated subtasks for your task.",
          });
        } catch (error) {
          console.error('Error generating subtasks:', error);
          setIsGenerating(false);
          
          // If generation fails, create empty subtasks
          setEditedSubtasks([
            {
              id: -Date.now() - 1,
              user_id: task.user_id,
              task_id: task.id,
              title: "",
              completed: false,
              position: 0,
              created_at: Math.floor(Date.now() / 1000),
              updated_at: Math.floor(Date.now() / 1000)
            }
          ]);
          
          toast({
            variant: "destructive",
            title: "Error generating subtasks",
            description: error instanceof Error ? error.message : "An unknown error occurred",
          });
        }
      }
    } catch (error) {
      console.error('Error in generateSubtasks:', error);
      setIsGenerating(false);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "An unknown error occurred",
      });
    }
  };

  const saveSubtasksMutation = useMutation({
    mutationFn: ({ taskId, subtasks }: { taskId: number, subtasks: Array<{ title: string; completed: boolean }> }) => {
      // Ensure subtasks match the expected format for the API
      // The server will handle adding task_id and other metadata internally
      return createSubtasks(taskId, subtasks);
    },
    onMutate: async ({ taskId, subtasks }) => {
      console.log("Optimistically saving subtasks for task:", taskId, subtasks);
      
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.TASKS_WITH_SUBTASKS] });
      if (selectedTask) {
        await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.TASK_SUBTASKS(taskId)] });
      }
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.TASKS] });
      
      // Snapshot the previous values
      const previousTasksWithSubtasks = queryClient.getQueryData<any>([QUERY_KEYS.TASKS_WITH_SUBTASKS]);
      const previousSubtasks = selectedTask ? 
        queryClient.getQueryData<any>([QUERY_KEYS.TASK_SUBTASKS(taskId)]) : null;
      const previousTasks = queryClient.getQueryData<TaskWithSubtasks[]>([QUERY_KEYS.TASKS]) || [];
      
      // Create optimistic subtasks with temporary IDs
      const optimisticSubtasks = subtasks.map((subtask, index) => ({
        id: `temp-${Date.now()}-${index}`,
        task_id: taskId,
        title: subtask.title,
        completed: subtask.completed,
        position: index,
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000)
      }));
      
      // Optimistically update tasks-with-subtasks
      if (previousTasksWithSubtasks) {
        // Add this task ID to the list of tasks with subtasks if not already there
        if (!previousTasksWithSubtasks.includes(taskId)) {
          queryClient.setQueryData<any>([QUERY_KEYS.TASKS_WITH_SUBTASKS], 
            [...previousTasksWithSubtasks, taskId]
          );
        }
      }
      
      // Optimistically update the subtasks for this task
      if (selectedTask) {
        queryClient.setQueryData<any>([QUERY_KEYS.TASK_SUBTASKS(taskId)], optimisticSubtasks);
      }
      
      // Update the main tasks list to show this task has subtasks
        const updatedTasks = JSON.parse(JSON.stringify(previousTasks));
      const taskIndex = updatedTasks.findIndex((task: TaskWithSubtasks) => task.id === taskId);
        
        if (taskIndex !== -1) {
        // Add the subtasks to the task
        updatedTasks[taskIndex].subtasks = optimisticSubtasks;
        
        // Update the tasks cache
          queryClient.setQueryData<TaskWithSubtasks[]>([QUERY_KEYS.TASKS], updatedTasks);
      }
      
      console.log("Optimistically updated subtasks in cache");
      
      // Return the context
      return { previousTasksWithSubtasks, previousSubtasks, previousTasks };
    },
    onError: (error, variables, context) => {
      console.error("Error saving subtasks:", error);
      
      // Roll back to the previous state if there was an error
      if (context?.previousTasksWithSubtasks) {
        queryClient.setQueryData([QUERY_KEYS.TASKS_WITH_SUBTASKS], context.previousTasksWithSubtasks);
      }
      if (context?.previousSubtasks && selectedTask) {
        queryClient.setQueryData([QUERY_KEYS.TASK_SUBTASKS(variables.taskId)], context.previousSubtasks);
      }
      if (context?.previousTasks) {
        queryClient.setQueryData([QUERY_KEYS.TASKS], context.previousTasks);
      }
      
      toast({
        variant: "destructive",
        title: "Failed to save subtasks",
        description: error instanceof Error ? error.message : "An error occurred while saving subtasks.",
      });
    },
    onSuccess: (data, variables) => {
      console.log("Subtasks saved successfully:", data);
      
      // Update the cache with the server response
      if (selectedTask) {
        queryClient.setQueryData([QUERY_KEYS.TASK_SUBTASKS(variables.taskId)], data);
      }
      
      // Invalidate queries to ensure consistency
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TASKS_WITH_SUBTASKS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TASKS] });
      
      toast({
        title: "Subtasks saved",
        description: "Your subtasks have been saved successfully.",
      });
      
      setShowSubtasks(false);
    }
  });

  const saveSubtasks = async () => {
    if (!selectedTask) return;
    saveSubtasksMutation.mutate({ taskId: selectedTask.id, subtasks: editedSubtasks });
  };

  const onDragEnd = (result: any) => {
    if (!result.destination) return;
    if (
      result.destination.droppableId === result.source.droppableId &&
      result.destination.index === result.source.index
    ) {
      return;
    }

    const items = Array.from(editedSubtasks);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    // Immediately update the UI
    setEditedSubtasks(items);
    
    // If we have a selected task, update the subtasks query data optimistically
    if (selectedTask) {
      // Get the current subtasks data
      const currentSubtasks = queryClient.getQueryData<any>([QUERY_KEYS.TASK_SUBTASKS(selectedTask.id)]);
      
      if (currentSubtasks) {
        // Update the positions based on the new order
        const updatedSubtasks = items.map((subtask, index) => ({
          ...subtask,
          position: index
        }));
        
        // Update the query data optimistically
        queryClient.setQueryData([QUERY_KEYS.TASK_SUBTASKS(selectedTask.id)], updatedSubtasks);
      }
    }
  };

  const renderTaskContent = (task: TaskWithSubtasks, isCompleted: boolean) => {
    if (editingTask === task.id && editForm) {
      return (
        <div className="flex-1 space-y-3">
          <Input
            value={editForm.title}
            onChange={(e) => setEditForm(prev => updateFormData(prev, { title: e.target.value }))}
            className="font-medium w-full bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="Task title"
          />
          <Input
            value={editForm.description || ""}
            onChange={(e) => setEditForm(prev => updateFormData(prev, { description: e.target.value || null }))}
            className="text-sm w-full bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="Description"
          />
          <div className="flex flex-col gap-3">
            <Select
              value={editForm.priority}
              onValueChange={(value) => setEditForm(prev => updateFormData(prev, { priority: value as "low" | "medium" | "high" }))}
            >
              <SelectTrigger className="w-full bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
            <Popover open={editDatePickerOpen} onOpenChange={setEditDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start text-left font-normal bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-md"
                >
                  <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                  {editForm.due_date && editForm.due_date instanceof Date && !isNaN(editForm.due_date.getTime())
                    ? formatDate(editForm.due_date, "PPP")
                    : "Due date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-w-[280px]">
                <div>
                  <Calendar
                    mode="single"
                    selected={editForm.due_date || undefined}
                    onSelect={(date) => {
                      console.log("Selected date in edit form:", date);
                      setEditForm(prev => updateFormData(prev, { due_date: date }));
                    }}
                    initialFocus
                  />
                  {editForm.due_date && (
                    <TimeSelect
                      value={editForm.due_date}
                      onChange={(newDate) => {
                        setEditForm(prev => updateFormData(prev, { due_date: newDate }));
                      }}
                      onComplete={() => {
                        setEditDatePickerOpen(false);
                      }}
                      compact={true}
                    />
                  )}
                </div>
              </PopoverContent>
            </Popover>
            {!task.parent_task_id && (
              <div className="flex items-center gap-2">
                <Switch
                  checked={editForm.is_recurring}
                  onCheckedChange={(checked) => {
                    setEditForm(prev => {
                      if (!prev) return prev;
                      return updateFormData(prev, {
                        is_recurring: checked,
                        recurrence_pattern: checked ? prev.recurrence_pattern || "weekly" : null,
                        recurrence_interval: checked ? prev.recurrence_interval || 1 : null,
                        recurrence_end_date: checked ? prev.recurrence_end_date || null : null,
                      });
                    });
                  }}
                >
                  <Repeat className="h-4 w-4 mr-2 text-primary" />
                  Recurring Task
                </Switch>
              </div>
            )}
            {editForm.is_recurring && !task.parent_task_id && (
              <div className="mt-4 p-4 border rounded-lg bg-accent/5 border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="mb-3 text-sm text-muted-foreground">
                  Configure how often this task should repeat
                </div>
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <label className="text-sm font-medium mb-1.5 block">
                      Repeat Every
                    </label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min="1"
                        placeholder="1"
                        value={editForm.recurrence_interval || ""}
                        onChange={(e) => setEditForm(prev => updateFormData(prev, {
                          recurrence_interval: parseInt(e.target.value) || 1
                        }))}
                        className="w-[80px] bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-md"
                      />
                      <Select
                        value={editForm.recurrence_pattern || "weekly"}
                        onValueChange={(value) => setEditForm(prev => updateFormData(prev, {
                          recurrence_pattern: value as "daily" | "weekly" | "monthly" | "yearly"
                        }))}
                      >
                        <SelectTrigger className="flex-1 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-md">
                          <SelectValue placeholder="Select period" />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                          <SelectItem value="daily">Day(s)</SelectItem>
                          <SelectItem value="weekly">Week(s)</SelectItem>
                          <SelectItem value="monthly">Month(s)</SelectItem>
                          <SelectItem value="yearly">Year(s)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="text-sm font-medium mb-1.5 block">
                      Ends (Optional)
                    </label>
                    <Popover open={recurrenceEndDatePickerOpen} onOpenChange={setRecurrenceEndDatePickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-md",
                            !editForm.recurrence_end_date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                          {editForm.recurrence_end_date
                            ? formatDate(editForm.recurrence_end_date, "PPP")
                            : "Select end date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-w-[260px]">
                        <Calendar
                          mode="single"
                          selected={editForm.recurrence_end_date || undefined}
                          onSelect={(date) => {
                            setEditForm((prev) => updateFormData(prev, { recurrence_end_date: date }));
                            if (!date) {
                              setRecurrenceEndDatePickerOpen(false);
                            }
                          }}
                          initialFocus
                        />
                        {editForm.recurrence_end_date && (
                          <TimeSelect
                            value={editForm.recurrence_end_date}
                            onChange={(newDate) => {
                              form.setValue("recurrence_end_date", newDate);
                            }}
                            onComplete={() => {
                              setRecurrenceEndDatePickerOpen(false);
                            }}
                            compact={true}
                          />
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={cn("font-medium truncate", isCompleted && "line-through text-muted-foreground")}>
            {task.title}
          </p>
          {task.is_recurring && !task.parent_task_id && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Repeat className={cn(
                    "h-4 w-4",
                    task.priority === "high" && "text-red-500",
                    task.priority === "medium" && "text-yellow-500",
                    task.priority === "low" && "text-green-500"
                  )} />
                </TooltipTrigger>
                <TooltipContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-md">
                  <div className="text-sm">
                    Repeats {task.recurrence_pattern}
                    {task.recurrence_interval && task.recurrence_interval > 1
                      ? ` every ${task.recurrence_interval} ${task.recurrence_pattern}s`
                      : ``}
                    {task.recurrence_end_date
                      ? ` until ${safeFormatDate(task.recurrence_end_date)}`
                      : ``}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {task.parent_task_id && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Repeat className={cn(
                    "h-4 w-4 opacity-50",
                    task.priority === "high" && "text-red-500",
                    task.priority === "medium" && "text-yellow-500",
                    task.priority === "low" && "text-green-500"
                  )} />
                </TooltipTrigger>
                <TooltipContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-md">
                  <div className="text-sm">This is a recurring instance</div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        {task.description && (
          <p className={cn("text-sm text-muted-foreground truncate mt-1", isCompleted && "line-through")}>
            {task.description}
          </p>
        )}
        <div className="flex items-center gap-2 mt-2">
          {task.due_date && (
            <div className={cn("text-xs flex items-center gap-1 px-1.5 py-0.5 rounded", {
              "text-red-500 font-medium bg-red-100/50 dark:bg-red-900/10": !task.completed && new Date(task.due_date * 1000) < getNow(),
              "text-muted-foreground bg-gray-100/50 dark:bg-gray-800/50": task.completed || new Date(task.due_date * 1000) >= getNow()
            })}>
              <CalendarIcon className="h-2.5 w-2.5" />
              {formatDueDate(task.due_date)}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderTaskActions = (task: TaskWithSubtasks) => {
    if (editingTask === task.id) {
      return (
        <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t">
          <Button
            variant="default"
            size="sm"
            onClick={() => saveEdit(task.id)}
            disabled={updateTaskMutation.isPending}
            className="bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors"
          >
            {updateTaskMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Check className="h-4 w-4 mr-1" />
            )}
            Save
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={cancelEditing}
            className="border-gray-200 dark:border-gray-700 rounded-md"
          >
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => generateSubtasks(task)}
                  disabled={task.completed}
                  className={cn(
                    "h-8 w-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors",
                    task.completed && "cursor-not-allowed"
                  )}
                >
                  {task.has_subtasks ? (
                    <List className="h-4 w-4 text-primary" />
                  ) : (
                    <Sparkles className="h-4 w-4 text-yellow-500" />
                  )}
                </Button>
              </div>
            </TooltipTrigger>
            <TooltipContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-md">
              {task.completed 
                ? "Cannot manage subtasks for completed tasks" 
                : task.has_subtasks
                  ? "View and manage subtasks"
                  : "Generate subtasks using AI"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => startEditing(task)}
                  disabled={task.completed}
                  className={cn(
                    "h-8 w-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors",
                    task.completed && "cursor-not-allowed"
                  )}
                >
                  <Pencil className={cn(
                    "h-4 w-4",
                    task.completed && "text-muted-foreground"
                  )} />
                </Button>
              </div>
            </TooltipTrigger>
            <TooltipContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-md">
              {task.completed ? "Cannot edit completed tasks" : "Edit task"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => deleteTaskMutation.mutate(task.id)}
          disabled={deleteTaskMutation.isPending}
          className="h-8 w-8 rounded-full hover:bg-red-100 dark:hover:bg-red-900/20 text-red-500 transition-colors"
        >
          {deleteTaskMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      </div>
    );
  };

  const isOverdue = (task: TaskWithSubtasks) => {
    if (!task.due_date || task.completed) return false;
    const dueDate = new Date(task.due_date * 1000);
    const now = new Date();
    return dueDate < now;
  };

  const getActiveTasks = (tasks: TaskWithSubtasks[]) => {
    return tasks.filter(task => 
      !task.completed && 
      !isOverdue(task) && 
      !task.parent_task_id
    );
  };

  const getOverdueTasks = (tasks: TaskWithSubtasks[]) => {
    return tasks.filter(task => 
      !task.completed && 
      isOverdue(task) && 
      !task.parent_task_id
    );
  };

  const getCompletedTasks = (tasks: TaskWithSubtasks[]) => {
    return tasks.filter(task => 
      task.completed && 
      !task.parent_task_id
    );
  };

  const clearFilters = () => {
    setFilterType('all');
    setPriorityFilter('all');
    setDueDateFilter('all');
    setSortOrder('none');
    setSearchTerm('');
  };

  const filterTasks = (tasks: TaskWithSubtasks[]) => {
    let filtered = tasks.filter(task =>
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (task.description?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );

    switch (filterType) {
      case 'active':
        filtered = filtered.filter(task => !task.completed && !isOverdue(task));
        break;
      case 'completed':
        filtered = filtered.filter(task => task.completed);
        break;
      case 'overdue':
        filtered = filtered.filter(task => !task.completed && isOverdue(task));
        break;
    }

    if (priorityFilter !== 'all') {
      filtered = filtered.filter(task => task.priority === priorityFilter);
    }

    if (dueDateFilter !== 'all') {
      const today = getNow();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);
      
      const nextMonth = new Date(today);
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      filtered = filtered.filter(task => {
        if (!task.due_date) return false;
        const dueDate = new Date(task.due_date * 1000);
        dueDate.setHours(0, 0, 0, 0);

        switch (dueDateFilter) {
          case 'today':
            return dueDate.getTime() === today.getTime();
          case 'tomorrow':
            return dueDate.getTime() === tomorrow.getTime();
          case 'week':
            return dueDate >= today && dueDate <= nextWeek;
          case 'month':
            return dueDate >= today && dueDate <= nextMonth;
          default:
            return true;
        }
      });
    }

    return sortTasksByDueDate(filtered);
  };

  const sortTasksByDueDate = (tasks: TaskWithSubtasks[]) => {
    if (sortOrder === 'none') return tasks;

    return [...tasks].sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return sortOrder === 'asc' ? 1 : -1;
      if (!b.due_date) return sortOrder === 'asc' ? -1 : 1;

      const dateA = new Date(a.due_date * 1000);
      const dateB = new Date(b.due_date * 1000);
      return sortOrder === 'asc' 
        ? dateA.getTime() - dateB.getTime()
        : dateB.getTime() - dateA.getTime();
    });
  };

  const getTaskCounts = (tasks: TaskWithSubtasks[]) => ({
    all: tasks.length,
    active: getActiveTasks(tasks).length,
    completed: getCompletedTasks(tasks).length,
    overdue: getOverdueTasks(tasks).length,
  });

  const getPaginatedActiveTasks = (tasks: TaskWithSubtasks[]) => {
    const filteredTasks = getActiveTasks(tasks);
    const startIndex = (activePage - 1) * tasksPerPage;
    return filteredTasks.slice(startIndex, startIndex + tasksPerPage);
  };

  const getPaginatedOverdueTasks = (tasks: TaskWithSubtasks[]) => {
    const filteredTasks = getOverdueTasks(tasks);
    const startIndex = (overduePage - 1) * tasksPerPage;
    return filteredTasks.slice(startIndex, startIndex + tasksPerPage);
  };

  const getPaginatedCompletedTasks = (tasks: TaskWithSubtasks[]) => {
    const filteredTasks = getCompletedTasks(tasks);
    const startIndex = (completedPage - 1) * tasksPerPage;
    return filteredTasks.slice(startIndex, startIndex + tasksPerPage);
  };

  const getActiveTasksTotalPages = (tasks: TaskWithSubtasks[]) => {
    return Math.ceil(getActiveTasks(tasks).length / tasksPerPage);
  };

  const getOverdueTasksTotalPages = (tasks: TaskWithSubtasks[]) => {
    return Math.ceil(getOverdueTasks(tasks).length / tasksPerPage);
  };

  const getCompletedTasksTotalPages = (tasks: TaskWithSubtasks[]) => {
    return Math.ceil(getCompletedTasks(tasks).length / tasksPerPage);
  };

  const getPaginatedTasks = (tasks: TaskWithSubtasks[]) => {
    // This function is kept for backward compatibility
    // but we'll use the specific pagination functions instead
    const startIndex = (activePage - 1) * tasksPerPage;
    return tasks.slice(startIndex, startIndex + tasksPerPage);
  };

  const getTotalPages = (tasks: TaskWithSubtasks[]) => {
    // This function is kept for backward compatibility
    return Math.ceil(tasks.length / tasksPerPage);
  };

  const PaginationControls = ({ 
    currentPage, 
    totalPages, 
    onPageChange 
  }: { 
    currentPage: number; 
    totalPages: number; 
    onPageChange: (page: number) => void;
  }) => {
    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-center gap-2 mt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          Previous
        </Button>
        <div className="flex items-center gap-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <Button
              key={page}
              variant={currentPage === page ? "default" : "outline"}
              size="sm"
              onClick={() => onPageChange(page)}
            >
              {page}
            </Button>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          Next
        </Button>
      </div>
    );
  };

  // Process tasks to add subtask information
  const processedTasks = useMemo(() => {
    console.log("Recalculating processedTasks with forceUpdate:", forceUpdate);
    
    // SIMPLIFIED: Safety check for tasks
    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return [];
    }
    
    // Try to get fresh tasks from cache
    const freshTasks = queryClient.getQueryData([QUERY_KEYS.TASKS]) || tasks;
    
    // Safety check for fresh tasks
    if (!freshTasks || !Array.isArray(freshTasks)) {
      return tasks; // Fall back to original tasks if cache is empty
    }
    
    // SIMPLIFIED: Just add the subtask information without complex type handling
    return freshTasks.map(task => {
      if (!task || !task.id) return null;
      
      // Check if this task has subtasks
      const hasSubtasks = Array.isArray(tasksWithSubtasksIds) && tasksWithSubtasksIds.includes(task.id) || false;
      
      // Use type assertion to avoid TypeScript errors
      const taskAny = task as any;
      
      // Return task with minimal subtask data added
      return {
        ...task,
        subtasks: taskAny.subtasks || [],
        has_subtasks: taskAny.has_subtasks || hasSubtasks,
        completed_subtasks: taskAny.completed_subtasks || 0,
        total_subtasks: taskAny.total_subtasks || 0
      };
    }).filter(Boolean); // Remove any null tasks
  }, [tasks, tasksWithSubtasksIds, forceUpdate]);

  const completedTasks = useMemo(() => 
    getCompletedTasks(filterTasks(processedTasks)),
  [filterTasks, processedTasks, forceUpdate]);

  const activeTasks = useMemo(() => 
    getActiveTasks(filterTasks(processedTasks)),
  [filterTasks, processedTasks, forceUpdate]);

  const overdueTasks = useMemo(() => 
    getOverdueTasks(filterTasks(processedTasks)),
  [filterTasks, processedTasks, forceUpdate]);

  const filteredTasks = useMemo(() => {
    if (searchTerm.length === 0) return processedTasks;
    
    const searchLower = searchTerm.toLowerCase();
    return processedTasks.filter(
      (task) =>
        task.title.toLowerCase().includes(searchLower) ||
        (task.description && task.description.toLowerCase().includes(searchLower))
    );
  }, [processedTasks, searchTerm, forceUpdate]);

  const filteredCompletedTasks = useMemo(() => 
    filteredTasks.filter((task) => task.completed),
  [filteredTasks, forceUpdate]);

  const filteredIncompleteTasks = useMemo(() => 
    filteredTasks.filter((task) => !task.completed),
  [filteredTasks, forceUpdate]);

  const handleSubtaskChange = (index: number, value: string) => {
    const newSubtasks = [...editedSubtasks];
    if (newSubtasks[index]) {
      newSubtasks[index] = {
        ...newSubtasks[index],
        title: value
      };
      setEditedSubtasks(newSubtasks);
    }
  };

  const handleSubtaskToggle = (index: number) => {
    const newSubtasks = [...editedSubtasks];
    if (newSubtasks[index]) {
      newSubtasks[index] = {
        ...newSubtasks[index],
        completed: !newSubtasks[index].completed
      };
      setEditedSubtasks(newSubtasks);
    }
  };

  const handleSubtaskDelete = (index: number) => {
    const newSubtasks = [...editedSubtasks];
    newSubtasks.splice(index, 1);
    setEditedSubtasks(newSubtasks);
  };

  // Add a ref for the latest subtask input
  const lastSubtaskInputRef = useRef<HTMLInputElement>(null);

  // Update the SubtaskItem component to use the ref for the last item
  const SubtaskItem = ({ subtask, onToggle, onDelete, isLast }: { 
    subtask: { 
      id: number; 
      user_id: number; 
      task_id: number; 
      title: string; 
      completed: boolean; 
      position: number;
      created_at: number;
      updated_at: number;
    }; 
    onToggle: () => void; 
    onDelete: () => void;
    isLast?: boolean;
  }) => {
    return (
      <div className="flex items-center gap-2 py-1 w-full">
        <Checkbox
          checked={subtask.completed}
          onCheckedChange={onToggle}
          className="data-[state=checked]:bg-green-500 data-[state=checked]:text-white flex-shrink-0"
        />
        <Input
          ref={isLast ? lastSubtaskInputRef : null}
          value={subtask.title}
          onChange={(e) => handleSubtaskChange(subtask.position, e.target.value)}
          className={cn(
            "flex-1 border-0 focus-visible:ring-1 px-2 py-1 h-auto min-h-[32px]",
            subtask.completed && "line-through text-muted-foreground bg-gray-50"
          )}
          placeholder="Enter subtask..."
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="h-6 w-6 flex-shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <div className="flex flex-col items-center gap-4 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 w-full max-w-md">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-2">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500 dark:text-blue-400" />
          </div>
          <h3 className="text-xl font-semibold text-center">Loading your tasks</h3>
          <p className="text-muted-foreground text-center">Please wait while we fetch your tasks...</p>
          <Progress className="w-full mt-2" value={65} />
        </div>
      </div>
    );
  }
  
  if (isError && tasksError) {
    return (
      <div className="flex justify-center p-8">
        <div className="flex flex-col items-center gap-4 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 w-full max-w-md">
          <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-2">
            <AlertCircle className="h-8 w-8 text-red-500 dark:text-red-400" />
          </div>
          <h3 className="text-xl font-semibold text-center">Failed to load tasks</h3>
          <p className="text-muted-foreground text-center">
            {typeof tasksError === 'object' && tasksError !== null && 'message' in tasksError 
              ? tasksError.message 
              : "An unknown error occurred"}
          </p>
          <Button 
            variant="default" 
            className="mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
            onClick={() => queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TASKS] })}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // FIXED: More robust check for empty tasks
  const hasNoTasks = !processedTasks || !Array.isArray(processedTasks) || processedTasks.length === 0;
  
  if (hasNoTasks && !showAddTask) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-6">
            <CheckSquare className="h-10 w-10 text-blue-500 dark:text-blue-400" />
          </div>
          <h3 className="text-2xl font-semibold mb-3 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">No tasks yet</h3>
          <p className="text-muted-foreground mb-8 max-w-md leading-relaxed">
            Get started by creating your first task. Tasks can have due dates, priorities, 
            and can be set to recur on a schedule. You can also generate subtasks using AI.
          </p>
          <Button 
            onClick={() => {
              console.log("Button clicked, setting showAddTask to true");
              setShowAddTask(true);
            }}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
            size="lg"
          >
            <Plus className="h-5 w-5" />
            Create Your First Task
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <CheckSquare className="h-6 w-6 text-primary" />
            Task Manager
          </h2>
        </div>

        <Card className="w-full bg-white dark:bg-gray-900 shadow-lg rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-teal-500 to-emerald-500 text-white p-4 md:p-6">
            <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
              <Plus className="h-5 w-5 text-white animate-pulse" />
              Add New Task
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 md:pt-6 px-4 md:px-6 pb-4 md:pb-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 md:space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3 md:gap-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem className="md:col-span-1 lg:col-span-5">
                        <FormControl>
                          <Input 
                            placeholder="Task title" 
                            {...field} 
                            value={field.value || ""}
                            className="w-full bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 transition-all duration-200 text-gray-800 dark:text-gray-200 placeholder:text-gray-500 dark:placeholder:text-gray-400 h-11"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem className="md:col-span-1 lg:col-span-4">
                        <FormControl>
                          <Input 
                            placeholder="Task description" 
                            {...field} 
                            value={field.value || ""}
                            onChange={(e) => field.onChange(e.target.value || null)}
                            className="w-full bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 transition-all duration-200 text-gray-800 dark:text-gray-200 placeholder:text-gray-500 dark:placeholder:text-gray-400 h-11"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem className="lg:col-span-3">
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 text-gray-800 dark:text-gray-200 h-11 w-full">
                              <SelectValue placeholder="Priority" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                            <SelectItem value="low" className="text-gray-800 dark:text-gray-200">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                Low
                              </div>
                            </SelectItem>
                            <SelectItem value="medium" className="text-gray-800 dark:text-gray-200">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                                Medium
                              </div>
                            </SelectItem>
                            <SelectItem value="high" className="text-gray-800 dark:text-gray-200">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                High
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 md:gap-4 items-center">
                  <div className="sm:col-span-1 lg:col-span-4">
                    <Popover open={newTaskDatePickerOpen} onOpenChange={setNewTaskDatePickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors h-11",
                            !dueDate && "text-gray-500 dark:text-gray-400",
                            dueDate && "text-gray-800 dark:text-gray-200 border-teal-200 dark:border-teal-800"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 text-teal-500 dark:text-teal-400" />
                          {dueDate ? formatDate(dueDate, "PPP") : "Due date (optional)"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-w-[300px]">
                        <div>
                          <Calendar
                            mode="single"
                            selected={dueDate ? new Date(dueDate) : undefined}
                            onSelect={(date) => {
                              if (date) {
                                const selectedTime = dueDate ? new Date(dueDate) : new Date();
                                form.setValue("due_date", date);
                              } else {
                                form.setValue("due_date", null);
                                setNewTaskDatePickerOpen(false);
                              }
                            }}
                            initialFocus
                            className="rounded-lg border-0"
                          />
                          {dueDate && (
                            <TimeSelect
                              value={new Date(dueDate)}
                              onChange={(newDate) => {
                                form.setValue("due_date", newDate);
                              }}
                              onComplete={() => {
                                setNewTaskDatePickerOpen(false);
                              }}
                              compact={true}
                            />
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  <div className="sm:col-span-1 lg:col-span-4">
                    <div className="flex items-center gap-2 h-11 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-3 transition-colors">
                      <Switch
                        checked={isRecurring}
                        onCheckedChange={(checked) => {
                          form.setValue("is_recurring", checked);
                          if (!checked) {
                            form.setValue("recurrence_pattern", null);
                            form.setValue("recurrence_interval", null);
                            form.setValue("recurrence_end_date", null);
                          } else {
                            form.setValue("recurrence_pattern", "weekly");
                            form.setValue("recurrence_interval", 1);
                          }
                        }}
                        className="data-[state=checked]:bg-teal-600 dark:data-[state=checked]:bg-teal-500 data-[state=unchecked]:bg-gray-300 dark:data-[state=unchecked]:bg-gray-600 border-2 border-transparent dark:border-gray-400"
                      />
                      <div className="flex items-center gap-2">
                        <Repeat className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                        <span className="text-gray-800 dark:text-gray-200 text-sm">Recurring Task</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="sm:col-span-2 lg:col-span-4">
                    <Button 
                      type="button" 
                      onClick={async () => {
                        try {
                          console.log("Add Task button clicked");
                          
                          // Validate the form first
                          const isValid = await form.trigger();
                          if (!isValid) {
                            console.log("Form validation failed");
                            toast({
                              variant: "destructive",
                              title: "Invalid form data",
                              description: "Please check the form for errors and try again.",
                            });
                            return;
                          }
                          
                          const formData = form.getValues();
                          console.log("Form data:", formData);
                          
                          // Ensure all required fields are present
                          if (!formData.title || formData.title.trim() === "") {
                            toast({
                              variant: "destructive",
                              title: "Missing title",
                              description: "Please provide a title for the task.",
                            });
                            return;
                          }
                          
                          const taskData = {
                            title: formData.title.trim(),
                            description: formData.description || null,
                            priority: formData.priority || "medium",
                            completed: false,
                            due_date: ensureUnixTimestamp(formData.due_date),
                            all_day: true,
                            parent_task_id: null,
                            user_id: user.id,
                            is_recurring: Boolean(formData.is_recurring),
                            recurrence_pattern: formData.is_recurring ? String(formData.recurrence_pattern || "weekly") : null,
                            recurrence_interval: formData.is_recurring ? 1 : null,
                            recurrence_end_date: ensureUnixTimestamp(formData.recurrence_end_date),
                          };

                          console.log('Sending task data to API:', JSON.stringify(taskData));
                          
                          // Call the mutation
                          await createTaskMutation.mutateAsync(taskData as any);
                          
                          // Reset form and close the add task panel
                          form.reset();
                          setShowAddTask(false);
                          
                          // Force a refresh of the tasks data
                          queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TASKS] });
                        } catch (error) {
                          console.error('Submit error:', error);
                          toast({
                            variant: "destructive",
                            title: "Error creating task",
                            description: error instanceof Error ? error.message : "An unknown error occurred",
                          });
                        }
                      }}
                      className="w-full h-11 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 dark:from-teal-600 dark:to-emerald-600 dark:hover:from-teal-500 dark:hover:to-emerald-500 text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2 font-medium"
                    >
                      {createTaskMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4" />
                          Create Task
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                
                {isRecurring && (
                  <div className="mt-4 md:mt-6 p-4 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 transition-all duration-200 shadow-inner">
                    <div className="mb-3 text-sm text-gray-600 dark:text-teal-300 font-medium flex items-center gap-2">
                      <Repeat className="h-4 w-4 text-teal-500" />
                      Configure how often this task should repeat
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-1.5 block text-gray-700 dark:text-gray-200">
                          Repeat Every
                        </label>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            min="1"
                            placeholder="1"
                            value={recurrenceInterval || ""}
                            onChange={(e) => form.setValue("recurrence_interval", parseInt(e.target.value) || 1)}
                            className="w-[80px] bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 text-gray-800 dark:text-gray-200"
                          />
                          <Select
                            value={recurrencePattern || ""}
                            onValueChange={(value) => form.setValue("recurrence_pattern", value as "daily" | "weekly" | "monthly" | "yearly" | null)}
                          >
                            <SelectTrigger className="flex-1 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 text-gray-800 dark:text-gray-200">
                              <SelectValue placeholder="Select period" />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                              <SelectItem value="daily" className="text-gray-800 dark:text-gray-200">
                                <div className="flex items-center gap-2">
                                  <span className="h-2 w-2 rounded-full bg-teal-500"></span>
                                  Day(s)
                                </div>
                              </SelectItem>
                              <SelectItem value="weekly" className="text-gray-800 dark:text-gray-200">
                                <div className="flex items-center gap-2">
                                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                                  Week(s)
                                </div>
                              </SelectItem>
                              <SelectItem value="monthly" className="text-gray-800 dark:text-gray-200">
                                <div className="flex items-center gap-2">
                                  <span className="h-2 w-2 rounded-full bg-green-500"></span>
                                  Month(s)
                                </div>
                              </SelectItem>
                              <SelectItem value="yearly" className="text-gray-800 dark:text-gray-200">
                                <div className="flex items-center gap-2">
                                  <span className="h-2 w-2 rounded-full bg-lime-500"></span>
                                  Year(s)
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block text-gray-700 dark:text-gray-200">
                          Ends (Optional)
                        </label>
                        <Popover open={recurrenceEndDatePickerOpen} onOpenChange={setRecurrenceEndDatePickerOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700",
                                !recurrenceEndDate && "text-gray-500 dark:text-gray-400",
                                recurrenceEndDate && "text-gray-800 dark:text-gray-200"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4 text-teal-500 dark:text-teal-400" />
                              {recurrenceEndDate
                                ? formatDate(recurrenceEndDate, "PPP")
                                : "Select end date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-w-[260px]">
                            <Calendar
                              mode="single"
                              selected={recurrenceEndDate ? recurrenceEndDate : undefined}
                              onSelect={(newDate) => form.setValue("recurrence_end_date", newDate ?? null)}
                              initialFocus
                              className="rounded-lg border-0"
                            />
                            {recurrenceEndDate && (
                              <TimeSelect
                                value={recurrenceEndDate}
                                onChange={(newDate) => {
                                  form.setValue("recurrence_end_date", newDate);
                                }}
                                onComplete={() => {
                                  setRecurrenceEndDatePickerOpen(false);
                                }}
                                compact={true}
                              />
                            )}
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </div>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-4 p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm mb-6">
          <div className="relative w-full md:w-auto md:flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
            <Input
              placeholder="Search tasks..."
              className="pl-9 w-full bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 transition-all duration-200 text-gray-800 dark:text-gray-200"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
            <Select
              value={filterType}
              onValueChange={(value: FilterType) => {
                setFilterType(value);
              }}
            >
              <SelectTrigger className="w-full sm:w-[140px] bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                {Object.entries({
                  all: { label: 'All Tasks', icon: null },
                  active: { label: 'Active', icon: Clock },
                  completed: { label: 'Completed', icon: CheckCircle2 },
                  overdue: { label: 'Overdue', icon: AlertCircle }
                }).map(([value, { label, icon: Icon }]) => {
                  const count = getTaskCounts(processedTasks)[value as FilterType];
                  if (count === 0 && value !== 'all') return null;
                  
                  return (
                    <SelectItem key={value} value={value}>
                      <div className="flex items-center">
                        {Icon && <Icon className="mr-2 h-4 w-4 text-teal-500 dark:text-teal-400" />}
                        <span>{label}</span>
                        <Badge variant="outline" className="ml-2 px-1.5 py-0 text-xs border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400">
                          {count}
                        </Badge>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            <Select
              value={priorityFilter}
              onValueChange={(value: PriorityFilter) => setPriorityFilter(value)}
            >
              <SelectTrigger className="w-full sm:w-[140px] bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="high">
                  <div className="flex items-center">
                    <span className="h-2 w-2 rounded-full bg-red-500 mr-2" />
                    High Priority
                  </div>
                </SelectItem>
                <SelectItem value="medium">
                  <div className="flex items-center">
                    <span className="h-2 w-2 rounded-full bg-yellow-500 mr-2" />
                    Medium Priority
                  </div>
                </SelectItem>
                <SelectItem value="low">
                  <div className="flex items-center">
                    <span className="h-2 w-2 rounded-full bg-green-500 mr-2" />
                    Low Priority
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={dueDateFilter}
              onValueChange={(value: DueDateFilter) => setDueDateFilter(value)}
            >
              <SelectTrigger className="w-full sm:w-[140px] bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400">
                <SelectValue placeholder="Due Date" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <SelectItem value="all">All Due Dates</SelectItem>
                <SelectItem value="today">Due Today</SelectItem>
                <SelectItem value="tomorrow">Due Tomorrow</SelectItem>
                <SelectItem value="week">Due This Week</SelectItem>
                <SelectItem value="month">Due This Month</SelectItem>
              </SelectContent>
            </Select>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setSortOrder(order => {
                      switch (order) {
                        case 'none': return 'asc';
                        case 'asc': return 'desc';
                        case 'desc': return 'none';
                      }
                    })}
                    className="w-[40px] h-[40px] shrink-0 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600 rounded-lg hover:border-teal-300 dark:hover:border-teal-700"
                  >
                    {sortOrder === 'none' ? (
                      <CalendarIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                    ) : sortOrder === 'asc' ? (
                      <SortAsc className="h-4 w-4 text-teal-500 dark:text-teal-400" />
                    ) : (
                      <SortDesc className="h-4 w-4 text-teal-500 dark:text-teal-400" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-md">
                  {sortOrder === 'none' 
                    ? "Sort by due date" 
                    : sortOrder === 'asc' 
                      ? "Sorted by due date (earliest first)" 
                      : "Sorted by due date (latest first)"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {(filterType !== 'all' || priorityFilter !== 'all' || dueDateFilter !== 'all' || sortOrder !== 'none' || searchTerm) && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={clearFilters}
                      className="w-[40px] h-[40px] shrink-0 bg-red-50 dark:bg-red-900/20 text-red-500 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-md">
                    Clear all filters
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>

        <div className={cn(
          "grid gap-6",
          getOverdueTasks(filterTasks(processedTasks)).length > 0 ? "md:grid-cols-3" : "md:grid-cols-2"
        )}>
          <Card className="border-t-4 border-t-blue-500 shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-500" />
                  Active Tasks
                </div>
                <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                  {getActiveTasks(filterTasks(processedTasks)).length}
                </Badge>
              </h2>
              <div className="space-y-4">
                {getPaginatedActiveTasks(filterTasks(processedTasks)).map((task) => (
                  <div
                    key={task.id}
                    className="group p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-accent/5 hover:border-primary/30 transition-all duration-200 shadow-sm hover:shadow relative pt-6"
                  >
                    <div
                      className={cn(
                        "absolute top-1 right-1 px-2 py-0.5 text-xs font-medium rounded-md flex items-center gap-1",
                        task.priority === "high" && "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
                        task.priority === "medium" && "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400",
                        task.priority === "low" && "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                      )}
                    >
                      <span className={cn(
                        "inline-block w-2 h-2 rounded-full",
                        task.priority === "high" && "bg-red-500 dark:bg-red-400",
                        task.priority === "medium" && "bg-yellow-500 dark:bg-yellow-400",
                        task.priority === "low" && "bg-green-500 dark:bg-green-400"
                      )}></span>
                      {task.priority}
                    </div>
                    <div className="flex items-center gap-4">
                      <Checkbox
                        checked={task.completed}
                        onCheckedChange={(checked: boolean) => {
                          console.log(`Changing task ${task.id} completion to ${checked}`);
                          // FIXED: Use mutateAsync to ensure we wait for the mutation to complete
                          updateTaskMutation.mutateAsync({
                            id: task.id,
                            completed: checked,
                          }).then(() => {
                            // FIXED: Force a re-render after completion status changes
                            setForceUpdate(prev => prev + 1);
                            // FIXED: Use the refreshTasks helper to ensure UI updates
                            refreshTasks();
                          }).catch(error => {
                            console.error("Error updating task completion:", error);
                          });
                        }}
                        className="h-5 w-5 rounded-md border-gray-300 dark:border-gray-600"
                      />
                      {renderTaskContent(task, false)}
                    </div>
                    {task.has_subtasks && (
                      <TaskProgress
                        completed={task.completed_subtasks || 0}
                        total={task.total_subtasks || 0}
                      />
                    )}
                    {renderTaskActions(task)}
                  </div>
                ))}
                {getActiveTasks(filterTasks(processedTasks)).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground bg-gray-50 dark:bg-gray-900/30 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
                    <Clock className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    {searchTerm ? 'No matching active tasks' : 'No active tasks'}
                  </div>
                )}
              </div>
            </CardContent>
            {getActiveTasksTotalPages(filterTasks(processedTasks)) > 1 && (
              <CardFooter className="flex justify-center border-t pt-4">
                <PaginationControls 
                  currentPage={activePage}
                  totalPages={getActiveTasksTotalPages(filterTasks(processedTasks))}
                  onPageChange={setActivePage}
                />
              </CardFooter>
            )}
          </Card>
          
          {getOverdueTasks(filterTasks(processedTasks)).length > 0 && (
            <Card className="border-t-4 border-t-red-500 shadow-md hover:shadow-lg transition-shadow duration-200">
              <CardContent className="pt-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    Overdue Tasks
                  </div>
                  <Badge variant="outline" className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800">
                    {getOverdueTasks(filterTasks(processedTasks)).length}
                  </Badge>
                </h2>
                <div className="space-y-4">
                  {getPaginatedOverdueTasks(filterTasks(processedTasks)).map((task) => (
                    <div
                      key={task.id}
                      className="group p-4 rounded-lg border border-red-200 dark:border-red-800/50 hover:bg-red-50/30 dark:hover:bg-red-900/10 transition-all duration-200 shadow-sm hover:shadow relative pt-6"
                    >
                      <div
                        className={cn(
                          "absolute top-1 right-1 px-2 py-0.5 text-xs font-medium rounded-md flex items-center gap-1",
                          task.priority === "high" && "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
                          task.priority === "medium" && "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400",
                          task.priority === "low" && "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                        )}
                      >
                        <span className={cn(
                          "inline-block w-2 h-2 rounded-full",
                          task.priority === "high" && "bg-red-500 dark:bg-red-400",
                          task.priority === "medium" && "bg-yellow-500 dark:bg-yellow-400",
                          task.priority === "low" && "bg-green-500 dark:bg-green-400"
                        )}></span>
                        {task.priority}
                      </div>
                      <div className="flex items-center gap-4">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div>
                                <Checkbox
                                  checked={task.completed}
                                  disabled={true}
                                  className="cursor-not-allowed h-5 w-5 rounded-md border-gray-300 dark:border-gray-600"
                                />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-md">
                              <p>Update the due date before marking as complete</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {renderTaskContent(task, false)}
                      </div>
                      {renderTaskActions(task)}
                    </div>
                  ))}
                </div>
              </CardContent>
              {getOverdueTasksTotalPages(filterTasks(processedTasks)) > 1 && (
                <CardFooter className="flex justify-center border-t pt-4">
                  <PaginationControls 
                    currentPage={overduePage}
                    totalPages={getOverdueTasksTotalPages(filterTasks(processedTasks))}
                    onPageChange={setOverduePage}
                  />
                </CardFooter>
              )}
            </Card>
          )}

          <Card className="border-t-4 border-t-green-500 shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  Completed Tasks
                </div>
                <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">
                  {getCompletedTasks(filterTasks(processedTasks)).length}
                </Badge>
              </h2>
              <div className="space-y-4">
                {getPaginatedCompletedTasks(filterTasks(processedTasks)).map((task) => (
                  <div
                    key={task.id}
                    className="group p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-muted/30 hover:bg-muted/50 transition-all duration-200 relative pt-6"
                  >
                    <div
                      className={cn(
                        "absolute top-1 right-1 px-2 py-0.5 text-xs font-medium rounded-md flex items-center gap-1 opacity-60",
                        task.priority === "high" && "bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400",
                        task.priority === "medium" && "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400",
                        task.priority === "low" && "bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400"
                      )}
                    >
                      <span className={cn(
                        "inline-block w-2 h-2 rounded-full",
                        task.priority === "high" && "bg-red-500/60 dark:bg-red-400/60",
                        task.priority === "medium" && "bg-yellow-500/60 dark:bg-yellow-400/60",
                        task.priority === "low" && "bg-green-500/60 dark:bg-green-400/60"
                      )}></span>
                      {task.priority}
                    </div>
                    <div className="flex items-center gap-4">
                      <Checkbox
                        checked={task.completed}
                        onCheckedChange={(checked: boolean) => {
                          console.log(`Changing task ${task.id} completion to ${checked}`);
                          // FIXED: Use mutateAsync to ensure we wait for the mutation to complete
                          updateTaskMutation.mutateAsync({
                            id: task.id,
                            completed: checked,
                          }).then(() => {
                            // FIXED: Force a re-render after completion status changes
                            setForceUpdate(prev => prev + 1);
                            // FIXED: Use the refreshTasks helper to ensure UI updates
                            refreshTasks();
                          }).catch(error => {
                            console.error("Error updating task completion:", error);
                          });
                        }}
                        className="h-5 w-5 rounded-md border-gray-300 dark:border-gray-600"
                      />
                      {renderTaskContent(task, true)}
                    </div>
                    {renderTaskActions(task)}
                  </div>
                ))}
                {getCompletedTasks(filterTasks(processedTasks)).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground bg-gray-50 dark:bg-gray-900/30 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    {searchTerm ? 'No matching completed tasks' : 'No completed tasks'}
                  </div>
                )}
              </div>
            </CardContent>
            {getCompletedTasksTotalPages(filterTasks(processedTasks)) > 1 && (
              <CardFooter className="flex justify-center border-t pt-4">
                <PaginationControls 
                  currentPage={completedPage}
                  totalPages={getCompletedTasksTotalPages(filterTasks(processedTasks))}
                  onPageChange={setCompletedPage}
                />
              </CardFooter>
            )}
          </Card>
        </div>

        {showSubtasks && selectedTask && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-2xl bg-white dark:bg-gray-800 shadow-2xl rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <List className="h-5 w-5" />
                  Subtasks for "{selectedTask.title}"
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {isGenerating ? (
                  <div className="flex flex-col items-center justify-center py-8 space-y-4">
                    <div className="relative w-16 h-16">
                      <Loader2 className="h-16 w-16 animate-spin text-primary" />
                      <Sparkles className="h-6 w-6 text-yellow-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    <p className="text-lg font-medium text-center">Generating subtasks with AI...</p>
                    <p className="text-sm text-muted-foreground text-center">This may take a few moments</p>
                    <Progress className="w-full max-w-xs" value={undefined} />
                  </div>
                ) : (
                  <div className="mb-4">
                    <div className="text-sm text-muted-foreground mb-4">
                      Break down your task into smaller, manageable steps. Drag to reorder.
                    </div>
                    
                    <DragDropContext onDragEnd={onDragEnd}>
                      <Droppable droppableId="subtasks">
                        {(provided) => (
                          <div
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                            className="space-y-2 max-h-[400px] overflow-y-auto pr-2"
                          >
                            {editedSubtasks.map((subtask, index) => (
                              <Draggable
                                key={subtask.id || `new-${index}`}
                                draggableId={`subtask-${index}`}
                                index={index}
                              >
                                {(provided) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 transition-colors group"
                                  >
                                    <div 
                                      {...provided.dragHandleProps}
                                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex-shrink-0"
                                    >
                                      <GripVertical className="h-4 w-4" />
                                    </div>
                                    <SubtaskItem
                                      subtask={subtask}
                                      onToggle={() => handleSubtaskToggle(index)}
                                      onDelete={() => handleSubtaskDelete(index)}
                                      isLast={index === editedSubtasks.length - 1}
                                    />
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </DragDropContext>

                    <div className="mt-4 space-y-3">
                      <Button
                        className="w-full flex items-center justify-center gap-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
                        onClick={() => {
                          if (selectedTask) {
                            const newSubtasks = [...editedSubtasks, {
                              id: -Date.now() - editedSubtasks.length,
                              user_id: selectedTask.user_id,
                              task_id: selectedTask.id,
                              title: "",
                              completed: false,
                              position: editedSubtasks.length,
                              created_at: Math.floor(Date.now() / 1000),
                              updated_at: Math.floor(Date.now() / 1000)
                            }];
                            setEditedSubtasks(newSubtasks);
                            
                            // Focus on the new input after the state update
                            setTimeout(() => {
                              if (lastSubtaskInputRef.current) {
                                lastSubtaskInputRef.current.focus();
                              }
                            }, 0);
                          }
                        }}
                      >
                        <Plus className="h-4 w-4" />
                        <span>Add Subtask</span>
                      </Button>
                      <div className="flex gap-2">
                        <Button
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                          onClick={saveSubtasks}
                          disabled={saveSubtasksMutation.isPending}
                        >
                          {saveSubtasksMutation.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              Saving...
                            </>
                          ) : (
                            "Save Subtasks"
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => setShowSubtasks(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}