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
import { Loader2, Pencil, Trash2 } from 'lucide-react';
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
        due_date: taskData.due_date?.toISOString(),
        all_day: taskData.all_day,  // Send as boolean
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
      toast({
        variant: 'destructive',
        title: 'Failed to create task',
        description: error.message || 'An error occurred while creating the task.',
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
      toast({
        variant: 'destructive',
        title: 'Failed to update task',
        description: error.message || 'An error occurred while updating the task.',
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
      toast({
        variant: 'destructive',
        title: 'Failed to delete task',
        description: error.message || 'An error occurred while deleting the task.',
      });
    },
  });

  // Add event drop handler
  const handleEventDrop = (info: any) => {
    const task = tasks.find(t => t.id.toString() === info.event.id);
    if (task) {
      updateTask.mutate({
        id: task.id,
        due_date: info.event.start.toISOString(),
        all_day: info.event.allDay,  // Send as boolean
      });
    }
  };

  // Convert tasks to calendar events
  useEffect(() => {
    if (!tasks) return;

    const calendarEvents = tasks.map((task) => {
      // Set colors based on priority and completion status
      let backgroundColor = '#3B82F6'; // Default blue
      let borderColor = '#2563EB';

      if (task.completed) {
        backgroundColor = '#10B981'; // Green for completed
        borderColor = '#059669';
      } else if (task.priority === 'high') {
        backgroundColor = '#EF4444'; // Red for high priority
        borderColor = '#DC2626';
      } else if (task.priority === 'medium') {
        backgroundColor = '#F59E0B'; // Yellow for medium priority
        borderColor = '#D97706';
      }

      // If the task is overdue and not completed
      if (!task.completed && task.due_date && new Date(task.due_date) < new Date()) {
        backgroundColor = '#991B1B'; // Dark red for overdue
        borderColor = '#7F1D1D';
      }

      return {
        id: task.id.toString(),
        title: task.title,
        start: task.due_date ? new Date(task.due_date).toISOString() : '',
        allDay: task.all_day,  // SQLite boolean mode will handle this
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
      setNewTask({
        title: task.title,
        description: task.description || '',
        priority: task.priority as 'low' | 'medium' | 'high',
        due_date: task.due_date ? new Date(task.due_date) : null,
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
      due_date: newTask.due_date?.toISOString(),
      all_day: newTask.all_day,  // Send as boolean
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Calendar</h2>
        <div className="text-sm text-muted-foreground">
          Click on a date to add a new task
        </div>
      </div>

      <Card className="border-t-4 border-t-primary shadow-md">
        <CardContent className="p-6">
          <style>
            {`
              .fc {
                --fc-border-color: hsl(var(--border));
                --fc-button-bg-color: hsl(var(--primary));
                --fc-button-border-color: hsl(var(--primary));
                --fc-button-hover-bg-color: hsl(var(--primary));
                --fc-button-hover-border-color: hsl(var(--primary));
                --fc-button-active-bg-color: hsl(var(--primary));
                --fc-button-active-border-color: hsl(var(--primary));
                --fc-event-border-color: transparent;
                --fc-today-bg-color: hsl(var(--accent) / 0.1);
                --fc-page-bg-color: transparent;
                --fc-neutral-bg-color: hsl(var(--muted));
                --fc-list-event-hover-bg-color: hsl(var(--accent));
                --fc-highlight-color: hsl(var(--accent) / 0.1);
              }
              .fc .fc-button {
                padding: 0.5rem 1rem;
                font-weight: 500;
                border-radius: 0.375rem;
                color: white;
              }
              .fc .fc-toolbar-title {
                font-size: 1.25rem;
                font-weight: 600;
                color: hsl(var(--foreground));
              }
              .fc .fc-event {
                border-radius: 0.25rem;
                padding: 2px 4px;
                font-size: 0.875rem;
              }
              .fc .fc-day:hover {
                background-color: hsl(var(--accent) / 0.1);
                cursor: pointer;
              }
              .fc .fc-col-header-cell {
                padding: 8px 0;
                background-color: hsl(var(--muted)) !important;
              }
              .fc .fc-col-header-cell.fc-day-sun {
                background-color: hsl(var(--muted)) !important;
              }
              .fc .fc-col-header-cell-cushion {
                color: hsl(var(--foreground));
                font-weight: 500;
                padding: 4px;
              }
              .fc .fc-daygrid-day-number {
                color: hsl(var(--foreground));
                padding: 8px;
              }
              .fc .fc-day-today {
                background-color: hsl(var(--accent) / 0.1) !important;
              }
              .fc .fc-day-today .fc-daygrid-day-number {
                font-weight: 600;
              }
              .fc .fc-button-primary:disabled {
                background-color: hsl(var(--primary) / 0.5);
                border-color: hsl(var(--primary) / 0.5);
              }
              /* Time grid specific styles */
              .fc .fc-timegrid-slot-label {
                color: hsl(var(--foreground));
                font-size: 0.875rem;
              }
              .fc .fc-timegrid-axis-cushion {
                color: hsl(var(--foreground));
                font-size: 0.875rem;
              }
              .fc .fc-timegrid-slot-minor {
                border-top-style: dashed;
              }
              .fc .fc-timegrid-now-indicator-line {
                border-color: hsl(var(--destructive));
              }
              .fc .fc-timegrid-now-indicator-arrow {
                border-color: hsl(var(--destructive));
              }
              .fc .fc-timegrid-col-frame {
                background-color: transparent;
              }
              /* Week view specific styles */
              .fc .fc-timegrid-col-header {
                background-color: hsl(var(--muted));
                padding: 8px 0;
              }
              .fc .fc-timegrid-col-header-cushion {
                color: hsl(var(--foreground));
                font-weight: 500;
                padding: 4px;
              }
              /* Event styles */
              .fc-direction-ltr .fc-daygrid-event.fc-event-end {
                margin-right: 4px;
              }
              .fc-direction-ltr .fc-daygrid-event.fc-event-start {
                margin-left: 4px;
              }
              /* Time slots */
              .fc .fc-timegrid-slot {
                height: 2.5rem;
              }
              .fc .fc-timegrid-slot-label-cushion {
                color: hsl(var(--foreground));
                font-size: 0.875rem;
              }
              /* Current time indicator */
              .fc .fc-timegrid-now-indicator-container {
                color: hsl(var(--destructive));
              }
            `}
          </style>
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay',
            }}
            events={events}
            eventClick={handleEventClick}
            dateClick={handleDateClick}
            height="auto"
            aspectRatio={1.8}
            editable={true}
            selectable={true}
            selectMirror={true}
            dayMaxEvents={true}
            weekends={true}
            nowIndicator={true}
            eventTimeFormat={{
              hour: 'numeric',
              minute: '2-digit',
              meridiem: true,
              hour12: true
            }}
            slotMinTime="06:00:00"
            slotMaxTime="22:00:00"
            eventDrop={handleEventDrop}
            slotDuration="00:30:00"
            allDaySlot={true}
            slotLabelFormat={{
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            }}
          />
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