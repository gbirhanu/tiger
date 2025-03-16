import { useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, QUERY_KEYS } from '@/lib/queryClient';
import { Task, UserSettings, Meeting, Appointment } from '@shared/schema';
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
import { Loader2, Pencil, Trash2, Plus, Calendar as CalendarIcon, Clock, Users, MapPin, Video } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { getUserTimezone, formatDate, getNow } from '@/lib/timezone';
import { TimeSelect } from "./TimeSelect";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { getMeetings, getAppointments, createMeeting, updateMeeting, deleteMeeting } from '@/lib/api';
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "@/lib/utils";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";

// Define event types for visual distinction
enum EventType {
  TASK = 'task',
  MEETING = 'meeting',
  APPOINTMENT = 'appointment'
}

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
    type: EventType;
    location?: string;
    attendees?: string;
  };
}

interface NewTaskForm {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  due_date: Date | null;
  all_day: boolean;
  eventType?: EventType;
}

// Create a schema for meeting form
const meetingFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  meetingLink: z.string().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
});

type MeetingFormValues = z.infer<typeof meetingFormSchema>;

export default function CalendarView() {
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
    eventType: EventType.TASK,
  });
  const [activeTab, setActiveTab] = useState<string>("all");

  // Add state for dialog open control
  const [newTaskDialogOpen, setNewTaskDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
  const [isEditingMeeting, setIsEditingMeeting] = useState(false);
  const [selectedMeetingId, setSelectedMeetingId] = useState<number | null>(null);
  const [eventTypeSelectOpen, setEventTypeSelectOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [startDatePickerOpen, setStartDatePickerOpen] = useState(false);
  const [endDatePickerOpen, setEndDatePickerOpen] = useState(false);

  // Meeting form
  const meetingForm = useForm<MeetingFormValues>({
    resolver: zodResolver(meetingFormSchema),
    defaultValues: {
      title: "",
      description: "",
      meetingLink: "",
      startDate: selectedDate || getNow(),
      endDate: selectedDate ? new Date(selectedDate.getTime() + 60 * 60 * 1000) : new Date(getNow().getTime() + 60 * 60 * 1000),
    },
  });

  // Reset meeting form when selectedDate changes
  useEffect(() => {
    if (selectedDate) {
      const endDate = new Date(selectedDate.getTime() + 60 * 60 * 1000); // 1 hour later
      meetingForm.reset({
        ...meetingForm.getValues(),
        startDate: selectedDate,
        endDate: endDate
      });
    }
  }, [selectedDate, meetingForm]);

  // Create meeting mutation
  const createMeetingMutation = useMutation({
    mutationFn: async (data: MeetingFormValues) => {
      console.log("Meeting mutation called with data:", data);
      console.log("isEditingMeeting:", isEditingMeeting);
      console.log("selectedMeetingId:", selectedMeetingId);
      
      // Validate dates exist
      if (!data.startDate || !data.endDate) {
        throw new Error("Start and end times are required");
      }
      
      // Validate end time is after start time
      if (data.endDate <= data.startDate) {
        throw new Error("End time must be after start time");
      }
      
      // Format the data for the API
      const meeting = {
        title: data.title,
        description: data.description || null,
        location: data.meetingLink || null,
        start_time: Math.floor(data.startDate.getTime() / 1000),
        end_time: Math.floor(data.endDate.getTime() / 1000),
        attendees: null,
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000)
      };
      
      // If we're editing an existing meeting, update it
      if (isEditingMeeting && selectedMeetingId) {
        console.log("Updating existing meeting with ID:", selectedMeetingId);
        
        try {
          // Use the updateMeeting function from the API
          const updatedMeeting = await updateMeeting(selectedMeetingId, {
            ...meeting,
            id: selectedMeetingId
          });
          
          console.log("API update successful:", updatedMeeting);
          return updatedMeeting;
        } catch (error) {
          console.error("Error updating meeting via API:", error);
          throw error;
        }
      }
      
      // Otherwise, create a new meeting
      console.log("Creating new meeting");
      return createMeeting(meeting);
    },
    onMutate: async (data) => {
      console.log("Optimistically updating meetings cache");
      
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.MEETINGS] });
      
      // Get a snapshot of the current meetings
      const previousMeetings = queryClient.getQueryData<Meeting[]>([QUERY_KEYS.MEETINGS]) || [];
      
      // Create a proper deep copy to avoid reference issues
      const previousMeetingsCopy = JSON.parse(JSON.stringify(previousMeetings));
      
      // If we're editing an existing meeting
      if (isEditingMeeting && selectedMeetingId) {
        // Create an optimistic updated meeting
        const updatedMeeting = {
          id: selectedMeetingId,
          title: data.title,
          description: data.description || null,
          location: data.meetingLink || null,
          start_time: Math.floor(data.startDate!.getTime() / 1000),
          end_time: Math.floor(data.endDate!.getTime() / 1000),
          attendees: null,
          created_at: Math.floor(Date.now() / 1000),
          updated_at: Math.floor(Date.now() / 1000)
        };
        
        // Create a deep copy of the meetings array
        const updatedMeetings = JSON.parse(JSON.stringify(previousMeetings));
        
        // Find the meeting to update
        const meetingIndex = updatedMeetings.findIndex((meeting: Meeting) => meeting.id === selectedMeetingId);
        
        if (meetingIndex !== -1) {
          // Update the meeting in the array
          updatedMeetings[meetingIndex] = {
            ...updatedMeetings[meetingIndex],
            ...updatedMeeting
          };
          
          // Update the cache with the new array
          queryClient.setQueryData<Meeting[]>([QUERY_KEYS.MEETINGS], updatedMeetings);
        }
      } else {
        // Create an optimistic new meeting
        const optimisticMeeting = {
          id: Date.now(), // Temporary ID
          user_id: 1, // Temporary user ID
          title: data.title,
          description: data.description || null,
          location: data.meetingLink || null,
          start_time: Math.floor(data.startDate!.getTime() / 1000),
          end_time: Math.floor(data.endDate!.getTime() / 1000),
          attendees: null,
          created_at: Math.floor(Date.now() / 1000),
          updated_at: Math.floor(Date.now() / 1000)
        };
        
        // Create a deep copy of the meetings array and add the new meeting
        const updatedMeetings = JSON.parse(JSON.stringify(previousMeetings));
        updatedMeetings.push(optimisticMeeting);
        
        // Update the cache with the new array
        queryClient.setQueryData<Meeting[]>([QUERY_KEYS.MEETINGS], updatedMeetings);
      }
      
      return { previousMeetings: previousMeetingsCopy };
    },
    onError: (error: Error, _variables, context) => {
      console.error("Meeting mutation error:", error);
      
      // If the mutation fails, use the context to roll back
      if (context?.previousMeetings) {
        console.log("Rolling back to previous meetings state");
        queryClient.setQueryData<Meeting[]>([QUERY_KEYS.MEETINGS], context.previousMeetings);
      }
      
      toast({
        variant: "destructive",
        title: isEditingMeeting ? "Failed to update meeting" : "Failed to create meeting",
        description: error.message || "An error occurred while processing your request.",
      });
    },
    onSuccess: (data) => {
      console.log("Meeting mutation successful with data:", data);
      
      // Invalidate queries to refresh data from server
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MEETINGS] });
      
      // Reset form and close dialog
      meetingForm.reset();
      setMeetingDialogOpen(false);
      
      // Reset editing state
      const wasEditing = isEditingMeeting;
      setIsEditingMeeting(false);
      setSelectedMeetingId(null);
      
      // Show success toast
      toast({
        title: wasEditing ? "Meeting updated" : "Meeting created",
        description: wasEditing 
          ? "Your meeting has been updated successfully." 
          : "Your meeting has been scheduled successfully.",
      });
    },
  });

  // Add delete meeting mutation
  const deleteMeetingMutation = useMutation({
    mutationFn: async (meetingId: number) => {
      console.log("Deleting meeting with ID:", meetingId);
      try {
        // Use the deleteMeeting function from the API
        await deleteMeeting(meetingId);
        console.log("Meeting deleted successfully");
        return { success: true };
      } catch (error) {
        console.error("Error deleting meeting:", error);
        throw error;
      }
    },
    onMutate: async (meetingId) => {
      console.log("Optimistically deleting meeting from cache:", meetingId);
      
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.MEETINGS] });
      
      // Get a snapshot of the current meetings
      const previousMeetings = queryClient.getQueryData<Meeting[]>([QUERY_KEYS.MEETINGS]) || [];
      
      // Create a proper deep copy to avoid reference issues
      const previousMeetingsCopy = JSON.parse(JSON.stringify(previousMeetings));
      
      // Create a deep copy of the meetings array and filter out the deleted meeting
      const updatedMeetings = JSON.parse(JSON.stringify(previousMeetings))
        .filter((meeting: Meeting) => meeting.id !== meetingId);
      
      console.log(`Optimistically removed meeting. Remaining meetings: ${updatedMeetings.length}`);
      
      // Update the cache with the filtered array
      queryClient.setQueryData<Meeting[]>([QUERY_KEYS.MEETINGS], updatedMeetings);
      
      return { previousMeetings: previousMeetingsCopy };
    },
    onError: (error: Error, _variables, context) => {
      console.error("Delete meeting error:", error);
      
      // If the mutation fails, use the context to roll back
      if (context?.previousMeetings) {
        console.log("Rolling back to previous meetings state");
        queryClient.setQueryData<Meeting[]>([QUERY_KEYS.MEETINGS], context.previousMeetings);
      }
      
      toast({
        variant: "destructive",
        title: "Failed to delete meeting",
        description: error.message || "An error occurred while deleting the meeting.",
      });
    },
    onSuccess: () => {
      console.log("Delete meeting mutation successful");
      
      // Invalidate queries to refresh data from server
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MEETINGS] });
      
      // Reset editing state and close dialog
      setMeetingDialogOpen(false);
      setIsEditingMeeting(false);
      setSelectedMeetingId(null);
      
      // Show success toast
      toast({
        title: "Meeting deleted",
        description: "Your meeting has been deleted successfully.",
      });
    },
  });

  // Fetch tasks
  const { data: tasks = [], isLoading: isLoadingTasks } = useQuery<Task[]>({
    queryKey: ['/api/tasks'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/tasks');
      return res.json();
    },
  });

  // Fetch meetings
  const { data: meetings = [], isLoading: isLoadingMeetings } = useQuery<Meeting[]>({
    queryKey: [QUERY_KEYS.MEETINGS],
    queryFn: getMeetings,
  });

  // Fetch appointments
  const { data: appointments = [], isLoading: isLoadingAppointments } = useQuery<Appointment[]>({
    queryKey: ['/api/appointments'],
    queryFn: getAppointments,
  });

  // Add timezone query
  const { data: settings } = useQuery({
    queryKey: ['/api/user-settings'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/user-settings');
      return res.json();
    },
  });

  // Get user settings for timezone
  const { data: userSettings } = useQuery<UserSettings>({
    queryKey: [QUERY_KEYS.SETTINGS],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  
  const timezone = getUserTimezone();

  // Create task mutation
  const createTask = useMutation({
    mutationFn: async (taskData: NewTaskForm) => {
      console.log("Creating task with data:", taskData);
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
    onMutate: async (taskData) => {
      console.log("Optimistically creating task in cache");
      
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['/api/tasks'] });
      
      // Get a snapshot of the current tasks
      const previousTasks = queryClient.getQueryData<Task[]>(['/api/tasks']) || [];
      
      // Create a proper deep copy to avoid reference issues
      const previousTasksCopy = JSON.parse(JSON.stringify(previousTasks));
      
      // Create an optimistic task with a temporary ID
      const optimisticTask = {
        id: Date.now(), // Temporary ID
        title: taskData.title,
        description: taskData.description || null,
        priority: taskData.priority,
        completed: false,
        due_date: taskData.due_date ? Math.floor(taskData.due_date.getTime() / 1000) : null,
        all_day: taskData.all_day,
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000)
      };
      
      // Create a deep copy of the tasks array and add the new task
      const updatedTasks = JSON.parse(JSON.stringify(previousTasks));
      updatedTasks.push(optimisticTask);
      
      console.log(`Optimistically added task. Total tasks: ${updatedTasks.length}`);
      
      // Update the cache with the new array
      queryClient.setQueryData<Task[]>(['/api/tasks'], updatedTasks);
      
      return { previousTasks: previousTasksCopy };
    },
    onSuccess: (newTask) => {
      console.log("Task created successfully:", newTask);
      
      // Invalidate queries to refresh data from server
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      
      setShowNewTaskDialog(false);
      setNewTask({
        title: '',
        description: '',
        priority: 'medium',
        due_date: null,
        all_day: true,
        eventType: EventType.TASK,
      });
      
      toast({
        title: 'Task created',
        description: 'Your task has been created successfully.',
      });
    },
    onError: (error: Error, _variables, context) => {
      console.error('Task creation error:', error);
      
      // If the mutation fails, use the context to roll back
      if (context?.previousTasks) {
        console.log("Rolling back to previous tasks state");
        queryClient.setQueryData<Task[]>(['/api/tasks'], context.previousTasks);
      }
      
      toast({
        variant: 'destructive',
        title: 'Failed to create task',
        description: error.message || 'An error occurred. Please try again.',
        className: 'dark:bg-red-950 dark:text-white dark:border-red-800',
      });
    },
  });

  // Update task mutation
  const updateTask = useMutation({
    mutationFn: async (taskData: Partial<Task> & { id: number }) => {
      console.log("Updating task with data:", taskData);
      const res = await apiRequest('PATCH', `/api/tasks/${taskData.id}`, taskData);
      return res.json();
    },
    onMutate: async (taskData) => {
      console.log("Optimistically updating task in cache:", taskData.id);
      
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['/api/tasks'] });
      
      // Get a snapshot of the current tasks
      const previousTasks = queryClient.getQueryData<Task[]>(['/api/tasks']) || [];
      
      // Create a proper deep copy to avoid reference issues
      const previousTasksCopy = JSON.parse(JSON.stringify(previousTasks));
      
      // Create a deep copy of the tasks array
      const updatedTasks = JSON.parse(JSON.stringify(previousTasks));
      
      // Find the task to update
      const taskIndex = updatedTasks.findIndex((task: Task) => task.id === taskData.id);
      
      if (taskIndex !== -1) {
        // Create updated task by merging objects
        updatedTasks[taskIndex] = {
          ...updatedTasks[taskIndex],  // Keep ALL existing fields
          ...taskData,                 // Apply updates
          updated_at: Math.floor(Date.now() / 1000) // Update the timestamp
        };
        
        console.log(`Optimistically updated task at index ${taskIndex}`);
        
        // Update the cache with the new array
        queryClient.setQueryData<Task[]>(['/api/tasks'], updatedTasks);
      } else {
        console.warn(`Task with id ${taskData.id} not found in cache`);
      }
      
      return { previousTasks: previousTasksCopy };
    },
    onSuccess: (updatedTask) => {
      console.log("Task updated successfully:", updatedTask);
      
      // Invalidate queries to refresh data from server
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      
      setShowTaskDialog(false);
      setIsEditing(false);
      
      toast({
        title: 'Task updated',
        description: 'Your task has been updated successfully.',
      });
    },
    onError: (error: Error, _variables, context) => {
      console.error('Task update error:', error);
      
      // If the mutation fails, use the context to roll back
      if (context?.previousTasks) {
        console.log("Rolling back to previous tasks state");
        queryClient.setQueryData<Task[]>(['/api/tasks'], context.previousTasks);
      }
      
      toast({
        variant: 'destructive',
        title: 'Failed to update task',
        description: error.message || 'An error occurred. Please try again.',
        className: 'dark:bg-red-950 dark:text-white dark:border-red-800',
      });
    },
  });

  // Delete task mutation
  const deleteTask = useMutation({
    mutationFn: async (taskId: number) => {
      console.log("Deleting task with ID:", taskId);
      await apiRequest('DELETE', `/api/tasks/${taskId}`);
      return { success: true, id: taskId };
    },
    onMutate: async (taskId) => {
      console.log("Optimistically deleting task from cache:", taskId);
      
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['/api/tasks'] });
      
      // Get a snapshot of the current tasks
      const previousTasks = queryClient.getQueryData<Task[]>(['/api/tasks']) || [];
      
      // Create a proper deep copy to avoid reference issues
      const previousTasksCopy = JSON.parse(JSON.stringify(previousTasks));
      
      // Create a deep copy of the tasks array and filter out the deleted task
      const updatedTasks = JSON.parse(JSON.stringify(previousTasks))
        .filter((task: Task) => task.id !== taskId);
      
      console.log(`Optimistically removed task. Remaining tasks: ${updatedTasks.length}`);
      
      // Update the cache with the filtered array
      queryClient.setQueryData<Task[]>(['/api/tasks'], updatedTasks);
      
      return { previousTasks: previousTasksCopy };
    },
    onSuccess: (result) => {
      console.log("Task deleted successfully:", result);
      
      // Invalidate queries to refresh data from server
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      
      setShowTaskDialog(false);
      
      toast({
        title: 'Task deleted',
        description: 'Your task has been deleted successfully.',
      });
    },
    onError: (error: Error, _variables, context) => {
      console.error('Task deletion error:', error);
      
      // If the mutation fails, use the context to roll back
      if (context?.previousTasks) {
        console.log("Rolling back to previous tasks state");
        queryClient.setQueryData<Task[]>(['/api/tasks'], context.previousTasks);
      }
      
      toast({
        variant: 'destructive',
        title: 'Failed to delete task',
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

  // Convert tasks, meetings, and appointments to calendar events
  useEffect(() => {
    if (!tasks && !meetings && !appointments) return;

    let calendarEvents: CalendarEvent[] = [];

    // Process tasks
    if (tasks) {
      const taskEvents = tasks.map(task => {
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
          id: `task_${task.id}`,
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
            type: EventType.TASK
          },
        };
      }).filter(event => event.start);

      calendarEvents = [...calendarEvents, ...taskEvents];
    }

    // Process meetings
    if (meetings) {
      const meetingEvents = meetings.map(meeting => {
        // Meeting-specific styling
        const backgroundColor = '#4F46E5'; // Indigo for meetings
        const borderColor = '#4338CA';

        return {
          id: `meeting_${meeting.id}`,
          title: meeting.title,
          start: new Date(meeting.start_time * 1000).toISOString(),
          end: new Date(meeting.end_time * 1000).toISOString(),
          allDay: false,
          backgroundColor,
          borderColor,
          textColor: '#ffffff',
          extendedProps: {
            description: meeting.description || undefined,
            type: EventType.MEETING,
            location: meeting.location || undefined,
            attendees: meeting.attendees || undefined
          },
        };
      });

      calendarEvents = [...calendarEvents, ...meetingEvents];
    }

    // Process appointments
    if (appointments) {
      const appointmentEvents = appointments.map(appointment => {
        // Appointment-specific styling
        const backgroundColor = '#8B5CF6'; // Purple for appointments
        const borderColor = '#7C3AED';

        return {
          id: `appointment_${appointment.id}`,
          title: appointment.title,
          start: new Date(appointment.start_time * 1000).toISOString(),
          end: new Date(appointment.end_time * 1000).toISOString(),
          allDay: appointment.all_day,
          backgroundColor,
          borderColor,
          textColor: '#ffffff',
          extendedProps: {
            description: appointment.description || undefined,
            type: EventType.APPOINTMENT
          },
        };
      });

      calendarEvents = [...calendarEvents, ...appointmentEvents];
    }

    // Filter events based on active tab
    if (activeTab !== "all") {
      calendarEvents = calendarEvents.filter(event => 
        event.extendedProps?.type === activeTab
      );
    }

    setEvents(calendarEvents);
  }, [tasks, meetings, appointments, activeTab]);

  const handleEventClick = (info: any) => {
    const event = info.event;
    const eventId = event.id;
    const eventType = event.extendedProps?.type;
    
    // Handle different event types
    if (eventType === EventType.TASK) {
      const taskId = parseInt(eventId.replace('task_', ''));
      const task = tasks.find(t => t.id === taskId);
      
      if (task) {
        // Check if task is completed - if so, just show a toast with details
        if (task.completed) {
          toast({
            title: task.title,
            description: (
              <div className="space-y-2">
                <p>{task.description || 'No description'}</p>
                <p className="text-xs text-muted-foreground">
                  {task.due_date ? formatInTimeZone(new Date(typeof task.due_date === 'number' ? task.due_date * 1000 : task.due_date), timezone, 'PPp') : 'No due date'}
                </p>
                <div className="flex items-center mt-1">
                  <span className="inline-flex items-center text-xs text-green-600 font-medium">
                    <span className="relative flex h-2.5 w-2.5 mr-1.5">
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-600"></span>
                      <span className="absolute inset-0 flex items-center justify-center text-white text-[6px]">✓</span>
                    </span>
                    Completed
                  </span>
                </div>
              </div>
            ),
            variant: "default",
            duration: 5000,
          });
          return;
        }
        
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
          eventType: EventType.TASK,
        });
        
        // Set editing mode immediately
        setIsEditing(true);
        setShowTaskDialog(true);
        setTaskDialogOpen(true);
      }
    } else if (eventType === EventType.MEETING) {
      // For meetings, open the meeting dialog with the meeting data
      const meetingId = parseInt(eventId.replace('meeting_', ''));
      const meeting = meetings.find(m => m.id === meetingId);
      
      if (meeting) {
        // Set the meeting form data
        meetingForm.reset({
          title: meeting.title,
          description: meeting.description || "",
          meetingLink: meeting.location || "",
          startDate: new Date(meeting.start_time * 1000),
          endDate: new Date(meeting.end_time * 1000),
        });
        
        // Set editing mode
        setIsEditingMeeting(true);
        setSelectedMeetingId(meeting.id);
        
        // Open the meeting dialog
        setMeetingDialogOpen(true);
        
        // Show a toast to indicate editing mode
        toast({
          title: "Edit Meeting",
          description: "You can now edit the meeting details.",
          variant: "default",
          duration: 3000,
        });
      }
    } else if (eventType === EventType.APPOINTMENT) {
      // For appointments, show details with option to edit
      const appointmentId = parseInt(eventId.replace('appointment_', ''));
      const appointment = appointments.find(a => a.id === appointmentId);
      
      if (appointment) {
        toast({
          title: appointment.title,
          description: (
            <div className="space-y-2">
              <p>{appointment.description || 'No description'}</p>
              <p className="text-xs">{formatInTimeZone(new Date(appointment.start_time * 1000), timezone, 'PPp')}</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2"
                onClick={() => window.location.href = '/appointments'}
              >
                <Pencil className="h-3 w-3 mr-1" />
                Edit Appointment
              </Button>
            </div>
          ),
          variant: "default",
          duration: 5000,
        });
      }
    }
  };

  const handleDateClick = (info: any) => {
    const clickedDate = new Date(info.dateStr);
    // If clicked in a time slot, set the specific time
    if (info.view.type !== 'dayGridMonth') {
      const hours = info.date.getHours();
      const minutes = info.date.getMinutes();
      clickedDate.setHours(hours, minutes, 0, 0);
    } else {
      // For month view, set as all-day event
      clickedDate.setHours(9, 0, 0, 0); // Default to 9 AM for all-day events
    }
    
    // Store the selected date and open the event type selection dialog
    setSelectedDate(clickedDate);
    setEventTypeSelectOpen(true);
  };

  // Function to handle event type selection after clicking on a date
  const handleEventTypeSelect = (type: EventType) => {
    if (!selectedDate) return;
    
    setEventTypeSelectOpen(false);
    
    if (type === EventType.TASK) {
      setNewTask({
        title: '',
        description: '',
        priority: 'medium',
        due_date: selectedDate,
        all_day: selectedDate.getHours() === 9 && selectedDate.getMinutes() === 0,
        eventType: EventType.TASK,
      });
      setShowNewTaskDialog(true);
      setNewTaskDialogOpen(true);
    } else if (type === EventType.MEETING) {
      // Open meeting dialog with the selected date
      const endDate = new Date(selectedDate.getTime() + 60 * 60 * 1000);
      meetingForm.reset({
        title: "",
        description: "",
        meetingLink: "",
        startDate: selectedDate,
        endDate: endDate,
      });
      setIsEditingMeeting(false);
      setSelectedMeetingId(null);
      setMeetingDialogOpen(true);
    } else if (type === EventType.APPOINTMENT) {
      setNewTask({
        title: 'New Appointment',
        description: '',
        priority: 'medium',
        due_date: selectedDate,
        all_day: selectedDate.getHours() === 9 && selectedDate.getMinutes() === 0,
        eventType: EventType.APPOINTMENT,
      });
      setShowNewTaskDialog(true);
      setNewTaskDialogOpen(true);
    }
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
    
    // If it's an appointment, handle differently
    if (newTask.eventType === EventType.APPOINTMENT) {
      // Create an appointment instead of a task
      toast({
        title: "Appointment created",
        description: `Your appointment "${newTask.title}" has been created.`,
      });
      
      // Close the dialog
      setShowNewTaskDialog(false);
      setNewTaskDialogOpen(false);
      
      // Add the appointment directly to the events list
      const newAppointment: CalendarEvent = {
        id: `appointment_${Date.now()}`,
        title: newTask.title,
        start: newTask.due_date ? newTask.due_date.toISOString() : new Date().toISOString(),
        end: newTask.due_date ? new Date(newTask.due_date.getTime() + 60 * 60 * 1000).toISOString() : new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        allDay: newTask.all_day,
        backgroundColor: '#8B5CF6', // Purple for appointments
        borderColor: '#7C3AED',
        textColor: '#ffffff',
        extendedProps: {
          description: newTask.description || undefined,
          type: EventType.APPOINTMENT
        },
      };
      
      setEvents(prev => [...prev, newAppointment]);
      return;
    }
    
    // Otherwise, create a regular task
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
      /* Fix for header color inconsistency */
      .fc .fc-col-header-cell {
        background-color: var(--background) !important;
      }
      .fc .fc-col-header-cell-cushion {
        color: var(--foreground);
        font-weight: 600;
        padding: 8px 4px;
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
      /* Event styling - ensure these are applied */
      .fc .fc-event {
        border-radius: 4px;
        padding: 2px 6px;
        font-size: 0.875rem;
        border-width: 2px !important;
        overflow: visible !important;
      }
      
      /* Fix for event visibility */
      .fc-daygrid-event-harness {
        margin-top: 2px !important;
      }
      
      .fc-event-main {
        padding: 2px 4px !important;
      }
      
      /* Ensure colors are applied to events */
      .fc .fc-event.task-event {
        background-color: var(--event-bg-color, #10B981) !important;
        border-color: var(--event-border-color, #059669) !important;
        color: white !important;
        z-index: 5 !important;
      }
      .fc .fc-event.meeting-event {
        background-color: var(--event-bg-color, #4F46E5) !important;
        border-color: var(--event-border-color, #4338CA) !important;
        color: white !important;
        z-index: 5 !important;
      }
      .fc .fc-event.appointment-event {
        background-color: var(--event-bg-color, #8B5CF6) !important;
        border-color: var(--event-border-color, #7C3AED) !important;
        color: white !important;
        z-index: 5 !important;
      }
      /* Task priority colors */
      .fc .fc-event.high-priority {
        background-color: #DC2626 !important;
        border-color: #B91C1C !important;
        z-index: 6 !important;
      }
      .fc .fc-event.medium-priority {
        background-color: #F59E0B !important;
        border-color: #D97706 !important;
        z-index: 5 !important;
      }
      .fc .fc-event.low-priority {
        background-color: #10B981 !important;
        border-color: #059669 !important;
        z-index: 4 !important;
      }
      .fc .fc-event.completed-task {
        background-color: #6B7280 !important;
        border-color: #4B5563 !important;
        z-index: 3 !important;
      }
      /* Day cell hover effect */
      .fc .fc-day:hover {
        background-color: hsl(var(--muted) / 0.5);
        cursor: pointer;
      }
      /* Remove the ::before pseudo-elements that add duplicate icons */
      .fc .fc-event.task-event::before,
      .fc .fc-event.meeting-event::before,
      .fc .fc-event.appointment-event::before {
        content: none !important;
      }
      /* Improve event title display */
      .fc .fc-event-title {
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      /* Add subtle hover effect to events */
      .fc .fc-event:hover {
        filter: brightness(1.1);
        transform: translateY(-1px);
        transition: all 0.2s ease;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      
      /* Improve event spacing */
      .fc-daygrid-day-events {
        margin-top: 2px !important;
        padding-top: 2px !important;
      }
      
      /* Make sure events don't get cut off */
      .fc-daygrid-event-harness {
        margin-bottom: 2px !important;
      }
      
      /* Improve time grid events */
      .fc-timegrid-event {
        padding: 2px 4px !important;
        border-radius: 4px !important;
      }
      
      /* Make sure event content is visible */
      .fc-event-main-frame {
        padding: 2px !important;
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

  // Update the calendar configuration to use the user's timezone
  const calendarOptions = {
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
    initialView: userSettings?.default_calendar_view === 'week' ? 'timeGridWeek' : 
                 userSettings?.default_calendar_view === 'day' ? 'timeGridDay' : 
                 'dayGridMonth',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay',
    },
    editable: true,
    selectable: true,
    selectMirror: true,
    dayMaxEvents: true,
    weekends: true,
    events: events,
    eventClick: handleEventClick,
    dateClick: handleDateClick,
    eventDrop: handleEventDrop,
    timeZone: timezone, // Set the timezone from user settings
    eventTimeFormat: {
      hour: '2-digit',
      minute: '2-digit',
      meridiem: 'short'
    } as any,
    slotLabelFormat: {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    } as any,
    // Add custom event rendering
    eventDidMount: (info: any) => {
      // Add tooltip with event details
      const eventType = info.event.extendedProps?.type;
      let tooltipContent = `<div class="p-2">
        <div class="font-bold">${info.event.title}</div>`;
      
      if (info.event.extendedProps?.description) {
        tooltipContent += `<div>${info.event.extendedProps.description}</div>`;
      }
      
      if (eventType === EventType.TASK) {
        tooltipContent += `<div class="text-xs mt-1">Priority: ${info.event.extendedProps?.priority || 'None'}</div>`;
        tooltipContent += `<div class="text-xs">Status: ${info.event.extendedProps?.completed ? 'Completed' : 'Pending'}</div>`;
        
        // Add priority class
        if (info.event.extendedProps?.priority === 'high') {
          info.el.classList.add('high-priority');
        } else if (info.event.extendedProps?.priority === 'medium') {
          info.el.classList.add('medium-priority');
        } else if (info.event.extendedProps?.priority === 'low') {
          info.el.classList.add('low-priority');
        }
        
        // Add completed class
        if (info.event.extendedProps?.completed) {
          info.el.classList.add('completed-task');
        }
      } else if (eventType === EventType.MEETING) {
        if (info.event.extendedProps?.location) {
          tooltipContent += `<div class="text-xs mt-1">Location: ${info.event.extendedProps.location}</div>`;
        }
        if (info.event.extendedProps?.attendees) {
          tooltipContent += `<div class="text-xs">Attendees: ${info.event.extendedProps.attendees}</div>`;
        }
      }
      
      tooltipContent += `</div>`;
      
      // Use title attribute for simple tooltip
      info.el.setAttribute('title', info.event.title + 
        (info.event.extendedProps?.description ? ` - ${info.event.extendedProps.description}` : ''));
      
      // Add event type as a class for custom styling
      if (eventType) {
        info.el.classList.add(`${eventType}-event`);
        
        // Apply background and border colors directly to the event element
        if (eventType === EventType.TASK) {
          // Apply colors directly to the event element
          info.el.style.backgroundColor = info.event.backgroundColor;
          info.el.style.borderColor = info.event.borderColor;
          
          // Also apply to inner elements to ensure visibility
          const eventMainEl = info.el.querySelector('.fc-event-main');
          if (eventMainEl) {
            eventMainEl.style.backgroundColor = info.event.backgroundColor;
            eventMainEl.style.borderColor = info.event.borderColor;
          }
          
          // Make sure text is visible
          const titleEl = info.el.querySelector('.fc-event-title');
          if (titleEl) {
            titleEl.style.color = '#ffffff';
            titleEl.style.fontWeight = 'bold';
          }
          
          const timeEl = info.el.querySelector('.fc-event-time');
          if (timeEl) {
            timeEl.style.color = '#ffffff';
          }
        } else if (eventType === EventType.MEETING) {
          info.el.style.backgroundColor = '#4F46E5';
          info.el.style.borderColor = '#4338CA';
          
          // Also apply to inner elements
          const eventMainEl = info.el.querySelector('.fc-event-main');
          if (eventMainEl) {
            eventMainEl.style.backgroundColor = '#4F46E5';
            eventMainEl.style.borderColor = '#4338CA';
          }
        } else if (eventType === EventType.APPOINTMENT) {
          info.el.style.backgroundColor = '#8B5CF6';
          info.el.style.borderColor = '#7C3AED';
          
          // Also apply to inner elements
          const eventMainEl = info.el.querySelector('.fc-event-main');
          if (eventMainEl) {
            eventMainEl.style.backgroundColor = '#8B5CF6';
            eventMainEl.style.borderColor = '#7C3AED';
          }
        }
      }
      
      // Add hover effect
      info.el.addEventListener('mouseenter', () => {
        info.el.style.transform = 'translateY(-2px)';
        info.el.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
        info.el.style.transition = 'all 0.2s ease';
      });
      
      info.el.addEventListener('mouseleave', () => {
        info.el.style.transform = 'translateY(0)';
        info.el.style.boxShadow = 'none';
      });
    },
    // Customize the day header cells
    dayHeaderContent: (args: any) => {
      const day = args.date.getDay();
      const isWeekend = day === 0 || day === 6;
      return {
        html: `<div class="${isWeekend ? 'text-red-500 font-medium' : ''}">${args.text}</div>`
      };
    },
    // Add business hours highlighting
    businessHours: {
      daysOfWeek: [1, 2, 3, 4, 5], // Monday - Friday
      startTime: userSettings?.work_start_hour ? 
        `${Math.floor(userSettings.work_start_hour)}:${Math.round((userSettings.work_start_hour % 1) * 60) || '00'}` : 
        '09:00',
      endTime: userSettings?.work_end_hour ? 
        `${Math.floor(userSettings.work_end_hour)}:${Math.round((userSettings.work_end_hour % 1) * 60) || '00'}` : 
        '17:00',
    }
  };

  // When formatting dates for display or API calls, use the timezone utilities
  const formatDateForDisplay = (date: Date | string) => {
    if (typeof date === 'string') {
      date = new Date(date);
    }
    return formatDate(date, 'PPP p');
  };

  // Function to handle creating a new event based on type
  const handleCreateNewEvent = (type: string) => {
    if (type === 'task') {
      setNewTask({
        title: '',
        description: '',
        priority: 'medium',
        due_date: new Date(),
        all_day: true,
        eventType: EventType.TASK,
      });
      setShowNewTaskDialog(true);
      setNewTaskDialogOpen(true);
    } else if (type === 'meeting') {
      // Open the meeting dialog directly
      const now = getNow();
      meetingForm.reset({
        title: "",
        description: "",
        meetingLink: "",
        startDate: now,
        endDate: new Date(now.getTime() + 60 * 60 * 1000),
      });
      setIsEditingMeeting(false);
      setSelectedMeetingId(null);
      setMeetingDialogOpen(true);
    } else if (type === 'appointment') {
      // Show appointment creation dialog using the task dialog
      setNewTask({
        title: 'New Appointment',
        description: '',
        priority: 'medium',
        due_date: new Date(),
        all_day: false,
        eventType: EventType.APPOINTMENT,
      });
      setShowNewTaskDialog(true);
      setNewTaskDialogOpen(true);
    }
  };

  if (isLoadingTasks || isLoadingMeetings || isLoadingAppointments) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Create a legend component for event types
  const EventLegend = () => (
    <div className="flex flex-wrap gap-3 items-center mb-4 p-3 bg-muted/30 rounded-lg">
      <div className="text-sm font-medium">Legend:</div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-full bg-[#DC2626]"></div>
        <span className="text-xs">High Priority Task</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-full bg-[#F59E0B]"></div>
        <span className="text-xs">Medium Priority Task</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-full bg-[#10B981]"></div>
        <span className="text-xs">Low Priority Task</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-full bg-[#6B7280]"></div>
        <span className="text-xs">Completed Task</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-full bg-[#4F46E5]"></div>
        <span className="text-xs">Meeting</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-full bg-[#8B5CF6]"></div>
        <span className="text-xs">Appointment</span>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Calendar</h2>
        <div className="flex gap-2">
          <Button 
            onClick={() => handleCreateNewEvent('task')}
            className="bg-[#10B981] hover:bg-[#10B981]/90 text-white font-medium"
            size="sm"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add Task
          </Button>
          <Button 
            onClick={() => handleCreateNewEvent('meeting')}
            className="bg-[#4F46E5] hover:bg-[#4F46E5]/90 text-white font-medium"
            size="sm"
          >
            <Users className="mr-1.5 h-4 w-4" />
            Add Meeting
          </Button>
          <Button 
            onClick={() => handleCreateNewEvent('appointment')}
            className="bg-[#8B5CF6] hover:bg-[#8B5CF6]/90 text-white font-medium"
            size="sm"
          >
            <Clock className="mr-1.5 h-4 w-4" />
            Add Appointment
          </Button>
        </div>
      </div>

      {/* Event type filter tabs */}
      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-4 mb-4">
          <TabsTrigger value="all">All Events</TabsTrigger>
          <TabsTrigger value={EventType.TASK}>Tasks</TabsTrigger>
          <TabsTrigger value={EventType.MEETING}>Meetings</TabsTrigger>
          <TabsTrigger value={EventType.APPOINTMENT}>Appointments</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Event type legend */}
      <EventLegend />

      {/* Event counts */}
      <div className="flex flex-wrap gap-3 mb-2">
        <Badge variant="outline" className="bg-background">
          <div className="flex items-center gap-1.5">
            <CalendarIcon className="h-3.5 w-3.5 text-primary" />
            <span>Total: {events.length} events</span>
          </div>
        </Badge>
        <Badge variant="outline" className="bg-background">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#10B981]"></div>
            <span>{tasks.length} Tasks</span>
          </div>
        </Badge>
        <Badge variant="outline" className="bg-background">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#4F46E5]"></div>
            <span>{meetings.length} Meetings</span>
          </div>
        </Badge>
        <Badge variant="outline" className="bg-background">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#8B5CF6]"></div>
            <span>{appointments.length} Appointments</span>
          </div>
        </Badge>
      </div>

      <Card className="shadow-lg border rounded-lg overflow-hidden">
        <CardContent className="p-0">
          <div className="calendar-container p-2 md:p-4">
            <FullCalendar
              {...calendarOptions}
              eventContent={(eventInfo) => {
                const eventType = eventInfo.event.extendedProps?.type;
                let icon = null;
                
                // Add custom icons based on event type
                if (eventType === EventType.TASK) {
                  icon = <span className="mr-1 font-bold">✓</span>;
                } else if (eventType === EventType.MEETING) {
                  icon = <Users className="h-3 w-3 mr-1 inline" />;
                } else if (eventType === EventType.APPOINTMENT) {
                  icon = <Clock className="h-3 w-3 mr-1 inline" />;
                }
                
                // Create a more visually appealing event display
                return (
                  <div className="fc-event-main-frame w-full">
                    {eventInfo.timeText && (
                      <div className="fc-event-time text-xs font-medium">{eventInfo.timeText}</div>
                    )}
                    <div className="fc-event-title-container flex items-center">
                      <div className="fc-event-title fc-sticky flex items-center text-sm font-medium">
                        {icon}
                        <span className="truncate">{eventInfo.event.title}</span>
                      </div>
                    </div>
                  </div>
                );
              }}
              height="auto"
              aspectRatio={1.8}
              stickyHeaderDates={true}
              dayMaxEventRows={4}
              eventMaxStack={4}
              nowIndicator={true}
              eventDisplay="block"
              eventTextColor="#FFFFFF"
            />
          </div>
        </CardContent>
      </Card>

      {/* Meeting Dialog */}
      <Dialog open={meetingDialogOpen} onOpenChange={(open) => {
        setMeetingDialogOpen(open);
        if (!open) {
          setIsEditingMeeting(false);
          setSelectedMeetingId(null);
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center text-lg font-semibold">
              {isEditingMeeting ? (
                <>
                  <Pencil className="h-5 w-5 mr-2 text-indigo-500" />
                  Edit Meeting
                </>
              ) : (
                <>
                  <Users className="h-5 w-5 mr-2 text-indigo-500" />
                  Schedule New Meeting
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {isEditingMeeting 
                ? "Make changes to your meeting details below." 
                : "Fill in the details to schedule a new meeting."}
            </DialogDescription>
          </DialogHeader>
          <Form {...meetingForm}>
            <form
              onSubmit={meetingForm.handleSubmit((data) => {
                // Additional validation before submitting
                if (!data.startDate || !data.endDate) {
                  toast({
                    variant: "destructive",
                    title: "Missing date information",
                    description: "Please select both start and end times",
                  });
                  return;
                }
                
                if (data.endDate <= data.startDate) {
                  toast({
                    variant: "destructive",
                    title: "Invalid time range",
                    description: "End time must be after start time",
                  });
                  return;
                }
                
                createMeetingMutation.mutate(data);
              })}
              className="space-y-4 mt-4"
            >
              <FormField
                control={meetingForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center text-sm font-medium">
                      <span className="inline-flex items-center">
                        <span className="w-4 h-4 mr-2 flex items-center justify-center">
                          <span className="w-1 h-4 bg-indigo-500 rounded-full"></span>
                        </span>
                        Title
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter meeting title" 
                        {...field} 
                        className="border-input focus:ring-2 focus:ring-indigo-500/30"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={meetingForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center text-sm font-medium">
                      <span className="inline-flex items-center">
                        <span className="w-4 h-4 mr-2 flex items-center justify-center">
                          <span className="w-1 h-4 bg-indigo-500/70 rounded-full"></span>
                        </span>
                        Description
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter meeting description" 
                        {...field} 
                        className="min-h-[80px] border-input focus:ring-2 focus:ring-indigo-500/30"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={meetingForm.control}
                name="meetingLink"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center text-sm font-medium">
                      <span className="inline-flex items-center">
                        <Video className="h-3.5 w-3.5 mr-2 text-indigo-500" />
                        Meeting Link
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter video call link (Zoom, Meet, etc.)" 
                        {...field} 
                        className="border-input focus:ring-2 focus:ring-indigo-500/30"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={meetingForm.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="flex items-center text-sm font-medium">
                        <span className="inline-flex items-center">
                          <Clock className="h-3.5 w-3.5 mr-2 text-indigo-500" />
                          Start Time
                        </span>
                      </FormLabel>
                      <Popover open={startDatePickerOpen} onOpenChange={setStartDatePickerOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal border-input focus:ring-2 focus:ring-indigo-500/30",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4 text-indigo-500" />
                              {field.value ? (
                                formatDate(field.value, "PPP p")
                              ) : (
                                <span>Pick a date</span>
                              )}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start" side="top">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={(date) => {
                              // If we have a date, preserve the time
                              if (date) {
                                const newDate = new Date(date);
                                if (field.value) {
                                  newDate.setHours(
                                    field.value.getHours(),
                                    field.value.getMinutes()
                                  );
                                } else {
                                  // Default to current time
                                  const now = new Date();
                                  newDate.setHours(now.getHours(), now.getMinutes());
                                }
                                field.onChange(newDate);
                              } else {
                                field.onChange(undefined);
                                setStartDatePickerOpen(false);
                              }
                            }}
                            initialFocus
                          />
                          {field.value && (
                            <TimeSelect
                              value={field.value}
                              onChange={(newDate) => {
                                field.onChange(newDate);
                                // Don't close the popover automatically
                              }}
                              onComplete={() => {
                                setStartDatePickerOpen(false);
                              }}
                              compact={true}
                            />
                          )}
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={meetingForm.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="flex items-center text-sm font-medium">
                        <span className="inline-flex items-center">
                          <Clock className="h-3.5 w-3.5 mr-2 text-indigo-500" />
                          End Time
                        </span>
                      </FormLabel>
                      <Popover open={endDatePickerOpen} onOpenChange={setEndDatePickerOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal border-input focus:ring-2 focus:ring-indigo-500/30",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4 text-indigo-500" />
                              {field.value ? (
                                formatDate(field.value, "PPP p")
                              ) : (
                                <span>Pick a date</span>
                              )}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start" side="top">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={(date) => {
                              // If we have a date, preserve the time
                              if (date) {
                                const newDate = new Date(date);
                                if (field.value) {
                                  newDate.setHours(
                                    field.value.getHours(),
                                    field.value.getMinutes()
                                  );
                                } else {
                                  // Default to current time + 1 hour
                                  const now = new Date();
                                  newDate.setHours(now.getHours() + 1, now.getMinutes());
                                }
                                field.onChange(newDate);
                              } else {
                                field.onChange(undefined);
                                setEndDatePickerOpen(false);
                              }
                            }}
                            initialFocus
                          />
                          {field.value && (
                            <TimeSelect
                              value={field.value}
                              onChange={(newDate) => {
                                field.onChange(newDate);
                                // Don't close the popover automatically
                              }}
                              onComplete={() => {
                                setEndDatePickerOpen(false);
                              }}
                              compact={true}
                            />
                          )}
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="pt-4">
                {isEditingMeeting && selectedMeetingId ? (
                  <div className="flex gap-2">
                    <Button 
                      type="button" 
                      variant="destructive" 
                      className="flex-1 bg-red-600 hover:bg-red-700"
                      onClick={() => {
                        if (selectedMeetingId) {
                          deleteMeetingMutation.mutate(selectedMeetingId);
                        }
                      }}
                      disabled={deleteMeetingMutation.isPending}
                    >
                      {deleteMeetingMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </>
                      )}
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createMeetingMutation.isPending} 
                      className="flex-1 bg-[#4F46E5] hover:bg-[#4F46E5]/90 text-white font-medium"
                    >
                      {createMeetingMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <Pencil className="mr-2 h-4 w-4" />
                          Update
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <Button 
                    type="submit" 
                    disabled={createMeetingMutation.isPending} 
                    className="w-full bg-[#4F46E5] hover:bg-[#4F46E5]/90 text-white font-medium"
                  >
                    {createMeetingMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Users className="mr-2 h-4 w-4" />
                        Schedule Meeting
                      </>
                    )}
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Event Type Selection Dialog */}
      <Dialog open={eventTypeSelectOpen} onOpenChange={setEventTypeSelectOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center text-lg font-semibold">
              <CalendarIcon className="h-5 w-5 mr-2 text-primary" />
              Create New Event
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Select the type of event you want to create
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Button 
              onClick={() => handleEventTypeSelect(EventType.TASK)}
              className="bg-[#10B981] hover:bg-[#10B981]/90 text-white font-medium flex items-center justify-start h-14 rounded-lg transition-all hover:translate-y-[-2px] hover:shadow-md"
            >
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mr-4">
                <span className="text-xl font-bold">✓</span>
              </div>
              <div className="flex flex-col items-start">
                <span className="text-base font-semibold">Create Task</span>
                <span className="text-xs text-white/80">Add a new task to your calendar</span>
              </div>
            </Button>
            <Button 
              onClick={() => handleEventTypeSelect(EventType.MEETING)}
              className="bg-[#4F46E5] hover:bg-[#4F46E5]/90 text-white font-medium flex items-center justify-start h-14 rounded-lg transition-all hover:translate-y-[-2px] hover:shadow-md"
            >
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mr-4">
                <Users className="h-5 w-5" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-base font-semibold">Create Meeting</span>
                <span className="text-xs text-white/80">Schedule a meeting with others</span>
              </div>
            </Button>
            <Button 
              onClick={() => handleEventTypeSelect(EventType.APPOINTMENT)}
              className="bg-[#8B5CF6] hover:bg-[#8B5CF6]/90 text-white font-medium flex items-center justify-start h-14 rounded-lg transition-all hover:translate-y-[-2px] hover:shadow-md"
            >
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mr-4">
                <Clock className="h-5 w-5" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-base font-semibold">Create Appointment</span>
                <span className="text-xs text-white/80">Schedule a personal appointment</span>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Task Dialog */}
      <Dialog open={showNewTaskDialog && newTaskDialogOpen} onOpenChange={(open) => {
        setShowNewTaskDialog(open);
        setNewTaskDialogOpen(open);
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center text-lg font-semibold">
              {newTask.eventType === EventType.APPOINTMENT ? (
                <>
                  <Clock className="h-5 w-5 mr-2 text-purple-500" />
                  Create New Appointment
                </>
              ) : (
                <>
                  <Plus className="h-5 w-5 mr-2 text-primary" />
                  Create New Task
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {newTask.eventType === EventType.APPOINTMENT 
                ? 'Add a new appointment to your calendar' 
                : 'Add a new task to your calendar'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title" className="flex items-center text-sm font-medium">
                <span className="inline-flex items-center">
                  <span className="w-4 h-4 mr-2 flex items-center justify-center">
                    <span className="w-1 h-4 bg-purple-500 rounded-full"></span>
                  </span>
                  Title
                </span>
              </Label>
              <Input
                id="title"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                placeholder={newTask.eventType === EventType.APPOINTMENT ? "Appointment title" : "Task title"}
                className="border-input focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description" className="flex items-center text-sm font-medium">
                <span className="inline-flex items-center">
                  <span className="w-4 h-4 mr-2 flex items-center justify-center">
                    <span className="w-1 h-4 bg-purple-500/70 rounded-full"></span>
                  </span>
                  Description (Optional)
                </span>
              </Label>
              <Textarea
                id="description"
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                placeholder={newTask.eventType === EventType.APPOINTMENT ? "Appointment description" : "Task description"}
                className="min-h-[100px] border-input focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="grid gap-2">
              <Label className="flex items-center text-sm font-medium">
                <span className="inline-flex items-center">
                  <span className="flex h-3.5 w-3.5 mr-2">
                    <span className="relative flex h-3 w-3">
                      <span className={cn(
                        "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                        newTask.priority === 'high' ? "bg-red-500" : 
                        newTask.priority === 'medium' ? "bg-amber-500" : "bg-emerald-500"
                      )}></span>
                      <span className={cn(
                        "relative inline-flex rounded-full h-3 w-3",
                        newTask.priority === 'high' ? "bg-red-600" : 
                        newTask.priority === 'medium' ? "bg-amber-600" : "bg-emerald-600"
                      )}></span>
                    </span>
                  </span>
                  Priority
                </span>
              </Label>
              <Select
                value={newTask.priority}
                onValueChange={(value) => setNewTask({ ...newTask, priority: value as 'low' | 'medium' | 'high' })}
              >
                <SelectTrigger className="border-input focus:ring-2 focus:ring-primary/30">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">
                    <div className="flex items-center">
                      <div className="w-2 h-2 rounded-full bg-[#10B981] mr-2"></div>
                      <span>Low</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="medium">
                    <div className="flex items-center">
                      <div className="w-2 h-2 rounded-full bg-[#F59E0B] mr-2"></div>
                      <span>Medium</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="high">
                    <div className="flex items-center">
                      <div className="w-2 h-2 rounded-full bg-[#DC2626] mr-2"></div>
                      <span>High</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label className="flex items-center text-sm font-medium">
                <span className="inline-flex items-center">
                  <CalendarIcon className="h-3.5 w-3.5 mr-2 text-purple-500" />
                  Due Date
                </span>
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    size={"sm"}
                    className="w-full justify-start text-left font-normal border-input focus:ring-2 focus:ring-primary/30"
                    disabled={isEditing && selectedTask?.completed}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                    {newTask.due_date ? (
                      formatInTimeZone(newTask.due_date, timezone, 'PPP p')
                    ) : (
                      <span>Pick date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start" side="top">
                  <Calendar
                    mode="single"
                    selected={newTask.due_date instanceof Date ? newTask.due_date : undefined}
                    onSelect={(date) => {
                      if (date) {
                        const newDate = new Date(date);
                        if (newTask.due_date instanceof Date) {
                          newDate.setHours(
                            newTask.due_date.getHours(),
                            newTask.due_date.getMinutes()
                          );
                        } else {
                          // Default to current time
                          const now = new Date();
                          newDate.setHours(now.getHours(), now.getMinutes());
                        }
                        setNewTask({ ...newTask, due_date: newDate });
                      } else {
                        setNewTask({ ...newTask, due_date: null });
                      }
                    }}
                    initialFocus
                    disabled={isEditing && selectedTask?.completed}
                  />
                  {newTask.due_date && !newTask.all_day && (
                    <TimeSelect
                      value={newTask.due_date}
                      onChange={(newDate) => {
                        setNewTask({ ...newTask, due_date: newDate });
                      }}
                      compact={true}
                      disabled={isEditing && selectedTask?.completed}
                    />
                  )}
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-md">
              <Label className="flex items-center text-sm font-medium">
                <Clock className="h-3.5 w-3.5 mr-2 text-primary" />
                All Day
              </Label>
              <div className="flex-1"></div>
              <Switch
                checked={newTask.all_day}
                onCheckedChange={(checked) => setNewTask(prev => ({ ...prev, all_day: checked }))}
                aria-label="Toggle all-day"
                disabled={isEditing && selectedTask?.completed}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowNewTaskDialog(false);
                setNewTaskDialogOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateTask}
              disabled={createTask.isPending && newTask.eventType !== EventType.APPOINTMENT}
              className={newTask.eventType === EventType.APPOINTMENT ? "bg-purple-600 hover:bg-purple-700" : "bg-primary hover:bg-primary/90"}
            >
              {createTask.isPending && newTask.eventType !== EventType.APPOINTMENT ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                newTask.eventType === EventType.APPOINTMENT ? (
                  <>
                    <Clock className="mr-2 h-4 w-4" />
                    Create Appointment
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Task
                  </>
                )
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Dialog */}
      <Dialog open={showTaskDialog && taskDialogOpen} onOpenChange={(open) => {
        setShowTaskDialog(open);
        setTaskDialogOpen(open);
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center text-lg font-semibold">
              {isEditing ? (
                <>
                  <Pencil className="h-5 w-5 mr-2 text-primary" />
                  {selectedTask?.completed ? "View Task" : "Edit Task"}
                </>
              ) : (
                <>
                  <Plus className="h-5 w-5 mr-2 text-primary" />
                  Create New Task
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {isEditing 
                ? selectedTask?.completed
                  ? "This task has been completed and cannot be edited."
                  : "Make changes to your task details below." 
                : "Add a new task to your calendar"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-title" className="flex items-center text-sm font-medium">
                <span className="inline-flex items-center">
                  <span className="w-4 h-4 mr-2 flex items-center justify-center">
                    <span className="w-1 h-4 bg-emerald-500 rounded-full"></span>
                  </span>
                  Title
                </span>
              </Label>
              <Input
                id="edit-title"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                placeholder="Task title"
                className="border-input focus:ring-2 focus:ring-primary/30"
                disabled={isEditing && selectedTask?.completed}
                readOnly={isEditing && selectedTask?.completed}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description" className="flex items-center text-sm font-medium">
                <span className="inline-flex items-center">
                  <span className="w-4 h-4 mr-2 flex items-center justify-center">
                    <span className="w-1 h-4 bg-emerald-500/70 rounded-full"></span>
                  </span>
                  Description (Optional)
                </span>
              </Label>
              <Textarea
                id="edit-description"
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                placeholder="Task description"
                className="min-h-[100px] border-input focus:ring-2 focus:ring-primary/30"
                disabled={isEditing && selectedTask?.completed}
                readOnly={isEditing && selectedTask?.completed}
              />
            </div>
            <div className="grid gap-2">
              <Label className="flex items-center text-sm font-medium">
                <span className="inline-flex items-center">
                  <span className="flex h-3.5 w-3.5 mr-2">
                    <span className="relative flex h-3 w-3">
                      <span className={cn(
                        "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                        newTask.priority === 'high' ? "bg-red-500" : 
                        newTask.priority === 'medium' ? "bg-amber-500" : "bg-emerald-500"
                      )}></span>
                      <span className={cn(
                        "relative inline-flex rounded-full h-3 w-3",
                        newTask.priority === 'high' ? "bg-red-600" : 
                        newTask.priority === 'medium' ? "bg-amber-600" : "bg-emerald-600"
                      )}></span>
                    </span>
                  </span>
                  Priority
                </span>
              </Label>
              <Select
                value={newTask.priority}
                onValueChange={(value) => setNewTask({ ...newTask, priority: value as 'low' | 'medium' | 'high' })}
                disabled={isEditing && selectedTask?.completed}
              >
                <SelectTrigger className="border-input focus:ring-2 focus:ring-primary/30">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">
                    <div className="flex items-center">
                      <div className="w-2 h-2 rounded-full bg-[#10B981] mr-2"></div>
                      <span>Low</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="medium">
                    <div className="flex items-center">
                      <div className="w-2 h-2 rounded-full bg-[#F59E0B] mr-2"></div>
                      <span>Medium</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="high">
                    <div className="flex items-center">
                      <div className="w-2 h-2 rounded-full bg-[#DC2626] mr-2"></div>
                      <span>High</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label className="flex items-center text-sm font-medium">
                <span className="inline-flex items-center">
                  <CalendarIcon className="h-3.5 w-3.5 mr-2 text-primary" />
                  Due Date
                </span>
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    size={"sm"}
                    className="w-full justify-start text-left font-normal border-input focus:ring-2 focus:ring-primary/30"
                    disabled={isEditing && selectedTask?.completed}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                    {newTask.due_date ? (
                      formatInTimeZone(newTask.due_date, timezone, 'PPP p')
                    ) : (
                      <span>Pick date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start" side="top">
                  <Calendar
                    mode="single"
                    selected={newTask.due_date instanceof Date ? newTask.due_date : undefined}
                    onSelect={(date) => {
                      if (date) {
                        const newDate = new Date(date);
                        if (newTask.due_date instanceof Date) {
                          newDate.setHours(
                            newTask.due_date.getHours(),
                            newTask.due_date.getMinutes()
                          );
                        } else {
                          // Default to current time
                          const now = new Date();
                          newDate.setHours(now.getHours(), now.getMinutes());
                        }
                        setNewTask({ ...newTask, due_date: newDate });
                      } else {
                        setNewTask({ ...newTask, due_date: null });
                      }
                    }}
                    initialFocus
                    disabled={isEditing && selectedTask?.completed}
                  />
                  {newTask.due_date && !newTask.all_day && (
                    <TimeSelect
                      value={newTask.due_date}
                      onChange={(newDate) => {
                        setNewTask({ ...newTask, due_date: newDate });
                      }}
                      compact={true}
                      disabled={isEditing && selectedTask?.completed}
                    />
                  )}
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-md">
              <Label className="flex items-center text-sm font-medium">
                <Clock className="h-3.5 w-3.5 mr-2 text-primary" />
                All Day
              </Label>
              <div className="flex-1"></div>
              <Switch
                checked={newTask.all_day}
                onCheckedChange={(checked) => setNewTask(prev => ({ ...prev, all_day: checked }))}
                aria-label="Toggle all-day"
                disabled={isEditing && selectedTask?.completed}
              />
            </div>
            
            {isEditing && selectedTask && (
              <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-md mt-2">
                <Label className="flex items-center text-sm font-medium">
                  <span className="inline-flex items-center">
                    <span className="relative flex h-3.5 w-3.5 mr-2">
                      <span className={selectedTask.completed ? "relative inline-flex rounded-full h-3.5 w-3.5 bg-green-600" : "relative inline-flex rounded-full h-3.5 w-3.5 border-2 border-muted-foreground"}></span>
                      {selectedTask.completed && <span className="absolute inset-0 flex items-center justify-center text-white text-[8px]">✓</span>}
                    </span>
                    Completed
                  </span>
                </Label>
                <div className="flex-1"></div>
                <Switch
                  checked={selectedTask.completed}
                  onCheckedChange={(checked) => {
                    if (selectedTask) {
                      updateTask.mutate({
                        id: selectedTask.id,
                        completed: checked
                      });
                    }
                  }}
                  aria-label="Toggle completed"
                />
              </div>
            )}
          </div>
          <DialogFooter className="flex justify-between items-center">
            <div>
              {isEditing && selectedTask && !selectedTask.completed && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (selectedTask) {
                      deleteTask.mutate(selectedTask.id);
                    }
                  }}
                  disabled={deleteTask.isPending}
                  size="sm"
                  className="bg-red-600 hover:bg-red-700"
                >
                  {deleteTask.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </>
                  )}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowTaskDialog(false);
                  setTaskDialogOpen(false);
                  setIsEditing(false);
                }}
              >
                {isEditing && selectedTask?.completed ? "Close" : "Cancel"}
              </Button>
              {(!isEditing || (isEditing && !selectedTask?.completed)) && (
                <Button
                  onClick={isEditing ? handleUpdateTask : handleCreateTask}
                  disabled={isEditing ? updateTask.isPending : createTask.isPending}
                  className="bg-primary hover:bg-primary/90"
                >
                  {isEditing ? (
                    updateTask.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <Pencil className="mr-2 h-4 w-4" />
                        Update Task
                      </>
                    )
                  ) : (
                    createTask.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Create Task
                      </>
                    )
                  )}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}