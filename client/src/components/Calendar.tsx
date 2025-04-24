import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
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
import { Loader2, Pencil, Trash2, Plus, Calendar as CalendarIcon, Clock, Users, MapPin, Video, Check } from 'lucide-react';
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
// Add a MeetingWithAllDay interface at the top of the file
interface MeetingWithAllDay extends Meeting {
  all_day?: boolean;
}

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
    is_recurring?: boolean;
    recurrence_pattern?: string | null;
    recurrence_interval?: number | null;
    recurrence_end_date?: number | null;
    isRecurringInstance?: boolean;
    originalEventId?: number | string;
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
  isRecurring: z.boolean().default(false),
  recurrencePattern: z.enum(["daily", "weekly", "monthly", "yearly"]).optional().nullable(),
  recurrenceInterval: z.number().optional().nullable(),
  recurrenceEndDate: z.date().optional().nullable(),
  update_all_recurring: z.boolean().optional(),
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
  isRecurring: z.boolean().default(false),
  recurrencePattern: z.enum(["daily", "weekly", "monthly", "yearly"]).optional().nullable(),
  recurrenceInterval: z.number().optional().nullable(),
  recurrenceEndDate: z.date().optional().nullable(),
  update_all_recurring: z.boolean().optional(),
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
  is_recurring?: boolean;
  recurrence_pattern?: string | null;
  recurrence_interval?: number | null;
  recurrence_end_date?: number | null;
  update_all_recurring?: boolean;
}

// Extend the Meeting and Appointment types with the update_all_recurring field
type MeetingExtended = Meeting & { 
  update_all_recurring?: boolean;
  description?: string | null;
  location?: string | null;
  recurrence_pattern?: string | null;
  recurrence_interval?: number | null;
  recurrence_end_date?: number | null;
};

type AppointmentExtended = Appointment & { update_all_recurring?: boolean };

export default function CalendarView() {
  const { toast } = useToast();
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
  
  // Add delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [meetingToDelete, setMeetingToDelete] = useState<MeetingWithAllDay | null>(null);
  
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
  const [recurrenceEndDatePickerOpen, setRecurrenceEndDatePickerOpen] = useState(false);
  const [appointmentDatePickerOpen, setAppointmentDatePickerOpen] = useState(false);
  const [taskDueDatePickerOpen, setTaskDueDatePickerOpen] = useState(false);
  const [taskRecurrenceEndDatePickerOpen, setTaskRecurrenceEndDatePickerOpen] = useState(false);
  const [startTimePickerOpen, setStartTimePickerOpen] = useState(false);
  const [endTimePickerOpen, setEndTimePickerOpen] = useState(false);

  // Meeting form
  const meetingForm = useForm<MeetingFormValues>({
    resolver: zodResolver(meetingFormSchema),
    defaultValues: {
      title: "",
      description: "",
      meetingLink: "",
      startDate: selectedDate || new Date(),
      endDate: selectedDate ? new Date(selectedDate.getTime() + 60 * 60 * 1000) : new Date(Date.now() + 60 * 60 * 1000),
      isRecurring: false,
      recurrencePattern: "weekly",
      recurrenceInterval: 1,
      recurrenceEndDate: null,
      update_all_recurring: false,
    },
  });
  
  // Create appointment form
  const appointmentForm = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentFormSchema),
    defaultValues: {
      title: "",
      description: "",
      date: new Date(),
      allDay: false,
      startHour: new Date().getHours(),
      startMinute: 0,
      endHour: new Date().getHours() + 1,
      endMinute: 0,
      isRecurring: false,
      recurrencePattern: "weekly",
      recurrenceInterval: 1,
      recurrenceEndDate: null,
      update_all_recurring: false,
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
        updated_at: Math.floor(Date.now() / 1000),
        completed: false,
        is_recurring: data.isRecurring || false,
        recurrence_pattern: data.isRecurring && data.recurrencePattern ? data.recurrencePattern : null,
        recurrence_interval: data.isRecurring && data.recurrenceInterval ? data.recurrenceInterval : null,
        recurrence_end_date: data.isRecurring && data.recurrenceEndDate ? Math.floor(data.recurrenceEndDate.getTime() / 1000) : null,
        parent_meeting_id: null,
        update_all_recurring: data.update_all_recurring || false,
      };
      
      // If we're editing an existing meeting, update it
      if (isEditingMeeting && selectedMeetingId) {
        
        
        try {
          // Use the updateMeeting function from the API
          const updatedMeeting = await updateMeeting(selectedMeetingId, {
            ...meeting,
            id: selectedMeetingId
          });
          
          
          return updatedMeeting;
        } catch (error) {
          console.error("Error updating meeting via API:", error);
          throw error;
        }
      }
      
      // Otherwise, create a new meeting
      
      return createMeeting(meeting);
    },
    onMutate: async (data) => {
      
      
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
          updated_at: Math.floor(Date.now() / 1000),
          completed: false,
          is_recurring: false,
          recurrence_pattern: null,
          recurrence_interval: null,
          recurrence_end_date: null,
          parent_meeting_id: null,
          update_all_recurring: data.update_all_recurring || false,
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
          queryClient.setQueryData<Meeting[]>([QUERY_KEYS.MEETINGS], updatedMeetings as Meeting[]);
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
          updated_at: Math.floor(Date.now() / 1000),
          completed: false,
          is_recurring: false,
          recurrence_pattern: null,
          recurrence_interval: null,
          recurrence_end_date: null,
          parent_meeting_id: null,
          update_all_recurring: data.update_all_recurring || false,
        };
        
        // Create a deep copy of the meetings array and add the new meeting
        const updatedMeetings = JSON.parse(JSON.stringify(previousMeetings));
        updatedMeetings.push(optimisticMeeting);
        
        // Update the cache with the new array
        queryClient.setQueryData<Meeting[]>([QUERY_KEYS.MEETINGS], updatedMeetings as Meeting[]);
      }
      
      return { previousMeetings: previousMeetingsCopy };
    },
    onError: (error: Error, _variables, context) => {
      console.error("Meeting mutation error:", error);
      
      // If the mutation fails, use the context to roll back
      if (context?.previousMeetings) {
        
        queryClient.setQueryData<Meeting[]>([QUERY_KEYS.MEETINGS], context.previousMeetings);
      }
      
      toast({
        variant: "destructive",
        title: isEditingMeeting ? "Failed to update meeting" : "Failed to create meeting",
        description: error.message || "An error occurred while processing your request.",
      });
    },
    onSuccess: (data) => {
      
      
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
      
      try {
        // Use the deleteMeeting function from the API
        await deleteMeeting(meetingId);
        
        return { success: true };
      } catch (error) {
        console.error("Error deleting meeting:", error);
        throw error;
      }
    },
    onMutate: async (meetingId) => {
      
      
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.MEETINGS] });
      
      // Get a snapshot of the current meetings
      const previousMeetings = queryClient.getQueryData<Meeting[]>([QUERY_KEYS.MEETINGS]) || [];
      
      // Create a proper deep copy to avoid reference issues
      const previousMeetingsCopy = JSON.parse(JSON.stringify(previousMeetings));
      
      // Create a deep copy of the meetings array and filter out the deleted meeting
      const updatedMeetings = JSON.parse(JSON.stringify(previousMeetings))
        .filter((meeting: Meeting) => meeting.id !== meetingId);
      
      
      
      // Update the cache with the filtered array
      queryClient.setQueryData<Meeting[]>([QUERY_KEYS.MEETINGS], updatedMeetings as Meeting[]);
      
      return { previousMeetings: previousMeetingsCopy };
    },
    onError: (error: Error, _variables, context) => {
      console.error("Delete meeting error:", error);
      
      // If the mutation fails, use the context to roll back
      if (context?.previousMeetings) {
        
        queryClient.setQueryData<Meeting[]>([QUERY_KEYS.MEETINGS], context.previousMeetings);
      }
      
      toast({
        variant: "destructive",
        title: "Failed to delete meeting",
        description: error.message || "An error occurred while deleting the meeting.",
      });
    },
    onSuccess: () => {
      
      
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
    mutationFn: async (updateData: { 
      id: number | string; 
      start_time?: number; 
      end_time?: number;
      title?: string;
      description?: string | null;
      all_day?: boolean;
      location?: string | null;
      is_recurring?: boolean;
      recurrence_pattern?: string | null;
      recurrence_interval?: number | null;
      recurrence_end_date?: number | null;
      update_all_recurring?: boolean;
    }) => {
      try {
        // Cast id to number if it's a string
        const id = typeof updateData.id === 'string' ? parseInt(updateData.id) : updateData.id;
        const { id: _, ...rest } = updateData;
        
        // Use the updateMeeting function from the API
        const updatedMeeting = await updateMeeting(id, rest);
        
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
            start_time: updateData.start_time ?? meeting.start_time,
            end_time: updateData.end_time ?? meeting.end_time
          };
        }
        // If we're updating all recurring instances, also update child meetings
        if (updateData.update_all_recurring && meeting.parent_meeting_id === updateData.id) {
          return {
            ...meeting,
            start_time: updateData.start_time ?? meeting.start_time,
            end_time: updateData.end_time ?? meeting.end_time
          };
        }
        return meeting;
      });
      
      // Update the cache with the optimistic update
      queryClient.setQueryData<Meeting[]>([QUERY_KEYS.MEETINGS], updatedMeetings as Meeting[]);
      
      // Return the previous meetings for potential rollback
      return { previousMeetings: previousMeetingsCopy };
    },
    onError: (error: Error, _variables, context) => {
      console.error("Meeting update error:", error);
      
      // If the mutation fails, use the context to roll back
      if (context?.previousMeetings) {
        
        queryClient.setQueryData<Meeting[]>([QUERY_KEYS.MEETINGS], context.previousMeetings);
      }
      
      toast({
        variant: "destructive",
        title: "Failed to update meeting",
        description: error.message || "An error occurred while updating the meeting.",
      });
    },
    onSuccess: (updatedMeeting) => {
      
      
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
    queryKey: [QUERY_KEYS.USER_SETTINGS],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  
  const timezone = getUserTimezone();

  const createTaskMutation = useMutation({
    mutationFn: createTask,
    onMutate: async (newTaskData) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.TASKS] });
      
      // Snapshot the previous value
      const previousTasks = queryClient.getQueryData<Task[]>([QUERY_KEYS.TASKS]) || [];
      const previousTasksCopy = JSON.parse(JSON.stringify(previousTasks));
      
      // Optimistically update the task list
      // (Keep this part as it is)
      
      // No need to manually update events anymore, the useMemo will handle it
      // when tasks are updated
      
      return { previousTasks: previousTasksCopy };
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
    mutationFn: async (updatedTaskData: any) => {
      // Extract update_all_recurring from the data
      const { update_all_recurring, ...taskData } = updatedTaskData;
      
      // Include update_all_recurring flag in the API call
      return updateTask({
        ...taskData,
        update_all_recurring
      });
    },
    onMutate: async (updatedTask) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.TASKS] });
      
      // Snapshot the previous value
      const previousTasks = queryClient.getQueryData<Task[]>([QUERY_KEYS.TASKS]) || [];
      const previousTasksCopy = JSON.parse(JSON.stringify(previousTasks));
      
      // Optimistically update the task list
      // (Keep this part as it is)
      
      // No need to manually update events anymore, the useMemo will handle it
      // when tasks are updated
      
      return { previousTasks: previousTasksCopy };
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
      
      
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TASKS] });
      
      // No need to manually update events anymore, the useMemo will handle it
      // when tasks are updated
      
      // Reset form and close dialog
      // (Keep this part as it is)
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: deleteTask,
    onMutate: async (taskId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.TASKS] });
      
      // Snapshot the previous values
      const previousTasks = queryClient.getQueryData<TaskWithSubtasks[]>([QUERY_KEYS.TASKS]);
      const previousTasksWithSubtasks = queryClient.getQueryData<number[]>([QUERY_KEYS.TASKS_WITH_SUBTASKS]);
      
      // No need to save events or update them manually anymore
      
      return { previousTasks, previousTasksWithSubtasks };
    },
    onError: (_error, _taskId, context) => {
      // Restore the previous tasks state
      if (context?.previousTasks) {
        queryClient.setQueryData([QUERY_KEYS.TASKS], context.previousTasks);
      }
      
      // No need to restore events anymore
      
      // Show error toast
      toast({
        variant: "destructive",
        title: "Error deleting task",
        description: "An error occurred while deleting the task.",
      });
    },
    onSuccess: (_, taskId) => {
      
      
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
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000),
        completed: false,
        is_recurring: data.isRecurring || false,
        recurrence_pattern: data.isRecurring && data.recurrencePattern ? data.recurrencePattern : null,
        recurrence_interval: data.isRecurring && data.recurrenceInterval ? data.recurrenceInterval : null,
        recurrence_end_date: data.isRecurring && data.recurrenceEndDate ? Math.floor(data.recurrenceEndDate.getTime() / 1000) : null,
        parent_appointment_id: null
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
        all_day: data.all_day,
        is_recurring: data.is_recurring || false,
        recurrence_pattern: data.is_recurring && data.recurrence_pattern ? data.recurrence_pattern : null,
        recurrence_interval: data.is_recurring && data.recurrence_interval ? data.recurrence_interval : null,
        recurrence_end_date: data.is_recurring && data.recurrence_end_date ? data.recurrence_end_date : null,
        update_all_recurring: data.update_all_recurring
      });
    },
    onSuccess: () => {
      // Refresh appointments data
      appointmentsQuery.refetch();
    }
  });



  // Convert tasks, meetings, and appointments to calendar events using useMemo
  const events = useMemo(() => {
    if (!tasks || !meetings || !appointments) return [];

    let calendarEvents: CalendarEvent[] = [];

    // Process tasks
    if (tasks) {
      const taskEvents = tasks.map(task => {
        // Determine the appropriate color based on task status and priority
        let backgroundColor;
        let borderColor;
        
        if (task.completed) {
          // Completed tasks are gray
          backgroundColor = '#6B7280'; // gray-500
          borderColor = '#4B5563'; // gray-600
        } else {
          // Tasks that aren't completed are colored by priority
          switch (task.priority) {
            case 'high':
              backgroundColor = '#DC2626'; // red-600
              borderColor = '#B91C1C'; // red-700
              break;
            case 'medium':
              backgroundColor = '#F59E0B'; // amber-500
              borderColor = '#D97706'; // amber-600
              break;
            case 'low':
            default:
              backgroundColor = '#10B981'; // emerald-500
              borderColor = '#059669'; // emerald-600
              break;
          }
        }

        // Only create an event if the task has a due date
        if (!task.due_date) return null;
        
        const startDate = new Date(task.due_date * 1000).toISOString();

        const taskEvent = {
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
            type: EventType.TASK,
            is_recurring: task.is_recurring || false,
            recurrence_pattern: task.recurrence_pattern,
            recurrence_interval: task.recurrence_interval
          },
        };

        return taskEvent;
      })
      .filter(Boolean) // Filter out null values
      .filter(event => event!.start) as CalendarEvent[]; // Type assertion to CalendarEvent[]

      calendarEvents = [...calendarEvents, ...taskEvents];
      
      // Generate additional instances for recurring tasks
      const recurringTaskEvents: CalendarEvent[] = [];
      
      // Create a Set to track dates that already have tasks (to avoid duplicates)
      const existingTaskDates = new Set<string>();
      
      // First, collect all dates where tasks already exist
      tasks.forEach(task => {
        if (task.due_date) {
          // Format date as YYYY-MM-DD for easier comparison
          const date = new Date(task.due_date * 1000);
          const dateStr = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
          existingTaskDates.add(dateStr);
        }
      });
      
      // Only generate recurring tasks for the parent tasks
      const parentTasks = tasks.filter(task => !task.parent_task_id);
      
      parentTasks.forEach(task => {
        if (task.is_recurring && task.recurrence_pattern && task.recurrence_interval && task.due_date) {
          // Get calendar view start and end dates (3 months range for visibility)
          const calendarStart = new Date();
          const calendarEnd = new Date();
          calendarEnd.setMonth(calendarEnd.getMonth() + 3);
          
          // Calculate occurrences
          const startDate = new Date(task.due_date * 1000);
          const endDate = task.recurrence_end_date ? new Date(task.recurrence_end_date * 1000) : null;
          let currentDate = new Date(startDate);
          
          // Create recurring instances
          while (currentDate <= calendarEnd && (!endDate || currentDate <= endDate)) {
            // Skip the original event
            if (currentDate.getTime() !== startDate.getTime()) {
              // Format date as YYYY-MM-DD for checking against existing tasks
              const dateStr = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}-${currentDate.getDate()}`;
              
              // Only add the recurring instance if there isn't already a task on this date
              if (!existingTaskDates.has(dateStr)) {
                // Determine color based on task priority
                let backgroundColor;
                let borderColor;
                
                if (task.completed) {
                  backgroundColor = '#6B7280'; // gray-500
                  borderColor = '#4B5563'; // gray-600
                } else {
                  switch (task.priority) {
                    case 'high':
                      backgroundColor = '#DC2626'; // red-600
                      borderColor = '#B91C1C'; // red-700
                      break;
                    case 'medium':
                      backgroundColor = '#F59E0B'; // amber-500
                      borderColor = '#D97706'; // amber-600
                      break;
                    case 'low':
                    default:
                      backgroundColor = '#10B981'; // emerald-500
                      borderColor = '#059669'; // emerald-600
                      break;
                  }
                }
                
                // Add recurring instance
                recurringTaskEvents.push({
                  id: `task_${task.id}_recur_${currentDate.getTime()}`,
                  title: task.title,
                  start: currentDate.toISOString(),
                  allDay: task.all_day,
                  backgroundColor,
                  borderColor,
                  textColor: '#ffffff',
                  extendedProps: {
                    description: task.description || undefined,
                    priority: task.priority,
                    completed: task.completed,
                    type: EventType.TASK,
                    is_recurring: true,
                    recurrence_pattern: task.recurrence_pattern,
                    recurrence_interval: task.recurrence_interval,
                    isRecurringInstance: true, // Mark as a recurring instance
                    originalEventId: task.id
                  },
                });
                
                // Add this date to existingTaskDates to avoid duplicates
                existingTaskDates.add(dateStr);
              }
            }
            
            // Calculate next occurrence
            switch (task.recurrence_pattern) {
              case 'daily':
                currentDate.setDate(currentDate.getDate() + (task.recurrence_interval || 1));
                break;
              case 'weekly':
                currentDate.setDate(currentDate.getDate() + (task.recurrence_interval || 1) * 7);
                break;
              case 'monthly':
                currentDate.setMonth(currentDate.getMonth() + (task.recurrence_interval || 1));
                break;
              case 'yearly':
                currentDate.setFullYear(currentDate.getFullYear() + (task.recurrence_interval || 1));
                break;
            }
          }
        }
      });
      
      calendarEvents = [...calendarEvents, ...recurringTaskEvents];
    }

    // Process meetings
    if (meetings) {
      const meetingEvents = meetings.map(meeting => {
        // Meeting-specific styling - Changed to a more distinct blue color
        const backgroundColor = '#0284c7'; // Bright sky blue for meetings
        const borderColor = '#0369a1'; // Darker sky blue

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
              attendees: meeting.attendees || undefined,
              completed: false, // Add missing property
              is_recurring: meeting.is_recurring || false,
              recurrence_pattern: meeting.recurrence_pattern,
            recurrence_interval: meeting.recurrence_interval
          },
        };
      });

      calendarEvents = [...calendarEvents, ...meetingEvents];
      
      // Generate additional instances for recurring meetings
      const recurringMeetingEvents: CalendarEvent[] = [];
      
      // Create a Set to track time slots that already have meetings (to avoid duplicates)
      const existingMeetingSlots = new Set<string>();
      
      // First, collect all dates and times where meetings already exist
      meetings.forEach(meeting => {
        if (meeting.start_time) {
          // Format date as YYYY-MM-DD HH:MM for easier comparison
          const date = new Date(meeting.start_time * 1000);
          const dateStr = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${date.getHours()}-${date.getMinutes()}`;
          existingMeetingSlots.add(dateStr);
        }
      });
      
      // Only generate recurring meetings for the parent meetings
      const parentMeetings = meetings.filter(meeting => !meeting.parent_meeting_id);
      
      parentMeetings.forEach(meeting => {
        if (meeting.is_recurring && meeting.recurrence_pattern && meeting.recurrence_interval) {
          // Get calendar view start and end dates (3 months range for visibility)
          const calendarStart = new Date();
          const calendarEnd = new Date();
          calendarEnd.setMonth(calendarEnd.getMonth() + 3);
          
          // Calculate occurrences
          const startDate = new Date(meeting.start_time * 1000);
          const endDate = meeting.recurrence_end_date ? new Date(meeting.recurrence_end_date * 1000) : null;
          let currentStartDate = new Date(startDate);
          
          // Create recurring instances
          while (currentStartDate <= calendarEnd && (!endDate || currentStartDate <= endDate)) {
            // Skip the original event
            if (currentStartDate.getTime() !== startDate.getTime()) {
              // Format date as YYYY-MM-DD HH:MM for checking against existing meetings
              const dateStr = `${currentStartDate.getFullYear()}-${currentStartDate.getMonth() + 1}-${currentStartDate.getDate()}-${currentStartDate.getHours()}-${currentStartDate.getMinutes()}`;
              
              // Only add the recurring instance if there isn't already a meeting in this slot
              if (!existingMeetingSlots.has(dateStr)) {
                // Calculate end time based on same duration
                const duration = meeting.end_time - meeting.start_time;
                const currentEndDate = new Date(currentStartDate.getTime() + duration * 1000);
                
                // Add recurring instance
                recurringMeetingEvents.push({
                  id: `meeting_${meeting.id}_recur_${currentStartDate.getTime()}`,
                  title: meeting.title,
                  start: currentStartDate.toISOString(),
                  end: currentEndDate.toISOString(),
                  allDay: false,
                  backgroundColor: '#0284c7',
                  borderColor: '#0369a1',
                  textColor: '#ffffff',
                  extendedProps: {
                    description: meeting.description || undefined,
                    type: EventType.MEETING,
                    location: meeting.location || undefined,
                    attendees: meeting.attendees || undefined,
                    completed: false,
                    is_recurring: true,
                    recurrence_pattern: meeting.recurrence_pattern,
                    recurrence_interval: meeting.recurrence_interval,
                    isRecurringInstance: true, // Mark as a recurring instance
                    originalEventId: meeting.id
                  },
                });
                
                // Add this time slot to existingMeetingSlots to avoid duplicates
                existingMeetingSlots.add(dateStr);
              }
            }
            
            // Calculate next occurrence
            switch (meeting.recurrence_pattern) {
              case 'daily':
                currentStartDate.setDate(currentStartDate.getDate() + (meeting.recurrence_interval || 1));
                break;
              case 'weekly':
                currentStartDate.setDate(currentStartDate.getDate() + (meeting.recurrence_interval || 1) * 7);
                break;
              case 'monthly':
                currentStartDate.setMonth(currentStartDate.getMonth() + (meeting.recurrence_interval || 1));
                break;
              case 'yearly':
                currentStartDate.setFullYear(currentStartDate.getFullYear() + (meeting.recurrence_interval || 1));
                break;
            }
          }
        }
      });
      
      calendarEvents = [...calendarEvents, ...recurringMeetingEvents];
    }

    // Process appointments
    if (appointments) {
      const appointmentEvents = appointments.map(appointment => {
        // Appointment-specific styling - Changed to a more distinct purple color
        const backgroundColor = '#a855f7'; // Bright purple for appointments
        const borderColor = '#9333ea'; // Darker purple

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
            type: EventType.APPOINTMENT,
            completed: false, // Add missing property
            is_recurring: appointment.is_recurring || false,
            recurrence_pattern: appointment.recurrence_pattern,
            recurrence_interval: appointment.recurrence_interval
          },
        };
      });

      calendarEvents = [...calendarEvents, ...appointmentEvents];
      
      // Generate additional instances for recurring appointments
      const recurringAppointmentEvents: CalendarEvent[] = [];
      
      // Create a Set to track time slots that already have appointments (to avoid duplicates)
      const existingAppointmentSlots = new Set<string>();
      
      // First, collect all dates and times where appointments already exist
      appointments.forEach(appointment => {
        if (appointment.start_time) {
          // Format date as YYYY-MM-DD HH:MM for easier comparison
          const date = new Date(appointment.start_time * 1000);
          const dateStr = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${date.getHours()}-${date.getMinutes()}`;
          existingAppointmentSlots.add(dateStr);
        }
      });
      
      // Only generate recurring appointments for the parent appointments
      const parentAppointments = appointments.filter(appointment => !appointment.parent_appointment_id);
      
      parentAppointments.forEach(appointment => {
        if (appointment.is_recurring && appointment.recurrence_pattern && appointment.recurrence_interval) {
          // Get calendar view start and end dates (3 months range for visibility)
          const calendarStart = new Date();
          const calendarEnd = new Date();
          calendarEnd.setMonth(calendarEnd.getMonth() + 3);
          
          // Calculate occurrences
          const startDate = new Date(appointment.start_time * 1000);
          const endDate = appointment.recurrence_end_date ? new Date(appointment.recurrence_end_date * 1000) : null;
          let currentStartDate = new Date(startDate);
          
          // Create recurring instances
          while (currentStartDate <= calendarEnd && (!endDate || currentStartDate <= endDate)) {
            // Skip the original event
            if (currentStartDate.getTime() !== startDate.getTime()) {
              // Format date as YYYY-MM-DD HH:MM for checking against existing appointments
              const dateStr = `${currentStartDate.getFullYear()}-${currentStartDate.getMonth() + 1}-${currentStartDate.getDate()}-${currentStartDate.getHours()}-${currentStartDate.getMinutes()}`;
              
              // Only add the recurring instance if there isn't already an appointment in this slot
              if (!existingAppointmentSlots.has(dateStr)) {
                // Calculate end time based on same duration
                const duration = appointment.end_time - appointment.start_time;
                const currentEndDate = new Date(currentStartDate.getTime() + duration * 1000);
                
                // Add recurring instance
                recurringAppointmentEvents.push({
                  id: `appointment_${appointment.id}_recur_${currentStartDate.getTime()}`,
                  title: appointment.title,
                  start: currentStartDate.toISOString(),
                  end: currentEndDate.toISOString(),
                  allDay: appointment.all_day,
                  backgroundColor: '#a855f7',
                  borderColor: '#9333ea',
                  textColor: '#ffffff',
                  extendedProps: {
                    description: appointment.description || undefined,
                    type: EventType.APPOINTMENT,
                    completed: false,
                    is_recurring: true,
                    recurrence_pattern: appointment.recurrence_pattern,
                    recurrence_interval: appointment.recurrence_interval,
                    isRecurringInstance: true, // Mark as a recurring instance
                    originalEventId: appointment.id
                  },
                });
                
                // Add this time slot to existingAppointmentSlots to avoid duplicates
                existingAppointmentSlots.add(dateStr);
              }
            }
            
            // Calculate next occurrence
            switch (appointment.recurrence_pattern) {
              case 'daily':
                currentStartDate.setDate(currentStartDate.getDate() + (appointment.recurrence_interval || 1));
                break;
              case 'weekly':
                currentStartDate.setDate(currentStartDate.getDate() + (appointment.recurrence_interval || 1) * 7);
                break;
              case 'monthly':
                currentStartDate.setMonth(currentStartDate.getMonth() + (appointment.recurrence_interval || 1));
                break;
              case 'yearly':
                currentStartDate.setFullYear(currentStartDate.getFullYear() + (appointment.recurrence_interval || 1));
                break;
            }
          }
        }
      });
      
      calendarEvents = [...calendarEvents, ...recurringAppointmentEvents];
    }

    // Filter events based on active tab
    if (activeTab !== "all") {
      calendarEvents = calendarEvents.filter(event => 
        event.extendedProps?.type === activeTab
      );
    }

    return calendarEvents;
  }, [tasks, meetings, appointments, activeTab]); // All dependencies that affect the calculation

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
        // Cast meeting to the extended type with update_all_recurring
        const extendedMeeting = meeting as MeetingExtended;
        
        // Set the meeting form data
        meetingForm.reset({
          title: meeting.title,
          description: meeting.description || "",
          meetingLink: meeting.location || "",
          startDate: new Date(meeting.start_time * 1000),
          endDate: new Date(meeting.end_time * 1000),
          isRecurring: meeting.is_recurring || false,
          recurrencePattern: (meeting.recurrence_pattern as "daily" | "weekly" | "monthly" | "yearly") || "weekly",
          recurrenceInterval: meeting.recurrence_interval || 1,
          recurrenceEndDate: meeting.recurrence_end_date ? new Date(meeting.recurrence_end_date * 1000) : null,
          update_all_recurring: extendedMeeting.update_all_recurring || false,
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
        isRecurring: false,
        recurrencePattern: null,
        recurrenceInterval: null,
        recurrenceEndDate: null,
      });
      setIsEditingMeeting(false);
      setSelectedMeetingId(null);
      setMeetingDialogOpen(true);
    } else if (type === EventType.APPOINTMENT) {
      // Set appointment dialog fields
      appointmentForm.reset({
        title: "",
        description: "",
        date: selectedDate,
        allDay: false,
        startHour: selectedDate.getHours(),
        startMinute: selectedDate.getMinutes(),
        endHour: Math.min(selectedDate.getHours() + 1, 23),
        endMinute: selectedDate.getMinutes(),
        isRecurring: false,
        recurrencePattern: "weekly" as "daily" | "weekly" | "monthly" | "yearly",
        recurrenceInterval: 1,
        recurrenceEndDate: null
      });
      setSelectedAppointmentId(null);
      setAppointmentDialogOpen(true);
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
      
      // Instead of updating events directly, trigger a query invalidation or refresh the calendar
      refreshCalendar();
      
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
      is_recurring: newTask.is_recurring,
      recurrence_pattern: newTask.recurrence_pattern,
      recurrence_interval: newTask.recurrence_interval,
      recurrence_end_date: newTask.recurrence_end_date ? Math.floor(newTask.recurrence_end_date.getTime() / 1000) : null
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
      /* --- General Calendar Structure --- */
      .fc { /* Overall container */
        border: 1px solid hsl(var(--border) / 0.8);
        box-shadow: 0 0 0 1px hsl(var(--border) / 0.3); /* Subtle double border effect */
        border-radius: 8px;
        overflow: hidden; /* Ensures rounded corners apply */
        background-color: hsl(var(--card)); /* Use card background */
      }
      
      .fc .fc-toolbar.fc-header-toolbar { /* Toolbar styling */
        padding: 12px;
        border-bottom: 1px solid hsl(var(--border));
        background-color: hsl(var(--muted) / 0.5);
      }
      
      .fc .fc-toolbar-title { /* Calendar Title */
        font-weight: 600 !important;
        font-size: 1.1rem !important; /* Slightly smaller */
        color: hsl(var(--foreground));
      }
      
      /* --- Header Styling --- */
      .fc .fc-col-header {
        border-bottom: 1px solid hsl(var(--border));
        background: linear-gradient(to bottom, hsl(var(--muted) / 0.5), hsl(var(--muted) / 0.2));  /* Gradient header background */
      }
      
      .fc .fc-col-header-cell { /* Day Headers (Mon, Tue, etc.) */
        border-right: 1px solid hsl(var(--border) / 0.7); /* More visible vertical line */
        border-bottom: none; /* Remove default bottom border */
        background: transparent; /* Ensure gradient shows through */
      }
      .fc .fc-col-header-cell:last-child {
        border-right: none;
      }
      
      .fc .fc-col-header-cell-cushion { /* Header Text */
        color: hsl(var(--foreground)); /* Better contrast for headers */
        font-weight: 500; /* Slightly lighter weight */
        padding: 8px 4px;
        font-size: 0.85rem; /* Smaller font */
        text-transform: uppercase; /* Uppercase days */
      }
      
      /* Weekend Header Highlight */
      .fc .fc-col-header-cell.fc-day-sat, 
      .fc .fc-col-header-cell.fc-day-sun {
        background: linear-gradient(to bottom, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.05)); /* Subtle weekend highlight */
      }
      
      .fc .fc-col-header-cell.fc-day-sat .fc-col-header-cell-cushion,
      .fc .fc-col-header-cell.fc-day-sun .fc-col-header-cell-cushion {
        color: hsl(var(--primary) / 0.8); /* Primary color for weekends */
      }
      
      /* --- Grid & Cell Styling --- */
      .fc .fc-daygrid-day { /* Day Cells in Month/Week View */
        position: relative;
        border-right: 1px solid hsl(var(--border) / 0.7) !important; /* Ensure right border is visible */
        border-bottom: 1px solid hsl(var(--border) / 0.7) !important; /* Ensure bottom border is visible */
        transition: background-color 0.2s ease;
      }
      
      .fc .fc-daygrid-day:hover { /* Hover effect for day cells */
        background-color: hsl(var(--accent) / 0.5); /* Subtle hover */
      }
      
      .fc .fc-daygrid-day.fc-day-today { /* Today Highlight */
        background-color: hsl(var(--primary) / 0.1) !important; /* Softer today bg */
        border-top: 2px solid hsl(var(--primary)); /* Add top border for emphasis */
      }
      
      .fc .fc-daygrid-day-number { /* Date numbers */
        font-weight: 500;
        padding: 6px !important; /* Adjust padding */
        font-size: 0.8rem;
        color: hsl(var(--foreground));
        border-radius: 50%; /* Circle shape */
        width: 24px;
        height: 24px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-top: 4px;
        margin-left: 4px;
        transition: all 0.2s ease;
      }
      
      .fc .fc-day-today .fc-daygrid-day-number { /* Today's date number */
        background-color: hsl(var(--primary));
        color: hsl(var(--primary-foreground));
        font-weight: 600;
      }
      
      .fc-day-other .fc-daygrid-day-number { /* Dates from other months */
        opacity: 0.4;
        color: hsl(var(--muted-foreground));
      }
      .fc-day-other:hover .fc-daygrid-day-number {
        opacity: 0.6;
      }
      
      /* --- TimeGrid Styling (Week/Day View) --- */
      .fc .fc-timegrid-slot { /* Time slots */
        border-color: hsl(var(--border) / 0.5); /* More visible slot borders */
        height: 2.5em; /* Consistent slot height */
      }
      
      .fc .fc-timegrid-slot-lane { /* Background lanes for time slots */
        transition: background-color 0.2s ease;
      }
      
      .fc .fc-timegrid-slot-lane:hover {
        background-color: hsl(var(--accent) / 0.5); /* Subtle hover */
      }
      
      .fc .fc-timegrid-slot-label { /* Time labels (e.g., 9:00 AM) */
        font-size: 0.75rem;
        color: hsl(var(--muted-foreground));
        border-color: hsl(var(--border) / 0.5); /* More visible border */
        padding: 0 4px;
        text-align: right;
      }
      
      .fc .fc-timegrid-axis-cushion { /* Ensure time label alignment */
        padding: 0 4px;
      }
      
      /* Business Hours Highlight */
      .fc .fc-non-business {
        background-color: hsl(var(--muted) / 0.2); /* Subtle gray for non-business hours */
      }
      
      /* --- Event Styling (Keep consistency) --- */
      .fc-event {
        border-radius: 4px !important; /* Slightly smaller radius */
        border: 1px solid transparent; /* Base border */
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.07) !important;
        transition: transform 0.1s ease-in-out, box-shadow 0.2s ease, background-color 0.2s ease !important;
        margin-bottom: 3px !important; /* Spacing between events */
        padding: 3px 5px !important; /* Adjust padding */
        font-size: 0.8rem; /* Slightly smaller event font */
        overflow: hidden !important;
      }
      
      .fc-event:hover {
        transform: translateY(-1px) !important;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15) !important;
        filter: brightness(1.1); /* Slight brightness increase */
      }
      
      .fc-event-main {
        color: white !important;
        font-weight: 500 !important;
      }
      
      .fc-event-time {
        font-weight: 400 !important;
        font-size: 0.75rem;
        opacity: 0.9;
      }
      
      .fc-daygrid-event { /* Make daygrid events slightly shorter */
        padding: 2px 4px !important;
      }
      
      /* (Keep Task/Meeting/Appointment/Priority specific styles as they are) */
      .fc-event.task-event { }
      .fc-event.meeting-event {
        background-color: #0284c7 !important;
        border-color: #0369a1 !important;
      }
      .fc-event.appointment-event {
        background-color: #a855f7 !important;
        border-color: #9333ea !important;
      }
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
        opacity: 0.7; /* Slightly more faded */
      }
      
      /* --- Button Styling --- */
      .fc .fc-button-primary {
        background-color: hsl(var(--secondary)) !important;
        border-color: hsl(var(--border)) !important;
        color: hsl(var(--secondary-foreground)) !important;
        font-weight: 500;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        transition: all 0.2s ease;
        border-radius: 6px;
        padding: 0.35rem 0.7rem; /* Adjusted padding */
        font-size: 0.85rem;
        text-transform: capitalize; /* Nicer button text */
      }
      
      .fc .fc-button-primary:not(.fc-button-active):hover {
        background-color: hsl(var(--muted)) !important;
        border-color: hsl(var(--border)) !important;
      }
      
      .fc .fc-button-primary.fc-button-active {
        background-color: hsl(var(--primary)) !important;
        border-color: hsl(var(--primary)) !important;
        color: hsl(var(--primary-foreground)) !important;
        font-weight: 600;
        box-shadow: 0 0 0 2px hsl(var(--background)), 0 0 0 4px hsl(var(--primary) / 0.4) !important;
      }
      
      /* Today Button Specific */
      .fc .fc-today-button {
        font-weight: 600;
      }
      
      /* Dark Mode Specific Adjustments */
      .dark .fc {
        border-color: hsl(var(--border) / 0.9); /* Stronger outer border in dark */
        box-shadow: 0 0 0 1px hsl(var(--border) / 0.4); /* Subtle glow effect */
      }
      
      .dark .fc .fc-toolbar.fc-header-toolbar {
        background-color: hsl(var(--muted) / 0.3); /* Darker muted */
        border-bottom-color: hsl(var(--border) / 0.7);
      }
      
      .dark .fc .fc-col-header {
        background: linear-gradient(to bottom, hsl(var(--muted) / 0.35), hsl(var(--card))); /* Gradient header in dark mode */
        border-bottom-color: hsl(var(--border) / 0.7);
      }
      
      .dark .fc .fc-col-header-cell {
        border-right-color: hsl(var(--border) / 0.7); /* More visible dark mode line */
      }
      
      .dark .fc .fc-col-header-cell-cushion {
        color: hsl(var(--foreground) / 0.9) !important; /* Better contrast in dark mode */
      }
      
      .dark .fc .fc-daygrid-day {
        box-shadow: 
          1px 0 0 0 hsl(var(--border) / 0.7), /* Right border - slightly darker in dark mode */
          0 1px 0 0 hsl(var(--border) / 0.7); /* Bottom border - slightly darker in dark mode */
      }
      
      .dark .fc .fc-daygrid-day:hover {
        background-color: hsl(var(--accent) / 0.3);
      }
      
      .dark .fc .fc-daygrid-day.fc-day-today {
        background-color: hsl(var(--primary) / 0.15) !important; /* Slightly more prominent today */
        border-top-color: hsl(var(--primary) / 0.7);
      }
      
      .dark .fc .fc-daygrid-day-number {
        color: hsl(var(--foreground));
      }
      
      .dark .fc-day-today .fc-daygrid-day-number {
         background-color: hsl(var(--primary) / 0.8); /* Less intense in dark mode */
         color: hsl(var(--primary-foreground));
      }
      
      .dark .fc-day-other .fc-daygrid-day-number {
         opacity: 0.3;
      }
      
      .dark .fc .fc-timegrid-slot {
        border-color: hsl(var(--border) / 0.5); /* More visible dark mode slots */
      }
      
      .dark .fc .fc-timegrid-slot-lane:hover {
        background-color: hsl(var(--accent) / 0.3);
      }
      
      .dark .fc .fc-timegrid-slot-label {
        color: hsl(var(--muted-foreground) / 0.8);
        border-color: hsl(var(--border) / 0.5); /* More visible dark slot labels */
      }
      
      .dark .fc .fc-non-business {
        background-color: hsla(var(--foreground), 0.03); /* Very subtle dark non-business */
      }
      
      .dark .fc .fc-button-primary {
        background-color: hsl(var(--secondary)) !important;
        border-color: hsl(var(--border) / 0.8) !important;
        color: hsl(var(--secondary-foreground)) !important;
      }
      
      .dark .fc .fc-button-primary:not(.fc-button-active):hover {
        background-color: hsl(var(--muted)) !important;
      }
      
      .dark .fc .fc-button-primary.fc-button-active {
        background-color: hsl(var(--primary)) !important;
        border-color: hsl(var(--primary)) !important;
        color: hsl(var(--primary-foreground)) !important;
        box-shadow: 0 0 0 2px hsl(var(--background)), 0 0 0 4px hsl(var(--primary) / 0.5) !important;
      }
      
      /* Remove default outline on focused elements within calendar */
      .fc :focus-visible {
        outline: none;
        box-shadow: none;
      }
      
      /* Custom scrollbar for timegrid */
      .fc .fc-scroller {
        scrollbar-width: thin;
        scrollbar-color: hsl(var(--border)) hsl(var(--card));
      }
      .fc .fc-scroller::-webkit-scrollbar {
        width: 6px;
        height: 6px;
      }
      .fc .fc-scroller::-webkit-scrollbar-track {
        background: hsl(var(--card));
        border-radius: 3px;
      }
      .fc .fc-scroller::-webkit-scrollbar-thumb {
        background-color: hsl(var(--border));
        border-radius: 3px;
        border: 1px solid hsl(var(--card));
      }
      .fc .fc-scroller::-webkit-scrollbar-thumb:hover {
        background-color: hsl(var(--muted-foreground));
      }
      
      /* Highlight cell borders on hover with a subtle animation */
      .fc-day-other:hover, .fc-daygrid-day:hover {
        border-color: hsl(var(--primary) / 0.3);
        transition: border-color 0.3s ease;
      }
      
      /* Add subtle grid pattern for visual interest */
      .fc .fc-scrollgrid {
        background-image: linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
                         linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
        background-size: 15px 15px;
        background-position: center center;
      }
      
      .dark .fc .fc-scrollgrid {
        background-image: linear-gradient(rgba(255, 255, 255, 0.015) 1px, transparent 1px),
                         linear-gradient(90deg, rgba(255, 255, 255, 0.015) 1px, transparent 1px);
      }
      
      /* Add border to first column to ensure consistent grid */
      .fc .fc-day:first-child, 
      .fc .fc-daygrid-day:first-child {
        border-left: 1px solid hsl(var(--border) / 0.7) !important;
      }
      
      /* Add border to first row to ensure consistent grid */
      .fc .fc-daygrid-body tr:first-child td {
        border-top: 1px solid hsl(var(--border) / 0.7) !important;
      }
      
      /* Ensure last column right border */
      .fc .fc-day-sat, 
      .fc .fc-daygrid-day:last-child {
        border-right: 1px solid hsl(var(--border) / 0.7) !important;
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
    const isRecurringInstance = event.extendedProps?.isRecurringInstance;
    const originalEventId = event.extendedProps?.originalEventId;
    
    if (eventType === EventType.TASK) {
      // Extract ID from the event ID
      const taskId = event.id.replace('task_', '').split('_recur_')[0];
      
      // If this is a recurring instance, update the original task and all its instances
      if (isRecurringInstance && originalEventId) {
        updateTaskMutation.mutate({
          id: originalEventId,
          due_date: Math.floor(event.start.getTime() / 1000),
          update_all_recurring: true
        });
      } else {
        updateTaskMutation.mutate({
          id: taskId,
          due_date: Math.floor(event.start.getTime() / 1000)
        });
      }
    } else if (eventType === EventType.MEETING) {
      // Extract ID from the event ID
      const meetingId = event.id.replace('meeting_', '').split('_recur_')[0];
      
      // Create partial meeting object with only required fields
      const updateParams = {
        id: meetingId,
        start_time: Math.floor(event.start.getTime() / 1000),
        end_time: Math.floor(event.end.getTime() / 1000)
      };
      
      // If this is a recurring instance, update all instances
      if (isRecurringInstance && originalEventId) {
        updateMeetingMutation.mutate({
          ...updateParams,
          id: originalEventId,
          update_all_recurring: true
        } as MeetingExtended & {id: number | string});
      } else {
        updateMeetingMutation.mutate(updateParams as MeetingExtended & {id: number | string});
      }
    } else if (eventType === EventType.APPOINTMENT) {
      // Extract ID from the event ID
      const appointmentId = event.id.replace('appointment_', '').split('_recur_')[0];
      
      // Create partial appointment object with only required fields
      const updateParams = {
        id: appointmentId,
        start_time: Math.floor(event.start.getTime() / 1000),
        end_time: Math.floor(event.end.getTime() / 1000)
      };
      
      // If this is a recurring instance, update the original appointment and all its instances
      if (isRecurringInstance && originalEventId) {
        updateAppointmentMutation.mutate({
          ...updateParams,
          id: originalEventId,
          update_all_recurring: true
        });
      } else {
        updateAppointmentMutation.mutate(updateParams);
      }
    }
  };

  // This should be the only declaration of handleEventResize in the file
  const handleEventResize = (info: any) => {
    const event = info.event;
    const eventType = event.extendedProps?.type;
    const isRecurringInstance = event.extendedProps?.isRecurringInstance;
    const originalEventId = event.extendedProps?.originalEventId;
    
    if (eventType === EventType.MEETING) {
      // Extract ID from the event ID
      const meetingId = event.id.replace('meeting_', '').split('_recur_')[0];
      
      // Create partial meeting object with only required fields
      const updateParams = {
        id: meetingId,
        start_time: Math.floor(event.start.getTime() / 1000),
        end_time: Math.floor(event.end.getTime() / 1000)
      };
      
      // If this is a recurring instance, update all instances
      if (isRecurringInstance && originalEventId) {
        updateMeetingMutation.mutate({
          ...updateParams,
          id: originalEventId,
          update_all_recurring: true
        } as MeetingExtended & {id: number | string});
      } else {
        updateMeetingMutation.mutate(updateParams as MeetingExtended & {id: number | string});
      }
    } else if (eventType === EventType.APPOINTMENT) {
      // Extract ID from the event ID
      const appointmentId = event.id.replace('appointment_', '').split('_recur_')[0];
      
      // Create partial appointment object with only required fields
      const updateParams = {
        id: appointmentId,
        start_time: Math.floor(event.start.getTime() / 1000),
        end_time: Math.floor(event.end.getTime() / 1000)
      };
      
      // If this is a recurring instance, update all instances
      if (isRecurringInstance && originalEventId) {
        updateAppointmentMutation.mutate({
          ...updateParams,
          id: originalEventId,
          update_all_recurring: true
        });
      } else {
        updateAppointmentMutation.mutate(updateParams);
      }
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
        
        // Apply colors directly to the event element
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
          info.el.style.backgroundColor = '#0284c7';
          info.el.style.borderColor = '#0369a1';
          info.el.style.borderWidth = '1px';
          info.el.style.borderStyle = 'solid';
          info.el.style.borderRadius = '6px';
          
          // Also apply to inner elements
          const eventMainEl = info.el.querySelector('.fc-event-main');
          if (eventMainEl) {
            eventMainEl.style.backgroundColor = '#0284c7';
            eventMainEl.style.borderColor = '#0369a1';
          }
          
          // Make text white for better contrast
          const titleEl = info.el.querySelector('.fc-event-title');
          if (titleEl) {
            titleEl.style.color = '#ffffff';
            titleEl.style.fontWeight = 'bold';
          }
          
          const timeEl = info.el.querySelector('.fc-event-time');
          if (timeEl) {
            timeEl.style.color = '#ffffff';
          }
        } else if (eventType === EventType.APPOINTMENT) {
          info.el.style.backgroundColor = '#a855f7';
          info.el.style.borderColor = '#9333ea';
          info.el.style.borderWidth = '1px';
          info.el.style.borderStyle = 'solid';
          info.el.style.borderRadius = '6px';
          
          // Also apply to inner elements
          const eventMainEl = info.el.querySelector('.fc-event-main');
          if (eventMainEl) {
            eventMainEl.style.backgroundColor = '#a855f7';
            eventMainEl.style.borderColor = '#9333ea';
          }
          
          // Make text white for better contrast
          const titleEl = info.el.querySelector('.fc-event-title');
          if (titleEl) {
            titleEl.style.color = '#ffffff';
            titleEl.style.fontWeight = 'bold';
          }
          
          const timeEl = info.el.querySelector('.fc-event-time');
          if (timeEl) {
            timeEl.style.color = '#ffffff';
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
        isRecurring: false,
        recurrencePattern: null,
        recurrenceInterval: null,
        recurrenceEndDate: null,
      });
      setIsEditingMeeting(false);
      setSelectedMeetingId(null);
      setMeetingDialogOpen(true);
    } else if (type === 'appointment') {
      // Reset to default values
      appointmentForm.reset({
        title: "",
        description: "",
        date: new Date(),
        allDay: false,
        startHour: new Date().getHours(),
        startMinute: 0,
        endHour: Math.min(new Date().getHours() + 1, 23),
        endMinute: 0,
        isRecurring: false,
        recurrencePattern: "weekly" as "daily" | "weekly" | "monthly" | "yearly",
        recurrenceInterval: 1,
        recurrenceEndDate: null
      });
      setSelectedAppointmentId(null);
      setAppointmentDialogOpen(true);
    }
  };

  // Use refs to track the last values to avoid unnecessary updates
  const lastAppointmentIdRef = useRef<number | null>(null);
  const lastSelectedDateRef = useRef<Date | null>(null);
  const appointmentResetTimerRef = useRef<number | null>(null);
  
  // Simple effect with proper tracking of previous values
  useEffect(() => {
    // Only reset the form if something relevant has changed
    const appointmentIdChanged = selectedAppointmentId !== lastAppointmentIdRef.current;
    const dateChanged = selectedDate !== lastSelectedDateRef.current;
    
    // Update refs to track current values
    lastAppointmentIdRef.current = selectedAppointmentId;
    lastSelectedDateRef.current = selectedDate;
    
    // Only proceed if something changed
    if (!appointmentIdChanged && !dateChanged) {
      return;
    }
    
    // Clear any existing timer to prevent multiple resets
    if (appointmentResetTimerRef.current !== null) {
      window.clearTimeout(appointmentResetTimerRef.current);
    }
    
    // Use setTimeout to break the render cycle and avoid infinite loops
    appointmentResetTimerRef.current = window.setTimeout(() => {
      // Reset the form with appropriate values
      if (selectedAppointmentId) {
        // Find the selected appointment
        const appointment = appointments.find(a => a.id === selectedAppointmentId);
        if (appointment) {
          const startDate = new Date(appointment.start_time * 1000);
          const endDate = new Date(appointment.end_time * 1000);
          
          // Cast appointment to the extended type with update_all_recurring
          const extendedAppointment = appointment as AppointmentExtended;
          
          appointmentForm.reset({
            title: appointment.title,
            description: appointment.description || "",
            date: startDate,
            allDay: appointment.all_day,
            startHour: startDate.getHours(),
            startMinute: startDate.getMinutes(),
            endHour: endDate.getHours(),
            endMinute: endDate.getMinutes(),
            isRecurring: appointment.is_recurring,
            recurrencePattern: appointment.recurrence_pattern as "daily" | "weekly" | "monthly" | "yearly" | null,
            recurrenceInterval: appointment.recurrence_interval,
            recurrenceEndDate: appointment.recurrence_end_date ? new Date(appointment.recurrence_end_date * 1000) : null,
            update_all_recurring: extendedAppointment.update_all_recurring || false
          });
        }
      } else if (dateChanged) {
        // Only reset for a new appointment if the date actually changed
        appointmentForm.reset({
          title: "",
          description: "",
          date: selectedDate || new Date(),
          allDay: selectedDate ? selectedDate.getHours() === 9 && selectedDate.getMinutes() === 0 : false,
          startHour: selectedDate ? selectedDate.getHours() : new Date().getHours(),
          startMinute: selectedDate ? selectedDate.getMinutes() : 0,
          endHour: selectedDate ? Math.min(selectedDate.getHours() + 1, 23) : Math.min(new Date().getHours() + 1, 23),
          endMinute: selectedDate ? selectedDate.getMinutes() : 0,
          isRecurring: false,
          recurrencePattern: "weekly" as "daily" | "weekly" | "monthly" | "yearly",
          recurrenceInterval: 1,
          recurrenceEndDate: null,
          update_all_recurring: false
        });
      }
      
      // Clear the timer ref
      appointmentResetTimerRef.current = null;
    }, 0);
    
    // Cleanup function to clear the timer if the component unmounts
    return () => {
      if (appointmentResetTimerRef.current !== null) {
        window.clearTimeout(appointmentResetTimerRef.current);
      }
    };
  }, [selectedAppointmentId, appointments, selectedDate, appointmentForm]);

  // Add a ref for the calendar component
  const calendarComponentRef = useRef<any>(null);

  // Add a function to refresh the calendar
  const refreshCalendar = useCallback(() => {
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
  }, [appointmentsQuery]);

  if (isLoadingTasks || isLoadingMeetings || isLoadingAppointments) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Create a legend component for event types with enhanced styling
  const EventLegend = () => (
    <div className="flex flex-wrap gap-2 md:gap-4 items-center mb-4 p-2 md:p-4 bg-card rounded-lg shadow-sm border">
      <div className="text-xs md:text-sm font-semibold w-full md:w-auto mb-1 md:mb-0">Legend:</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:flex md:flex-wrap gap-2 w-full md:w-auto">
        <div className="flex items-center gap-1.5">
          <div className="flex items-center justify-center w-4 h-4 rounded-full bg-red-500/20">
            <div className="w-2.5 h-2.5 rounded-full bg-[#DC2626] shadow-sm"></div>
          </div>
          <span className="text-xs md:text-sm">High Priority</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center justify-center w-4 h-4 rounded-full bg-amber-500/20">
            <div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B] shadow-sm"></div>
          </div>
          <span className="text-xs md:text-sm">Medium Priority</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500/20">
            <div className="w-2.5 h-2.5 rounded-full bg-[#10B981] shadow-sm"></div>
          </div>
          <span className="text-xs md:text-sm">Low Priority</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center justify-center w-4 h-4 rounded-full bg-gray-400/20">
            <div className="w-2.5 h-2.5 rounded-full bg-[#6B7280] shadow-sm"></div>
          </div>
          <span className="text-xs md:text-sm">Completed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center justify-center w-4 h-4 rounded-full bg-sky-500/20">
            <div className="w-2.5 h-2.5 rounded-full bg-[#0284c7] shadow-sm"></div>
          </div>
          <span className="text-xs md:text-sm">Meeting</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center justify-center w-4 h-4 rounded-full bg-purple-500/20">
            <div className="w-2.5 h-2.5 rounded-full bg-[#a855f7] shadow-sm"></div>
          </div>
          <span className="text-xs md:text-sm">Appointment</span>
        </div>
      </div>
    </div>
  );

  // Add a function to handle delete meeting click
  const handleDeleteMeetingClick = () => {
    if (selectedMeetingId) {
      // Find the meeting by id and cast as MeetingWithAllDay
      const meeting = meetings?.find(m => m.id === selectedMeetingId) as MeetingWithAllDay;
      if (meeting) {
        setMeetingToDelete(meeting);
        setDeleteDialogOpen(true);
      }
    }
  };

  // Add a function to handle confirm delete
  const handleConfirmDelete = () => {
    if (meetingToDelete?.id) {
      deleteMeetingMutation.mutate(meetingToDelete.id);
      setDeleteDialogOpen(false);
      setMeetingToDelete(null);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex flex-col space-y-4 px-1 sm:px-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Calendar</h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button 
              onClick={() => handleCreateNewEvent('task')}
              className="bg-[#10B981] hover:bg-[#10B981]/90 text-white font-medium w-full sm:w-auto"
              size="sm"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              <span className="whitespace-nowrap">Add Task</span>
            </Button>
            <Button 
              onClick={() => handleCreateNewEvent('meeting')}
              className="bg-[#0284c7] hover:bg-[#0284c7]/90 text-white font-medium w-full sm:w-auto"
              size="sm"
            >
              <Users className="mr-1.5 h-4 w-4" />
              <span className="whitespace-nowrap">Add Meeting</span>
            </Button>
            <Button 
              onClick={() => handleCreateNewEvent('appointment')}
              className="bg-[#a855f7] hover:bg-[#a855f7]/90 text-white font-medium w-full sm:w-auto"
              size="sm"
            >
              <Clock className="mr-1.5 h-4 w-4" />
              <span className="whitespace-nowrap">Add Appointment</span>
            </Button>
          </div>
        </div>

        {/* Event type filter tabs */}
        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-4 mb-4 p-1.5">
            <TabsTrigger value="all" className="font-medium flex items-center justify-center gap-1">
              <CalendarIcon className="h-3.5 w-3.5" />
              <span className="hidden xs:inline">All Events</span>
              <span className="xs:hidden">All</span>
            </TabsTrigger>
            <TabsTrigger value={EventType.TASK} className="font-medium flex items-center justify-center gap-1">
              <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-emerald-500/20 text-emerald-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12l5 5l10 -10"></path>
                </svg>
              </span>
              <span className="hidden xs:inline">Tasks</span>
              <span className="xs:hidden">Tasks</span>
            </TabsTrigger>
            <TabsTrigger value={EventType.MEETING} className="font-medium flex items-center justify-center gap-1">
              <Users className="h-3.5 w-3.5" />
              <span className="hidden xs:inline">Meetings</span>
              <span className="xs:hidden">Meet</span>
            </TabsTrigger>
            <TabsTrigger value={EventType.APPOINTMENT} className="font-medium flex items-center justify-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span className="hidden xs:inline">Appointments</span>
              <span className="xs:hidden">Appt</span>
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
              <div className="w-2 h-2 rounded-full bg-[#0284c7]"></div>
              <span>{meetings.length} Meetings</span>
            </div>
          </Badge>
          <Badge variant="outline" className="bg-background">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#a855f7]"></div>
              <span>{appointments.length} Appointments</span>
            </div>
          </Badge>
        </div>

        <Card className="shadow-md border-muted">
          <CardContent className="p-0 sm:p-2">
            {/* Responsive wrapper with horizontal scroll for small screens */}
            <div className="overflow-x-auto sm:overflow-visible pb-2">
              {/* Set a minimum width to prevent excessive squishing on small screens */}
              <div className="min-w-[700px]">
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
                      // Use a square check icon for tasks
                      icon = (
                        <span className={`inline-flex items-center justify-center w-4 h-4 rounded-sm mr-1.5 ${
                          isCompleted 
                            ? 'bg-gray-400/20 text-white' 
                            : eventInfo.event.extendedProps?.priority === 'high'
                              ? 'bg-red-500/20 text-white'
                              : eventInfo.event.extendedProps?.priority === 'medium'
                                ? 'bg-amber-500/20 text-white'
                                : 'bg-emerald-500/20 text-white'
                        }`}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                          <polyline points="9 12 12 15 15 9"></polyline>
                        </svg>
                      </span>
                    );
                  } else if (eventType === EventType.MEETING) {
                    // Use a users icon with a high contrast background for meetings
                    icon = (
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full mr-1.5 bg-sky-500/20 text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                          <circle cx="9" cy="7" r="4"></circle>
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                      </span>
                    );
                  } else if (eventType === EventType.APPOINTMENT) {
                    // Use a clock icon with a high contrast background for appointments
                    icon = (
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full mr-1.5 bg-purple-500/20 text-white">
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
                      {/* Display time information - either the default timeText or custom due time for tasks */}
                      {!eventInfo.event.allDay && eventInfo.timeText && (
                        <div className="text-xs opacity-80 mt-0.5 font-medium pl-5">
                          {eventInfo.timeText}
                        </div>
                      )}
                      {/* Display due time for tasks only if timeText is not present */}
                      {eventType === EventType.TASK && eventInfo.event.start && !eventInfo.timeText && (
                        <div className="text-xs opacity-80 mt-0.5 font-medium pl-5 flex items-center">
                          <span className="mr-1">Due:</span> {new Date(eventInfo.event.start).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit', hour12: true})}
                          {eventInfo.event.extendedProps?.is_recurring && (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 ml-1.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                              <path d="M3 8v4h4" />
                              <path d="M3 12a9 9 0 0 0 9 9c2.8 0 5.2-1.16 7-3" />
                            </svg>
                          )}
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
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Meeting Dialog */}
        <Dialog open={meetingDialogOpen} onOpenChange={setMeetingDialogOpen}>
          <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center text-lg font-semibold">
                {isEditingMeeting ? (
                  <>
                    <Pencil className="h-5 w-5 mr-2 text-sky-500" />
                    Edit Meeting
                  </>
                ) : (
                  <>
                    <Users className="h-5 w-5 mr-2 text-sky-500" />
                    Schedule Meeting
                  </>
                )}
              </DialogTitle>
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
                  
                  if (isEditingMeeting && selectedMeetingId) {
                    // Extract update_all_recurring from data or default to false
                    const { update_all_recurring = false, ...formData } = data;
                    
                    // Update existing meeting
                    updateMeetingMutation.mutate({
                      id: selectedMeetingId,
                      start_time: Math.floor(formData.startDate.getTime() / 1000),
                      end_time: Math.floor(formData.endDate.getTime() / 1000),
                      title: formData.title,
                      description: formData.description || "",
                      all_day: false,
                      location: formData.meetingLink || "",
                      is_recurring: formData.isRecurring,
                      recurrence_pattern: formData.isRecurring ? formData.recurrencePattern : null,
                      recurrence_interval: formData.isRecurring ? formData.recurrenceInterval : null,
                      recurrence_end_date: formData.isRecurring && formData.recurrenceEndDate 
                        ? Math.floor(formData.recurrenceEndDate.getTime() / 1000) 
                        : null,
                      update_all_recurring
                    });
                  } else {
                    // Create new meeting
                    createMeetingMutation.mutate(data);
                  }
                  
                  // Close the dialog and reset state
                  setMeetingDialogOpen(false);
                  setIsEditingMeeting(false);
                  setSelectedMeetingId(null);
                })}
                className="space-y-3 mt-2"
              >
                <FormField
                  control={meetingForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium">Title</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter meeting title" 
                          {...field} 
                          className="h-9"
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
                      <FormLabel className="text-xs font-medium">Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Enter meeting description" 
                          {...field} 
                          className="min-h-[60px] text-sm"
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
                      <FormLabel className="text-xs font-medium flex items-center">
                        <Video className="h-3 w-3 mr-1.5 text-sky-500" />
                          Meeting Link
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter video call link" 
                          {...field} 
                          className="h-9"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={meetingForm.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="text-xs font-medium flex items-center">
                          <Clock className="h-3 w-3 mr-1.5 text-indigo-500" />
                          Start
                        </FormLabel>
                        <Popover open={startDatePickerOpen} onOpenChange={setStartDatePickerOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className="h-9 pl-3 text-left font-normal text-xs"
                              >
                                {field.value ? (
                                  formatDate(field.value, "PPP h:mm a")
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
                                if (date) {
                                  const newDate = new Date(date);
                                  if (field.value) {
                                    newDate.setHours(field.value.getHours(), field.value.getMinutes());
                                  } else {
                                    const now = new Date();
                                    newDate.setHours(now.getHours(), now.getMinutes());
                                  }
                                  field.onChange(newDate);
                                  // Auto-close the calendar after selection
                                  setStartDatePickerOpen(false);
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
                                onChange={(newDate) => field.onChange(newDate)}
                                onComplete={() => setStartDatePickerOpen(false)}
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
                        <FormLabel className="text-xs font-medium flex items-center">
                          <Clock className="h-3 w-3 mr-1.5 text-indigo-500" />
                          End
                        </FormLabel>
                        <Popover open={endDatePickerOpen} onOpenChange={setEndDatePickerOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className="h-9 pl-3 text-left font-normal text-xs"
                              >
                                {field.value ? (
                                  formatDate(field.value, "PPP h:mm a")
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
                                if (date) {
                                  const newDate = new Date(date);
                                  if (field.value) {
                                    newDate.setHours(field.value.getHours(), field.value.getMinutes());
                                  } else {
                                    const now = new Date();
                                    newDate.setHours(now.getHours() + 1, now.getMinutes());
                                  }
                                  field.onChange(newDate);
                                  // Auto-close the calendar after selection
                                  setEndDatePickerOpen(false);
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
                                onChange={(newDate) => field.onChange(newDate)}
                                onComplete={() => setEndDatePickerOpen(false)}
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
                
                {/* Recurring Meeting Options */}
                <FormField
                  control={meetingForm.control}
                  name="isRecurring"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-xs">This is a recurring meeting</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
                
                {/* Recurring meeting options */}
                {meetingForm.watch("isRecurring") && (
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={meetingForm.control}
                      name="recurrencePattern"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Frequency</FormLabel>
                          <Select
                            value={field.value || undefined}
                            onValueChange={(value) => {
                              field.onChange(value);
                            }}
                          >
                            <SelectTrigger className="h-9 text-xs">
                              <SelectValue placeholder="Select frequency" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="daily">Daily</SelectItem>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="yearly">Yearly</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={meetingForm.control}
                      name="recurrenceInterval"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Interval</FormLabel>
                          <Input
                            type="number"
                            min={1}
                            placeholder="Every..."
                            className="h-9 text-xs"
                            {...field}
                            value={field.value || "1"}
                            onChange={(e) => {
                              const value = parseInt(e.target.value);
                              field.onChange(isNaN(value) ? 1 : value);
                            }}
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={meetingForm.control}
                      name="recurrenceEndDate"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel className="text-xs">Until</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className="h-9 w-full pl-3 text-left font-normal text-xs"
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>No end date</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value || undefined}
                                onSelect={(date) => field.onChange(date)}
                                initialFocus
                              />
                              <div className="p-2 border-t border-border">
                                <Button
                                  variant="ghost"
                                  className="w-full text-xs"
                                  onClick={() => field.onChange(null)}
                                >
                                  Clear end date
                                </Button>
                              </div>
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
                
                {/* Show update all recurring checkbox when editing a recurring meeting */}
                {meetingForm.watch("isRecurring") && isEditingMeeting && selectedMeetingId && (
                  <FormField
                    control={meetingForm.control}
                    name="update_all_recurring"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3 bg-amber-50">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-xs">Update all recurring meetings</FormLabel>
                          <p className="text-xs text-muted-foreground">
                            When checked, this will apply changes to all instances of this meeting.
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />
                )}
                
                <div className="pt-2">
                  {isEditingMeeting && selectedMeetingId ? (
                    <div className="flex gap-2">
                      <Button 
                        type="button" 
                        variant="destructive" 
                        className="flex-1 h-9 text-xs"
                        onClick={handleDeleteMeetingClick}
                        disabled={deleteMeetingMutation.isPending}
                      >
                        {deleteMeetingMutation.isPending ? (
                          <>
                            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                            Deleting...
                          </>
                        ) : (
                          <>
                            <Trash2 className="mr-1.5 h-3 w-3" />
                            Delete
                          </>
                        )}
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={createMeetingMutation.isPending} 
                        className="flex-1 h-9 bg-[#0284c7] hover:bg-[#0284c7]/90 text-xs"
                      >
                        {createMeetingMutation.isPending ? (
                          <>
                            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                            Updating...
                          </>
                        ) : (
                          <>
                            <Pencil className="mr-1.5 h-3 w-3" />
                            Update
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      type="submit" 
                      disabled={createMeetingMutation.isPending} 
                      className="w-full h-9 bg-[#0284c7] hover:bg-[#0284c7]/90 text-xs"
                    >
                      {createMeetingMutation.isPending ? (
                        <>
                          <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Users className="mr-1.5 h-3 w-3" />
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
                className="bg-[#0284c7] hover:bg-[#0284c7]/90 text-white font-medium flex items-center justify-start h-14 rounded-lg transition-all hover:translate-y-[-2px] hover:shadow-md"
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
                className="bg-[#a855f7] hover:bg-[#a855f7]/90 text-white font-medium flex items-center justify-start h-14 rounded-lg transition-all hover:translate-y-[-2px] hover:shadow-md"
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
          <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center text-lg font-semibold">
                {newTask.eventType === EventType.APPOINTMENT ? (
                  <>
                    <Clock className="h-5 w-5 mr-2 text-purple-500" />
                    Create Appointment
                  </>
                ) : (
                  <>
                    <Plus className="h-5 w-5 mr-2 text-primary" />
                    Create New Task
                  </>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="grid gap-1.5">
                <Label htmlFor="title" className="text-xs font-medium">Title</Label>
                <Input
                  id="title"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder={newTask.eventType === EventType.APPOINTMENT ? "Appointment title" : "Task title"}
                  className="h-9"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="description" className="text-xs font-medium">Description</Label>
                <Textarea
                  id="description"
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder={newTask.eventType === EventType.APPOINTMENT ? "Appointment details" : "Task details"}
                  className="min-h-[60px] text-sm"
                  disabled={isEditing && selectedTask?.completed}
                />
              </div>
              
              {newTask.eventType !== EventType.APPOINTMENT && (
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium">Priority</Label>
                <Select
                  value={newTask.priority}
                  onValueChange={(value) => setNewTask({ ...newTask, priority: value as 'low' | 'medium' | 'high' })}
                >
                    <SelectTrigger className="h-9">
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
              )}
              
              <div className="grid gap-2">
                <Label className="flex items-center text-sm font-medium">
                  <span className="inline-flex items-center">
                    <CalendarIcon className="h-3.5 w-3.5 mr-2 text-primary" />
                    Due Date
                  </span>
                </Label>
                <Popover open={taskDueDatePickerOpen} onOpenChange={setTaskDueDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline" 
                      className="w-full justify-start text-left font-normal mt-1 h-8 text-xs"
                      disabled={isEditing && selectedTask?.completed}
                    >
                      {newTask.due_date ? (
                        format(newTask.due_date, 'MMM dd, yyyy h:mm a')
                      ) : (
                        <span>Select a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 flex flex-col sm:flex-row max-h-[90vh] overflow-auto" align="start">
                    <div className="min-w-[280px]">
                    <Calendar
                      mode="single"
                        selected={newTask.due_date || undefined} 
                      onSelect={(date) => {
                        if (date) {
                          const newDate = new Date(date);
                            if (newTask.due_date) {
                              // Preserve the time
                            newDate.setHours(
                              newTask.due_date.getHours(),
                                newTask.due_date.getMinutes(),
                                0,
                                0
                            );
                          }
                          setNewTask({ ...newTask, due_date: newDate });
                        }
                      }}
                      disabled={isEditing && selectedTask?.completed}
                    />
                    </div>
                    <div className="border-t sm:border-t-0 sm:border-l">
                      <TimeSelect
                        value={newTask.due_date ? new Date(newTask.due_date) : new Date()}
                        onChange={(newDate) => {
                          setNewTask({ ...newTask, due_date: newDate });
                        }}
                        onComplete={() => {
                          setTaskDueDatePickerOpen(false);
                        }}
                        compact={true}
                        disabled={isEditing && selectedTask?.completed}
                      />
                    </div>
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
              
              <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-md">
                <Label className="flex items-center text-sm font-medium">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className="h-3.5 w-3.5 mr-2 text-primary" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                    <path d="M16 16h5v5" />
                  </svg>
                  Recurring Task
                </Label>
                <div className="flex-1"></div>
                <Switch
                  checked={newTask.is_recurring}
                  onCheckedChange={(checked) => setNewTask({
                    ...newTask,
                    is_recurring: checked,
                    recurrence_pattern: checked ? newTask.recurrence_pattern || 'weekly' : null,
                    recurrence_interval: checked ? newTask.recurrence_interval || 1 : null
                  })}
                  disabled={isEditing && selectedTask?.completed}
                />
              </div>
              
              {newTask.is_recurring && (
                <div className="space-y-3 p-2 px-3 bg-muted/20 rounded-md border border-muted/30">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-medium">Repeat</Label>
                      <Select 
                        value={newTask.recurrence_pattern || 'weekly'}
                        onValueChange={(value) => setNewTask({
                          ...newTask,
                          recurrence_pattern: value
                        })}
                        disabled={isEditing && selectedTask?.completed}
                      >
                        <SelectTrigger className="h-8 mt-1">
                          <SelectValue placeholder="Select pattern" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label className="text-xs font-medium">Every</Label>
                      <div className="flex items-center h-8 mt-1">
                        <Input 
                          type="number" 
                          value={newTask.recurrence_interval || 1}
                          onChange={(e) => setNewTask({
                            ...newTask,
                            recurrence_interval: parseInt(e.target.value) || 1
                          })}
                          min="1" 
                          className="h-8 w-16"
                          disabled={isEditing && selectedTask?.completed}
                        />
                        <span className="text-xs ml-2">
                          {newTask.recurrence_pattern === 'daily' && 'day(s)'}
                          {newTask.recurrence_pattern === 'weekly' && 'week(s)'}
                          {newTask.recurrence_pattern === 'monthly' && 'month(s)'}
                          {newTask.recurrence_pattern === 'yearly' && 'year(s)'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-xs font-medium">End Recurrence</Label>
                    <Popover open={taskRecurrenceEndDatePickerOpen} onOpenChange={setTaskRecurrenceEndDatePickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="h-8 w-full justify-start pl-3 text-left font-normal text-xs mt-1"
                          disabled={isEditing && selectedTask?.completed}
                        >
                          <CalendarIcon className="mr-2 h-3 w-3" />
                          {newTask.recurrence_end_date ? (
                            formatDate(newTask.recurrence_end_date, "PPP")
                          ) : (
                            <span>No end date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <div className="p-2 flex justify-between">
                          <span className="text-xs font-medium">End Date</span>
                          {newTask.recurrence_end_date && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs"
                              onClick={() => {
                                setNewTask({
                                ...newTask,
                                recurrence_end_date: null
                                });
                                setTaskRecurrenceEndDatePickerOpen(false);
                              }}
                              disabled={isEditing && selectedTask?.completed}
                            >
                              Clear
                            </Button>
                          )}
                        </div>
                        <div className="flex flex-col sm:flex-row">
                          <div className="min-w-[280px]">
                            <Calendar 
                              mode="single"
                              selected={newTask.recurrence_end_date || undefined}
                              onSelect={(date) => {
                                if (date) {
                                  const newDate = new Date(date);
                                  if (newTask.recurrence_end_date) {
                                    // Preserve the time
                                    newDate.setHours(
                                      newTask.recurrence_end_date.getHours(),
                                      newTask.recurrence_end_date.getMinutes(),
                                      0,
                                      0
                                    );
                                  }
                                  setNewTask({
                                    ...newTask,
                                    recurrence_end_date: newDate
                                  });
                                } else {
                                  setNewTask({
                                    ...newTask,
                                    recurrence_end_date: null
                                  });
                                }
                              }}
                              initialFocus
                              disabled={(date) => {
                                if (!newTask.due_date) return false;
                                return Boolean(date < newTask.due_date || (isEditing && selectedTask?.completed));
                              }}
                            />
                          </div>
                          <div className="border-t sm:border-t-0 sm:border-l">
                            <TimeSelect
                              value={newTask.recurrence_end_date ? new Date(newTask.recurrence_end_date) : new Date()}
                              onChange={(newDate) => {
                                setNewTask({ ...newTask, recurrence_end_date: newDate });
                              }}
                              onComplete={() => {
                                setTaskRecurrenceEndDatePickerOpen(false);
                              }}
                              compact={true}
                              disabled={isEditing && selectedTask?.completed}
                            />
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                className="h-9 text-xs"
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
                className={`h-9 text-xs ${newTask.eventType === EventType.APPOINTMENT ? "bg-purple-600 hover:bg-purple-700" : "bg-primary hover:bg-primary/90"}`}
              >
                {createTaskMutation.isPending && newTask.eventType !== EventType.APPOINTMENT ? (
                  <>
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                    Creating...
                  </>
                ) : (
                  newTask.eventType === EventType.APPOINTMENT ? (
                    <>
                      <Clock className="mr-1.5 h-3 w-3" />
                      Create Appointment
                    </>
                  ) : (
                    <>
                      <Plus className="mr-1.5 h-3 w-3" />
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
          <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
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
                <Popover open={taskDueDatePickerOpen} onOpenChange={setTaskDueDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline" 
                      className="w-full justify-start text-left font-normal mt-1 h-8 text-xs"
                      disabled={isEditing && selectedTask?.completed}
                    >
                      {newTask.due_date ? (
                        format(newTask.due_date, 'MMM dd, yyyy h:mm a')
                      ) : (
                        <span>Select a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 flex flex-col sm:flex-row max-h-[90vh] overflow-auto" align="start">
                    <div className="min-w-[280px]">
                    <Calendar
                      mode="single"
                        selected={newTask.due_date || undefined} 
                      onSelect={(date) => {
                        if (date) {
                          const newDate = new Date(date);
                            if (newTask.due_date) {
                              // Preserve the time
                            newDate.setHours(
                              newTask.due_date.getHours(),
                                newTask.due_date.getMinutes(),
                                0,
                                0
                            );
                          }
                          setNewTask({ ...newTask, due_date: newDate });
                            // Auto-close the calendar after selection
                            setTaskDueDatePickerOpen(false);
                        }
                      }}
                      disabled={isEditing && selectedTask?.completed}
                    />
                    </div>
                    <div className="border-t sm:border-t-0 sm:border-l">
                      <TimeSelect
                        value={newTask.due_date ? new Date(newTask.due_date) : new Date()}
                        onChange={(newDate) => {
                          setNewTask({ ...newTask, due_date: newDate });
                        }}
                        onComplete={() => {
                          setTaskDueDatePickerOpen(false);
                        }}
                        compact={true}
                        disabled={isEditing && selectedTask?.completed}
                      />
                    </div>
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
              
              <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-md">
                <Label className="flex items-center text-sm font-medium">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className="h-3.5 w-3.5 mr-2 text-primary" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                    <path d="M16 16h5v5" />
                  </svg>
                  Recurring Task
                </Label>
                <div className="flex-1"></div>
                <Switch
                  checked={newTask.is_recurring}
                  onCheckedChange={(checked) => setNewTask({
                    ...newTask,
                    is_recurring: checked,
                    recurrence_pattern: checked ? newTask.recurrence_pattern || 'weekly' : null,
                    recurrence_interval: checked ? newTask.recurrence_interval || 1 : null
                  })}
                  disabled={isEditing && selectedTask?.completed}
                />
              </div>
              
              {newTask.is_recurring && (
                <div className="space-y-3 p-2 px-3 bg-muted/20 rounded-md border border-muted/30">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-medium">Repeat</Label>
                      <Select 
                        value={newTask.recurrence_pattern || 'weekly'}
                        onValueChange={(value) => setNewTask({
                          ...newTask,
                          recurrence_pattern: value
                        })}
                        disabled={isEditing && selectedTask?.completed}
                      >
                        <SelectTrigger className="h-8 mt-1">
                          <SelectValue placeholder="Select pattern" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label className="text-xs font-medium">Every</Label>
                      <div className="flex items-center h-8 mt-1">
                        <Input 
                          type="number" 
                          value={newTask.recurrence_interval || 1}
                          onChange={(e) => setNewTask({
                            ...newTask,
                            recurrence_interval: parseInt(e.target.value) || 1
                          })}
                          min="1" 
                          className="h-8 w-16"
                          disabled={isEditing && selectedTask?.completed}
                        />
                        <span className="text-xs ml-2">
                          {newTask.recurrence_pattern === 'daily' && 'day(s)'}
                          {newTask.recurrence_pattern === 'weekly' && 'week(s)'}
                          {newTask.recurrence_pattern === 'monthly' && 'month(s)'}
                          {newTask.recurrence_pattern === 'yearly' && 'year(s)'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-xs font-medium">End Recurrence</Label>
                    <Popover open={taskRecurrenceEndDatePickerOpen} onOpenChange={setTaskRecurrenceEndDatePickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="h-8 w-full justify-start pl-3 text-left font-normal text-xs mt-1"
                          disabled={isEditing && selectedTask?.completed}
                        >
                          <CalendarIcon className="mr-2 h-3 w-3" />
                          {newTask.recurrence_end_date ? (
                            formatDate(newTask.recurrence_end_date, "PPP")
                          ) : (
                            <span>No end date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <div className="p-2 flex justify-between">
                          <span className="text-xs font-medium">End Date</span>
                          {newTask.recurrence_end_date && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs"
                              onClick={() => {
                                setNewTask({
                                ...newTask,
                                recurrence_end_date: null
                                });
                                setTaskRecurrenceEndDatePickerOpen(false);
                              }}
                              disabled={isEditing && selectedTask?.completed}
                            >
                              Clear
                            </Button>
                          )}
                        </div>
                        <div className="flex flex-col sm:flex-row">
                          <div className="min-w-[280px]">
                            <Calendar 
                              mode="single"
                              selected={newTask.recurrence_end_date || undefined}
                              onSelect={(date) => {
                                if (date) {
                                  const newDate = new Date(date);
                                  if (newTask.recurrence_end_date) {
                                    // Preserve the time
                                    newDate.setHours(
                                      newTask.recurrence_end_date.getHours(),
                                      newTask.recurrence_end_date.getMinutes(),
                                      0,
                                      0
                                    );
                                  }
                                  setNewTask({
                                    ...newTask,
                                    recurrence_end_date: newDate
                                  });
                                } else {
                                  setNewTask({
                                    ...newTask,
                                    recurrence_end_date: null
                                  });
                                }
                              }}
                              initialFocus
                              disabled={(date) => {
                                if (!newTask.due_date) return false;
                                return Boolean(date < newTask.due_date || (isEditing && selectedTask?.completed));
                              }}
                            />
                          </div>
                          <div className="border-t sm:border-t-0 sm:border-l">
                            <TimeSelect
                              value={newTask.recurrence_end_date ? new Date(newTask.recurrence_end_date) : new Date()}
                              onChange={(newDate) => {
                                setNewTask({ ...newTask, recurrence_end_date: newDate });
                              }}
                              onComplete={() => {
                                setTaskRecurrenceEndDatePickerOpen(false);
                              }}
                              compact={true}
                              disabled={isEditing && selectedTask?.completed}
                            />
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
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
                    )
                    }
                </Button>
                  )}
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Appointment Dialog */}
        <Dialog open={appointmentDialogOpen} onOpenChange={setAppointmentDialogOpen}>
          <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
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
                    New Appointment
                  </>
                )}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {selectedAppointmentId 
                  ? "Make changes to your appointment details below."
                  : "Fill in the details to schedule a new appointment."}
              </DialogDescription>
            </DialogHeader>
            
            <Form {...appointmentForm}>
              <form
                onSubmit={appointmentForm.handleSubmit((data) => {
                  const startDate = new Date(data.date);
                  startDate.setHours(data.startHour, data.startMinute, 0, 0);
                  const endDate = new Date(data.date);
                  endDate.setHours(data.endHour, data.endMinute, 0, 0);

                  if (selectedAppointmentId) {
                    // Extract update_all_recurring from data or default to false
                    const { update_all_recurring = false, ...formData } = data;
                    
                    // Update existing appointment
                    updateAppointmentMutation.mutate({
                      id: selectedAppointmentId.toString(),
                      title: formData.title,
                      description: formData.description || "",
                      start_time: Math.floor(startDate.getTime() / 1000),
                      end_time: Math.floor(endDate.getTime() / 1000),
                      all_day: formData.allDay,
                      is_recurring: formData.isRecurring,
                      recurrence_pattern: formData.isRecurring ? formData.recurrencePattern : null,
                      recurrence_interval: formData.isRecurring ? formData.recurrenceInterval : null,
                      recurrence_end_date: formData.isRecurring && formData.recurrenceEndDate 
                        ? Math.floor(formData.recurrenceEndDate.getTime() / 1000) 
                        : null,
                      update_all_recurring: update_all_recurring
                    });
                  } else {
                    // Create new appointment
                    createAppointmentMutation.mutate(data);
                  }
                  
                  setAppointmentDialogOpen(false);
                })}
                className="space-y-4 mt-2"
              >
                <FormField
                  control={appointmentForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter appointment title" {...field} />
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
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Enter appointment details" 
                          {...field} 
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={appointmentForm.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date</FormLabel>
                      <Popover open={appointmentDatePickerOpen} onOpenChange={setAppointmentDatePickerOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start" side="bottom">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={(date) => {
                              field.onChange(date);
                              if (date) {
                                setAppointmentDatePickerOpen(false);
                              }
                            }}
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
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>All-day appointment</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
                
                {appointmentForm.watch("isRecurring") && selectedAppointmentId && (
                  <FormField
                    control={appointmentForm.control}
                    name="update_all_recurring"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-amber-50">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Update all recurring appointments</FormLabel>
                          <p className="text-sm text-muted-foreground">
                            When checked, this will apply changes to all instances of this recurring appointment.
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />
                )}
                
                {!appointmentForm.watch("allDay") && (
                  <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={appointmentForm.control}
                          name="startHour"
                          render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel className="text-xs font-medium">Start Time</FormLabel>
                          <Popover open={startTimePickerOpen} onOpenChange={setStartTimePickerOpen}>
                            <PopoverTrigger asChild>
                            <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  <Clock className="mr-2 h-4 w-4 text-purple-500" />
                                  {format(
                                    new Date().setHours(appointmentForm.watch("startHour"), appointmentForm.watch("startMinute")),
                                    "h:mm a"
                                  )}
                                </Button>
                            </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start" side="top">
                              <TimeSelect
                                value={(() => {
                                  const date = new Date();
                                  date.setHours(field.value, appointmentForm.watch("startMinute"));
                                  return date;
                                })()}
                                onChange={(date) => {
                                  field.onChange(date.getHours());
                                  appointmentForm.setValue("startMinute", date.getMinutes());
                                  // Auto-close time selector after selection
                                  setStartTimePickerOpen(false);
                                }}
                                compact={true}
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                            </FormItem>
                          )}
                        />
                    
                        <FormField
                          control={appointmentForm.control}
                          name="endHour"
                          render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel className="text-xs font-medium">End Time</FormLabel>
                          <Popover open={endTimePickerOpen} onOpenChange={setEndTimePickerOpen}>
                            <PopoverTrigger asChild>
                            <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  <Clock className="mr-2 h-4 w-4 text-purple-500" />
                                  {format(
                                    new Date().setHours(appointmentForm.watch("endHour"), appointmentForm.watch("endMinute")),
                                    "h:mm a"
                                  )}
                                </Button>
                            </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start" side="top">
                              <TimeSelect
                                value={(() => {
                                  const date = new Date();
                                  date.setHours(field.value, appointmentForm.watch("endMinute"));
                                  return date;
                                })()}
                                onChange={(date) => {
                                  field.onChange(date.getHours());
                                  appointmentForm.setValue("endMinute", date.getMinutes());
                                  // Auto-close time selector after selection
                                  setEndTimePickerOpen(false);
                                }}
                                compact={true}
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                )}
                
                {/* Recurring Appointment Options */}
                <FormField
                  control={appointmentForm.control}
                  name="isRecurring"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-xs font-medium flex items-center">
                          <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            className="h-3 w-3 mr-1.5 text-purple-500" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                          >
                            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                            <path d="M3 3v5h5" />
                            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                            <path d="M16 16h5v5" />
                          </svg>
                          Recurring Appointment
                        </FormLabel>
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
                
                {appointmentForm.watch("isRecurring") && (
                  <div className="space-y-3 p-2 bg-muted/30 rounded-md">
                    <div className="grid grid-cols-2 gap-2">
                      <FormField
                        control={appointmentForm.control}
                        name="recurrencePattern"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-medium">Repeat</FormLabel>
                            <Select
                              value={field.value || "weekly"}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Select pattern" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="daily">Daily</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                                <SelectItem value="yearly">Yearly</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={appointmentForm.control}
                        name="recurrenceInterval"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-medium">Every</FormLabel>
                            <div className="flex items-center h-8">
                              <FormControl>
                                <Input 
                                  type="number" 
                                  {...field}
                                  value={field.value || 1}
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                                  min="1" 
                                  className="h-8 w-12 text-xs"
                                />
                              </FormControl>
                              <span className="text-xs ml-2">
                                {appointmentForm.watch("recurrencePattern") === "daily" && "day(s)"}
                                {appointmentForm.watch("recurrencePattern") === "weekly" && "week(s)"}
                                {appointmentForm.watch("recurrencePattern") === "monthly" && "month(s)"}
                                {appointmentForm.watch("recurrencePattern") === "yearly" && "year(s)"}
                              </span>
                </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <FormField
                      control={appointmentForm.control}
                      name="recurrenceEndDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium">End Recurrence</FormLabel>
                          <Popover open={recurrenceEndDatePickerOpen} onOpenChange={setRecurrenceEndDatePickerOpen}>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className="h-8 w-full justify-start pl-3 text-left font-normal text-xs"
                                >
                                  <CalendarIcon className="mr-2 h-3 w-3" />
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>No end date</span>
                                  )}
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <div className="p-2 flex justify-between items-center border-b">
                                <div className="font-medium">End Date</div>
                                {field.value && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      field.onChange(undefined);
                                      setRecurrenceEndDatePickerOpen(false);
                                    }}
                                  >
                                    Clear
                                  </Button>
                                )}
                              </div>
                              <Calendar
                                mode="single"
                                selected={field.value || undefined}
                                onSelect={(date) => {
                                  field.onChange(date);
                                  if (date) {
                                    setRecurrenceEndDatePickerOpen(false);
                                  }
                                }}
                                initialFocus
                                disabled={(date) => {
                                  const formDate = appointmentForm.getValues("date");
                                  return formDate ? date < formDate : false;
                                }}
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
                
                <DialogFooter>
                    <Button
                      type="button"
                    variant="outline" 
                    onClick={() => setAppointmentDialogOpen(false)}
                  >
                    Cancel
                    </Button>
                  <Button 
                    type="submit" 
                    className="mr-2 bg-purple-500 hover:bg-purple-600"
                    disabled={createAppointmentMutation.isPending}
                  >
                    {createAppointmentMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        {selectedAppointmentId ? 'Update Appointment' : 'Create Appointment'}
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Add delete confirmation dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <Trash2 className="h-5 w-5 mr-2 text-destructive" />
                Confirm Deletion
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this meeting? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            
            {meetingToDelete && (
              <div className="py-4">
                <div className="rounded-lg border p-4 bg-destructive/5 text-destructive-foreground">
                  <p className="text-sm font-medium mb-2">
                    You are about to delete:
                  </p>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      {meetingToDelete.title}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center">
                      <CalendarIcon className="h-3 w-3 mr-1 opacity-70" />
                      {formatDateForDisplay(new Date(meetingToDelete.start_time * 1000))}
                      {!meetingToDelete.all_day && (
                        <> • {format(new Date(meetingToDelete.start_time * 1000), "h:mm a")} - {format(new Date(meetingToDelete.end_time * 1000), "h:mm a")}</>
                      )}
                    </p>
                    {meetingToDelete.location && (
                      <p className="text-xs text-muted-foreground flex items-center mt-1">
                        <Video className="h-3 w-3 mr-1 opacity-70" />
                        Meeting link
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            <DialogFooter className="flex space-x-2 mt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setMeetingToDelete(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmDelete}
                variant="destructive"
                disabled={deleteMeetingMutation.isPending}
              >
                {deleteMeetingMutation.isPending ? 
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </> : 
                  "Delete Meeting"
                }
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
