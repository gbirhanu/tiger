import { useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Task } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { queryClient } from '@/lib/queryClient';
import { Loader2, Pencil, Trash2, Plus } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay?: boolean;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  extendedProps?: {
    description?: string;
    priority?: string;
    completed?: boolean;
  };
}

interface NewTaskForm {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  due_date: Date | null;
  all_day: boolean;
}

export default function Calendar() {
  const { toast } = useToast();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [showNewTaskDialog, setShowNewTaskDialog] = useState(false);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newTask, setNewTask] = useState<NewTaskForm>({
    title: '',
    description: '',
    priority: 'medium',
    due_date: null,
    all_day: true,
  });

  // Fetch tasks
  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ['/api/tasks'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/tasks');
      return res.json();
    },
  });

  // Add timezone query
  const { data: settings } = useQuery({
    queryKey: ['/api/user-settings'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/user-settings');
      return res.json();
    },
  });

  // Create task mutation
  const createTask = useMutation({
    mutationFn: async (taskData: NewTaskForm) => {
      const res = await apiRequest('POST', '/api/tasks', {
        title: taskData.title,
        description: taskData.description || null,
        priority: taskData.priority,
        completed: false,
        due_date: taskData.due_date ? Math.floor(taskData.due_date.getTime() / 1000) : null,
        all_day: taskData.all_day,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      setShowNewTaskDialog(false);
      setNewTask({
        title: '',
        description: '',
        priority: 'medium',
        due_date: null,
        all_day: true,
      });
      toast({
        title: 'Task created',
        description: 'Your task has been created successfully.',
      });
    },
    onError: (error: Error) => {
      console.error('Calendar error:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to complete action',
        description: error.message || 'An error occurred. Please try again.',
        className: 'dark:bg-red-950 dark:text-white dark:border-red-800',
      });
    },
  });

  // Update task mutation
  const updateTask = useMutation({
    mutationFn: async (taskData: Partial<Task> & { id: number }) => {
      const res = await apiRequest('PATCH', `/api/tasks/${taskData.id}`, taskData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      setShowTaskDialog(false);
      setIsEditing(false);
      toast({
        title: 'Task updated',
        description: 'Your task has been updated successfully.',
      });
    },
    onError: (error: Error) => {
      console.error('Calendar error:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to complete action',
        description: error.message || 'An error occurred. Please try again.',
        className: 'dark:bg-red-950 dark:text-white dark:border-red-800',
      });
    },
  });

  // Delete task mutation
  const deleteTask = useMutation({
    mutationFn: async (taskId: number) => {
      await apiRequest('DELETE', `/api/tasks/${taskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      setShowTaskDialog(false);
      toast({
        title: 'Task deleted',
        description: 'Your task has been deleted successfully.',
      });
    },
    onError: (error: Error) => {
      console.error('Calendar error:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to complete action',
        description: error.message || 'An error occurred. Please try again.',
        className: 'dark:bg-red-950 dark:text-white dark:border-red-800',
      });
    },
  });

  // Add event drop handler
  const handleEventDrop = (info: any) => {
    const task = tasks.find(t => t.id.toString() === info.event.id);
    if (task) {
      const updateData = {
        id: Number(info.event.id),
        due_date: Math.floor(info.event.start!.getTime() / 1000), // Convert to Unix timestamp in seconds
        all_day: info.event.allDay,  // Send as boolean
      };
      updateTask.mutate(updateData);
    }
  };

  // Convert tasks to calendar events
  useEffect(() => {
    if (!tasks) return;

    const calendarEvents = tasks.map(task => {
      // Determine color based on priority
      let backgroundColor, borderColor;
      if (task.priority === 'high') {
        backgroundColor = '#DC2626'; // Bright red for high priority
        borderColor = '#B91C1C';
      } else if (task.priority === 'medium') {
        backgroundColor = '#F59E0B'; // Amber for medium priority
        borderColor = '#D97706';
      } else {
        backgroundColor = '#10B981'; // Emerald for low priority
        borderColor = '#059669';
      }

      // If the task is completed
      if (task.completed) {
        backgroundColor = '#6B7280'; // Gray for completed tasks
        borderColor = '#4B5563';
      }
      
      // Check if task is overdue
      let isOverdue = false;
      if (!task.completed && task.due_date) {
        const dueDate = typeof task.due_date === 'number' 
          ? new Date(task.due_date * 1000) 
          : new Date(task.due_date as string);
          
        isOverdue = dueDate < new Date();
      }
      
      // If the task is overdue and not completed
      if (isOverdue) {
        backgroundColor = '#991B1B'; // Dark red for overdue
        borderColor = '#7F1D1D';
      }

      // Safely parse the date
      let startDate = '';
      if (task.due_date) {
        try {
          // Handle different types of due_date values
          if (typeof task.due_date === 'number') {
            // If it's a timestamp in seconds (from SQLite)
            startDate = new Date(task.due_date * 1000).toISOString();
          } else if (typeof task.due_date === 'string') {
            // If it's a string date representation
            startDate = new Date(task.due_date).toISOString();
          } else if (typeof task.due_date === 'object' && task.due_date !== null && 'toISOString' in task.due_date) {
            // If it's already a Date object somehow
            startDate = (task.due_date as any).toISOString();
          }
        } catch (error) {
          console.error(`Error parsing date for task ${task.id}:`, error);
          // Fallback to empty string if date can't be parsed
          startDate = '';
        }
      }

      return {
        id: task.id.toString(),
        title: task.title,
        start: startDate,
        allDay: task.all_day,
        backgroundColor,
        borderColor,
        textColor: '#ffffff',
        extendedProps: {
          description: task.description || undefined,
          priority: task.priority,
          completed: task.completed,
        },
      };
    }).filter(event => event.start);

    setEvents(calendarEvents);
  }, [tasks]);

  const handleEventClick = (info: any) => {
    const event = info.event;
    const task = tasks.find(t => t.id.toString() === event.id);
    if (task) {
      setSelectedTask(task);
      
      // Safely handle the due_date when editing
      let dueDate = null;
      if (task.due_date) {
        try {
          // If it's a timestamp in seconds (from SQLite)
          if (typeof task.due_date === 'number') {
            dueDate = new Date(task.due_date * 1000);
          } else if (typeof task.due_date === 'string') {
            // If it's a string date representation
            dueDate = new Date(task.due_date);
          } else {
            // Fall back to current date if we can't parse
            console.warn(`Unexpected due_date type for task ${task.id}`);
            dueDate = null;
          }
        } catch (error) {
          console.error(`Error parsing date for editing task ${task.id}:`, error);
          dueDate = null;
        }
      }
      
      setNewTask({
        title: task.title,
        description: task.description || '',
        priority: task.priority as 'low' | 'medium' | 'high',
        due_date: dueDate,
        all_day: task.all_day ?? true,
      });
      setShowTaskDialog(true);
    }
  };

  const handleDateClick = (info: any) => {
    const clickedDate = new Date(info.dateStr);
    // If clicked in a time slot, set the specific time
    if (info.view.type !== 'dayGridMonth') {
      const hours = info.date.getHours();
      const minutes = info.date.getMinutes();
      clickedDate.setHours(hours, minutes, 0, 0);
      setNewTask(prev => ({ 
        ...prev, 
        due_date: clickedDate,
        all_day: false 
      }));
    } else {
      // For month view, set as all-day event
      clickedDate.setHours(9, 0, 0, 0); // Default to 9 AM for all-day events
      setNewTask(prev => ({ 
        ...prev, 
        due_date: clickedDate,
        all_day: true 
      }));
    }
    setShowNewTaskDialog(true);
  };

  const handleCreateTask = () => {
    if (!newTask.title.trim()) {
      toast({
        variant: 'destructive',
        title: 'Title required',
        description: 'Please enter a title for the task.',
      });
      return;
    }
    createTask.mutate(newTask);
  };

  const handleUpdateTask = () => {
    if (!selectedTask) return;
    if (!newTask.title.trim()) {
      toast({
        variant: 'destructive',
        title: 'Title required',
        description: 'Please enter a title for the task.',
      });
      return;
    }
    updateTask.mutate({
      id: selectedTask.id,
      title: newTask.title,
      description: newTask.description || null,
      priority: newTask.priority,
      due_date: newTask.due_date ? Math.floor(newTask.due_date.getTime() / 1000) : null,
      all_day: newTask.all_day,  // Send as boolean
    });
  };

  // Add custom CSS for FullCalendar to fix dark mode styling
  useEffect(() => {
    // Create a style element
    const styleEl = document.createElement("style");
    styleEl.setAttribute("id", "calendar-custom-styles");
    
    // Define our custom styles
    styleEl.textContent = `
      /* Fix calendar header colors for both light and dark themes */
      .fc-col-header-cell-cushion {
        color: var(--fc-theme-standard-content-color, inherit) !important;
      }
      
      /* Ensure proper styling for dark mode */
      .dark .fc-col-header {
        background-color: hsl(var(--muted));
      }
      
      .dark .fc-col-header-cell-cushion {
        color: hsl(var(--foreground)) !important;
      }
      
      .dark .fc-daygrid-day-number {
        color: hsl(var(--foreground));
      }
      
      .dark .fc-daygrid-day.fc-day-today {
        background-color: hsl(var(--primary) / 0.2) !important;
      }
      
      /* Fix button contrast in dark mode */
      .dark .fc-button-primary {
        background-color: hsl(var(--primary)) !important;
        border-color: hsl(var(--primary)) !important;
        color: hsl(var(--primary-foreground)) !important;
      }
      
      .dark .fc-button-primary:not(.fc-button-active):hover {
        background-color: hsl(var(--primary) / 0.9) !important;
        color: hsl(var(--primary-foreground)) !important;
      }
      
      .dark .fc-button-primary.fc-button-active {
        background-color: hsl(var(--secondary)) !important;
        border-color: hsl(var(--secondary)) !important;
        color: hsl(var(--secondary-foreground)) !important;
        font-weight: 600;
      }
      
      /* Improve active buttons in light mode too */
      .fc-button-primary.fc-button-active {
        font-weight: 600;
      }
      
      /* Style navigation buttons better in both modes */
      .fc-prev-button, .fc-next-button {
        transition: transform 0.2s ease;
      }
      
      .fc-prev-button:hover, .fc-next-button:hover {
        transform: scale(1.05);
      }
      
      /* Make sure event text is readable */
      .fc-event-title, .fc-event-time {
        color: white !important;
        font-weight: 500;
      }
      
      /* Make the calendar header more prominent */
      .fc .fc-toolbar-title {
        font-size: 1.5rem;
        font-weight: 600;
      }
      
      /* Improve the appearance of today's date */
      .fc-day-today .fc-daygrid-day-number {
        background-color: hsl(var(--primary));
        color: hsl(var(--primary-foreground)) !important;
        border-radius: 9999px;
        width: 1.75rem;
        height: 1.75rem;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0.25rem;
      }
    `;
    
    // Add the style element to the document
    document.head.appendChild(styleEl);
    
    // Cleanup function to remove the style element when component unmounts
    return () => {
      const existingStyle = document.getElementById("calendar-custom-styles");
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, []); // Empty dependency array means this runs once when component mounts

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Calendar</h2>
        <Button 
          onClick={() => {
            setNewTask({
              title: '',
              description: '',
              priority: 'medium',
              due_date: new Date(),
              all_day: true,
            });
            setShowNewTaskDialog(true);
          }}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Task
        </Button>
      </div>

      <Card className="shadow-lg border rounded-lg overflow-hidden">
        <CardContent className="p-0">
          <div className="calendar-container p-2 md:p-4">
            <style>{`
              /* Fix for header color inconsistency */
              .fc .fc-col-header-cell {
                background-color: var(--background) !important;
              }
              .fc .fc-col-header-cell-cushion {
                color: var(--foreground);
                font-weight: 600;
                padding: 8px 4px;
              }
              /* Improve button styling */
              .fc .fc-button-primary {
                background-color: hsl(var(--primary));
                border-color: hsl(var(--primary));
              }
              .fc .fc-button-primary:hover {
                background-color: hsl(var(--primary) / 0.9);
                border-color: hsl(var(--primary) / 0.9);
              }
              /* Better today highlight */
              .fc .fc-day-today {
                background-color: hsl(var(--accent) / 0.1) !important;
              }
              /* Event styling */
              .fc .fc-event {
                border-radius: 4px;
                padding: 2px 6px;
                font-size: 0.875rem;
              }
              /* Day cell hover effect */
              .fc .fc-day:hover {
                background-color: hsl(var(--muted) / 0.5);
                cursor: pointer;
              }
            `}</style>
            
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay',
              }}
              buttonText={{
                today: 'Today',
                month: 'Month',
                week: 'Week',
                day: 'Day',
              }}
              events={events}
              eventClick={handleEventClick}
              dateClick={handleDateClick}
              height="auto"
              aspectRatio={1.5}
              eventTimeFormat={{
                hour: '2-digit',
                minute: '2-digit',
                meridiem: 'short',
              }}
              dayMaxEvents={3}
              moreLinkClick="popover"
              eventDisplay="block"
              eventBackgroundColor="#3B82F6"
              eventBorderColor="#2563EB"
              themeSystem="standard"
              dayHeaderClassNames="text-base font-medium py-2"
              dayHeaderFormat={{ weekday: 'short', day: 'numeric' }}
              slotLabelFormat={{
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
              }}
              allDayText="All day"
              allDaySlot={true}
            />
          </div>
        </CardContent>
      </Card>

      <Dialog open={showNewTaskDialog} onOpenChange={setShowNewTaskDialog}>
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
            <DialogTitle>
              Create Task for {newTask.due_date ? format(newTask.due_date, newTask.all_day ? 'PPP' : 'PPP p') : 'New Task'}
            </DialogTitle>
            </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Input
                placeholder="Task title"
                value={newTask.title}
                onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Input
                placeholder="Task description (optional)"
                value={newTask.description}
                onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Select
                value={newTask.priority}
                onValueChange={(value: 'low' | 'medium' | 'high') =>
                  setNewTask(prev => ({ ...prev, priority: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low Priority</SelectItem>
                  <SelectItem value="medium">Medium Priority</SelectItem>
                  <SelectItem value="high">High Priority</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!newTask.all_day && newTask.due_date && (
              <div className="grid gap-2">
                <Input
                  type="time"
                  value={formatInTimeZone(
                    newTask.due_date || new Date(),
                    settings?.timezone || 'UTC',
                    'HH:mm'
                  )}
                  onChange={(e) => {
                    const [hours, minutes] = e.target.value.split(':');
                    const newDate = new Date(newTask.due_date || new Date());
                    newDate.setHours(parseInt(hours), parseInt(minutes));
                    setNewTask({ ...newTask, due_date: newDate });
                  }}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNewTaskDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateTask}
              disabled={createTask.isPending}
            >
              {createTask.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Task'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? 'Edit Task' : 'Task Details'}
            </DialogTitle>
            {!isEditing && selectedTask?.due_date && (
              <DialogDescription>
                {selectedTask?.due_date && formatInTimeZone(
                  new Date(selectedTask.due_date),
                  settings?.timezone || 'UTC',
                  selectedTask.all_day ? 'PPP' : 'PPP p'
                )}
              </DialogDescription>
            )}
          </DialogHeader>
          
          {isEditing ? (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Input
                  placeholder="Task title"
                  value={newTask.title}
                  onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Input
                  placeholder="Task description (optional)"
                  value={newTask.description}
                  onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Select
                  value={newTask.priority}
                  onValueChange={(value: 'low' | 'medium' | 'high') =>
                    setNewTask(prev => ({ ...prev, priority: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low Priority</SelectItem>
                    <SelectItem value="medium">Medium Priority</SelectItem>
                    <SelectItem value="high">High Priority</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">
                  All Day
                </label>
                <input
                  type="checkbox"
                  checked={newTask.all_day}
                  onChange={(e) => setNewTask(prev => ({ ...prev, all_day: e.target.checked }))}
                  className="ml-2"
                />
              </div>
              {newTask.due_date && (
                <div className="grid gap-2">
                  {!newTask.all_day && (
                    <Input
                      type="time"
                      value={formatInTimeZone(
                        newTask.due_date || new Date(),
                        settings?.timezone || 'UTC',
                        'HH:mm'
                      )}
                      onChange={(e) => {
                        const [hours, minutes] = e.target.value.split(':');
                        const newDate = new Date(newTask.due_date || new Date());
                        newDate.setHours(parseInt(hours), parseInt(minutes));
                        setNewTask({ ...newTask, due_date: newDate });
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="py-4 space-y-4">
              <div>
                <h3 className="font-medium">{selectedTask?.title}</h3>
                {selectedTask?.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedTask.description}
                  </p>
                )}
              </div>
              <div className="flex gap-2 text-sm">
                <span className="font-medium">Priority:</span>
                <span className="capitalize">{selectedTask?.priority}</span>
              </div>
              <div className="flex gap-2 text-sm">
                <span className="font-medium">Status:</span>
                <span>{selectedTask?.completed ? 'Completed' : 'Pending'}</span>
              </div>
              <div className="flex gap-2 text-sm">
                <span className="font-medium">Type:</span>
                <span>{selectedTask?.all_day ? 'All Day' : 'Time-Specific'}</span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            {isEditing ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    if (selectedTask) {
                      setNewTask({
                        title: selectedTask.title,
                        description: selectedTask.description || '',
                        priority: selectedTask.priority as 'low' | 'medium' | 'high',
                        due_date: selectedTask.due_date ? new Date(selectedTask.due_date) : null,
                        all_day: selectedTask.all_day ?? true,
                      });
                    }
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdateTask}
                  disabled={updateTask.isPending}
                >
                  {updateTask.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setShowTaskDialog(false)}
                >
                  Close
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsEditing(true)}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                          <Button
                    variant="destructive"
                    onClick={() => {
                      if (selectedTask) {
                        deleteTask.mutate(selectedTask.id);
                      }
                    }}
                    disabled={deleteTask.isPending}
                  >
                    {deleteTask.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                          </Button>
                </div>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}