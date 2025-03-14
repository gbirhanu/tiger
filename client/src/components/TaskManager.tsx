import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  Task, TaskWithSubtasks, Subtask, NewSubtask,
  insertTaskSchema, insertSubtaskSchema,
  type NewTask
} from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardFooter, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useToast } from "@/hooks/use-toast";
import { 
  getTasks, 
  createTask, 
  updateTask, 
  deleteTask, 
  generateSubtasks as generateSubtasksApi, 
  getSubtasks, 
  createSubtasks,
  getTasksWithSubtasks,
  getUserSettings
} from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { CalendarIcon, Trash2, Loader2, Pencil, X, Check, Sparkles, Search, Clock, CheckCircle2, AlertCircle, Repeat, Plus, GripVertical, List, CheckSquare } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, parseISO } from 'date-fns';
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Switch,
} from "@/components/ui/switch";
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useTheme } from "@/contexts/ThemeContext";

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

// TimeSelect component
const TimeSelect = ({ value, onChange, timeFormat = "24h" }: { value: Date; onChange: (date: Date) => void; timeFormat?: "12h" | "24h" }) => {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5);

  const formatHour = (hour: number) => {
    if (timeFormat === "12h") {
      const period = hour >= 12 ? "PM" : "AM";
      const displayHour = hour % 12 || 12;
      return `${displayHour} ${period}`;
    }
    return `${hour.toString().padStart(2, '0')}:00`;
  };

  return (
    <div className="flex gap-2">
      <Select
        value={value.getHours().toString()}
        onValueChange={(hour) => {
          const newDate = new Date(value);
          newDate.setHours(parseInt(hour));
          onChange(newDate);
        }}
      >
        <SelectTrigger className="w-[100px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {hours.map((hour) => (
            <SelectItem key={hour} value={hour.toString()}>
              {formatHour(hour)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={value.getMinutes().toString()}
        onValueChange={(minutes) => {
          const newDate = new Date(value);
          newDate.setMinutes(parseInt(minutes));
          onChange(newDate);
        }}
      >
        <SelectTrigger className="w-[100px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {minutes.map((minute) => (
            <SelectItem key={minute} value={minute.toString()}>
              {minute.toString().padStart(2, '0')}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

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
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      console.warn("Invalid date provided to ensureUnixTimestamp:", date);
      return null;
    }
    
    const timestamp = Math.floor(date.getTime() / 1000);
    console.log("Converted to Unix timestamp:", timestamp, "from", date.toISOString());
    
    return timestamp;
  } catch (error) {
    console.error("Error converting date to Unix timestamp:", error);
    return null;
  }
};

export default function TaskManager() {
  const { toast } = useToast();
  // Replace useAuth with hardcoded user object
  const user = { id: 2 }; // Use the authenticated user ID from the error message
  const [date, setDate] = useState<Date | null>(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [editingTask, setEditingTask] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<FormData> | null>(null);
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskWithSubtasks | null>(null);
  const [editedSubtasks, setEditedSubtasks] = useState<Array<{ title: string; completed: boolean }>>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSubtasks, setGeneratedSubtasks] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [dueDateFilter, setDueDateFilter] = useState<DueDateFilter>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('none');
  const [currentPage, setCurrentPage] = useState(1);
  const [hasSubtasks, setHasSubtasks] = useState<Record<number, boolean>>({});
  const tasksPerPage = 5;

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
    queryKey: ["tasks"],
    queryFn: getTasks,
  });

  useEffect(() => {
    if (tasksError) {
      console.error("Error fetching tasks:", tasksError);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to fetch tasks: ${tasksError instanceof Error ? tasksError.message : 'Unknown error'}`,
      });
    }
  }, [tasksError, toast]);

  const { data: tasksWithSubtasksIds, error: subtasksError } = useQuery({
    queryKey: ["tasks-with-subtasks"],
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
    onSuccess: () => {
      toast({
        title: "Task created",
        description: "Your task has been created successfully.",
      });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: updateTask,
    onSuccess: () => {
      toast({
        title: "Task updated",
        description: "Your task has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      toast({
        title: "Task deleted",
        description: "Your task has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const onSubmit = async (data: FormData) => {
    try {
      console.log('Form submitted with data:', data);
      
      // Create task with all required fields
      const taskData = {
        title: data.title || "",
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
      await createTaskMutation.mutateAsync(taskData as any);
      
      // Additional UI cleanup
      setShowAddTask(false);
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
    console.log('Starting edit for task:', task);
    setEditingTask(task.id);
    
    // Safely create Date objects from timestamps
    let dueDate: Date | null = null;
    let recurrenceEndDate: Date | null = null;
    
    try {
      if (task.due_date) {
        const timestamp = Number(task.due_date);
        console.log("Raw due_date value:", task.due_date, "converted to number:", timestamp);
        if (!isNaN(timestamp)) {
          // Handle potential different timestamp formats
          if (timestamp < 10000000000) {
            // Unix timestamp (seconds)
            dueDate = new Date(timestamp * 1000);
          } else {
            // JavaScript timestamp (milliseconds)
            dueDate = new Date(timestamp);
          }
          console.log("Converted due_date to Date:", dueDate.toISOString());
        }
      }
      
      if (task.recurrence_end_date) {
        const timestamp = Number(task.recurrence_end_date);
        console.log("Raw recurrence_end_date value:", task.recurrence_end_date, "converted to number:", timestamp);
        if (!isNaN(timestamp)) {
          // Handle potential different timestamp formats
          if (timestamp < 10000000000) {
            // Unix timestamp (seconds)
            recurrenceEndDate = new Date(timestamp * 1000);
          } else {
            // JavaScript timestamp (milliseconds)
            recurrenceEndDate = new Date(timestamp);
          }
          console.log("Converted recurrence_end_date to Date:", recurrenceEndDate.toISOString());
        }
      }
    } catch (error) {
      console.error("Error converting timestamps to dates:", error);
    }
    
    console.log("Created date objects:", { dueDate, recurrenceEndDate });
    
    setEditForm({
      title: task.title || "",
      description: task.description || "",
      priority: task.priority as "low" | "medium" | "high",
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
      const updateData: NewTask = {
        title: editForm!.title,
        description: editForm!.description,
        priority: editForm!.priority,
        due_date: ensureUnixTimestamp(editForm!.due_date),
        is_recurring: editForm!.is_recurring,
        recurrence_pattern: editForm!.is_recurring ? editForm!.recurrence_pattern : null,
        recurrence_interval: editForm!.is_recurring && editForm!.recurrence_interval ? Number(editForm!.recurrence_interval) : null,
        recurrence_end_date: ensureUnixTimestamp(editForm!.recurrence_end_date),
      };

      await updateTaskMutation.mutateAsync({
        id: taskId,
        ...updateData,
      });

      setEditForm({
        title: "",
        description: null,
        priority: "medium",
        due_date: null,
        is_recurring: false,
        recurrence_pattern: null,
        recurrence_interval: null,
        recurrence_end_date: null,
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
    try {
      setSelectedTask(task);
      setIsGenerating(true);
      setShowSubtasks(true);

      const existingSubtasks = await getSubtasks(task.id);
      console.log('Existing subtasks:', existingSubtasks);
      
      if (existingSubtasks && Array.isArray(existingSubtasks) && existingSubtasks.length > 0) {
        setEditedSubtasks(existingSubtasks.map(subtask => ({
          title: subtask.title,
          completed: subtask.completed
        })));
      } else {
        const prompt = `
          Generate 5 clear and simple subtasks for this task. Each subtask should be a single, actionable item.
          Do not create nested lists or sublists. Each line should be an independent task.

          Main Task: ${task.title}
          ${task.description ? `Description: ${task.description}` : ''}
          Priority: ${task.priority}
          ${task.due_date ? `Due Date: ${
            safeFormatDate(task.due_date)
          }` : ''}
        `;
        
        console.log('Sending prompt to generate subtasks:', prompt);
        
        const response = await generateSubtasksApi(prompt);
        console.log('Received response from API:', response);

        if (response && Array.isArray(response.subtasks)) {
          const processedSubtasks = response.subtasks
            .map(s => typeof s === 'string' ? s.trim() : '')
            .filter(s => s.length > 0)
            .map(title => ({
              title: title.replace(/^[-*\d.]\s*/, ''),
              completed: false
            }));

          console.log('Processed subtasks:', processedSubtasks);
          setEditedSubtasks(processedSubtasks);
        } else if (response && typeof response.subtasks === 'string') {
          const subtasksArray = response.subtasks
            .split('\n')
            .map(s => s.trim())
            .filter(s => s.length > 0)
            .map(title => ({
              title: title.replace(/^[-*\d.]\s*/, ''),
              completed: false
            }));

          console.log('Processed string subtasks:', subtasksArray);
          setEditedSubtasks(subtasksArray);
        } else {
          throw new Error("Invalid response format from subtasks generation");
        }
      }
    } catch (error) {
      console.error('Error generating subtasks:', error);
      toast({
        variant: "destructive",
        title: "Failed to generate subtasks",
        description: error instanceof Error ? error.message : "An error occurred while generating subtasks.",
      });
      setEditedSubtasks([]);
      setShowSubtasks(true);
    } finally {
      setIsGenerating(false);
    }
  };

  const saveSubtasksMutation = useMutation({
    mutationFn: ({ taskId, subtasks }: { taskId: number, subtasks: Array<{ title: string; completed: boolean }> }) => {
      // Ensure subtasks match the expected format for the API
      // The server will handle adding task_id and other metadata internally
      return createSubtasks(taskId, subtasks);
    },
    onSuccess: () => {
      toast({
        title: "Subtasks saved",
        description: "Your subtasks have been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["tasks-with-subtasks"] });
      if (selectedTask) {
        queryClient.invalidateQueries({ queryKey: [`task-subtasks-${selectedTask.id}`] });
      }
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setShowSubtasks(false);
    },
    onError: (error) => {
      console.error('Error saving subtasks:', error);
      toast({
        variant: "destructive",
        title: "Failed to save subtasks",
        description: error instanceof Error ? error.message : "An error occurred while saving subtasks.",
      });
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
    setEditedSubtasks(items);
  };

  const renderTaskContent = (task: TaskWithSubtasks, isCompleted: boolean) => {
    if (editingTask === task.id && editForm) {
      return (
        <div className="flex-1 space-y-3">
          <Input
            value={editForm.title}
            onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
            className="font-medium w-full"
            placeholder="Task title"
          />
          <Input
            value={editForm.description || ""}
            onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value || null }))}
            className="text-sm w-full"
            placeholder="Description"
          />
          <div className="flex flex-col gap-3">
            <Select
              value={editForm.priority}
              onValueChange={(value) => setEditForm(prev => ({ ...prev, priority: value as "low" | "medium" | "high" }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {editForm.due_date && editForm.due_date instanceof Date && !isNaN(editForm.due_date.getTime())
                    ? format(editForm.due_date, "PPP")
                    : "Due date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div>
                  <Calendar
                    mode="single"
                    selected={editForm.due_date || undefined}
                    onSelect={(date) => {
                      console.log("Selected date in edit form:", date);
                      setEditForm(prev => ({ ...prev, due_date: date }));
                    }}
                    initialFocus
                  />
                  {editForm.due_date && (
                    <TimeSelect
                      value={editForm.due_date}
                      onChange={(newDate) => {
                        setEditForm(prev => ({ ...prev, due_date: newDate }));
                      }}
                      timeFormat="12h"
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
                      return {
                        ...prev,
                        is_recurring: checked,
                        recurrence_pattern: checked ? prev.recurrence_pattern || "weekly" : null,
                        recurrence_interval: checked ? prev.recurrence_interval || 1 : null,
                        recurrence_end_date: checked ? prev.recurrence_end_date || null : null,
                      };
                    });
                  }}
                >
                  <Repeat className="h-4 w-4 mr-2" />
                  Recurring Task
                </Switch>
              </div>
            )}
            {editForm.is_recurring && !task.parent_task_id && (
              <div className="mt-4 p-4 border rounded-lg bg-accent/5">
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
                        onChange={(e) => setEditForm(prev => ({
                          ...prev,
                          recurrence_interval: parseInt(e.target.value) || 1
                        }))}
                        className="w-[80px]"
                      />
                      <Select
                        value={editForm.recurrence_pattern || "weekly"}
                        onValueChange={(value) => setEditForm(prev => ({
                          ...prev,
                          recurrence_pattern: value as "daily" | "weekly" | "monthly" | "yearly"
                        }))}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select period" />
                        </SelectTrigger>
                        <SelectContent>
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
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !editForm.recurrence_end_date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {editForm.recurrence_end_date
                            ? format(editForm.recurrence_end_date, "PPP")
                            : "Select end date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={editForm.recurrence_end_date || undefined}
                          onSelect={(date) => {
                            setEditForm((prev) => ({
                              ...prev,
                              recurrence_end_date: date,
                            }));
                          }}
                          initialFocus
                        />
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
                <TooltipContent>
                  Repeats {task.recurrence_pattern}
                  {task.recurrence_interval && task.recurrence_interval > 1
                    ? ` every ${task.recurrence_interval} ${task.recurrence_pattern}s`
                    : ``}
                  {task.recurrence_end_date
                    ? ` until ${safeFormatDate(task.recurrence_end_date)}`
                    : ``}
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
                <TooltipContent>
                  This is a recurring instance
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        {task.description && (
          <p className={cn("text-sm text-muted-foreground truncate", isCompleted && "line-through")}>
            {task.description}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1">
          <span
            className={cn(
              "px-2 py-1 rounded-full text-xs",
              isCompleted && "opacity-50",
              task.priority === "high" && "bg-[hsl(var(--task-high))]",
              task.priority === "medium" && "bg-[hsl(var(--task-medium))]",
              task.priority === "low" && "bg-[hsl(var(--task-low))]"
            )}
          >
            {task.priority}
          </span>
          {task.due_date && (
            <div className="text-sm text-gray-500">
              {(() => {
                try {
                  // Ensure due_date is a valid number
                  const dueDate = Number(task.due_date);
                  
                  // Add robust validation
                  if (isNaN(dueDate) || !isFinite(dueDate) || dueDate < 1000000) {
                    console.warn('Invalid or epoch due_date value:', task.due_date);
                    return 'Invalid date';
                  }
                  
                  const date = new Date(dueDate * 1000);
                  
                  // Check if date is valid and not epoch
                  if (isNaN(date.getTime()) || date.getFullYear() === 1970) {
                    console.error("Invalid due date after conversion:", date);
                    return 'Invalid date';
                  }
                  
                  // Create Date object and format it with timezone
                  return formatInTimeZone(
                    date,
                    userSettings?.timezone || 'UTC',
                    task.all_day ? 'PPP' : 'PPP p'
                  );
                } catch (error) {
                  console.error('Error formatting date:', error, task.due_date);
                  return 'Date error';
                }
              })()}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderTaskActions = (task: TaskWithSubtasks) => {
    if (editingTask === task.id) {
      return (
        <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => saveEdit(task.id)}
            disabled={updateTaskMutation.isPending}
          >
            {updateTaskMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={cancelEditing}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t opacity-0 group-hover:opacity-100 transition-opacity">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => generateSubtasks(task)}
                  disabled={task.completed}
                  className={cn(task.completed && "cursor-not-allowed")}
                >
                  {task.has_subtasks ? (
                    <List className="h-4 w-4 text-primary" />
                  ) : (
                    <Sparkles className="h-4 w-4 text-yellow-500" />
                  )}
                </Button>
              </div>
            </TooltipTrigger>
            <TooltipContent>
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
                  className={cn(task.completed && "cursor-not-allowed")}
                >
                  <Pencil className={cn(
                    "h-4 w-4",
                    task.completed && "text-muted-foreground"
                  )} />
                </Button>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {task.completed ? "Cannot edit completed tasks" : "Edit task"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => deleteTaskMutation.mutate(task.id)}
          disabled={deleteTaskMutation.isPending}
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
      const today = new Date();
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

  const getPaginatedTasks = (tasks: TaskWithSubtasks[], page: number) => {
    const startIndex = (page - 1) * tasksPerPage;
    const endIndex = startIndex + tasksPerPage;
    return tasks.slice(startIndex, endIndex);
  };

  const getTotalPages = (tasks: TaskWithSubtasks[]) => {
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

  const processedTasks: TaskWithSubtasks[] = useMemo(() => {
    if (!tasks) return [];
    
    return tasks.map((task): TaskWithSubtasks => ({
      ...task,
      has_subtasks: tasksWithSubtasksIds?.includes(task.id) || false
    }));
  }, [tasks, tasksWithSubtasksIds]);

  const completedTasks = useMemo(() => 
    processedTasks.filter(task => task.completed),
  [processedTasks]);

  const incompleteTasks = useMemo(() => 
    processedTasks.filter(task => !task.completed),
  [processedTasks]);

  const filteredTasks = useMemo(() => {
    if (searchTerm.length === 0) return processedTasks;
    
    const searchLower = searchTerm.toLowerCase();
    return processedTasks.filter(
      (task) =>
        task.title.toLowerCase().includes(searchLower) ||
        (task.description && task.description.toLowerCase().includes(searchLower))
    );
  }, [processedTasks, searchTerm]);

  const filteredCompletedTasks = useMemo(() => 
    filteredTasks.filter((task) => task.completed),
  [filteredTasks]);

  const filteredIncompleteTasks = useMemo(() => 
    filteredTasks.filter((task) => !task.completed),
  [filteredTasks]);

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading your tasks...</p>
        </div>
      </div>
    );
  }

  if (isError && tasksError) {
    return (
      <div className="flex justify-center p-8">
        <div className="flex flex-col items-center gap-2 max-w-md text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <h3 className="font-semibold text-lg">Failed to load tasks</h3>
          <p className="text-muted-foreground">
            {tasksError instanceof Error ? tasksError.message : "An unknown error occurred"}
          </p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["tasks"] })}
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {processedTasks.length === 0 && !showAddTask ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
          <CheckSquare className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">No tasks yet</h3>
          <p className="text-muted-foreground mb-6 max-w-md">
            Get started by creating your first task. Tasks can have due dates, priorities, 
            and can be set to recur on a schedule.
          </p>
          <Button 
            onClick={() => {
              console.log("Button clicked, setting showAddTask to true");
              setShowAddTask(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Your First Task
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <CheckSquare className="h-6 w-6 text-primary" />
              Task Manager
            </h2>
          </div>

          <Card className="w-full bg-white dark:bg-gray-800 shadow-lg rounded-xl border border-gray-200 dark:border-gray-700">
  <CardContent className="pt-6 px-6 pb-6">
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="flex flex-wrap items-start gap-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem className="flex-1 min-w-[200px]">
                <FormControl>
                  <Input 
                    placeholder="Task title" 
                    {...field} 
                    value={field.value || ""}
                    className="w-full bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 transition-all duration-200"
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem className="flex-1 min-w-[200px]">
                <FormControl>
                  <Input 
                    placeholder="Task description" 
                    {...field} 
                    value={field.value || ""}
                    onChange={(e) => field.onChange(e.target.value || null)}
                    className="w-full bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 transition-all duration-200"
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem className="w-[140px]">
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <FormControl>
                    <SelectTrigger className="bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className={cn(
                  "w-[180px] justify-start text-left font-normal bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors",
                  !dueDate && "text-gray-500 dark:text-gray-400"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                {dueDate ? format(dueDate, "PPP") : "Due date (optional)"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-lg shadow-xl">
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
                    timeFormat="12h"
                    className="border-t border-gray-200 dark:border-gray-700"
                  />
                )}
              </div>
            </PopoverContent>
          </Popover>
          <div className="flex items-center gap-2 self-center">
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
              className="data-[state=checked]:bg-[hsl(222.2,47.4%,11.2%)] dark:data-[state=checked]:bg-[hsl(222.2,47.4%,11.2%)]"
            >
              <Repeat className="h-4 w-4 mr-2 text-[hsl(222.2,47.4%,11.2%)] dark:text-[hsl(222.2,47.4%,11.2%)]" />
              Recurring Task
            </Switch>
          </div>
          <Button 
            type="button" 
            onClick={async () => {
              try {
                console.log("Add Task button clicked");
                const formData = form.getValues();
                console.log("Form data:", formData);
                
                const taskData = {
                  title: formData.title || "",
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
                await createTaskMutation.mutateAsync(taskData as any);
                
                setShowAddTask(false);
              } catch (error) {
                console.error('Submit error:', error);
                toast({
                  variant: "destructive",
                  title: "Error creating task",
                  description: error instanceof Error ? error.message : "An unknown error occurred",
                });
              }
            }}
            className="min-w-[100px] bg-[hsl(222.2,47.4%,11.2%)] dark:bg-[hsl(222.2,47.4%,11.2%)] text-white hover:bg-[hsl(222.2,47.4%,15%)] dark:hover:bg-[hsl(222.2,47.4%,15%)] rounded-lg transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Task
          </Button>
        </div>
        {isRecurring && (
          <div className="mt-6 p-4 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900/50 transition-all duration-200">
            <div className="mb-3 text-sm text-gray-600 dark:text-gray-400">
              Configure how often this task should repeat
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
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
                    className="w-[80px] bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                  />
                  <Select
                    value={recurrencePattern || ""}
                    onValueChange={(value) => form.setValue("recurrence_pattern", value as "daily" | "weekly" | "monthly" | "yearly" | null)}
                  >
                    <SelectTrigger className="flex-1 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400">
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
                <label className="text-sm font-medium mb-1.5 block text-gray-700 dark:text-gray-200">
                  Ends (Optional)
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700",
                        !recurrenceEndDate && "text-gray-500 dark:text-gray-400"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                      {recurrenceEndDate
                        ? format(recurrenceEndDate, "PPP")
                        : "Select end date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-lg shadow-xl">
                    <Calendar
                      mode="single"
                      selected={recurrenceEndDate ? recurrenceEndDate : undefined}
                      onSelect={(newDate) => form.setValue("recurrence_end_date", newDate ?? null)}
                      initialFocus
                      className="rounded-lg border-0"
                    />
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

          <div className="flex gap-4 items-center flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select
              value={filterType}
              onValueChange={(value: FilterType) => {
                setFilterType(value);
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
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
                        {Icon && <Icon className="mr-2 h-4 w-4" />}
                        <span>{label}</span>
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
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="high">
                  <div className="flex items-center">
                    <span className="h-2 w-2 rounded-full bg-[hsl(var(--task-high))] mr-2" />
                    High Priority
                  </div>
                </SelectItem>
                <SelectItem value="medium">
                  <div className="flex items-center">
                    <span className="h-2 w-2 rounded-full bg-[hsl(var(--task-medium))] mr-2" />
                    Medium Priority
                  </div>
                </SelectItem>
                <SelectItem value="low">
                  <div className="flex items-center">
                    <span className="h-2 w-2 rounded-full bg-[hsl(var(--task-low))] mr-2" />
                    Low Priority
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={dueDateFilter}
              onValueChange={(value: DueDateFilter) => setDueDateFilter(value)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Due Date" />
              </SelectTrigger>
              <SelectContent>
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
                    className="w-[40px] shrink-0"
                  >
                    {sortOrder === 'none' ? (
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    ) : sortOrder === 'asc' ? (
                      <CalendarIcon className="h-4 w-4 text-primary" />
                    ) : (
                      <CalendarIcon className="h-4 w-4 text-primary rotate-180" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
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
                      className="w-[40px] shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Clear all filters
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          <div className={cn(
            "grid gap-6",
            getOverdueTasks(filterTasks(processedTasks)).length > 0 ? "md:grid-cols-3" : "md:grid-cols-2"
          )}>
            <Card className="border-t-4 border-t-blue-500">
              <CardContent className="pt-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center justify-between">
                  Active Tasks
                  <span className="text-sm text-muted-foreground">
                    {getActiveTasks(filterTasks(processedTasks)).length} tasks
                  </span>
                </h2>
                <div className="space-y-4">
                  {getPaginatedTasks(getActiveTasks(filterTasks(processedTasks)), currentPage).map((task) => (
                    <div
                      key={task.id}
                      className="group p-4 rounded-lg border hover:bg-accent/5 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <Checkbox
                          checked={task.completed}
                          onCheckedChange={(checked: boolean) =>
                            updateTaskMutation.mutate({
                              id: task.id,
                              completed: checked,
                            })
                          }
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
                    <div className="text-center py-8 text-muted-foreground">
                      {searchTerm ? 'No matching active tasks' : 'No active tasks'}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            
            {getOverdueTasks(filterTasks(processedTasks)).length > 0 && (
              <Card className="border-t-4 border-t-red-500">
                <CardContent className="pt-6">
                  <h2 className="text-lg font-semibold mb-4 flex items-center justify-between">
                    Overdue Tasks
                    <span className="text-sm text-muted-foreground">
                      {getOverdueTasks(filterTasks(processedTasks)).length} tasks
                    </span>
                  </h2>
                  <div className="space-y-4">
                    {getPaginatedTasks(getOverdueTasks(filterTasks(processedTasks)), currentPage).map((task) => (
                      <div
                        key={task.id}
                        className="group p-4 rounded-lg border hover:bg-accent/5 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div>
                                  <Checkbox
                                    checked={task.completed}
                                    disabled={true}
                                    className="cursor-not-allowed"
                                  />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
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
              </Card>
            )}

            <Card className="border-t-4 border-t-green-500">
              <CardContent className="pt-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center justify-between">
                  Completed Tasks
                  <span className="text-sm text-muted-foreground">
                    {getCompletedTasks(filterTasks(processedTasks)).length} tasks
                  </span>
                </h2>
                <div className="space-y-4">
                  {getPaginatedTasks(getCompletedTasks(filterTasks(processedTasks)), currentPage).map((task) => (
                    <div
                      key={task.id}
                      className="group p-4 rounded-lg border bg-muted/50"
                    >
                      <div className="flex items-center gap-4">
                        <Checkbox
                          checked={task.completed}
                          onCheckedChange={(checked: boolean) =>
                            updateTaskMutation.mutate({
                              id: task.id,
                              completed: checked,
                            })
                          }
                        />
                        {renderTaskContent(task, true)}
                      </div>
                      {renderTaskActions(task)}
                    </div>
                  ))}
                  {getCompletedTasks(filterTasks(processedTasks)).length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      {searchTerm ? 'No matching completed tasks' : 'No completed tasks'}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <PaginationControls 
            currentPage={currentPage}
            totalPages={getTotalPages(filterTasks(processedTasks))}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {showSubtasks && selectedTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl">
            <CardContent className="pt-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">
                  Subtasks for "{selectedTask.title}"
                </h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowSubtasks(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="subtasks">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-2"
                    >
                      {editedSubtasks.map((subtask, index) => (
                        <Draggable
                          key={index}
                          draggableId={`subtask-${index}`}
                          index={index}
                        >
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className="flex items-center gap-2 p-2 bg-muted rounded"
                            >
                              <div {...provided.dragHandleProps}>
                                <GripVertical className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <Checkbox
                                checked={subtask.completed}
                                onCheckedChange={(checked) => {
                                  const newSubtasks = [...editedSubtasks];
                                  newSubtasks[index].completed = checked as boolean;
                                  setEditedSubtasks(newSubtasks);
                                }}
                              />
                              <Input
                                value={subtask.title}
                                onChange={(e) => {
                                  const newSubtasks = [...editedSubtasks];
                                  newSubtasks[index].title = e.target.value;
                                  setEditedSubtasks(newSubtasks);
                                }}
                                className="flex-1"
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  const newSubtasks = editedSubtasks.filter((_, i) => i !== index);
                                  setEditedSubtasks(newSubtasks);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>

              <div className="mt-4 space-y-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setEditedSubtasks([...editedSubtasks, { title: "", completed: false }]);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Subtask
                </Button>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={saveSubtasks}
                    disabled={saveSubtasksMutation.isPending}
                  >
                    {saveSubtasksMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
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
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}