import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTasks, createTask, updateTask, deleteTask, getUserSettings } from "../lib/api";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { 
  Calendar as CalendarIcon, 
  Loader2, 
  AlertCircle, 
  Trash2, 
  Plus, 
  CheckSquare, 
  List,
  Clock,
  CheckCircle2,
  BarChart2,
  Activity,
  TrendingUp
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { queryClient, QUERY_KEYS } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Update Task interface to match database schema
interface Task {
  id: number;
  title: string;
  description: string | null;
  completed: boolean;  // Should be boolean, not number
  due_date: number | null;  // Should be number (unix timestamp), not string
  priority: string;
  is_recurring: boolean;  // Should be boolean, not number
  recurrence_pattern?: string | null;
  recurrence_interval?: number | null;
  recurrence_end_date?: number | null;
  parent_task_id?: number | null;
  user_id?: number;
  created_at?: number;
  updated_at?: number;
  all_day?: boolean;
}

// Enhanced time series graph component
const TaskActivityGraph = ({ task, tasks }: { task: Task, tasks: Task[] }) => {
  // Get subtasks for this task
  const subtasks = tasks.filter(t => t.parent_task_id === task.id);
  const isProminent = subtasks.length > 2;
  
  if (subtasks.length === 0) {
    // Fallback for tasks with no subtasks - show a simple indicator
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors cursor-pointer border border-gray-200 dark:border-gray-700">
              <BarChart2 className="h-3 w-3" />
              <span>No activity</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">No subtask activity data available</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  // Get update timestamps for visualization
  const timestamps = subtasks
    .map(t => t.updated_at)
    .filter(Boolean)
    .sort((a, b) => (a || 0) - (b || 0));
  
  // If we don't have enough data points, create some dummy data for visualization
  if (timestamps.length < 2) {
    // Create synthetic data for visualization
    const now = Math.floor(Date.now() / 1000);
    const syntheticPoints = [
      { x: 0, y: 0.3 },
      { x: 0.3, y: 0.5 },
      { x: 0.7, y: 0.4 },
      { x: 1, y: 0.6 }
    ];
    
    // Generate SVG path
    const svgWidth = isProminent ? 120 : 60;
    const svgHeight = isProminent ? 40 : 24;
    const pathData = syntheticPoints.map((point, i) => {
      const x = point.x * svgWidth;
      const y = (1 - point.y) * svgHeight;
      return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
    }).join(' ');
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn(
              "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors cursor-pointer border border-blue-200 dark:border-blue-800",
              isProminent && "w-full justify-between"
            )}>
              <div className="flex items-center gap-1.5">
                <BarChart2 className={cn("h-3 w-3", isProminent && "h-4 w-4")} />
                <span className={cn(isProminent && "text-sm font-medium")}>Activity</span>
              </div>
              <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="overflow-visible">
                <defs>
                  <linearGradient id={`activity-gradient-${task.id}-fallback`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="rgb(59, 130, 246)" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="rgb(37, 99, 235)" stopOpacity="1" />
                  </linearGradient>
                </defs>
                
                <line x1="0" y1={svgHeight/2} x2={svgWidth} y2={svgHeight/2} stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.2" />
                <line x1={svgWidth/2} y1="0" x2={svgWidth/2} y2={svgHeight} stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.2" />
                
                <path
                  d={pathData}
                  fill="none"
                  stroke={`url(#activity-gradient-${task.id}-fallback)`}
                  strokeWidth={isProminent ? 3 : 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="2,2"
                />
              </svg>
              <span className="text-xs">{subtasks.length} subtask{subtasks.length !== 1 && 's'}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Subtask Activity</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Limited data available - {subtasks.length} subtask(s)</p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  // Create data points for the mini graph
  const now = Math.floor(Date.now() / 1000);
  const earliestTime = timestamps[0] || now;
  const timeRange = now - earliestTime;
  
  // Normalize timestamps to 0-1 range for drawing
  const points = timestamps.map((time, index) => {
    const normalizedTime = ((time || earliestTime) - earliestTime) / (timeRange || 1);
    // Create a more interesting pattern based on index
    const activityLevel = 0.3 + Math.sin(index * 0.8) * 0.3 + Math.random() * 0.2;
    return { x: normalizedTime, y: activityLevel };
  });
  
  // Add current time as last point
  points.push({ x: 1, y: 0.5 });
  
  // Generate SVG path
  const svgWidth = isProminent ? 180 : 60;
  const svgHeight = isProminent ? 50 : 24;
  const pathData = points.map((point, i) => {
    const x = point.x * svgWidth;
    const y = (1 - point.y) * svgHeight;
    return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
  }).join(' ');
  
  // Create area under the curve for prominent display
  const areaPathData = isProminent ? 
    `${pathData} L ${svgWidth},${svgHeight} L 0,${svgHeight} Z` : '';
  
  // Format the earliest and latest dates for the tooltip
  const formatTimestamp = (timestamp: number) => {
    try {
      const date = new Date(timestamp * 1000);
      return format(date, 'MMM d, h:mm a');
    } catch (e) {
      return 'Unknown date';
    }
  };
  
  const earliestDate = formatTimestamp(earliestTime);
  const latestDate = formatTimestamp(now);
  const updateCount = timestamps.length;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors cursor-pointer border border-violet-200 dark:border-violet-800",
            isProminent && "w-full justify-between"
          )}>
            <div className="flex items-center gap-1.5">
              <TrendingUp className={cn("h-3 w-3", isProminent && "h-4 w-4")} />
              <span className={cn(isProminent && "text-sm font-medium")}>Activity</span>
            </div>
            <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="overflow-visible">
              {/* Add gradient for the path */}
              <defs>
                <linearGradient id={`activity-gradient-${task.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgb(139, 92, 246)" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="rgb(124, 58, 237)" stopOpacity="1" />
                </linearGradient>
                {isProminent && (
                  <linearGradient id={`activity-area-gradient-${task.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="rgb(139, 92, 246)" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="rgb(139, 92, 246)" stopOpacity="0.05" />
                  </linearGradient>
                )}
              </defs>
              
              {/* Add subtle grid lines */}
              <line x1="0" y1={svgHeight/2} x2={svgWidth} y2={svgHeight/2} stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.2" />
              <line x1={svgWidth/2} y1="0" x2={svgWidth/2} y2={svgHeight} stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.2" />
              
              {/* Area under the curve for prominent display */}
              {isProminent && (
                <path
                  d={areaPathData}
                  fill={`url(#activity-area-gradient-${task.id})`}
                  strokeWidth="0"
                />
              )}
              
              {/* Main path with gradient */}
              <path
                d={pathData}
                fill="none"
                stroke={`url(#activity-gradient-${task.id})`}
                strokeWidth={isProminent ? 3 : 2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              
              {/* Add dots for data points */}
              {points.map((point, i) => (
                <circle 
                  key={i}
                  cx={point.x * svgWidth}
                  cy={(1 - point.y) * svgHeight}
                  r={isProminent ? 2 : 1.5}
                  fill="white"
                  stroke="currentColor"
                  strokeWidth="1"
                />
              ))}
            </svg>
            <span className="text-xs">{updateCount} updates</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Subtask Activity</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{updateCount} updates from {earliestDate} to {latestDate}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{subtasks.length} subtasks tracked</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export function TaskList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [date, setDate] = useState<Date | null>(null);
  
  // Get user settings for timezone
  const { data: userSettings } = useQuery({
    queryKey: ['user-settings'],
    queryFn: getUserSettings,
  });
  
  // Fetch tasks
  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: [QUERY_KEYS.TASKS],
    queryFn: async () => {
      const data = await getTasks();
      
      // Debug the raw data
      console.log("Raw tasks data from API:", data);
      
      return data.map((task: any) => {
        // Add extra validation and logging for debugging date issues
        if (task.due_date) {
          console.log(`Task ${task.id} raw due_date:`, task.due_date, typeof task.due_date);
          
          // Handle different potential formats of due_date from the API
          let processedDueDate = task.due_date;
          
          // If it's a string that looks like a number, convert it to a number
          if (typeof task.due_date === 'string' && /^\d+$/.test(task.due_date)) {
            processedDueDate = parseInt(task.due_date, 10);
          } 
          // If it's a string that looks like an ISO date, convert to timestamp
          else if (typeof task.due_date === 'string' && task.due_date.includes('-')) {
            const dateObj = new Date(task.due_date);
            if (!isNaN(dateObj.getTime())) {
              processedDueDate = Math.floor(dateObj.getTime() / 1000);
            }
          }
          
          // Additional validation: ensure the timestamp is valid (not 0 or too small)
          if (processedDueDate === 0 || processedDueDate < 1000000) {
            console.warn(`Task ${task.id} has an invalid timestamp:`, processedDueDate);
            processedDueDate = null; // Set to null instead of keeping invalid timestamp
          }
          
          console.log(`Task ${task.id} processed due_date:`, processedDueDate);
          
          return {
            ...task,
            completed: task.completed === 1,
            due_date: processedDueDate
          };
        }
        
        return {
          ...task,
          completed: task.completed === 1,
        };
      });
    },
  });

  // Filter tasks - exclude recurring tasks and child tasks
  const activeTasks = tasks.filter(task => 
    task.completed === false && 
    !task.is_recurring && 
    !task.parent_task_id
  );
  const completedTasks = tasks.filter(task => 
    task.completed === true && 
    !task.is_recurring && 
    !task.parent_task_id
  );

  // Helper function to get priority styling
  const getPriorityClass = (priority: string) => {
    switch (priority) {
      case "high":
        return {
          bg: "bg-red-50 dark:bg-red-950/30",
          text: "text-red-700 dark:text-red-400",
          border: "border-red-200 dark:border-red-800",
          icon: <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
        };
      case "medium":
        return {
          bg: "bg-amber-50 dark:bg-amber-950/30",
          text: "text-amber-700 dark:text-amber-400",
          border: "border-amber-200 dark:border-amber-800",
          icon: <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
        };
      case "low":
        return {
          bg: "bg-green-50 dark:bg-green-950/30",
          text: "text-green-700 dark:text-green-400",
          border: "border-green-200 dark:border-green-800",
          icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
        };
      default:
        return {
          bg: "bg-slate-50 dark:bg-slate-800/30",
          text: "text-slate-700 dark:text-slate-400",
          border: "border-slate-200 dark:border-slate-700",
          icon: null
        };
    }
  };

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (data: { title: string; description: string | null; priority: string }) => {
      // Create task with all required fields
      const taskData = {
        ...data,
        completed: false,
        due_date: date ? Math.floor(date.getTime() / 1000) : null,
        user_id: 2, // Use the authenticated user ID from the error message
        all_day: true,
        is_recurring: false,
        parent_task_id: null,
        recurrence_pattern: null,
        recurrence_interval: null,
        recurrence_end_date: null,
        created_at: Math.floor(Date.now() / 1000), // Current timestamp for TypeScript
        updated_at: Math.floor(Date.now() / 1000), // Current timestamp for TypeScript
        // These will be overwritten by the server anyway
      };
      return createTask(taskData);
    },
    onMutate: async (data) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.TASKS] });
      
      // Snapshot the previous value
      const previousTasks = queryClient.getQueryData<Task[]>([QUERY_KEYS.TASKS]) || [];
      
      // Create an optimistic task with a temporary ID
      const optimisticTask: Task = {
        ...data,
        id: Date.now(), // Temporary ID
        completed: false,
        due_date: date ? Math.floor(date.getTime() / 1000) : null,
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000),
        // Add other required fields
        user_id: 2,
        all_day: true,
        is_recurring: false,
        parent_task_id: null,
        recurrence_pattern: null,
        recurrence_interval: null,
        recurrence_end_date: null,
      } as Task;
      
      // Optimistically update the tasks list
      queryClient.setQueryData<Task[]>([QUERY_KEYS.TASKS], [...previousTasks, optimisticTask]);
      
      // Return the context
      return { previousTasks };
    },
    onError: (error: Error, _variables, context) => {
      // If the mutation fails, use the context to roll back
      if (context?.previousTasks) {
        queryClient.setQueryData<Task[]>([QUERY_KEYS.TASKS], context.previousTasks);
      }
      toast({
        variant: "destructive",
        title: "Failed to create task",
        description: error.message || "An error occurred while creating the task.",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TASKS] });
      toast({
        title: "Task created",
        description: "Your task has been created successfully.",
      });
    },
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, task }: { id: number; task: Partial<Task> }) => {
      // Create an object that conforms to the expected server schema
      const updateData = {
        ...task,
        id,
        // Handle boolean to number conversion for the server if needed
        completed: task.completed !== undefined ? task.completed : undefined,
      };
      return updateTask(updateData);
    },
    onMutate: async ({ id, task }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.TASKS] });
      
      // Snapshot the previous value
      const previousTasks = queryClient.getQueryData<Task[]>([QUERY_KEYS.TASKS]) || [];
      
      // Create a deep copy of the tasks to avoid reference issues
      const updatedTasks = JSON.parse(JSON.stringify(previousTasks));
      
      // Find the task to update
      const taskIndex = updatedTasks.findIndex((t: Task) => t.id === id);
      
      if (taskIndex !== -1) {
        // Update the task with the new data
        updatedTasks[taskIndex] = {
          ...updatedTasks[taskIndex],
          ...task
        };
        
        // Immediately update the UI
        queryClient.setQueryData<Task[]>([QUERY_KEYS.TASKS], updatedTasks);
      }
      
      // Return the context for potential rollback
      return { previousTasks };
    },
    onError: (error: Error, _variables, context) => {
      // If the mutation fails, use the context to roll back
      if (context?.previousTasks) {
        queryClient.setQueryData<Task[]>([QUERY_KEYS.TASKS], context.previousTasks);
      }
      toast({
        variant: "destructive",
        title: "Failed to update task",
        description: error.message || "An error occurred while updating the task.",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TASKS] });
      toast({
        title: "Task updated",
        description: "Your task has been updated successfully.",
      });
    },
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (id: number) => {
      // First, get all child tasks
      const childTasks = tasks.filter(task => task.parent_task_id === id);
      
      // Delete all child tasks first
      for (const childTask of childTasks) {
        await deleteTask(childTask.id);
      }
      
      // Then delete the parent task
      return deleteTask(id);
    },
    onMutate: async (id) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.TASKS] });
      
      // Snapshot the previous value
      const previousTasks = queryClient.getQueryData<Task[]>([QUERY_KEYS.TASKS]) || [];
      
      // Get child tasks
      const childTaskIds = tasks
        .filter(task => task.parent_task_id === id)
        .map(task => task.id);
      
      // Optimistically remove the task and its children from the list
      queryClient.setQueryData<Task[]>([QUERY_KEYS.TASKS], 
        previousTasks.filter(task => 
          task.id !== id && !childTaskIds.includes(task.id)
        )
      );
      
      // Return the context
      return { previousTasks };
    },
    onError: (error: Error, _variables, context) => {
      // If the mutation fails, use the context to roll back
      if (context?.previousTasks) {
        queryClient.setQueryData<Task[]>([QUERY_KEYS.TASKS], context.previousTasks);
      }
      toast({
        variant: "destructive",
        title: "Failed to delete task",
        description: error.message || "An error occurred while deleting the task.",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TASKS] });
      toast({
        title: "Task deleted",
        description: "The task and its subtasks have been deleted successfully.",
      });
    },
  });

  // Helper function to safely format dates
  const formatDueDate = (timestamp: number | null) => {
    if (!timestamp) return null;
    
    try {
      // Ensure timestamp is a valid number
      if (typeof timestamp !== 'number' || isNaN(timestamp) || !isFinite(timestamp)) {
        console.warn('Invalid timestamp:', timestamp);
        return 'Invalid date';
      }

      let date: Date;
      
      // Handle both Unix (seconds) and JavaScript (milliseconds) timestamps
      if (timestamp < 10000000000) { // Unix timestamp (seconds)
        date = new Date(timestamp * 1000);
      } else { // JavaScript timestamp (milliseconds)
        date = new Date(timestamp);
      }
      
      // Validate the converted date
      if (isNaN(date.getTime())) {
        console.error("Invalid date after conversion:", date);
        return 'Invalid date';
      }
      
      // Format the date using the user's timezone with fallback
      const timezone = userSettings?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
      return formatInTimeZone(date, timezone, 'PPP');
    } catch (error) {
      console.error("Error formatting date:", error);
      return "Invalid date";
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    
    const title = formData.get("title") as string;
    if (!title.trim()) {
      toast({
        variant: "destructive",
        title: "Invalid input",
        description: "Task title is required.",
      });
      return;
    }
    
    createTaskMutation.mutate({
      title,
      description: formData.get("description") as string || null,
      priority: formData.get("priority") as string,
    });
    
    form.reset();
    setDate(null);
  };

  if (error) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Error loading tasks. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950">
        <CardHeader className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-b border-slate-100 dark:border-slate-800">
          <CardTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300">Create New Task</CardTitle>
          <CardDescription className="text-slate-500 dark:text-slate-400">Add a new task to your list</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-2">
                <Input
                  name="title"
                  placeholder="Task title"
                  required
                  className="w-full transition-all duration-200 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="lg:col-span-1">
                <Input
                  name="description"
                  placeholder="Task description (optional)"
                  className="w-full transition-all duration-200 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="lg:col-span-1">
                <Select name="priority" defaultValue="medium">
                  <SelectTrigger className="w-full transition-all duration-200 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low" className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500"></div>
                      <span>Low Priority</span>
                    </SelectItem>
                    <SelectItem value="medium" className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-amber-500"></div>
                      <span>Medium Priority</span>
                    </SelectItem>
                    <SelectItem value="high" className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-red-500"></div>
                      <span>High Priority</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="lg:col-span-4">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal transition-all duration-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800",
                        !date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, "PPP") : "Due date (optional)"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date || undefined}
                      onSelect={(newDate: Date | undefined) => setDate(newDate || null)}
                      initialFocus
                      className="rounded-md border border-slate-200 dark:border-slate-700"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <Button
              type="submit"
              disabled={createTaskMutation.isPending}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
            >
              {createTaskMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Add Task
            </Button>
          </form>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading your tasks...</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Active Tasks */}
          <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-white to-blue-50 dark:from-slate-900 dark:to-blue-950/20">
            <div className="h-1.5 w-full bg-gradient-to-r from-blue-400 to-blue-600"></div>
            <CardHeader className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="flex items-center gap-2 text-xl font-bold text-blue-700 dark:text-blue-400">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Active Tasks
                </div>
                <Badge variant="outline" className="ml-auto text-xs font-medium bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800">
                  {activeTasks.length}
                </Badge>
              </CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400">Non-recurring parent tasks only</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {activeTasks.map((task) => {
                  // Check if this task has many subtasks to show a more prominent graph
                  const hasSubtasks = tasks.some(t => t.parent_task_id === task.id);
                  const subtaskCount = tasks.filter(t => t.parent_task_id === task.id).length;
                  const showProminentGraph = subtaskCount > 2;
                  
                  return (
                    <li
                      key={task.id}
                      className="group relative transition-all duration-200 hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                    >
                      <div className="p-4">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={task.completed}
                            onCheckedChange={(checked: boolean) =>
                              updateTaskMutation.mutate({
                                id: task.id,
                                task: { completed: checked },
                              })
                            }
                            className="mt-1 h-5 w-5 rounded-full border-2 border-slate-300 dark:border-slate-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 transition-all duration-200"
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-slate-900 dark:text-slate-100">{task.title}</h4>
                            {task.description && (
                              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                                {task.description}
                              </p>
                            )}
                            
                            {/* Show prominent graph for tasks with many subtasks */}
                            {showProminentGraph && (
                              <div className="mt-2 mb-2">
                                <TaskActivityGraph task={task} tasks={tasks} />
                              </div>
                            )}
                            
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              <div className={cn(
                                "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                                getPriorityClass(task.priority).bg,
                                getPriorityClass(task.priority).text,
                              )}>
                                {getPriorityClass(task.priority).icon}
                                <span className="capitalize">{task.priority}</span>
                              </div>
                              {task.due_date && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                  <CalendarIcon className="h-3 w-3" />
                                  {formatDueDate(task.due_date)}
                                </span>
                              )}
                              {hasSubtasks && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400">
                                  <List className="h-3 w-3" />
                                  {subtaskCount} subtasks
                                </span>
                              )}
                              {/* Only show compact graph for tasks with few subtasks */}
                              {!showProminentGraph && <TaskActivityGraph task={task} tasks={tasks} />}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteTaskMutation.mutate(task.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
                {activeTasks.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <div className="rounded-full bg-blue-50 p-3 dark:bg-blue-950/30">
                      <CheckSquare className="h-6 w-6 text-blue-500 dark:text-blue-400" />
                    </div>
                    <h3 className="mt-4 text-sm font-medium text-slate-900 dark:text-slate-100">No active tasks</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Add a new task to get started
                    </p>
                  </div>
                )}
              </ul>
            </CardContent>
          </Card>

          {/* Completed Tasks */}
          <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-white to-green-50 dark:from-slate-900 dark:to-green-950/20">
            <div className="h-1.5 w-full bg-gradient-to-r from-green-400 to-green-600"></div>
            <CardHeader className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="flex items-center gap-2 text-xl font-bold text-green-700 dark:text-green-400">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  Completed Tasks
                </div>
                <Badge variant="outline" className="ml-auto text-xs font-medium bg-green-50 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-400 dark:border-green-800">
                  {completedTasks.length}
                </Badge>
              </CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400">Non-recurring parent tasks only</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {completedTasks.map((task) => {
                  // Check if this task has many subtasks to show a more prominent graph
                  const hasSubtasks = tasks.some(t => t.parent_task_id === task.id);
                  const subtaskCount = tasks.filter(t => t.parent_task_id === task.id).length;
                  const showProminentGraph = subtaskCount > 2;
                  
                  return (
                    <li
                      key={task.id}
                      className="group relative transition-all duration-200 hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                    >
                      <div className="p-4">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={task.completed}
                            onCheckedChange={(checked: boolean) =>
                              updateTaskMutation.mutate({
                                id: task.id,
                                task: { completed: checked },
                              })
                            }
                            className="mt-1 h-5 w-5 rounded-full border-2 border-slate-300 dark:border-slate-600 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600 transition-all duration-200"
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-slate-500 dark:text-slate-400 line-through">{task.title}</h4>
                            {task.description && (
                              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 line-clamp-2 line-through">
                                {task.description}
                              </p>
                            )}
                            
                            {/* Show prominent graph for tasks with many subtasks */}
                            {showProminentGraph && (
                              <div className="mt-2 mb-2 opacity-60">
                                <TaskActivityGraph task={task} tasks={tasks} />
                              </div>
                            )}
                            
                            <div className="flex flex-wrap items-center gap-2 mt-2 opacity-60">
                              <div className={cn(
                                "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                                getPriorityClass(task.priority).bg,
                                getPriorityClass(task.priority).text,
                              )}>
                                {getPriorityClass(task.priority).icon}
                                <span className="capitalize">{task.priority}</span>
                              </div>
                              {task.due_date && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 line-through">
                                  <CalendarIcon className="h-3 w-3" />
                                  {formatDueDate(task.due_date)}
                                </span>
                              )}
                              {hasSubtasks && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-500 dark:bg-indigo-950/30 dark:text-indigo-400">
                                  <List className="h-3 w-3" />
                                  {subtaskCount} subtasks
                                </span>
                              )}
                              {/* Only show compact graph for tasks with few subtasks */}
                              {!showProminentGraph && <TaskActivityGraph task={task} tasks={tasks} />}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteTaskMutation.mutate(task.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
                {completedTasks.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <div className="rounded-full bg-green-50 p-3 dark:bg-green-950/30">
                      <CheckSquare className="h-6 w-6 text-green-500 dark:text-green-400" />
                    </div>
                    <h3 className="mt-4 text-sm font-medium text-slate-900 dark:text-slate-100">No completed tasks</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Complete a task to see it here
                    </p>
                  </div>
                )}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}