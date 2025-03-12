import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTasks, createTask, updateTask, deleteTask } from "../lib/api";
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
import { Calendar as CalendarIcon, Loader2, AlertCircle, Trash2 } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";

// Update Task interface to match database schema
interface Task {
  id: number;
  title: string;
  description: string | null;
  completed: number;  // 0 or 1
  due_date: string | null;  // timestamp string
  priority: string;
  is_recurring: number;  // 0 or 1
  recurrence_pattern?: string;
  recurrence_interval?: number;
  recurrence_end_date?: string;
  parent_task_id?: number | null;
}

export function TaskList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [date, setDate] = useState<Date | null>(null);
  
  // Fetch tasks
  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const data = await getTasks();
      return data.map((task: any) => ({
        ...task,
        completed: task.completed === 1,
      }));
    },
  });

  // Filter tasks - exclude recurring tasks and child tasks
  const activeTasks = tasks.filter(task => 
    task.completed === 0 && 
    !task.is_recurring && 
    !task.parent_task_id
  );
  const completedTasks = tasks.filter(task => 
    task.completed === 1 && 
    !task.is_recurring && 
    !task.parent_task_id
  );

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (data: Partial<Task>) => {
      const taskData = {
        ...data,
        completed: 0,
        due_date: date?.toISOString() || null,
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
      const updateData = {
        ...task,
        completed: typeof task.completed === 'number' ? (task.completed ? 1 : 0) : task.completed,
      };
      return updateTask(id, updateData);
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
      due_date: date?.toISOString() || null,
      completed: 0,
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
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Active Tasks */}
          <Card className="border-t-4 border-t-blue-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Active Tasks
                <span className="ml-auto text-sm text-muted-foreground">
                  {activeTasks.length} tasks
                </span>
              </CardTitle>
              <CardDescription>Non-recurring parent tasks only</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4">
                {activeTasks.map((task) => (
                  <li
                    key={task.id}
                    className="group flex flex-col space-y-2 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={task.completed}
                          onCheckedChange={(checked: boolean) =>
                            updateTaskMutation.mutate({
                              id: task.id,
                              task: { completed: checked ? 1 : 0 },
                            })
                          }
                          className="mt-1"
                        />
                        <div>
                          <h4 className="font-medium">{task.title}</h4>
                          {task.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {task.description}
                            </p>
                          )}
                          {/* Show number of subtasks if any */}
                          {tasks.some(t => t.parent_task_id === task.id) && (
                            <span className="text-xs text-muted-foreground">
                              {tasks.filter(t => t.parent_task_id === task.id).length} subtasks
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteTaskMutation.mutate(task.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "px-2 py-1 rounded-full text-xs font-medium",
                          task.priority === "high" && "bg-red-100 text-red-700",
                          task.priority === "medium" && "bg-yellow-100 text-yellow-700",
                          task.priority === "low" && "bg-green-100 text-green-700"
                        )}
                      >
                        {task.priority}
                      </span>
                      {task.due_date && (
                        <span className="text-xs text-muted-foreground">
                          Due {format(new Date(task.due_date), "PPP")}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
                {activeTasks.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No active tasks
                  </div>
                )}
              </ul>
            </CardContent>
          </Card>

          {/* Completed Tasks */}
          <Card className="border-t-4 border-t-green-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Completed Tasks
                <span className="ml-auto text-sm text-muted-foreground">
                  {completedTasks.length} tasks
                </span>
              </CardTitle>
              <CardDescription>Non-recurring parent tasks only</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4">
                {completedTasks.map((task) => (
                  <li
                    key={task.id}
                    className="group flex flex-col space-y-2 p-4 rounded-lg border bg-muted/50"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={task.completed}
                          onCheckedChange={(checked: boolean) =>
                            updateTaskMutation.mutate({
                              id: task.id,
                              task: { completed: checked ? 1 : 0 },
                            })
                          }
                          className="mt-1"
                        />
                        <div>
                          <h4 className="font-medium line-through text-muted-foreground">
                            {task.title}
                          </h4>
                          {task.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-through">
                              {task.description}
                            </p>
                          )}
                          {/* Show number of subtasks if any */}
                          {tasks.some(t => t.parent_task_id === task.id) && (
                            <span className="text-xs text-muted-foreground">
                              {tasks.filter(t => t.parent_task_id === task.id).length} subtasks
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteTaskMutation.mutate(task.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "px-2 py-1 rounded-full text-xs font-medium opacity-50",
                          task.priority === "high" && "bg-red-100 text-red-700",
                          task.priority === "medium" && "bg-yellow-100 text-yellow-700",
                          task.priority === "low" && "bg-green-100 text-green-700"
                        )}
                      >
                        {task.priority}
                      </span>
                      {task.due_date && (
                        <span className="text-xs text-muted-foreground line-through">
                          Due {format(new Date(task.due_date), "PPP")}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
                {completedTasks.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No completed tasks
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