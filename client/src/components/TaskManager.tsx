import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type Task, type TaskWithSubtasks, insertTaskSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { generateSubtasks as generateSubtasksApi } from "@/lib/api";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CalendarIcon, Trash2, Loader2, Pencil, X, Check, Sparkles, Search, Clock, CheckCircle2, AlertCircle, Repeat, Plus, GripVertical, List } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Switch,
} from "@/components/ui/switch";
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useAuth } from "@/contexts/AuthContext";

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

// Add TimeSelect component
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

// Update progress indicator component
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

export default function TaskManager() {
  const { toast } = useToast();
  const [date, setDate] = useState<Date | null>(null);
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

  // Watch form values
  const isRecurring = form.watch("is_recurring");
  const dueDate = form.watch("due_date");
  const recurrencePattern = form.watch("recurrence_pattern");
  const recurrenceInterval = form.watch("recurrence_interval");
  const recurrenceEndDate = form.watch("recurrence_end_date");

  // Update date state when form value changes
  React.useEffect(() => {
    if (dueDate) {
      setDate(new Date(dueDate));
    }
  }, [dueDate]);

  const { data: tasks = [], isLoading } = useQuery<TaskWithSubtasks[]>({
    queryKey: ["/api/tasks"],
    queryFn: async () => {
      try {
        const sessionToken = useAuth().sessionToken;
        // Get all tasks
        const res = await apiRequest("GET", "/api/tasks", undefined, sessionToken);
        if (!res.ok) {
          throw new Error("Failed to fetch tasks");
        }
        const tasksData: Task[] = await res.json();
        
        // Get tasks with subtasks
        const subtasksRes = await apiRequest("GET", "/api/tasks/subtasks");
        if (!subtasksRes.ok) {
          throw new Error("Failed to fetch subtasks info");
        }
        const tasksWithSubtasks: number[] = await subtasksRes.json();
        const subtasksSet = new Set(tasksWithSubtasks);

        // Map tasks and add has_subtasks property
        return tasksData.map((task: Task): TaskWithSubtasks => ({
          ...task,
          has_subtasks: subtasksSet.has(task.id)
        }));
      } catch (error) {
        throw error;
      }
    },
  });

  const { data: settings } = useQuery({
    queryKey: ['/api/user-settings'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/user-settings');
      return res.json();
    },
  });

  const createTask = useMutation({
    mutationFn: async (formData: FormData) => {
      try {
        const taskData = {
          title: formData.title.trim(),
          description: formData.description?.trim() || null,
          priority: formData.priority,
          completed: false,
          due_date: formData.due_date,
          is_recurring: formData.is_recurring,
          recurrence_pattern: formData.is_recurring ? formData.recurrence_pattern : null,
          recurrence_interval: formData.is_recurring ? formData.recurrence_interval : null,
          recurrence_end_date: formData.is_recurring ? formData.recurrence_end_date : null,
          all_day: false,
          parent_task_id: null
        };


        const res = await apiRequest("POST", "/api/tasks", taskData);
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.message || "Failed to create task");
        }
        const data = await res.json();
        return data;
      } catch (error) {
        throw error;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      form.reset();
      setDate(null);
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

  const updateTask = useMutation({
    mutationFn: async ({ id, ...data }: Partial<TaskWithSubtasks> & { id: number }) => {
      // Create a clean update object with just the properties we want to update
      const updateData: Partial<Task> = {};
      
      // Only include properties that are explicitly provided
      if ('completed' in data) {
        updateData.completed = Boolean(data.completed);  // Ensure boolean
      }
      
      // Only include other fields if they're explicitly being updated
      if ('title' in data) updateData.title = data.title;
      if ('description' in data) updateData.description = data.description;
      if ('priority' in data) updateData.priority = data.priority;
      if ('due_date' in data) {
        updateData.due_date = data.due_date instanceof Date ? data.due_date : null;
      }
      if ('is_recurring' in data) {
        updateData.is_recurring = data.is_recurring;
        // If turning off recurring, clear related fields
        if (!data.is_recurring) {
          updateData.recurrence_pattern = null;
          updateData.recurrence_interval = null;
          updateData.recurrence_end_date = null;
        }
      }
      if ('recurrence_pattern' in data) {
        updateData.recurrence_pattern = data.is_recurring ? data.recurrence_pattern : null;
      }
      if ('recurrence_interval' in data) {
        updateData.recurrence_interval = data.is_recurring ? data.recurrence_interval : null;
      }
      if ('recurrence_end_date' in data) {
        updateData.recurrence_end_date = data.is_recurring ? 
          (data.recurrence_end_date instanceof Date ? data.recurrence_end_date : null) : 
          null;
      }
      
      const res = await apiRequest("PATCH", `/api/tasks/${id}`, updateData);
      const updatedTask = await res.json();
      return {
        ...updatedTask,
        has_subtasks: data.has_subtasks
      } as TaskWithSubtasks;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to update task",
        description: error.message || "An error occurred while updating the task.",
      });
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: "Task deleted",
        description: "Your task has been deleted successfully.",
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

  const onSubmit = async (data: FormData) => {
    try {
      if (!data.title.trim()) {
        toast({
          variant: "destructive",
          title: "Validation error",
          description: "Task title is required",
        });
        return;
      }

      // Ensure dates are properly formatted
      const taskData = {
        ...data,
        due_date: data.due_date ? new Date(data.due_date) : null,
        recurrence_end_date: data.recurrence_end_date ? new Date(data.recurrence_end_date) : null,
      };

      await createTask.mutateAsync(taskData);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create task",
      });
    }
  };

  const startEditing = (task: TaskWithSubtasks) => {
    setEditingTask(task.id);
    setEditForm({
      title: task.title || "",
      description: task.description || "",
      priority: task.priority as "low" | "medium" | "high",
      due_date: task.due_date ? new Date(task.due_date) : null,
      is_recurring: task.is_recurring || false,
      recurrence_pattern: task.recurrence_pattern as "daily" | "weekly" | "monthly" | "yearly" | null,
      recurrence_interval: task.recurrence_interval || 1,
      recurrence_end_date: task.recurrence_end_date ? new Date(task.recurrence_end_date) : null,
    });
  };

  const cancelEditing = () => {
    setEditingTask(null);
    setEditForm(null);
  };

  const saveEdit = async (taskId: number) => {
    if (!editForm) return;
    
    try {
      const updateData = {
        ...editForm,
        due_date: editForm.due_date,
        is_recurring: editForm.is_recurring,
        recurrence_pattern: editForm.is_recurring ? editForm.recurrence_pattern : null,
        recurrence_interval: editForm.is_recurring ? editForm.recurrence_interval : null,
        recurrence_end_date: editForm.is_recurring ? editForm.recurrence_end_date : null,
      };

      await updateTask.mutateAsync({
        id: taskId,
        ...updateData,
      });
      setEditingTask(null);
      setEditForm(null);
      toast({
        title: "Task updated",
        description: "Your changes have been saved.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to update task",
        description: error instanceof Error ? error.message : "Failed to update task",
      });
    }
  };

  // Update the generateSubtasks function
  const generateSubtasks = async (task: TaskWithSubtasks) => {
    try {
      setSelectedTask(task);
      setIsGenerating(true);
      setShowSubtasks(true);

      // First check if subtasks already exist for this task
      const response = await apiRequest("GET", `/api/tasks/${task.id}/subtasks`);
      const existingSubtasks = await response.json();
      
      if (existingSubtasks && Array.isArray(existingSubtasks) && existingSubtasks.length > 0) {
        // If there are existing subtasks, just show them
        setEditedSubtasks(existingSubtasks.map(subtask => ({
          title: subtask.title,
          completed: subtask.completed
        })));
      } else {
        // If no existing subtasks, generate new ones using Gemini
        const prompt = `
          Generate 5 clear and simple subtasks for this task. Each subtask should be a single, actionable item.
          Do not create nested lists or sublists. Each line should be an independent task.

          Main Task: ${task.title}
          ${task.description ? `Description: ${task.description}` : ''}
          Priority: ${task.priority}
          ${task.due_date ? `Due Date: ${format(new Date(task.due_date), "PPP")}` : ''}
        `;
        
        
        const response = await generateSubtasksApi(prompt) as SubtasksResponse;

        if (response && Array.isArray(response.subtasks)) {
          const processedSubtasks = response.subtasks
            .map(s => typeof s === 'string' ? s.trim() : '')
            .filter(s => s.length > 0)
            .map(title => ({
              title: title.replace(/^[-*\d.]\s*/, ''), // Remove any bullets, numbers, or dots
              completed: false
            }));

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

          setEditedSubtasks(subtasksArray);
        } else {
          throw new Error("Invalid response format from subtasks generation");
        }
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to generate subtasks",
        description: error instanceof Error ? error.message : "An error occurred while generating subtasks.",
      });
      // Even if generation fails, still show the dialog so user can add manually
      setEditedSubtasks([]);
      setShowSubtasks(true);
    } finally {
      setIsGenerating(false);
    }
  };

  // Update the saveSubtasks function
  const saveSubtasks = async () => {
    if (!selectedTask) return;

    try {
      await apiRequest("POST", `/api/tasks/${selectedTask.id}/subtasks`, {
        subtasks: editedSubtasks
      });

      // Invalidate both queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/subtasks"] });
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${selectedTask.id}/subtasks`] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });

      toast({
        title: "Subtasks saved",
        description: "Your subtasks have been saved successfully.",
      });
      setShowSubtasks(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to save subtasks",
        description: "An error occurred while saving subtasks.",
      });
    }
  };

  // Update the drag and drop handler
  const onDragEnd = (result: any) => {
    // If there's no destination or it's dropped outside the list, do nothing
    if (!result.destination) return;
    
    // If the item was dropped in the same position as it started, do nothing
    if (
      result.destination.droppableId === result.source.droppableId &&
      result.destination.index === result.source.index
    ) {
      return;
    }

    // Create a new array from the current subtasks
    const items = Array.from(editedSubtasks);
    // Remove the dragged item from its original position
    const [reorderedItem] = items.splice(result.source.index, 1);
    // Insert the dragged item at its new position
    items.splice(result.destination.index, 0, reorderedItem);

    // Update the state with the new order
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
                  {editForm.due_date ? format(editForm.due_date, "PPP") : "Due date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div>
                  <Calendar
                    mode="single"
                    selected={editForm?.due_date || undefined}
                    onSelect={(newDate: Date | undefined) => {
                      if (newDate) {
                        const selectedTime = editForm?.due_date ? new Date(editForm.due_date) : new Date();
                        setEditForm(prev => ({ ...prev, due_date: newDate }));
                      } else {
                        setEditForm(prev => ({ ...prev, due_date: null }));
                      }
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
                          selected={editForm?.recurrence_end_date || undefined}
                          onSelect={(newDate) => setEditForm(prev => ({
                            ...prev,
                            recurrence_end_date: newDate ?? null
                          }))}
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
                    ? ` until ${format(new Date(task.recurrence_end_date), "PPP")}`
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
              task.priority === "high" && "bg-red-100 text-red-800",
              task.priority === "medium" && "bg-yellow-100 text-yellow-800",
              task.priority === "low" && "bg-green-100 text-green-800"
            )}
          >
            {task.priority}
          </span>
          {task.due_date && (
            <div className="text-sm text-gray-500">
              {formatInTimeZone(
                new Date(task.due_date),
                settings?.timezone || 'UTC',
                task.all_day ? 'PPP' : 'PPP p'
              )}
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
            disabled={updateTask.isPending}
          >
            {updateTask.isPending ? (
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
          onClick={() => deleteTask.mutate(task.id)}
          disabled={deleteTask.isPending}
        >
          {deleteTask.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      </div>
    );
  };

  // Add function to check if a task is overdue
  const isOverdue = (task: TaskWithSubtasks) => {
    if (!task.due_date || task.completed) return false;
    const dueDate = new Date(task.due_date);
    const now = new Date();
    return dueDate < now;
  };

  // Add function to get active (non-overdue) tasks
  const getActiveTasks = (tasks: TaskWithSubtasks[]) => {
    return tasks.filter(task => 
      !task.completed && 
      !isOverdue(task) && 
      !task.parent_task_id // Only show parent tasks, not recurring instances
    );
  };

  // Add function to get overdue tasks
  const getOverdueTasks = (tasks: TaskWithSubtasks[]) => {
    return tasks.filter(task => 
      !task.completed && 
      isOverdue(task) && 
      !task.parent_task_id // Only show parent tasks, not recurring instances
    );
  };

  // Add function to get completed tasks
  const getCompletedTasks = (tasks: TaskWithSubtasks[]) => {
    return tasks.filter(task => 
      task.completed && 
      !task.parent_task_id // Only show parent tasks, not recurring instances
    );
  };

  const clearFilters = () => {
    setFilterType('all');
    setPriorityFilter('all');
    setDueDateFilter('all');
    setSortOrder('none');
    setSearchTerm('');
  };

  // Modify the filterTasks function to be more consistent
  const filterTasks = (tasks: TaskWithSubtasks[]) => {
    // First apply search filter
    let filtered = tasks.filter(task =>
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (task.description?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );

    // Then apply type filter
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

    // Apply priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(task => task.priority === priorityFilter);
    }

    // Apply due date filter
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
        const dueDate = new Date(task.due_date);
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

    // Finally, apply sorting
    return sortTasksByDueDate(filtered);
  };

  // Add new function to sort tasks by due date
  const sortTasksByDueDate = (tasks: TaskWithSubtasks[]) => {
    if (sortOrder === 'none') return tasks;

    return [...tasks].sort((a, b) => {
      // Handle cases where due_date is null
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return sortOrder === 'asc' ? 1 : -1;
      if (!b.due_date) return sortOrder === 'asc' ? -1 : 1;

      const dateA = new Date(a.due_date);
      const dateB = new Date(b.due_date);
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

  // Add pagination helper functions
  const getPaginatedTasks = (tasks: TaskWithSubtasks[], page: number) => {
    const startIndex = (page - 1) * tasksPerPage;
    const endIndex = startIndex + tasksPerPage;
    return tasks.slice(startIndex, endIndex);
  };

  const getTotalPages = (tasks: TaskWithSubtasks[]) => {
    return Math.ceil(tasks.length / tasksPerPage);
  };

  // Add pagination controls component
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

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <>
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="flex items-start gap-4 flex-wrap">
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
                          <SelectTrigger>
                            <SelectValue placeholder="Priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
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
                        "w-[180px] justify-start text-left font-normal",
                        !dueDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dueDate ? format(new Date(dueDate), "PPP") : "Due date (optional)"}
              </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <div>
                      <Calendar
                        mode="single"
                        selected={dueDate ? new Date(dueDate) : undefined}
                        onSelect={(newDate) => {
                          if (newDate) {
                            const selectedTime = dueDate ? new Date(dueDate) : new Date();
                            form.setValue("due_date", newDate);
                          } else {
                            form.setValue("due_date", null);
                          }
                        }}
                        initialFocus
                      />
                      {dueDate && (
                        <TimeSelect
                          value={new Date(dueDate)}
                          onChange={(newDate) => {
                            form.setValue("due_date", newDate);
                          }}
                          timeFormat="12h"
                        />
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
                <div className="flex items-center gap-2">
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
                  >
                    <Repeat className="h-4 w-4 mr-2" />
                    Recurring Task
                  </Switch>
                </div>
                <Button 
                  type="submit" 
                  disabled={createTask.isPending}
                  className="min-w-[100px]"
                >
                  {createTask.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Add Task"
                  )}
                </Button>
              </div>
              {isRecurring && (
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
                          value={recurrenceInterval || ""}
                          onChange={(e) => form.setValue("recurrence_interval", parseInt(e.target.value) || 1)}
                          className="w-[80px]"
                        />
                        <Select
                          value={recurrencePattern || ""}
                          onValueChange={(value) => form.setValue("recurrence_pattern", value as "daily" | "weekly" | "monthly" | "yearly" | null)}
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
                              !recurrenceEndDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {recurrenceEndDate
                              ? format(new Date(recurrenceEndDate), "PPP")
                              : "Select end date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={recurrenceEndDate ? new Date(recurrenceEndDate) : undefined}
                            onSelect={(newDate) => {
                              form.setValue("recurrence_end_date", newDate ?? null);
                            }}
                            initialFocus
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

        {/* Add Search and Filter Section - only show if there are tasks */}
        {tasks.length > 0 && (
          <div className="flex gap-4 items-center flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
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
                  const count = getTaskCounts(tasks)[value as FilterType];
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
        )}

        {/* Modify the tasks grid to use filtered tasks */}
        <div className={cn(
          "grid gap-6",
          getOverdueTasks(filterTasks(tasks)).length > 0 ? "md:grid-cols-3" : "md:grid-cols-2"
        )}>
          {/* Active Tasks */}
          <Card className="border-t-4 border-t-blue-500">
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center justify-between">
                Active Tasks
                <span className="text-sm text-muted-foreground">
                  {getActiveTasks(filterTasks(tasks)).length} tasks
                </span>
              </h2>
              <div className="space-y-4">
                {getPaginatedTasks(getActiveTasks(filterTasks(tasks)), currentPage).map((task) => (
                  <div
                    key={task.id}
                    className="group p-4 rounded-lg border hover:bg-accent/5 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <Checkbox
                        checked={task.completed}
                        onCheckedChange={(checked: boolean) =>
                          updateTask.mutate({
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
                {getActiveTasks(filterTasks(tasks)).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchTerm ? 'No matching active tasks' : 'No active tasks'}
                  </div>
                )}
                <PaginationControls
                  currentPage={currentPage}
                  totalPages={getTotalPages(getActiveTasks(filterTasks(tasks)))}
                  onPageChange={setCurrentPage}
                />
              </div>
            </CardContent>
          </Card>

          {/* Overdue Tasks - Only show if there are overdue tasks */}
          {getOverdueTasks(filterTasks(tasks)).length > 0 && (
            <Card className="border-t-4 border-t-red-500">
              <CardContent className="pt-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center justify-between">
                  Overdue Tasks
                  <span className="text-sm text-muted-foreground">
                    {getOverdueTasks(filterTasks(tasks)).length} tasks
                  </span>
                </h2>
                <div className="space-y-4">
                  {getPaginatedTasks(getOverdueTasks(filterTasks(tasks)), currentPage).map((task) => (
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
                  <PaginationControls
                    currentPage={currentPage}
                    totalPages={getTotalPages(getCompletedTasks(filterTasks(tasks)))}
                    onPageChange={setCurrentPage}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Completed Tasks */}
          <Card className="border-t-4 border-t-green-500">
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center justify-between">
                Completed Tasks
                <span className="text-sm text-muted-foreground">
                  {getCompletedTasks(filterTasks(tasks)).length} tasks
                </span>
              </h2>
              <div className="space-y-4">
                {getPaginatedTasks(getCompletedTasks(filterTasks(tasks)), currentPage).map((task) => (
                  <div
                    key={task.id}
                    className="group p-4 rounded-lg border bg-muted/50"
                  >
                    <div className="flex items-center gap-4">
                      <Checkbox
                        checked={task.completed}
                        onCheckedChange={(checked: boolean) =>
                          updateTask.mutate({
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
                {getCompletedTasks(filterTasks(tasks)).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchTerm ? 'No matching completed tasks' : 'No completed tasks'}
                  </div>
                )}
                <PaginationControls
                  currentPage={currentPage}
                  totalPages={getTotalPages(getCompletedTasks(filterTasks(tasks)))}
                  onPageChange={setCurrentPage}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showSubtasks} onOpenChange={(open) => {
        if (!open) {
          setShowSubtasks(false);
          setEditedSubtasks([]);
          setIsGenerating(false);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isGenerating ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {selectedTask?.has_subtasks
                    ? "Loading subtasks..." 
                    : "Generating subtasks..."}
                </div>
              ) : (
                `Subtasks for ${selectedTask?.title || ''}`
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="relative">
            <div className="relative">
              <ScrollArea className="max-h-[60vh] overflow-hidden border rounded-md">
                <div className="p-4">
                  <DragDropContext onDragEnd={onDragEnd}>
                    <div className="relative w-full">
                      <Droppable droppableId="subtasks">
                        {(provided, snapshot) => (
                          <div
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                            className={cn(
                              "space-y-2 relative min-h-[50px] w-full",
                              snapshot.isDraggingOver && "bg-accent/20 rounded-lg p-2"
                            )}
                          >
                            {editedSubtasks.map((subtask, index) => (
                              <Draggable
                                key={`subtask-${index}`}
                                draggableId={`subtask-${index}`}
                                index={index}
                              >
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    style={{
                                      ...provided.draggableProps.style,
                                      left: 'auto !important',
                                      right: 'auto !important',
                                    }}
                                    className={cn(
                                      "flex items-start gap-2 p-2 rounded-lg border bg-background w-full",
                                      snapshot.isDragging && "border-primary shadow-lg ring-2 ring-primary z-50",
                                      "group hover:border-primary/50 transition-colors"
                                    )}
                                  >
                                    <div
                                      {...provided.dragHandleProps}
                                      className="mt-2.5 text-muted-foreground/50 hover:text-primary cursor-grab active:cursor-grabbing shrink-0"
                                    >
                                      <GripVertical className="h-4 w-4" />
                                    </div>
                                    <Checkbox
                                      checked={subtask.completed}
                                      onCheckedChange={(checked) => {
                                        const newSubtasks = [...editedSubtasks];
                                        newSubtasks[index] = {
                                          ...newSubtasks[index],
                                          completed: checked === true ? true : false
                                        };
                                        setEditedSubtasks(newSubtasks);
                                      }}
                                      className="mt-2.5"
                                    />
                                    <Input
                                      value={subtask.title}
                                      onChange={(e) => {
                                        const newSubtasks = [...editedSubtasks];
                                        newSubtasks[index] = {
                                          ...newSubtasks[index],
                                          title: e.target.value
                                        };
                                        setEditedSubtasks(newSubtasks);
                                      }}
                                      className={cn(
                                        "flex-1",
                                        subtask.completed && "line-through text-muted-foreground"
                                      )}
                                    />
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        const newSubtasks = editedSubtasks.filter((_, i) => i !== index);
                                        setEditedSubtasks(newSubtasks);
                                      }}
                                      className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  </DragDropContext>
                  <Button
                    variant="outline"
                    className="w-full mt-4"
                    onClick={() => setEditedSubtasks([...editedSubtasks, { title: "", completed: false }])}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Subtask
                  </Button>
                </div>
              </ScrollArea>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowSubtasks(false)}>
              Cancel
            </Button>
            <Button onClick={saveSubtasks}>
              Save Subtasks
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
