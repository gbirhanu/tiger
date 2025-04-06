import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  generateSubtasks as generateSubtasksApi,
  createSubtasks,
  getUserSettings,
  getTasksWithSubtasks,
  updateSubtask
} from "@/lib/api";
import TaskActivityGraph from "./TaskActivityGraph";
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
import { Task as ImportedTask, Subtask as ImportedSubtask } from "@shared/schema";
import { TimeSelect } from "./TimeSelect";
import { UsageLimitDialog } from './UsageLimitDialog';
import { getAuthToken } from "@/lib/api"; // Import getAuthToken
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

interface Task extends ImportedTask {
  has_subtasks?: boolean;
  completed_subtasks?: number;
  total_subtasks?: number;
  subtasks?: Subtask[];
  parent_task_id: number | null;
}

interface Subtask extends ImportedSubtask {
  position: number;
}

interface TaskWithSubtasks extends Task {
  subtasks: Subtask[];
  has_subtasks: boolean;
  completed_subtasks: number;
  total_subtasks: number;
  position?: number;
  parent_task_id: number | null;
}

// TaskProgress component
const TaskProgress = ({ completed, total }: { completed: number; total: number }) => {
  if (total === 0 || completed === 0) return null;
  
  const percentage = (completed / total) * 100;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="absolute top-0 left-0 right-0 h-1 bg-transparent cursor-help">
            {/* Animated progress bar with gradient */}
            <div
              className="h-full transition-all duration-500 ease-out"
              style={{ 
                width: `${percentage}%`,
                background: percentage < 33 
                  ? 'linear-gradient(90deg, #f87171 0%, #fb923c 100%)' 
                  : percentage < 66 
                    ? 'linear-gradient(90deg, #fb923c 0%, #facc15 50%, #a3e635 100%)' 
                    : 'linear-gradient(90deg, #a3e635 0%, #4ade80 50%, #34d399 100%)',
                boxShadow: `0 0 6px ${percentage < 33 ? 'rgba(239, 68, 68, 0.5)' : percentage < 66 ? 'rgba(234, 179, 8, 0.5)' : 'rgba(34, 197, 94, 0.5)'}`
              }}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-md">
          <div className="text-sm flex items-center gap-1.5">
            <span className="font-semibold text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">{completed}/{total}</span>
            <span>subtasks completed</span>
            <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700">
              {Math.round(percentage)}%
            </span>
            {percentage === 100 && <span className="text-lg">🎉</span>}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
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

// Add this near the top of the file with other type definitions
interface GeminiUsageLimitError {
  limitReached: boolean;
  message: string;
  code: string;
  showUpgrade?: boolean;
}


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
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  const [limitErrorMessage, setLimitErrorMessage] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingTaskCompletion, setPendingTaskCompletion] = useState<{ taskId: number; checked: boolean } | null>(null);
  
  // Use ReturnType<typeof setTimeout> for the correct type
  const titleUpdateTimeoutRef = useRef<number | undefined>(undefined);
 
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
      
      // This will trigger a re-render when tasks change
      setForceUpdate(prev => prev + 1);
    }
  }, [tasks]);
  
  // FIXED: Add a useEffect to handle forceUpdate changes
  useEffect(() => {
    if (forceUpdate > 0) {
      
      // Force a refresh of the tasks data
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TASKS] });
    }
  }, [forceUpdate]);
  
  useEffect(() => {
    if (tasksError) {
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
      // Handle the error appropriately
    }
  }, [subtasksError]);

  const { data: userSettings, error: settingsError } = useQuery({
    queryKey: ['user-settings'],
    queryFn: getUserSettings,
  });

  useEffect(() => {
    if (settingsError) {
      // Handle the error appropriately
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
      

      // Use the mutation with type assertion to bypass the type error
      const newTask = await createTaskMutation.mutateAsync(taskData as any);
      
      
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
        // Keep loading indicator on
        toast({
          title: "Generating subtasks",
          description: "Please wait while AI generates subtasks...",
        });
        
        try {
          // Pass the task object directly to the API with correct structure
          console.log("Generating subtasks for task:", {
            taskId: task.id,
            title: task.title,
            description: task.description
          });
          
          // Check if we have auth token before making the request
          const authToken = getAuthToken();
          if (!authToken) {
            console.error("No auth token available for generateSubtasks - attempting to refresh");
            
            toast({
              title: "Authentication Error",
              description: "Please refresh the page and try again.",
              variant: "destructive"
            });
            
            setIsGenerating(false);
            return;
          }
          
          // Use the standardized API call with proper parameters
          const response = await generateSubtasksApi({ 
            task: {
              title: task.title || "Untitled Task", 
              description: task.description || ""
            },
            count: 5
          });
          
          setIsGenerating(false); // Stop loading after generation
          
          // Log the response for debugging
          console.log("Response from generateSubtasksApi:", {
            hasResponse: !!response,
            hasSubtasks: response && !!response.subtasks,
            subtasksType: response && response.subtasks ? 
              (Array.isArray(response.subtasks) ? 
                `array[${response.subtasks.length}]` : 
                typeof response.subtasks) : 
              'none',
            response
          });
          
          // Safely handle the response
          if (!response || !response.subtasks) {
            console.error("Invalid or empty response from generateSubtasksApi");
            toast({
              title: "Error generating subtasks",
              description: "Unable to generate subtasks. Please try again later.",
              variant: "destructive"
            });
            
            // Create one empty subtask for manual entry
            setEditedSubtasks([{
              id: -Date.now(),
              user_id: task.user_id,
              task_id: task.id,
              title: "",
              completed: false,
              position: 0,
              created_at: Math.floor(Date.now() / 1000),
              updated_at: Math.floor(Date.now() / 1000)
            }]);
            return;
          }
          
          // Process the response
          const subtasksFromResponse = response.subtasks;
          let subtasksList: string[] = [];
          
          if (Array.isArray(subtasksFromResponse)) {
            // Server should return an array, use it directly
            subtasksList = subtasksFromResponse;
            console.log("Received subtasks array:", subtasksList);
          } else if (typeof subtasksFromResponse === 'string') {
            // Handle string responses by parsing
            console.log("Received subtasks string, attempting to parse:", 
                      subtasksFromResponse.substring(0, 100) + 
                      (subtasksFromResponse.length > 100 ? "..." : ""));
            
            try {
              // Try to parse as JSON if it looks like JSON
              if (subtasksFromResponse.trim().startsWith('[') && 
                  subtasksFromResponse.trim().endsWith(']')) {
                subtasksList = JSON.parse(subtasksFromResponse);
              } else {
                // Fallback to splitting by newlines
                subtasksList = subtasksFromResponse.split('\n')
                  .map(line => line.trim())
                  .filter(Boolean);
              }
            } catch (parseError) {
              console.error("Error parsing subtasks string:", parseError);
              // Simple fallback
              subtasksList = subtasksFromResponse
                .replace(/^\s*\[|\]\s*$/g, '')
                .split(/[,\n]/)
                .map(line => line.trim().replace(/^["']|["']$/g, ''))
                .filter(Boolean);
            }
          } else {
            console.error("Unexpected subtasks format:", subtasksFromResponse);
            subtasksList = ["Review task details"];
          }
          
          // If we still have no subtasks, provide a fallback
          if (subtasksList.length === 0) {
            subtasksList = ["Add a subtask"];
          }
          
          console.log("Final subtasks list:", subtasksList);
          
          // Map to the expected format
          const subtasksArray = subtasksList
            .filter(line => line && line.trim().length > 0)
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
          
          setEditedSubtasks(subtasksArray);
          
          toast({
            title: "Subtasks generated",
            description: "AI has generated subtasks for your task.",
          });
        } catch (error) {
          console.error('Error generating subtasks:', error);
          setIsGenerating(false);
          
          // Check if this is a usage limit error
          if (error && typeof error === 'object' && 'limitReached' in error) {
            const limitError = error as GeminiUsageLimitError;
            // Show dialog instead of toast
            setLimitErrorMessage(limitError.message || "You've reached your Gemini API usage limit.");
            setShowLimitDialog(true);
          } else {
            // If generation fails for other reasons, create empty subtasks
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
              title: "Failed to generate subtasks",
              description: error instanceof Error ? error.message : "An unknown error occurred",
            });
          }
        }
      }
    } catch (error) {
      console.error('Error in subtasks workflow:', error);
      setIsGenerating(false);
      
      toast({
        variant: "destructive",
        title: "Error loading subtasks",
        description: error instanceof Error ? error.message : "An unknown error occurred",
      });
    }
  };

  const saveSubtasksMutation = useMutation({
    mutationFn: ({ taskId, subtasks }: { taskId: number, subtasks: Array<Subtask | { title: string; completed: boolean }> }) => {
      // Send all subtasks to the server - the server will only create the new ones
      console.log("Saving subtasks:", { taskId, subtasksCount: subtasks.length });
      return createSubtasks(taskId, subtasks);
    },
    onSuccess: (data, variables) => {
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
    },
    onError: (error) => {
      console.error("Failed to save subtasks:", error);
      
      toast({
        title: "Error saving subtasks",
        description: "There was a problem saving your subtasks. Please try again.",
        variant: "destructive"
      });
    }
  });

  const saveSubtasks = async () => {
    if (!selectedTask) return;
    
    // Filter out empty subtasks before saving
    const filteredSubtasks = editedSubtasks.filter(subtask => 
      subtask.title && subtask.title.trim() !== ''
    );
    
    if (filteredSubtasks.length === 0) {
      toast({
        title: "No subtasks to save",
        description: "Please add at least one subtask with a title.",
        variant: "default"
      });
      return;
    }
    
    // Ensure position values are sequential
    const subtasksWithPositions = filteredSubtasks.map((subtask, index) => ({
      ...subtask,
      position: index
    }));
    
    console.log("Saving subtasks with positions:", 
      subtasksWithPositions.map(s => ({ id: s.id, title: s.title, position: s.position }))
    );
    
    // Just pass all subtasks - the server will handle existing vs new ones
    saveSubtasksMutation.mutate({ 
      taskId: selectedTask.id, 
      subtasks: subtasksWithPositions 
    });
  };

  const onDragEnd = async (result: any) => {
    // If no destination or dropped in same place, do nothing
    if (!result.destination) return;
    if (
      result.destination.droppableId === result.source.droppableId &&
      result.destination.index === result.source.index
    ) {
      return;
    }

    // Create a copy of the current subtasks and reorder them
    const items = Array.from(editedSubtasks);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    // Get current subtasks data
    const currentSubtasks = queryClient.getQueryData<Subtask[]>([QUERY_KEYS.TASK_SUBTASKS(selectedTask?.id || 0)]);
    
    // Update positions in the reordered array BUT PRESERVE original updated_at times
    const updatedItems = items.map((subtask, index) => {
      // Find the original subtask to preserve its updated_at timestamp
      const originalSubtask = currentSubtasks?.find(s => s.id === subtask.id);
      
      return {
        ...subtask,
        position: index,
        // Keep the original updated_at timestamp - CRITICAL for activity graph
        updated_at: originalSubtask?.updated_at || subtask.updated_at
      };
    });
    
    // Immediately update the UI
    setEditedSubtasks(updatedItems);
    
    // If we have a selected task, update the subtasks positions in the database
    if (selectedTask) {
      try {
        // Get the subtasks that exist in the database (positive IDs)
        const existingSubtasks = updatedItems.filter(
          subtask => subtask.id && typeof subtask.id === 'number' && subtask.id > 0
        );
        
        console.log("Updating positions only for existing subtasks:", 
          existingSubtasks.map(st => ({ id: st.id, position: st.position }))
        );
        
        // Only update positions for subtasks that already exist in the database
        for (const subtask of existingSubtasks) {
          try {
            // Send ONLY the position data, nothing else
            await updateSubtask(
              selectedTask.id,
              subtask.id as number,
              { position: subtask.position }
            );
          } catch (error) {
            console.error(`Error updating subtask ${subtask.id} position:`, error);
          }
        }
        
        // Update the query cache PRESERVING the original timestamps
        if (currentSubtasks) {
          const mergedSubtasks = updatedItems.map(updatedSubtask => {
            // For each updated subtask, find the matching original to preserve timestamps
            const originalSubtask = currentSubtasks.find(s => s.id === updatedSubtask.id);
            if (originalSubtask) {
              // Preserve created_at and updated_at from the original
              return {
                ...updatedSubtask,
                created_at: originalSubtask.created_at,
                updated_at: originalSubtask.updated_at
              };
            }
            return updatedSubtask;
          });
          
          queryClient.setQueryData([QUERY_KEYS.TASK_SUBTASKS(selectedTask.id)], mergedSubtasks);
        }
      } catch (error) {
        console.error("Error updating subtask positions:", error);
        toast({
          title: "Error updating positions",
          description: "There was a problem updating subtask positions. Please try again.",
          variant: "destructive"
        });
      }
    }
  };

  const renderTaskContent = (task: Task, isInDetail = false) => {
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
                          <PopoverContent className="w-auto p-0 flex" align="start">
                            <div>
                            <Calendar
                      mode="single"
                      selected={editForm.due_date ? new Date(editForm.due_date) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          const currentTime = editForm.due_date ? new Date(editForm.due_date) : new Date();
                          date.setHours(currentTime.getHours(), currentTime.getMinutes());
                          setEditForm(prev => updateFormData(prev, { due_date: date }));
                        } else {
                          setEditForm(prev => updateFormData(prev, { due_date: null }));
                          setEditDatePickerOpen(false);
                        }
                      }}
                      initialFocus
                    />
                            </div>
                            <div className="border-l">
                            <TimeSelect
                                value={editForm.due_date ? new Date(editForm.due_date) : new Date()}
                                onChange={(newDate) => {
                                  setEditForm(prev => updateFormData(prev, { due_date: newDate }));
                                }}
                                onComplete={() => {
                                  setEditDatePickerOpen(false);
                                }}
                                compact={true}
                              />
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
                            type="button"
                            variant="outline"
                            className="w-full justify-start text-left font-normal bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-md"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                            {editForm.recurrence_end_date && editForm.recurrence_end_date instanceof Date && !isNaN(editForm.recurrence_end_date.getTime())
                              ? formatDate(editForm.recurrence_end_date, "PPP")
                              : "Select end date"}
                          </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 flex" align="start">
                            <div>
                            <Calendar
                      mode="single"
                      selected={editForm.recurrence_end_date ? new Date(editForm.recurrence_end_date) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          const currentTime = editForm.recurrence_end_date ? new Date(editForm.recurrence_end_date) : new Date();
                          date.setHours(currentTime.getHours(), currentTime.getMinutes());
                          setEditForm(prev => updateFormData(prev, { recurrence_end_date: date }));
                        } else {
                          setEditForm(prev => updateFormData(prev, { recurrence_end_date: null }));
                          setRecurrenceEndDatePickerOpen(false);
                        }
                      }}
                      initialFocus
                    />
                            </div>
                            <div className="border-l">
                            <TimeSelect
                                value={editForm.due_date ? new Date(editForm.due_date) : new Date()}
                                onChange={(newDate) => {
                                  setEditForm(prev => updateFormData(prev, { recurrence_end_date: newDate }));
                                }}
                                onComplete={() => {
                                  setRecurrenceEndDatePickerOpen(false);
                                }}
                                compact={true}
                              />
                            </div>
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
          <p className={cn("font-medium truncate", task.completed && "line-through text-muted-foreground")}>
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
          <p className={cn("text-sm text-muted-foreground truncate mt-1", task.completed && "line-through")}>
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
        {/* Check property exists before accessing it */}
        {('has_subtasks' in task && task.has_subtasks) ? 
          <TaskActivityGraph task={task as TaskWithSubtasks} /> : null}
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
    return tasks.filter(task => {
      // Regular active tasks
      if (!task.completed && !isOverdue(task) && !task.parent_task_id) {
        return true;
      }
      
      // For child tasks of recurring tasks (instances of recurring tasks)
      if (!task.completed && !isOverdue(task) && task.parent_task_id) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Only show if it has a due date
        if (!task.due_date) return false;
        
        const dueDate = new Date(task.due_date * 1000);
        
        // Get next week's end
        const nextWeekEnd = new Date(today);
        nextWeekEnd.setDate(today.getDate() + 7);
        
        // Include the task if it's due within the current week or next week
        return dueDate >= today && dueDate <= nextWeekEnd;
      }
      
      return false;
    });
  };

  const getOverdueTasks = (tasks: TaskWithSubtasks[]) => {
    return tasks.filter(task => {
      // Regular overdue tasks
      if (!task.completed && isOverdue(task) && !task.parent_task_id) {
        return true;
      }
      
      // For child tasks of recurring tasks (instances of recurring tasks)
      if (!task.completed && isOverdue(task) && task.parent_task_id) {
        // Only include overdue tasks from child recurring tasks
        return true;
      }
      
      return false;
    });
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
    const subtask = newSubtasks[index];
    
    if (subtask) {
      // Update the title in local state
      newSubtasks[index] = {
        ...subtask,
        title: value
      };
      setEditedSubtasks(newSubtasks);
      
      // If this is an existing subtask with a POSITIVE numeric ID, update it via API
      // Negative IDs are temporary and don't exist in the database yet
      if (subtask.id && typeof subtask.id === 'number' && subtask.id > 0 && selectedTask) {
        // Debounce the API call to avoid too many requests
        if (titleUpdateTimeoutRef.current) {
          clearTimeout(titleUpdateTimeoutRef.current);
        }
        
        titleUpdateTimeoutRef.current = window.setTimeout(() => {
          updateSubtaskMutation.mutate({
            taskId: selectedTask.id,
            subtaskId: subtask.id as number,
            data: { title: value }
          });
        }, 500); // 500ms debounce
      }
    }
  };

  const handleSubtaskToggle = (index: number) => {
    const newSubtasks = [...editedSubtasks];
    const subtask = newSubtasks[index];
    
    if (subtask) {
      // Toggle completed state in local state
      const newCompletedState = !subtask.completed;
      const currentTimestamp = Math.floor(Date.now() / 1000);
      
      // Update the subtask in the local state
      newSubtasks[index] = {
        ...subtask,
        completed: newCompletedState,
        // When a subtask is completed, update its timestamp to now
        // This is important for the activity graph
        updated_at: newCompletedState ? currentTimestamp : subtask.updated_at
      };
      
      // Immediately update the local state
      setEditedSubtasks(newSubtasks);
      
      // If this is an existing subtask with a POSITIVE ID, update it via API
      // Negative IDs are temporary and don't exist in the database yet
      if (subtask.id && typeof subtask.id === 'number' && subtask.id > 0 && selectedTask) {
        // Update all caches immediately for a responsive UI
        
        // 1. Update TASK_SUBTASKS cache
        const currentTaskSubtasks = queryClient.getQueryData<Subtask[]>([QUERY_KEYS.TASK_SUBTASKS(selectedTask.id)]);
        if (currentTaskSubtasks) {
          const updatedCache = currentTaskSubtasks.map(s => 
            s.id === subtask.id 
              ? { ...s, completed: newCompletedState, updated_at: newCompletedState ? currentTimestamp : s.updated_at } 
              : s
          );
          queryClient.setQueryData([QUERY_KEYS.TASK_SUBTASKS(selectedTask.id)], updatedCache);
        }
        
        // 2. Update SUBTASKS cache (used by TaskActivityGraph)
        const currentSubtasksCache = queryClient.getQueryData<Subtask[]>([QUERY_KEYS.SUBTASKS, selectedTask.id]);
        if (currentSubtasksCache) {
          const updatedCache = currentSubtasksCache.map(s => 
            s.id === subtask.id 
              ? { ...s, completed: newCompletedState, updated_at: newCompletedState ? currentTimestamp : s.updated_at } 
              : s
          );
          queryClient.setQueryData([QUERY_KEYS.SUBTASKS, selectedTask.id], updatedCache);
        }
        
        // Then update the server - use mutateAsync to ensure completion
        updateSubtaskMutation.mutateAsync({
          taskId: selectedTask.id,
          subtaskId: subtask.id,
          data: { 
            completed: newCompletedState,
            // Include updated_at in the request data only if the subtask is being completed
            ...(newCompletedState ? { updated_at: currentTimestamp } : {})
          }
        }).catch(error => {
          console.error("Failed to update subtask completion:", error);
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to update subtask completion status"
          });
        });
      }
    }
  };

  const handleSubtaskDelete = (index: number) => {
    const newSubtasks = [...editedSubtasks];
    newSubtasks.splice(index, 1);
    setEditedSubtasks(newSubtasks);
  };

  // Add a ref for the latest subtask input
  const lastSubtaskInputRef = useRef<HTMLInputElement>(null);
  
  // Create a map of refs for each subtask input
  const subtaskInputRefs = useRef<Map<number, HTMLInputElement>>(new Map());

  // Update the SubtaskItem component to use the ref for the last item
  const SubtaskItem = ({ subtask, index, onToggle, onDelete, isLast }: { 
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
    index: number;
    onToggle: () => void; 
    onDelete: () => void;
    isLast?: boolean;
  }) => {
    // Use local state for the input value to prevent focus loss during typing
    const [localTitle, setLocalTitle] = useState(subtask.title);
    
    // Update local state when the subtask title changes from parent
    useEffect(() => {
      setLocalTitle(subtask.title);
    }, [subtask.title]);
    
    // Handle local changes without triggering parent state updates
    const handleLocalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setLocalTitle(e.target.value);
    };
    
    // Update parent state only when input loses focus
    const handleBlur = () => {
      if (localTitle !== subtask.title) {
        handleSubtaskChange(index, localTitle);
      }
    };
    
    return (
      <div className="flex items-center gap-2 py-1 w-full group">
        <Checkbox
          checked={subtask.completed}
          onCheckedChange={onToggle}
          className="data-[state=checked]:bg-blue-500 data-[state=checked]:text-white flex-shrink-0 border-gray-300 dark:border-gray-600 transition-colors"
        />
        <Input
          ref={isLast ? lastSubtaskInputRef : null}
          value={localTitle}
          onChange={handleLocalChange}
          onBlur={handleBlur}
          className={cn(
            "flex-1 border-0 focus-visible:ring-1 focus-visible:ring-blue-500 px-3 py-1.5 h-auto min-h-[36px] rounded-md text-sm",
            subtask.completed 
              ? "line-through text-muted-foreground bg-gray-50 dark:bg-gray-800/50" 
              : "bg-white dark:bg-gray-800 shadow-sm"
          )}
          placeholder="Enter subtask..."
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="h-7 w-7 rounded-full flex-shrink-0 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ml-auto"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  };

  // Add mutation for updating individual subtask
  const updateSubtaskMutation = useMutation({
    mutationFn: ({ taskId, subtaskId, data }: { taskId: number; subtaskId: number; data: Partial<Subtask> }) => 
      updateSubtask(taskId, subtaskId, data),
    onMutate: async ({ taskId, subtaskId, data }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.TASK_SUBTASKS(taskId)] });
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.SUBTASKS, taskId] });
      
      // Snapshot the previous value
      const previousSubtasks = queryClient.getQueryData<Subtask[]>([QUERY_KEYS.TASK_SUBTASKS(taskId)]);
      const previousQuerySubtasks = queryClient.getQueryData<Subtask[]>([QUERY_KEYS.SUBTASKS, taskId]);
      
      // Create an optimistic update
      if (previousSubtasks) {
        const optimisticSubtasks = previousSubtasks.map(subtask => 
          subtask.id === subtaskId 
            ? { 
                ...subtask, 
                ...data, 
                // Preserve the updated timestamp from data if it's provided
                updated_at: data.updated_at || subtask.updated_at
              }
            : subtask
        );
        
        // Update the query cache
        queryClient.setQueryData([QUERY_KEYS.TASK_SUBTASKS(taskId)], optimisticSubtasks);
      }

      // Also update the SUBTASKS query cache used by the TaskActivityGraph
      if (previousQuerySubtasks) {
        const optimisticQuerySubtasks = previousQuerySubtasks.map(subtask => 
          subtask.id === subtaskId 
            ? { 
                ...subtask, 
                ...data, 
                // Preserve the updated timestamp from data if it's provided
                updated_at: data.updated_at || subtask.updated_at
              }
            : subtask
        );
        
        queryClient.setQueryData([QUERY_KEYS.SUBTASKS, taskId], optimisticQuerySubtasks);
      }
      
      return { previousSubtasks, previousQuerySubtasks };
    },
    onError: (err, variables, context) => {
      // Roll back to the previous state if there's an error
      if (context?.previousSubtasks) {
        queryClient.setQueryData(
          [QUERY_KEYS.TASK_SUBTASKS(variables.taskId)], 
          context.previousSubtasks
        );
      }

      if (context?.previousQuerySubtasks) {
        queryClient.setQueryData(
          [QUERY_KEYS.SUBTASKS, variables.taskId], 
          context.previousQuerySubtasks
        );
      }
      
      // Notify user of error
      toast({
        variant: "destructive",
        title: "Failed to update subtask",
        description: err instanceof Error ? err.message : "An error occurred while updating the subtask",
      });
    },
    onSuccess: (updatedSubtask, variables) => {
      // Get the current data
      const currentSubtasks = queryClient.getQueryData<Subtask[]>([QUERY_KEYS.TASK_SUBTASKS(variables.taskId)]);
      
      // Update just the specific subtask in the cache with the response from the server
      if (currentSubtasks) {
        const updatedSubtasks = currentSubtasks.map(subtask => 
          subtask.id === updatedSubtask.id ? updatedSubtask : subtask
        );
        
        // Update the cache with the fresh data
        queryClient.setQueryData([QUERY_KEYS.TASK_SUBTASKS(variables.taskId)], updatedSubtasks);
      }
      
      // Invalidate all affected queries to ensure UI consistency
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.SUBTASKS, variables.taskId] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TASKS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TASKS_WITH_SUBTASKS] });
    },
    onSettled: (_, __, variables) => {
      // Always force a refresh of the subtasks data when a mutation completes
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.SUBTASKS, variables.taskId] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TASK_SUBTASKS(variables.taskId)] });
      
      // Force update UI counters and task list
      setForceUpdate(prev => prev + 1);
    }
  });

  const handleTaskCompletion = async (taskId: number, checked: boolean) => {
    // Get the task
    const task = tasks?.find(t => t.id === taskId) as TaskWithSubtasks;
    if (!task) return;

    // If task has subtasks and there are uncompleted ones
    if (task.has_subtasks && checked && task.completed_subtasks < task.total_subtasks) {
      setPendingTaskCompletion({ taskId, checked });
      setShowConfirmDialog(true);
      return;
    }

    // Otherwise, proceed with the update
    await completeTask(taskId, checked);
  };

  const completeTask = async (taskId: number, checked: boolean) => {
    try {
      // Update the task completion status - let database handle updated_at timestamp
      await updateTaskMutation.mutateAsync({
        id: taskId,
        completed: checked
      });

      // If completing the task and it has subtasks, complete all subtasks
      const task = tasks?.find(t => t.id === taskId);
      if (task && 'has_subtasks' in task && task.has_subtasks && checked) {
        const subtasks = await getSubtasks(taskId);
        for (const subtask of subtasks) {
          if (!subtask.completed) {
            await updateSubtaskMutation.mutateAsync({
              taskId: taskId,
              subtaskId: subtask.id,
              data: { 
                completed: true
              }
            });
          }
        }
      }

      // Force a re-render and refresh tasks
      setForceUpdate(prev => prev + 1);
      refreshTasks();
    } catch (error) {
      console.error("Error updating task completion:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update task completion status"
      });
    }
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
                            className="w-full justify-start text-left font-normal bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-md"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                            {dueDate && dueDate instanceof Date && !isNaN(dueDate.getTime())
                              ? formatDate(dueDate, "PPP")
                              : "Due date"}
                          </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 flex" align="start">
                            <div>
                            <Calendar
                      mode="single"
                      selected={dueDate ? new Date(dueDate) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          const currentTime = dueDate ? new Date(dueDate) : new Date();
                          date.setHours(currentTime.getHours(), currentTime.getMinutes());
                          form.setValue("due_date", date);
                        } else {
                          form.setValue("due_date", null);
                          setNewTaskDatePickerOpen(false);
                        }
                      }}
                      initialFocus
                    />
                            </div>
                            <div className="border-l">
                            <TimeSelect
                                value={dueDate ? new Date(dueDate) : new Date()}
                                onChange={(newDate) => {
                                  form.setValue("due_date", newDate);
                                }}
                                onComplete={() => {
                                  setNewTaskDatePickerOpen(false);
                                }}
                                compact={true}
                              />
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
                          
                          
                          // Validate the form first
                          const isValid = await form.trigger();
                          if (!isValid) {
                            
                            toast({
                              variant: "destructive",
                              title: "Invalid form data",
                              description: "Please check the form for errors and try again.",
                            });
                            return;
                          }
                          
                          const formData = form.getValues();
                          
                          
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
                            type="button"
                            variant="outline"
                            className="w-full justify-start text-left font-normal bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-md"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                            {recurrenceEndDate && recurrenceEndDate instanceof Date && !isNaN(recurrenceEndDate.getTime())
                              ? formatDate(recurrenceEndDate, "PPP")
                              : "Select end date"}
                          </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 flex" align="start">
                            <div>
                            <Calendar
                      mode="single"
                      selected={recurrenceEndDate ? new Date(recurrenceEndDate) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          const currentTime = recurrenceEndDate ? new Date(recurrenceEndDate) : new Date();
                          date.setHours(currentTime.getHours(), currentTime.getMinutes());
                          form.setValue("recurrence_end_date", date);
                        } else {
                          form.setValue("recurrence_end_date", null);
                          setRecurrenceEndDatePickerOpen(false);
                        }
                      }}
                      initialFocus
                    />
                            </div>
                            <div className="border-l">
                            <TimeSelect
                                value={recurrenceEndDate ? new Date(recurrenceEndDate) : new Date()}
                                onChange={(newDate) => {
                                  form.setValue("recurrence_end_date", newDate);
                                }}
                                onComplete={() => {
                                  setRecurrenceEndDatePickerOpen(false);
                                }}
                                compact={true}
                              />
                            </div>
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
                    className="group p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-blue-50/40 dark:hover:bg-blue-900/10 transition-all duration-200 shadow-sm hover:shadow relative overflow-hidden"
                  >
                    {'has_subtasks' in task && task.has_subtasks && (
                      <TaskProgress
                        completed={task.completed_subtasks || 0}
                        total={task.total_subtasks || 0}
                      />
                    )}
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
                        onCheckedChange={(checked: boolean) => handleTaskCompletion(task.id, checked)}
                        className="h-5 w-5 rounded-md border-gray-300 dark:border-gray-600"
                      />
                      {renderTaskContent(task, false)}
                    </div>
                    
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
                      className="group p-4 rounded-lg border border-red-200 dark:border-red-800/50 hover:bg-red-50/30 dark:hover:bg-red-900/10 transition-all duration-200 shadow-sm hover:shadow relative overflow-hidden"
                    >
                      {'has_subtasks' in task && task.has_subtasks && (
                        <TaskProgress
                          completed={task.completed_subtasks || 0}
                          total={task.total_subtasks || 0}
                        />
                      )}
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
                    className="group p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-muted/30 hover:bg-muted/50 transition-all duration-200 relative overflow-hidden"
                  >
                    {'has_subtasks' in task && task.has_subtasks && (
                      <TaskProgress
                        completed={task.completed_subtasks || 0}
                        total={task.total_subtasks || 0}
                      />
                    )}
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
                        onCheckedChange={(checked: boolean) => handleTaskCompletion(task.id, checked)}
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
          <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <Card className="w-full max-w-2xl bg-white dark:bg-gray-800 shadow-2xl rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden transform-gpu scale-100 transition-all">
              <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 pb-4">
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <List className="h-5 w-5" />
                    <span className="line-clamp-1">Subtasks for "{selectedTask.title}"</span>
                  </CardTitle>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setShowSubtasks(false)}
                    className="text-white/80 hover:text-white hover:bg-white/20"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
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
                  <div className="mb-2">
                    <div className="text-sm text-muted-foreground mb-4 flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-blue-500" />
                      <span>Break down your task into smaller, manageable steps. Drag to reorder.</span>
                    </div>
                    
                    <DragDropContext onDragEnd={onDragEnd}>
                      <Droppable droppableId="subtasks">
                        {(provided) => (
                          <div
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                            className="space-y-2 max-h-[350px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent"
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
                                    className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm transition-all duration-150 group"
                                  >
                                    <div 
                                      {...provided.dragHandleProps}
                                      className="text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors flex-shrink-0 cursor-grab active:cursor-grabbing"
                                    >
                                      <GripVertical className="h-4 w-4" />
                                    </div>
                                    <SubtaskItem
                                      subtask={subtask}
                                      index={index}
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

                    <div className="mt-6 space-y-4">
                      <Button
                        variant="outline"
                        className="w-full flex items-center justify-center gap-2 border-dashed border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10 hover:bg-blue-100/50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-all h-10"
                        onClick={() => {
                          if (selectedTask) {
                            // Generate a unique temporary ID (negative to distinguish from server IDs)
                            // Use microsecond precision for better uniqueness
                            const tempId = -(Date.now() * 1000 + Math.floor(Math.random() * 1000));
                            
                            const newSubtasks = [...editedSubtasks, {
                              id: tempId, // Temporary negative ID
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
                      <div className="flex gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                        <Button
                          size="default"
                          className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
                          onClick={saveSubtasks}
                          disabled={saveSubtasksMutation.isPending}
                        >
                          {saveSubtasksMutation.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Check className="h-4 w-4 mr-2" />
                              Save Changes
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="default"
                          className="flex-none px-5 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
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
      {/* Usage Limit Dialog */}
      <UsageLimitDialog 
        open={showLimitDialog} 
        onOpenChange={setShowLimitDialog}
        message={limitErrorMessage}
      />
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete Task with Uncompleted Subtasks?</AlertDialogTitle>
            <AlertDialogDescription>
              This task has uncompleted subtasks. Would you like to mark all subtasks as completed as well?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingTaskCompletion(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingTaskCompletion) {
                  completeTask(pendingTaskCompletion.taskId, pendingTaskCompletion.checked);
                  setPendingTaskCompletion(null);
                }
                setShowConfirmDialog(false);
              }}
            >
              Yes, Complete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
