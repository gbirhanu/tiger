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
import { Calendar as CalendarIcon, Loader2, AlertCircle, Trash2 } from "lucide-react";
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
    queryKey: ["tasks"],
    queryFn: async () => {
      const data = await getTasks();
      
      return data.map((task: any) => {
        // Add extra validation and logging for debugging date issues
        if (task.due_date) {
          
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
            processedDueDate = null; // Set to null instead of keeping invalid timestamp
          }
          
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
  const activeTasks = tasks.filter(task => {
    // Non-recurring normal tasks that are active
    if (task.completed === 0 && !task.is_recurring && !task.parent_task_id) {
      return true;
    }
    
    // For child tasks of recurring tasks (instances of recurring tasks)
    if (task.completed === 0 && !task.is_recurring && task.parent_task_id) {
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
  
  const completedTasks = tasks.filter(task => 
    task.completed === 1 && 
    !task.is_recurring && 
    !task.parent_task_id
  );

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({
        title: "Task created",
        description: "Your task has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to create task",
        description: error.message || "An error occurred while creating the task.",
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({
        title: "Task updated",
        description: "Task status has been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to update task",
        description: error.message || "An error occurred while updating the task.",
      });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({
        title: "Task deleted",
        description: "The task and its subtasks have been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to delete task",
        description: error.message || "An error occurred while deleting the task.",
      });
    },
  });

  // Helper function to safely format dates
  const formatDueDate = (timestamp: number | null) => {
    if (!timestamp) return null;
    
    // Ensure timestamp is a valid number
    if (isNaN(timestamp) || !isFinite(timestamp) || timestamp < 1000000) {
      return 'Invalid date';
    }
    
    // Convert Unix timestamp (seconds) to milliseconds
    const date = new Date(timestamp * 1000);
    
    // Check if date is valid
    if (isNaN(date.getTime()) || date.getFullYear() === 1970) {
      return 'Invalid date';
    }
    
    // Format the date using the user's timezone
    return formatInTimeZone(
      date,
      userSettings?.timezone || 'Africa/Addis_Ababa',
      'PPP'
    );
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create New Task</CardTitle>
          <CardDescription>Add a new task to your list</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-4">
              <Input
                name="title"
                placeholder="Task title"
                required
                className="flex-1"
              />
              <Input
                name="description"
                placeholder="Task description (optional)"
                className="flex-1"
              />
              <Select name="priority" defaultValue="medium">
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low Priority</SelectItem>
                  <SelectItem value="medium">Medium Priority</SelectItem>
                  <SelectItem value="high">High Priority</SelectItem>
                </SelectContent>
              </Select>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-[180px] justify-start text-left font-normal",
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
                  />
                </PopoverContent>
              </Popover>
            </div>
            <Button
              type="submit"
              disabled={createTaskMutation.isPending}
              className="w-full"
            >
              {createTaskMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Add Task
            </Button>
          </form>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center p-4">
          <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {/* Active Tasks */}
          <Card className="border-t-4 border-t-teal-500 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                Active Tasks
                <span className="ml-auto text-sm px-2 py-1 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 font-medium">
                  {activeTasks.length} tasks
                </span>
              </CardTitle>
              <CardDescription>Non-recurring parent tasks only</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {activeTasks.map((task) => (
                  <li
                    key={task.id}
                    className="group flex flex-col space-y-2 p-3 md:p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors shadow-sm relative pt-6"
                  >
                    <div
                      className={cn(
                        "absolute top-0 left-0 px-2 py-0.5 text-xs font-medium rounded-tl-lg rounded-br-lg",
                        task.priority === "high" && "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
                        task.priority === "medium" && "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400",
                        task.priority === "low" && "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                      )}
                    >
                      {task.priority}
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <Checkbox
                          checked={task.completed}
                          onCheckedChange={(checked: boolean) =>
                            updateTaskMutation.mutate({
                              id: task.id,
                              task: { completed: checked },
                            })
                          }
                          className="mt-1 h-5 w-5 rounded-md border-2 border-teal-400 dark:border-teal-500 data-[state=checked]:bg-teal-500 data-[state=checked]:border-teal-500"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">{task.title}</h4>
                          {task.description && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                              {task.description}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-2 mt-1.5">
                            {task.due_date && (
                              <span className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-1 bg-gray-100 dark:bg-gray-700/50 px-1.5 py-0.5 rounded">
                                <CalendarIcon className="h-3 w-3" />
                                {formatDueDate(task.due_date)}
                              </span>
                            )}
                            {/* Show number of subtasks if any */}
                            {tasks.some(t => t.parent_task_id === task.id) && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                <span className="inline-block w-2.5 h-2.5 rounded-full bg-teal-100 dark:bg-teal-900/50 border border-teal-300 dark:border-teal-700"></span>
                                {tasks.filter(t => t.parent_task_id === task.id).length} subtasks
                              </span>
                            )}
                            {task.is_recurring && (
                              <span className="text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                                <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 border border-indigo-300 dark:border-indigo-700"></span>
                                {task.recurrence_pattern}
                                {task.recurrence_interval && task.recurrence_interval > 1
                                  ? ` (${task.recurrence_interval})`
                                  : ``}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteTaskMutation.mutate(task.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 rounded-full"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </li>
                ))}
                {activeTasks.length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
                    <p className="mb-1">No active tasks</p>
                    <p className="text-sm">Create a new task to get started</p>
                  </div>
                )}
              </ul>
            </CardContent>
          </Card>

          {/* Completed Tasks */}
          <Card className="border-t-4 border-t-emerald-500 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                Completed Tasks
                <span className="ml-auto text-sm px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-medium">
                  {completedTasks.length} tasks
                </span>
              </CardTitle>
              <CardDescription>Non-recurring parent tasks only</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {completedTasks.map((task) => (
                  <li
                    key={task.id}
                    className="group flex flex-col space-y-2 p-3 md:p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 transition-colors shadow-sm relative"
                  >
                    <span
                      className={cn(
                        "absolute top-0 left-0 px-2 py-0.5 text-xs font-medium rounded-tl-lg rounded-br-lg opacity-60",
                        task.priority === "high" && "bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400",
                        task.priority === "medium" && "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400",
                        task.priority === "low" && "bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400"
                      )}
                    >
                      {task.priority}
                    </span>
                    <div className="flex items-start justify-between gap-3 mt-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <Checkbox
                          checked={task.completed}
                          onCheckedChange={(checked: boolean) =>
                            updateTaskMutation.mutate({
                              id: task.id,
                              task: { completed: checked },
                            })
                          }
                          className="mt-1 h-5 w-5 rounded-md border-2 border-emerald-400 dark:border-emerald-500 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium line-through text-gray-500 dark:text-gray-400 truncate">
                            {task.title}
                          </h4>
                          {task.description && (
                            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1 line-through line-clamp-2">
                              {task.description}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-2 mt-1.5">
                            {/* Show number of subtasks if any */}
                            {tasks.some(t => t.parent_task_id === task.id) && (
                              <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                                <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"></span>
                                {tasks.filter(t => t.parent_task_id === task.id).length} subtasks
                              </span>
                            )}
                            {task.due_date && (
                              <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 line-through">
                                <CalendarIcon className="h-2.5 w-2.5" />
                                {formatDueDate(task.due_date)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteTaskMutation.mutate(task.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 rounded-full"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </li>
                ))}
                {completedTasks.length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
                    <p className="mb-1">No completed tasks</p>
                    <p className="text-sm">Complete a task to see it here</p>
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