import { useEffect, useState, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, QUERY_KEYS } from '@/lib/queryClient';
import { Task, UserSettings, Meeting, Appointment, TaskWithSubtasks, insertTaskSchema } from '@shared/schema';
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
import { 
  getMeetings, 
  getAppointments, 
  createMeeting, 
  updateMeeting, 
  deleteMeeting, 
  updateTask, 
  createTask, 
  deleteTask, 
  createAppointment,
  updateAppointment,
  deleteAppointment
} from '@/lib/api';
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
import { Checkbox } from "@/components/ui/checkbox";
import Appointments from "@/components/Appointments";

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
  completed: boolean;
  is_recurring: boolean;
  recurrence_pattern: string | null;
  recurrence_interval: number | null;
  recurrence_end_date: Date | null;
}

// Meeting form schema
const meetingFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  meetingLink: z.string().optional(),
  startDate: z.date({
    required_error: "Start date is required",
  }),
  endDate: z.date({
    required_error: "End date is required",
  }),
});

// Appointment form schema
const appointmentFormSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  date: z.date({
    required_error: "Date is required",
  }),
  allDay: z.boolean().default(false),
  startHour: z.number().min(0).max(23),
  startMinute: z.number().min(0).max(59),
  endHour: z.number().min(0).max(23),
  endMinute: z.number().min(0).max(59),
});

type MeetingFormValues = z.infer<typeof meetingFormSchema>;
type AppointmentFormValues = z.infer<typeof appointmentFormSchema>;

interface AppointmentMutationInput {
  id: string;
  start_time: number;
  end_time: number;
  title?: string;
  description?: string;
  all_day?: boolean;
}

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
    completed: false,
    is_recurring: false,
    recurrence_pattern: null,
    recurrence_interval: null,
    recurrence_end_date: null
  });
  
  // Meeting state
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
  const [isEditingMeeting, setIsEditingMeeting] = useState(false);
  const [selectedMeetingId, setSelectedMeetingId] = useState<number | null>(null);
  
  // Appointment state
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const [isEditingAppointment, setIsEditingAppointment] = useState(false);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  // Move the taskForm inside the component
  const taskForm = useForm<NewTaskForm>({
    resolver: zodResolver(insertTaskSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      completed: false,
      due_date: null,
      is_recurring: false,
      recurrence_pattern: null,
      recurrence_interval: null,
      recurrence_end_date: null,
    },
  });

  const [activeTab, setActiveTab] = useState<string>("all");

  // Add state for dialog open control
  const [newTaskDialogOpen, setNewTaskDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [eventTypeSelectOpen, setEventTypeSelectOpen] = useState(false);
  const [startDatePickerOpen, setStartDatePickerOpen] = useState(false);
  const [endDatePickerOpen, setEndDatePickerOpen] = useState(false);

  // Meeting form
  const meetingForm = useForm<MeetingFormValues>({
    resolver: zodResolver(meetingFormSchema),
    defaultValues: {
      title: "",
      description: "",
      meetingLink: "",
      startDate: selectedDate || new Date(),
      endDate: selectedDate ? new Date(selectedDate.getTime() + 60 * 60 * 1000) : new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  
  // Appointment form
  const appointmentForm = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentFormSchema),
    defaultValues: {
      title: "",
      description: "",
      date: selectedDate || new Date(),
      allDay: false,
      startHour: new Date().getHours(),
      startMinute: 0,
      endHour: new Date().getHours() + 1,
      endMinute: 0,
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

  // Add update meeting mutation
  const updateMeetingMutation = useMutation({
    mutationFn: async (updateData: { id: number; start_time: number; end_time: number }) => {
      console.log("Updating meeting with data:", updateData);
      try {
        // Use the updateMeeting function from the API
        const updatedMeeting = await updateMeeting(updateData.id, {
          start_time: updateData.start_time,
          end_time: updateData.end_time
        });
        console.log("Meeting updated successfully:", updatedMeeting);
        return updatedMeeting;
      } catch (error) {
        console.error("Error updating meeting:", error);
        throw error;
      }
    },
    onMutate: async (updateData) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.MEETINGS] });
      
      // Get a snapshot of the current meetings
      const previousMeetings = queryClient.getQueryData<Meeting[]>([QUERY_KEYS.MEETINGS]) || [];
      
      // Create a proper deep copy to avoid reference issues
      const previousMeetingsCopy = JSON.parse(JSON.stringify(previousMeetings));
      
      // Optimistically update the meeting in the cache
      const updatedMeetings = previousMeetings.map(meeting => {
        if (meeting.id === updateData.id) {
          return {
            ...meeting,
            start_time: updateData.start_time,
            end_time: updateData.end_time
          };
        }
        return meeting;
      });
      
      // Update the cache with the optimistic update
      queryClient.setQueryData<Meeting[]>([QUERY_KEYS.MEETINGS], updatedMeetings);
      
      // Return the previous meetings for potential rollback
      return { previousMeetings: previousMeetingsCopy };
    },
    onError: (error: Error, _variables, context) => {
      console.error("Meeting update error:", error);
      
      // If the mutation fails, use the context to roll back
      if (context?.previousMeetings) {
        console.log("Rolling back to previous meetings state");
        queryClient.setQueryData<Meeting[]>([QUERY_KEYS.MEETINGS], context.previousMeetings);
      }
      
      toast({
        variant: "destructive",
        title: "Failed to update meeting",
        description: error.message || "An error occurred while updating the meeting.",
      });
    },
    onSuccess: (updatedMeeting) => {
      console.log("Meeting update successful with data:", updatedMeeting);
      
      // Invalidate queries to refresh data from server
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MEETINGS] });
      
      toast({
        title: "Meeting updated",
        description: "Your meeting time has been updated successfully.",
      });
    },
  });

  // Fetch tasks
  const { data: tasks = [], isLoading: isLoadingTasks } = useQuery<Task[]>({
    queryKey: [QUERY_KEYS.TASKS],
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

  // Get appointments data
  const appointmentsQuery = useQuery<Appointment[]>({
    queryKey: ['/api/appointments'],
    queryFn: getAppointments,
  });
  const { data: appointments = [], isLoading: isLoadingAppointments } = appointmentsQuery;

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

  const createTaskMutation = useMutation({
    mutationFn: createTask,
    onMutate: async (newTaskData) => {
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
      
      // Add the new task to the events state for immediate UI update
      const newEvent: CalendarEvent = {
        id: `task_${newTask.id}`,
        title: newTask.title,
        start: newTask.due_date ? new Date(newTask.due_date * 1000).toISOString() : new Date().toISOString(),
        allDay: newTask.all_day,
        backgroundColor: newTask.completed ? '#6B7280' : 
                        newTask.priority === 'high' ? '#DC2626' : 
                        newTask.priority === 'medium' ? '#F59E0B' : '#10B981',
        borderColor: newTask.completed ? '#4B5563' : 
                    newTask.priority === 'high' ? '#B91C1C' : 
                    newTask.priority === 'medium' ? '#D97706' : '#059669',
        textColor: '#ffffff',
        extendedProps: {
          description: newTask.description || undefined,
          priority: newTask.priority,
          completed: newTask.completed,
          type: EventType.TASK
        }
      };
      
      setEvents(prev => [...prev, newEvent]);
      
      // Close the dialog
      setShowNewTaskDialog(false);
      setNewTaskDialogOpen(false);
      
      toast({
        title: "Task created",
        description: "Your task has been created successfully.",
      });
      
      taskForm.reset();
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
      
      // Update the events state for immediate UI update
      setEvents(prev => {
        return prev.map(event => {
          if (event.id === `task_${updatedTask.id}`) {
            // Create a new event object with updated properties
            const updatedEvent: CalendarEvent = {
              ...event,
              title: updatedTask.title,
              start: updatedTask.due_date ? new Date(updatedTask.due_date * 1000).toISOString() : event.start,
              allDay: updatedTask.all_day !== undefined ? updatedTask.all_day : event.allDay,
              backgroundColor: updatedTask.completed ? '#6B7280' : 
                              updatedTask.priority === 'high' ? '#DC2626' : 
                              updatedTask.priority === 'medium' ? '#F59E0B' : '#10B981',
              borderColor: updatedTask.completed ? '#4B5563' : 
                          updatedTask.priority === 'high' ? '#B91C1C' : 
                          updatedTask.priority === 'medium' ? '#D97706' : '#059669',
              extendedProps: {
                ...event.extendedProps,
                description: updatedTask.description || event.extendedProps?.description,
                priority: updatedTask.priority || event.extendedProps?.priority,
                completed: updatedTask.completed !== undefined ? updatedTask.completed : event.extendedProps?.completed,
                type: EventType.TASK
              }
            };
            return updatedEvent;
          }
          return event;
        });
      });
      
      // Close the dialog
      setShowTaskDialog(false);
      setTaskDialogOpen(false);
      
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
      const previousEvents = [...events]; // Save current events for rollback
      
      // Optimistically update the UI by removing the task from events
      setEvents(prev => prev.filter(event => event.id !== `task_${taskId}`));
      
      return { previousTasks, previousTasksWithSubtasks, previousEvents };
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
      
      // Restore the previous events state
      if (context?.previousEvents) {
        setEvents(context.previousEvents);
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
      
      // Close the dialog
      setShowTaskDialog(false);
      setTaskDialogOpen(false);
      
      toast({
        title: "Task deleted",
        description: "Your task has been deleted successfully.",
      });
    },
  });

  // Create appointment mutation
  const createAppointmentMutation = useMutation({
    mutationFn: (data: AppointmentFormValues) => {
      const startDate = new Date(data.date);
      startDate.setHours(data.startHour, data.startMinute, 0, 0);
      const endDate = new Date(data.date);
      endDate.setHours(data.endHour, data.endMinute, 0, 0);

      return createAppointment({
        title: data.title,
        description: data.description || null,
        start_time: Math.floor(startDate.getTime() / 1000),
        end_time: Math.floor(endDate.getTime() / 1000),
        all_day: data.allDay,
        created_at: Date.now(),
        updated_at: Date.now()
      });
    }
  });

  // Update appointment mutation
  const updateAppointmentMutation = useMutation({
    mutationFn: (data: AppointmentMutationInput) => {
      return updateAppointment(parseInt(data.id), {
        title: data.title,
        description: data.description,
        start_time: data.start_time,
        end_time: data.end_time,
        all_day: data.all_day
      });
    },
    onSuccess: () => {
      // Refresh appointments data
      appointmentsQuery.refetch();
    }
  });

  // Add deleteAppointmentMutation
  const deleteAppointmentMutation = useMutation({
    mutationFn: (id: string) => deleteAppointment(parseInt(id)),
    onSuccess: () => {
      // Refresh appointments data
      appointmentsQuery.refetch();
    }
  });

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
      const task = tasks.find(t => t.id.toString() === info.event.id.replace('task_', ''));
      if (task) {
        setSelectedTask(task);
        
        // Convert Unix timestamp to Date object if it exists
        const dueDate = task.due_date ? new Date(task.due_date * 1000) : null;
        
        setNewTask({
          title: task.title,
          description: task.description || '',
          priority: task.priority as 'low' | 'medium' | 'high',
          due_date: dueDate,
          all_day: task.all_day ?? true,
          eventType: EventType.TASK,
          completed: task.completed,
          is_recurring: task.is_recurring || false,
          recurrence_pattern: task.recurrence_pattern,
          recurrence_interval: task.recurrence_interval,
          recurrence_end_date: task.recurrence_end_date ? new Date(task.recurrence_end_date * 1000) : null
        });
        
        // Set editing mode immediately
        setIsEditing(true);
        
        // Show the task dialog
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
      const appointmentId = parseInt(eventId.replace('appointment_', ''));
      setSelectedAppointmentId(appointmentId);
      setAppointmentDialogOpen(true);
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
        completed: false,
        is_recurring: false,
        recurrence_pattern: null,
        recurrence_interval: null,
        recurrence_end_date: null
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
        completed: false,
        is_recurring: false,
        recurrence_pattern: null,
        recurrence_interval: null,
        recurrence_end_date: null
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
    createTaskMutation.mutate({
      title: newTask.title,
      description: newTask.description || null,
      priority: newTask.priority,
      due_date: newTask.due_date ? Math.floor(newTask.due_date.getTime() / 1000) : null,
      all_day: newTask.all_day,
      completed: newTask.completed,
      is_recurring: newTask.is_recurring,
      recurrence_pattern: newTask.recurrence_pattern,
      recurrence_interval: newTask.recurrence_interval,
      recurrence_end_date: newTask.recurrence_end_date ? Math.floor(newTask.recurrence_end_date.getTime() / 1000) : null,
      parent_task_id: null,  // Add missing properties
      user_id: 0,  // This will be set by the server
      created_at: Math.floor(Date.now() / 1000),
      updated_at: Math.floor(Date.now() / 1000)
    });
    
    // Close the dialog - the mutation success handler will handle the UI update
    setShowNewTaskDialog(false);
    setNewTaskDialogOpen(false);
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
    updateTaskMutation.mutate({
      id: selectedTask.id,
      title: newTask.title,
      description: newTask.description || null,
      priority: newTask.priority,
      due_date: newTask.due_date ? Math.floor(newTask.due_date.getTime() / 1000) : null,
      all_day: newTask.all_day,  // Send as boolean
    });
    
    // Close the dialog - the mutation success handler will handle the UI update
    setShowTaskDialog(false);
    setTaskDialogOpen(false);
  };

  // Add custom CSS for FullCalendar to fix dark mode styling
  useEffect(() => {
    // Create a style element
    const styleEl = document.createElement("style");
    styleEl.setAttribute("id", "calendar-custom-styles");
    
    // Define our custom styles
    styleEl.textContent = `
      /* Enhanced header styling */
      .fc .fc-col-header-cell {
        background-color: var(--background) !important;
        border-bottom: 2px solid hsl(var(--border));
      }
      
      .fc .fc-col-header-cell-cushion {
        color: var(--foreground);
        font-weight: 600;
        padding: 10px 4px;
        font-size: 0.95rem;
      }
      
      /* Improved day/week/month view buttons */
      .fc .fc-button-primary {
        background-color: hsl(var(--muted)) !important;
        border-color: hsl(var(--border)) !important;
        color: hsl(var(--muted-foreground)) !important;
        font-weight: 500;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        transition: all 0.2s ease;
        border-radius: 6px;
        padding: 0.4rem 0.8rem;
      }
      
      .fc .fc-button-primary:not(.fc-button-active):hover {
        background-color: hsl(var(--muted-foreground) / 0.1) !important;
        border-color: hsl(var(--border)) !important;
      }
      
      .fc .fc-button-primary.fc-button-active {
        background-color: hsl(var(--primary)) !important;
        border-color: hsl(var(--primary)) !important;
        color: hsl(var(--primary-foreground)) !important;
        font-weight: 600;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      }
      
      /* Enhanced today highlight */
      .fc .fc-daygrid-day.fc-day-today {
        background-color: hsl(var(--primary) / 0.15) !important;
      }
      
      /* Better event styling */
      .fc-event {
        border-radius: 6px !important;
        border-left-width: 4px !important;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1) !important;
        transition: transform 0.1s ease-in-out, box-shadow 0.2s ease !important;
        margin-bottom: 2px !important;
        overflow: hidden !important;
      }
      
      .fc-event:hover {
        transform: translateY(-1px) !important;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15) !important;
      }
      
      /* Task event styling */
      .fc-event.task-event {
        border-radius: 4px !important;
        padding: 2px 4px !important;
      }
      
      /* Meeting event styling */
      .fc-event.meeting-event {
        border-radius: 6px !important;
        padding: 3px 6px !important;
      }
      
      /* Appointment event styling */
      .fc-event.appointment-event {
        border-radius: 8px !important;
        padding: 3px 6px !important;
      }
      
      /* Priority-based styling */
      .fc-event.high-priority {
        background-color: #DC2626 !important;
        border-color: #B91C1C !important;
      }
      
      .fc-event.medium-priority {
        background-color: #F59E0B !important;
        border-color: #D97706 !important;
      }
      
      .fc-event.low-priority {
        background-color: #10B981 !important;
        border-color: #059669 !important;
      }
      
      .fc-event.completed-task {
        background-color: #6B7280 !important;
        border-color: #4B5563 !important;
        text-decoration: line-through;
        opacity: 0.8;
      }
      
      /* Ensure proper styling for dark mode */
      .dark .fc-col-header {
        background-color: hsl(var(--card));
      }
      
      .dark .fc-col-header-cell-cushion {
        color: hsl(var(--foreground)) !important;
      }
      
      .dark .fc-daygrid-day-number {
        color: hsl(var(--foreground));
        font-weight: 500;
      }
      
      .dark .fc-daygrid-day.fc-day-today {
        background-color: hsl(var(--primary) / 0.2) !important;
      }
      
      /* Fix button contrast in dark mode */
      .dark .fc-button-primary {
        background-color: hsl(var(--secondary)) !important;
        border-color: hsl(var(--border)) !important;
        color: hsl(var(--secondary-foreground)) !important;
      }
      
      .dark .fc-button-primary:not(.fc-button-active):hover {
        background-color: hsl(var(--secondary) / 0.9) !important;
        color: hsl(var(--secondary-foreground)) !important;
      }
      
      .dark .fc-button-primary.fc-button-active {
        background-color: hsl(var(--primary)) !important;
        border-color: hsl(var(--primary)) !important;
        color: hsl(var(--primary-foreground)) !important;
        font-weight: 600;
      }
      
      /* Improve active buttons in light mode too */
      .fc-button-primary.fc-button-active {
        box-shadow: 0 0 0 2px hsl(var(--background)), 0 0 0 4px hsl(var(--primary) / 0.4) !important;
      }
      
      /* Better day number styling */
      .fc-daygrid-day-number {
        font-weight: 500;
        padding: 8px !important;
      }
      
      /* Improve other day styling */
      .fc-day-other .fc-daygrid-day-number {
        opacity: 0.6;
      }
      
      /* Improve calendar title */
      .fc-toolbar-title {
        font-weight: 600 !important;
        font-size: 1.25rem !important;
      }
      
      /* Improve event text readability */
      .fc-event-title, .fc-event-time {
        color: white !important;
        font-weight: 500 !important;
      }
    `;
    
    // Add the style element to the document head
    document.head.appendChild(styleEl);
    
    // Clean up function to remove the style element when component unmounts
    return () => {
      const existingStyle = document.getElementById("calendar-custom-styles");
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, []);

  // This should be the only declaration of handleEventDrop in the file
  const handleEventDrop = (info: any) => {
    const event = info.event;
    const eventType = event.extendedProps?.type;
    
    if (eventType === EventType.TASK) {
      updateTaskMutation.mutate({
        id: event.id,
        due_date: Math.floor(event.start.getTime() / 1000)
      });
    } else if (eventType === EventType.MEETING) {
      updateMeetingMutation.mutate({
        id: event.id,
        start_time: Math.floor(event.start.getTime() / 1000),
        end_time: Math.floor(event.end.getTime() / 1000)
      });
    } else if (eventType === EventType.APPOINTMENT) {
      updateAppointmentMutation.mutate({
        id: event.id.replace('appointment_', ''),
        start_time: Math.floor(event.start.getTime() / 1000),
        end_time: Math.floor(event.end.getTime() / 1000)
      });
    }
  };

  // This should be the only declaration of handleEventResize in the file
  const handleEventResize = (info: any) => {
    const event = info.event;
    const eventType = event.extendedProps?.type;
    
    if (eventType === EventType.MEETING) {
      updateMeetingMutation.mutate({
        id: event.id,
        start_time: Math.floor(event.start.getTime() / 1000),
        end_time: Math.floor(event.end.getTime() / 1000)
      });
    } else if (eventType === EventType.APPOINTMENT) {
      updateAppointmentMutation.mutate({
        id: event.id.replace('appointment_', ''),
        start_time: Math.floor(event.start.getTime() / 1000),
        end_time: Math.floor(event.end.getTime() / 1000)
      });
    }
  };

  // Update the calendar configuration to use the user's timezone
  const calendarOptions = {
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin],
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
    eventResize: handleEventResize,
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
    eventResizableFromStart: true,
    eventDurationEditable: true,
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
        completed: false,
        is_recurring: false,
        recurrence_pattern: null,
        recurrence_interval: null,
        recurrence_end_date: null
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
      setSelectedDate(new Date());
      setSelectedAppointmentId(null);
      setAppointmentDialogOpen(true);
    }
  };

  // Add this effect after the other useEffect hooks
  useEffect(() => {
    if (selectedAppointmentId) {
      // Find the selected appointment
      const appointment = appointments.find(a => a.id === selectedAppointmentId);
      if (appointment) {
        const startDate = new Date(appointment.start_time * 1000);
        const endDate = new Date(appointment.end_time * 1000);
        
        appointmentForm.reset({
          title: appointment.title,
          description: appointment.description || "",
          date: startDate,
          allDay: appointment.all_day,
          startHour: startDate.getHours(),
          startMinute: startDate.getMinutes(),
          endHour: endDate.getHours(),
          endMinute: endDate.getMinutes(),
        });
      }
    } else {
      // Reset form for new appointment
      appointmentForm.reset({
        title: "",
        description: "",
        date: selectedDate || new Date(),
        allDay: false,
        startHour: new Date().getHours(),
        startMinute: 0,
        endHour: new Date().getHours() + 1,
        endMinute: 0,
      });
    }
  }, [selectedAppointmentId, appointments, selectedDate]);

  // Add a ref for the calendar component
  const calendarComponentRef = useRef<any>(null);

  // Add a function to refresh the calendar
  const refreshCalendar = () => {
    // Refresh appointments data
    appointmentsQuery.refetch();
    
    // Force calendar to refresh
    if (calendarComponentRef.current) {
      calendarComponentRef.current.getApi().refetchEvents();
    }
    
    // Add a small delay and refresh again to ensure UI update
    setTimeout(() => {
      if (calendarComponentRef.current) {
        calendarComponentRef.current.getApi().refetchEvents();
      }
    }, 300);
  };

  if (isLoadingTasks || isLoadingMeetings || isLoadingAppointments) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Create a legend component for event types with enhanced styling
  const EventLegend = () => (
    <div className="flex flex-wrap gap-4 items-center mb-4 p-4 bg-card rounded-lg shadow-sm border">
      <div className="text-sm font-semibold">Legend:</div>
      <div className="flex items-center gap-1.5">
        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-red-500/20">
          <div className="w-3 h-3 rounded-full bg-[#DC2626] shadow-sm"></div>
        </div>
        <span className="text-sm">High Priority Task</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/20">
          <div className="w-3 h-3 rounded-full bg-[#F59E0B] shadow-sm"></div>
        </div>
        <span className="text-sm">Medium Priority Task</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20">
          <div className="w-3 h-3 rounded-full bg-[#10B981] shadow-sm"></div>
        </div>
        <span className="text-sm">Low Priority Task</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-400/20">
          <div className="w-3 h-3 rounded-full bg-[#6B7280] shadow-sm"></div>
        </div>
        <span className="text-sm">Completed Task</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-500/20">
          <div className="w-3 h-3 rounded-full bg-[#4F46E5] shadow-sm"></div>
        </div>
        <span className="text-sm">Meeting</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-500/20">
          <div className="w-3 h-3 rounded-full bg-[#8B5CF6] shadow-sm"></div>
        </div>
        <span className="text-sm">Appointment</span>
      </div>
    </div>
  );

  return (
    <div className="flex-1 p-4 h-full overflow-auto">
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
          <TabsList className="grid grid-cols-4 mb-4 p-1.5">
            <TabsTrigger value="all" className="font-medium flex items-center justify-center gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5" />
              <span>All Events</span>
            </TabsTrigger>
            <TabsTrigger value={EventType.TASK} className="font-medium flex items-center justify-center gap-1.5">
              <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-emerald-500/20 text-emerald-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </span>
              <span>Tasks</span>
            </TabsTrigger>
            <TabsTrigger value={EventType.MEETING} className="font-medium flex items-center justify-center gap-1.5">
              <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-indigo-500/20 text-indigo-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </span>
              <span>Meetings</span>
            </TabsTrigger>
            <TabsTrigger value={EventType.APPOINTMENT} className="font-medium flex items-center justify-center gap-1.5">
              <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-purple-500/20 text-purple-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
              </span>
              <span>Appointments</span>
            </TabsTrigger>
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

        <Card className="shadow-md border-muted">
          <CardContent className="p-0 sm:p-2">
            <FullCalendar
              ref={calendarComponentRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay',
              }}
              height="auto"
              aspectRatio={1.8}
              events={events}
              eventContent={(eventInfo) => {
                const eventType = eventInfo.event.extendedProps?.type || 'default';
                const isCompleted = eventInfo.event.extendedProps?.completed || false;
                
                // Create icon based on event type with enhanced styling
                let icon = null;
                if (eventType === EventType.TASK) {
                  // Use a checkmark with a subtle background for tasks
                  icon = (
                    <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full mr-1.5 ${
                      isCompleted 
                        ? 'bg-gray-400/20 text-gray-500' 
                        : eventInfo.event.extendedProps?.priority === 'high'
                          ? 'bg-red-500/20 text-red-600'
                          : eventInfo.event.extendedProps?.priority === 'medium'
                            ? 'bg-amber-500/20 text-amber-600'
                            : 'bg-emerald-500/20 text-emerald-600'
                    }`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-square-check-big h-4 w-4"><path d="M21 10.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12.5"></path><path d="m9 11 3 3L22 4"></path></svg>
                      </span>
                    );
                  } else if (eventType === EventType.MEETING) {
                    // Use a users icon with a subtle background for meetings
                    icon = (
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full mr-1.5 bg-indigo-500/20 text-indigo-600">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                          <circle cx="9" cy="7" r="4"></circle>
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                      </span>
                    );
                  } else if (eventType === EventType.APPOINTMENT) {
                    // Use a clock icon with a subtle background for appointments
                    icon = (
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full mr-1.5 bg-purple-500/20 text-purple-600">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                      </span>
                    );
                  }
                  
                  return (
                    <div className="w-full overflow-hidden">
                      <div className="font-medium text-xs sm:text-sm truncate flex items-center">
                        {icon}
                        <span className={isCompleted ? 'line-through opacity-70' : ''}>
                          {eventInfo.event.title}
                        </span>
                      </div>
                      {!eventInfo.event.allDay && eventInfo.timeText && (
                        <div className="text-xs opacity-80 mt-0.5 font-medium pl-5">
                          {eventInfo.timeText}
                        </div>
                      )}
                    </div>
                  );
                }}
                editable={true}
                selectable={true}
                selectMirror={true}
                dayMaxEvents={true}
                nowIndicator={true}
                eventResizableFromStart={true}
                eventDurationEditable={true}
                eventTimeFormat={{
                  hour: 'numeric',
                  minute: '2-digit',
                  meridiem: 'short'
                }}
                eventClick={handleEventClick}
                dateClick={handleDateClick}
                eventDrop={handleEventDrop}
                eventResize={handleEventResize}
                eventClassNames={(arg) => {
                  const eventType = arg.event.extendedProps?.type;
                  const priority = arg.event.extendedProps?.priority;
                  const completed = arg.event.extendedProps?.completed;
                  
                  let classes = [];
                  
                  if (eventType === EventType.TASK) {
                    classes.push('task-event');
                    
                    if (completed) {
                      classes.push('completed-task');
                    } else if (priority === 'high') {
                      classes.push('high-priority');
                    } else if (priority === 'medium') {
                      classes.push('medium-priority');
                    } else if (priority === 'low') {
                      classes.push('low-priority');
                    }
                  } else if (eventType === EventType.MEETING) {
                    classes.push('meeting-event');
                  } else if (eventType === EventType.APPOINTMENT) {
                    classes.push('appointment-event');
                  }
                  
                  return classes;
                }}
                eventBackgroundColor="#3788d8"
                eventBorderColor="#2c6cb0"
                eventTextColor="#FFFFFF"
              />
            </CardContent>
          </Card>

          {/* Meeting Dialog */}
          <Dialog open={meetingDialogOpen} onOpenChange={setMeetingDialogOpen}>
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
                    disabled={isEditing && selectedTask?.completed}
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
                  disabled={createTaskMutation.isPending && newTask.eventType !== EventType.APPOINTMENT}
                  className={newTask.eventType === EventType.APPOINTMENT ? "bg-purple-600 hover:bg-purple-700" : "bg-primary hover:bg-primary/90"}
                >
                  {createTaskMutation.isPending && newTask.eventType !== EventType.APPOINTMENT ? (
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
                          updateTaskMutation.mutate({
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
                          deleteTaskMutation.mutate(selectedTask.id);
                        }
                      }}
                      disabled={deleteTaskMutation.isPending}
                      size="sm"
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {deleteTaskMutation.isPending ? (
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
                      disabled={isEditing ? updateTaskMutation.isPending : createTaskMutation.isPending}
                      className="bg-primary hover:bg-primary/90"
                    >
                      {isEditing ? (
                        updateTaskMutation.isPending ? (
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
                        createTaskMutation.isPending ? (
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

          {/* Appointment Dialog */}
          <Dialog open={appointmentDialogOpen} onOpenChange={setAppointmentDialogOpen}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle className="flex items-center text-lg font-semibold">
                  {selectedAppointmentId ? (
                    <>
                      <Pencil className="h-5 w-5 mr-2 text-purple-500" />
                      Edit Appointment
                    </>
                  ) : (
                    <>
                      <Clock className="h-5 w-5 mr-2 text-purple-500" />
                      Create New Appointment
                    </>
                  )}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  {selectedAppointmentId 
                    ? "Make changes to your appointment details below."
                    : "Fill in the details to create a new appointment."}
                </DialogDescription>
              </DialogHeader>
              <Form {...appointmentForm}>
                <form onSubmit={appointmentForm.handleSubmit((data) => {
                  if (selectedAppointmentId) {
                    // Update existing appointment
                    const startDate = new Date(data.date);
                    startDate.setHours(data.startHour, data.startMinute, 0, 0);
                    const endDate = new Date(data.date);
                    endDate.setHours(data.endHour, data.endMinute, 0, 0);

                    updateAppointmentMutation.mutate({
                      id: selectedAppointmentId.toString(),
                      start_time: Math.floor(startDate.getTime() / 1000),
                      end_time: Math.floor(endDate.getTime() / 1000),
                      title: data.title,
                      description: data.description,
                      all_day: data.allDay
                    }, {
                      onSuccess: () => {
                        // Close dialog and refresh calendar
                        setAppointmentDialogOpen(false);
                        refreshCalendar();
                      }
                    });
                  } else {
                    // Create new appointment
                    createAppointmentMutation.mutate(data, {
                      onSuccess: () => {
                        // Close dialog and refresh calendar
                        setAppointmentDialogOpen(false);
                        refreshCalendar();
                      }
                    });
                  }
                })} className="space-y-4 mt-4">
                  <FormField
                    control={appointmentForm.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center text-sm font-medium">Title</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Enter appointment title" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={appointmentForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center text-sm font-medium">Description</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Enter appointment description" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={appointmentForm.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center text-sm font-medium">Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button variant="outline" className="w-full pl-3 text-left font-normal">
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={appointmentForm.control}
                    name="allDay"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">All Day</FormLabel>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  {!appointmentForm.watch("allDay") && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Start Time</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <FormField
                            control={appointmentForm.control}
                            name="startHour"
                            render={({ field }) => (
                              <FormItem>
                                <Select
                                  value={field.value.toString()}
                                  onValueChange={(value) => field.onChange(parseInt(value))}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Hour" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Array.from({ length: 24 }, (_, i) => (
                                      <SelectItem key={i} value={i.toString()}>
                                        {i.toString().padStart(2, '0')}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={appointmentForm.control}
                            name="startMinute"
                            render={({ field }) => (
                              <FormItem>
                                <Select
                                  value={field.value.toString()}
                                  onValueChange={(value) => field.onChange(parseInt(value))}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Minute" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Array.from({ length: 12 }, (_, i) => i * 5).map((minute) => (
                                      <SelectItem key={minute} value={minute.toString()}>
                                        {minute.toString().padStart(2, '0')}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>End Time</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <FormField
                            control={appointmentForm.control}
                            name="endHour"
                            render={({ field }) => (
                              <FormItem>
                                <Select
                                  value={field.value.toString()}
                                  onValueChange={(value) => field.onChange(parseInt(value))}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Hour" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Array.from({ length: 24 }, (_, i) => (
                                      <SelectItem key={i} value={i.toString()}>
                                        {i.toString().padStart(2, '0')}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={appointmentForm.control}
                            name="endMinute"
                            render={({ field }) => (
                              <FormItem>
                                <Select
                                  value={field.value.toString()}
                                  onValueChange={(value) => field.onChange(parseInt(value))}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Minute" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Array.from({ length: 12 }, (_, i) => i * 5).map((minute) => (
                                      <SelectItem key={minute} value={minute.toString()}>
                                        {minute.toString().padStart(2, '0')}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  <DialogFooter>
                    {selectedAppointmentId && (
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => {
                          // Handle appointment deletion
                          if (selectedAppointmentId) {
                            deleteAppointmentMutation.mutate(selectedAppointmentId.toString(), {
                              onSuccess: () => {
                                setAppointmentDialogOpen(false);
                                refreshCalendar();
                              }
                            });
                          }
                        }}
                        className="mr-auto"
                      >
                        Delete
                      </Button>
                    )}
                    <Button type="submit" className="bg-purple-600 hover:bg-purple-700">
                      {selectedAppointmentId ? 'Update Appointment' : 'Create Appointment'}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
  );
}