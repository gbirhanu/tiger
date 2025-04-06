import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { z } from "zod";
import { type Meeting } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { queryClient, QUERY_KEYS, apiRequest } from "@/lib/queryClient";
import { getMeetings, createMeeting, deleteMeeting, updateMeeting, getAppointments } from "@/lib/api";
import { Plus, Trash2, Video, Loader2, CalendarIcon, Clock, Pencil, Users, AlertCircle, MoreVertical, Edit, XCircle, CheckCircle } from "lucide-react";
import { formatDate, getNow } from "@/lib/timezone";
import { TimeSelect } from "./TimeSelect";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MeetingsProps {
  isDialogOpen?: boolean;
  setIsDialogOpen?: (open: boolean) => void;
  initialDate?: Date | null;
}

// Create a schema for the form
const meetingFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  meetingLink: z.string().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  allDay: z.boolean().default(false),
  isRecurring: z.boolean().default(false),
  recurrencePattern: z.enum(["daily", "weekly", "monthly", "yearly"]).optional(),
  recurrenceInterval: z.number().optional(),
  recurrenceEndDate: z.date().optional(),
});

type MeetingFormValues = z.infer<typeof meetingFormSchema>;

// Fix the MeetingWithAllDay interface to correctly extend Meeting
interface MeetingWithAllDay extends Omit<Meeting, 'recurrence_pattern'> {
  all_day?: boolean;
  // Make the recurrence pattern field accept any string values from the API,
  // not just the enum values, to avoid type errors
  recurrence_pattern: string | null;
}

// Add this helper function to determine meeting status
const getMeetingStatus = (meeting: Meeting) => {
  // First check if the meeting is marked as completed
  if (meeting.completed) {
    return "completed";
  }
  
  const now = Math.floor(Date.now() / 1000);
  if (meeting.end_time < now) {
    return "past";
  } else if (meeting.start_time <= now && meeting.end_time >= now) {
    return "in-progress";
  } else {
    return "upcoming";
  }
};

// Add this helper function to get status badge
const getMeetingStatusBadge = (status: string) => {
  switch (status) {
    case "completed":
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Completed</span>;
    case "in-progress":
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">In Progress</span>;
    case "upcoming":
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Upcoming</span>;
    case "past":
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">Past</span>;
    default:
      return null;
  }
};

// Add a helper function to safely filter meetings
const filterMeetingsByStatus = (meetings: MeetingWithAllDay[] | undefined, status: string): MeetingWithAllDay[] => {
  if (!meetings) return [];
  if (status === "all") return meetings;
  return meetings.filter(meeting => getMeetingStatus(meeting) === status);
};

// Function to check if meetings overlap
const checkMeetingOverlap = (
  meetings: MeetingWithAllDay[] | undefined,
  startTime: number,
  endTime: number,
  isAllDay: boolean,
  excludeMeetingId?: number
): { overlapping: MeetingWithAllDay | null; type: "meeting" } | null => {
  if (!meetings || meetings.length === 0) return null;
  
  // Find any meeting that overlaps with the specified time range
  const overlappingMeeting = meetings.find(meeting => {
    // Skip comparing with itself if updating
    if (excludeMeetingId && meeting.id === excludeMeetingId) return false;
    
    // For all-day events, check if the dates overlap
    if (isAllDay || meeting.all_day) {
      const newStartDay = new Date(startTime * 1000);
      newStartDay.setHours(0, 0, 0, 0);
      
      const newEndDay = new Date(endTime * 1000);
      newEndDay.setHours(23, 59, 59, 999);
      
      const existingStartDay = new Date(meeting.start_time * 1000);
      existingStartDay.setHours(0, 0, 0, 0);
      
      const existingEndDay = new Date(meeting.end_time * 1000);
      existingEndDay.setHours(23, 59, 59, 999);
      
      // Check if the days overlap
      return (
        (newStartDay <= existingEndDay && newEndDay >= existingStartDay)
      );
    }
    
    // Regular time-based overlap check
    return (
      (startTime < meeting.end_time && endTime > meeting.start_time)
    );
  });
  
  // Return the overlapping meeting if found
  return overlappingMeeting ? { overlapping: overlappingMeeting, type: "meeting" } : null;
};

// Function to check if a meeting overlaps with an appointment
const checkAppointmentOverlap = (
  appointments: any[] | undefined,
  startTime: number,
  endTime: number,
  isAllDay: boolean
): { overlapping: any; type: "appointment" } | null => {
  if (!appointments || appointments.length === 0) return null;
  
  const overlappingAppointment = appointments.find((appointment) => {
    // For all-day events, check if the dates overlap
    if (isAllDay || appointment.all_day) {
      const newStartDay = new Date(startTime * 1000);
      newStartDay.setHours(0, 0, 0, 0);
      
      const newEndDay = new Date(endTime * 1000);
      newEndDay.setHours(23, 59, 59, 999);
      
      const existingStartDay = new Date(appointment.start_time * 1000);
      existingStartDay.setHours(0, 0, 0, 0);
      
      const existingEndDay = new Date(appointment.end_time * 1000);
      existingEndDay.setHours(23, 59, 59, 999);
      
      return (
        (newStartDay <= existingEndDay && newEndDay >= existingStartDay)
      );
    }
    
    // Regular time-based overlap check
    return (
      (startTime < appointment.end_time && endTime > appointment.start_time)
    );
  });
  
  return overlappingAppointment ? { overlapping: overlappingAppointment, type: "appointment" } : null;
};

export default function Meetings({ isDialogOpen, setIsDialogOpen, initialDate }: MeetingsProps = {}) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [startDatePickerOpen, setStartDatePickerOpen] = useState(false);
  const [endDatePickerOpen, setEndDatePickerOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingWithAllDay | null>(null);
  
  // Add isSubmitting state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filter, setFilter] = useState<"all" | "completed" | "in-progress" | "upcoming" | "past">("all");
  
  // Add pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  
  // Add state for conflict confirmation dialog
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [conflictDetails, setConflictDetails] = useState<{
    eventType: string;
    eventTitle: string;
    eventDate: string;
    eventTime: string;
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);

  // Add state for delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [meetingToDelete, setMeetingToDelete] = useState<MeetingWithAllDay | null>(null);

  // Add recurrence states
  const [recurrenceEndDatePickerOpen, setRecurrenceEndDatePickerOpen] = useState(false);

  // Form for creating meetings
  const form = useForm<MeetingFormValues>({
    resolver: zodResolver(meetingFormSchema),
    defaultValues: {
      title: "",
      description: "",
      meetingLink: "",
      startDate: initialDate || new Date(),
      endDate: initialDate ? new Date(initialDate.getTime() + 60 * 60 * 1000) : new Date(Date.now() + 60 * 60 * 1000),
      allDay: false,
      isRecurring: false,
      recurrencePattern: "weekly",
      recurrenceInterval: 1,
      recurrenceEndDate: undefined,
    },
  });

  // Sync internal and external dialog state
  useEffect(() => {
    if (isDialogOpen !== undefined) {
      setDialogOpen(isDialogOpen);
    }
  }, [isDialogOpen]);

  // Update external dialog state when internal state changes
  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (setIsDialogOpen) {
      setIsDialogOpen(open);
    }
  };

  const { data: meetings, isLoading, error } = useQuery<MeetingWithAllDay[]>({
    queryKey: [QUERY_KEYS.MEETINGS],
    queryFn: getMeetings,
  });

  // Add appointments query
  const { data: appointments } = useQuery({
    queryKey: [QUERY_KEYS.APPOINTMENTS],
    queryFn: getAppointments,
  });

  // Log any errors for debugging
  React.useEffect(() => {
    if (error) {
      console.error("Error fetching meetings:", error);
    }
  }, [error]);

  // Add event listener for opening the meeting dialog from Calendar
  React.useEffect(() => {
    const handleOpenMeetingDialog = () => {
      setDialogOpen(true);
    };
    
    document.addEventListener('open-meeting-dialog', handleOpenMeetingDialog);
    
    return () => {
      document.removeEventListener('open-meeting-dialog', handleOpenMeetingDialog);
    };
  }, []);

  // Function to check for any calendar conflicts (meetings or appointments)
  const checkCalendarConflicts = (
    startTime: number,
    endTime: number,
    isAllDay: boolean,
    excludeMeetingId?: number
  ) => {
    // Check for meeting overlaps
    const meetingOverlap = checkMeetingOverlap(
      meetings, 
      startTime, 
      endTime, 
      isAllDay,
      excludeMeetingId
    );
    
    if (meetingOverlap) {
      return meetingOverlap;
    }
    
    // Check for appointment overlaps
    const appointmentOverlap = checkAppointmentOverlap(
      appointments, 
      startTime, 
      endTime, 
      isAllDay
    );
    
    if (appointmentOverlap) {
      return appointmentOverlap;
    }
    
    return null;
  };

  const createMeetingMutation = useMutation({
    mutationFn: async (data: MeetingFormValues) => {
      
      // Validate dates exist
      if (!data.startDate || !data.endDate) {
        throw new Error("Start and end times are required");
      }
      
      // For all-day events, adjust the times to the full day
      let startDate = new Date(data.startDate);
      let endDate = new Date(data.endDate);
      
      if (data.allDay) {
        // Set start time to beginning of day
        startDate.setHours(0, 0, 0, 0);
        
        // Set end time to end of day
        endDate.setHours(23, 59, 59, 999);
        
        // For all-day events, the end date can be the same as or after the start date
        // No need to validate further for all-day events
      } else {
        // For regular meetings, validate end time is after start time
        // Use timestamp comparison for more precise comparison
        if (endDate.getTime() <= startDate.getTime()) {
          throw new Error("End time must be after start time");
        }
      }
      
      // Calculate timestamps for overlap check
      const startTimestamp = Math.floor(startDate.getTime() / 1000);
      const endTimestamp = Math.floor(endDate.getTime() / 1000);
      
      // Additional validation ensuring end timestamp is greater than start timestamp
      if (endTimestamp <= startTimestamp) {
        throw new Error("End time must be after start time");
      }
      
      // Check for calendar conflicts (meetings or appointments)
      const conflict = checkCalendarConflicts(
        startTimestamp, 
        endTimestamp, 
        data.allDay,
        undefined
      );
      
      if (conflict) {
        const eventType = conflict.type;
        const eventTitle = conflict.overlapping?.title;
        const eventDate = formatDate(conflict.overlapping?.start_time || 0, "EEE, MMM d");
        const isAllDay = conflict.overlapping?.all_day;
        const eventTime = isAllDay 
          ? "(All Day)" 
          : `at ${formatDate(conflict.overlapping?.start_time || 0, "h:mm a")}`;
        
        // Return a new Promise that will be resolved or rejected based on user's choice
        return new Promise((resolve, reject) => {
          // Set conflict details for the dialog
          setConflictDetails({
            eventType,
            eventTitle,
            eventDate,
            eventTime,
            onConfirm: () => {
              // User confirmed, continue with meeting creation
              const meeting: Partial<MeetingWithAllDay> = {
                title: data.title,
                description: data.description || null,
                location: data.meetingLink || null,
                start_time: startTimestamp,
                end_time: endTimestamp,
                all_day: data.allDay,
                completed: false,
                is_recurring: data.isRecurring,
                recurrence_pattern: data.isRecurring ? data.recurrencePattern : null,
                recurrence_interval: data.isRecurring ? data.recurrenceInterval : null,
                recurrence_end_date: data.isRecurring && data.recurrenceEndDate ? Math.floor(data.recurrenceEndDate.getTime() / 1000) : null,
                created_at: Math.floor(Date.now() / 1000),
                updated_at: Math.floor(Date.now() / 1000)
              };
              
              // Close the dialog
              setConflictDialogOpen(false);
              
              // Resolve with the meeting data
              resolve(createMeeting(meeting as Meeting));
            },
            onCancel: () => {
              // User cancelled, reject the promise
              setConflictDialogOpen(false);
              reject(new Error(`Meeting creation cancelled due to overlap with ${eventType}`));
            }
          });
          
          // Open the conflict dialog
          setConflictDialogOpen(true);
        });
      }
      
      // If no conflict, proceed with meeting creation
      // Format the data for the API
      const meeting: Partial<MeetingWithAllDay> = {
        title: data.title,
        description: data.description || null,
        location: data.meetingLink || null,
        start_time: startTimestamp,
        end_time: endTimestamp,
        all_day: data.allDay,
        completed: false,
        attendees: null, // Required by the type
        is_recurring: data.isRecurring,
        recurrence_pattern: data.isRecurring ? data.recurrencePattern : null,
        recurrence_interval: data.isRecurring ? data.recurrenceInterval : null,
        recurrence_end_date: data.isRecurring && data.recurrenceEndDate ? Math.floor(data.recurrenceEndDate.getTime() / 1000) : null,
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000)
      };
      
      return createMeeting(meeting as Meeting);
    },
    onMutate: async (data) => {
      
      
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.MEETINGS] });
      
      // Get a snapshot of the current meetings
      const previousMeetings = queryClient.getQueryData<MeetingWithAllDay[]>([QUERY_KEYS.MEETINGS]) || [];
      
      // Adjust dates for all-day events
      let startDate = new Date(data.startDate!);
      let endDate = new Date(data.endDate!);
      
      if (data.allDay) {
        // Set start time to beginning of day
        startDate.setHours(0, 0, 0, 0);
        
        // Set end time to end of day
        endDate.setHours(23, 59, 59, 999);
        
        // For all-day events, the end date can be the same as or after the start date
        // No need to validate further for all-day events
      } else {
        // For regular meetings, validate end time is after start time
        // Using timestamp comparison for more precise validation
        if (endDate.getTime() <= startDate.getTime()) {
          throw new Error("End time must be after start time");
        }
      }
      
      // Calculate timestamps
      const startTimestamp = Math.floor(startDate.getTime() / 1000);
      const endTimestamp = Math.floor(endDate.getTime() / 1000);
      
      // Additional validation ensuring end timestamp is greater than start timestamp
      if (endTimestamp <= startTimestamp) {
        throw new Error("End time must be after start time");
      }
      
      // Create an optimistic meeting with a temporary ID
      const optimisticMeeting: MeetingWithAllDay = {
        id: Date.now(), // Temporary ID
        user_id: 1, // Temporary user ID
        title: data.title,
        description: data.description || null,
        location: data.meetingLink || null,
        start_time: startTimestamp,
        end_time: endTimestamp,
        all_day: data.allDay,
        completed: false,
        attendees: null,
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000),
        // Add missing required fields with proper null handling
        is_recurring: data.isRecurring,
        recurrence_pattern: data.isRecurring && data.recurrencePattern ? data.recurrencePattern : null,
        recurrence_interval: data.isRecurring && data.recurrenceInterval ? data.recurrenceInterval : null,
        recurrence_end_date: data.isRecurring && data.recurrenceEndDate ? Math.floor(data.recurrenceEndDate.getTime() / 1000) : null,
        parent_meeting_id: null // Add the missing required property
      };
      
      
      
      // Create a proper deep copy to avoid reference issues
      const updatedMeetings = JSON.parse(JSON.stringify(previousMeetings));
      updatedMeetings.push(optimisticMeeting);
      
      
      
      // Update the cache with the new array that includes all previous meetings plus the new one
      queryClient.setQueryData<MeetingWithAllDay[]>([QUERY_KEYS.MEETINGS], updatedMeetings);
      
      return { previousMeetings };
    },
    onError: (error: Error, _variables, context) => {
      console.error("Error creating meeting:", error);
      
      // Rollback to previous state if available
      if (context?.previousMeetings) {
        queryClient.setQueryData<MeetingWithAllDay[]>([QUERY_KEYS.MEETINGS], context.previousMeetings);
      }
      
      toast({
        variant: "destructive",
        title: "Failed to create meeting",
        description: error.message || "An error occurred while creating the meeting.",
      });
    },
    onSuccess: (newMeeting) => {
      
      
      // Simply fetch the meetings again from the server
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MEETINGS] });
      
      form.reset();
      setDialogOpen(false);
      toast({
        title: "Meeting created",
        description: "Your meeting has been scheduled successfully.",
      });
    },
  });

  const deleteMeetingMutation = useMutation({
    mutationFn: deleteMeeting,
    onMutate: async (id) => {
      
      
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.MEETINGS] });
      
      // Snapshot the previous value
      const previousMeetings = queryClient.getQueryData<MeetingWithAllDay[]>([QUERY_KEYS.MEETINGS]) || [];
      
      // Create a proper deep copy to avoid reference issues
      const updatedMeetings = JSON.parse(JSON.stringify(previousMeetings))
        .filter((meeting: Meeting) => meeting.id !== id);
      
      
      
      // Update the cache with the filtered list
      queryClient.setQueryData<MeetingWithAllDay[]>([QUERY_KEYS.MEETINGS], updatedMeetings);
      
      // Return the context
      return { previousMeetings };
    },
    onError: (error: Error, _variables, context) => {
      console.error("Error deleting meeting:", error);
      
      // If the mutation fails, use the context to roll back
      if (context?.previousMeetings) {
        queryClient.setQueryData<MeetingWithAllDay[]>([QUERY_KEYS.MEETINGS], context.previousMeetings);
      }
      
      toast({
        variant: "destructive",
        title: "Failed to delete meeting",
        description: error.message || "An error occurred while deleting the meeting.",
      });
    },
    onSuccess: (_, deletedMeetingId) => {
      
      
      // Simply fetch the meetings again from the server
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MEETINGS] });
      
      toast({
        title: "Meeting deleted",
        description: "Your meeting has been deleted successfully.",
      });
    },
  });

  const updateMeetingMutation = useMutation({
    mutationFn: async (data: MeetingFormValues) => {
      if (!selectedMeeting) throw new Error("No meeting selected for update");
      if (!data.startDate || !data.endDate) throw new Error("Start and end times are required");
      
      // For all-day events, adjust the times to the full day
      let startDate = new Date(data.startDate);
      let endDate = new Date(data.endDate);
      
      if (data.allDay) {
        // Set start time to beginning of day
        startDate.setHours(0, 0, 0, 0);
        
        // Set end time to end of day
        endDate.setHours(23, 59, 59, 999);
        
        // For all-day events, the end date can be the same as or after the start date
        // No need to validate further for all-day events
      } else {
        // For regular meetings, validate end time is after start time
        // Use timestamp comparison for more precise comparison
        if (endDate.getTime() <= startDate.getTime()) {
          throw new Error("End time must be after start time");
        }
      }
      
      // Calculate timestamps for overlap check
      const startTimestamp = Math.floor(startDate.getTime() / 1000);
      const endTimestamp = Math.floor(endDate.getTime() / 1000);
      
      // Additional validation ensuring end timestamp is greater than start timestamp
      if (endTimestamp <= startTimestamp) {
        throw new Error("End time must be after start time");
      }
      
      // Check for calendar conflicts (meetings or appointments)
      const conflict = checkCalendarConflicts(
        startTimestamp, 
        endTimestamp, 
        data.allDay,
        selectedMeeting.id
      );
      
      if (conflict) {
        const eventType = conflict.type;
        const eventTitle = conflict.overlapping?.title;
        const eventDate = formatDate(conflict.overlapping?.start_time || 0, "EEE, MMM d");
        const isAllDay = conflict.overlapping?.all_day;
        const eventTime = isAllDay 
          ? "(All Day)" 
          : `at ${formatDate(conflict.overlapping?.start_time || 0, "h:mm a")}`;
        
        // Return a new Promise that will be resolved or rejected based on user's choice
        return new Promise((resolve, reject) => {
          // Set conflict details for the dialog
          setConflictDetails({
            eventType,
            eventTitle,
            eventDate,
            eventTime,
            onConfirm: () => {
              // User confirmed, continue with meeting update
              const meeting: Partial<MeetingWithAllDay> = {
                id: selectedMeeting.id,
                title: data.title,
                description: data.description || null,
                location: data.meetingLink || null,
                start_time: startTimestamp,
                end_time: endTimestamp,
                all_day: data.allDay,
                completed: selectedMeeting.completed,
                is_recurring: data.isRecurring,
                recurrence_pattern: data.isRecurring ? data.recurrencePattern : null,
                recurrence_interval: data.isRecurring ? data.recurrenceInterval : null,
                recurrence_end_date: data.isRecurring && data.recurrenceEndDate ? Math.floor(data.recurrenceEndDate.getTime() / 1000) : null,
                updated_at: Math.floor(Date.now() / 1000)
              };
              
              // Close the dialog
              setConflictDialogOpen(false);
              
              // Resolve with the meeting data
              resolve(updateMeeting(selectedMeeting.id, meeting as Meeting));
            },
            onCancel: () => {
              // User cancelled, reject the promise
              setConflictDialogOpen(false);
              reject(new Error(`Meeting update cancelled due to overlap with ${eventType}`));
            }
          });
          
          // Open the conflict dialog
          setConflictDialogOpen(true);
        });
      }
      
      const meeting: Partial<MeetingWithAllDay> = {
        id: selectedMeeting.id,
        title: data.title,
        description: data.description || null,
        location: data.meetingLink || null,
        start_time: startTimestamp,
        end_time: endTimestamp,
        all_day: data.allDay,
        completed: selectedMeeting.completed,
        is_recurring: data.isRecurring,
        recurrence_pattern: data.isRecurring ? data.recurrencePattern : null,
        recurrence_interval: data.isRecurring ? data.recurrenceInterval : null,
        recurrence_end_date: data.isRecurring && data.recurrenceEndDate ? Math.floor(data.recurrenceEndDate.getTime() / 1000) : null,
        updated_at: Math.floor(Date.now() / 1000)
      };
      
      return updateMeeting(selectedMeeting.id, meeting as Meeting);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MEETINGS] });
      setDialogOpen(false);
      setIsEditing(false);
      setSelectedMeeting(null);
      toast({
        title: "Meeting updated",
        description: "The meeting has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to update meeting",
        description: error.message || "An error occurred while updating the meeting.",
      });
    }
  });

  // Add a separate mutation for toggling completion status
  const toggleMeetingCompletionMutation = useMutation({
    mutationFn: async ({ meetingId, data }: { meetingId: number; data: { completed: boolean } }) => {
      // Create a specific update with only the completed field
      const updateData = {
        completed: data.completed,
        updated_at: Math.floor(Date.now() / 1000)
      };

      console.log(`Toggling meeting ${meetingId} completion to ${data.completed}`);
      
      try {
        // Call the API directly to ensure we're only updating the completed status
        const response = await apiRequest(
          'PATCH',
          `/meetings/${meetingId}`,
          updateData
        );
        
        if (!response.ok) {
          const errorData = await response.text();
          console.error("API error response:", errorData);
          throw new Error(`API error: ${response.status} ${errorData}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error("Error toggling meeting completion:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MEETINGS] });
      toast({
        title: "Meeting updated",
        description: "Meeting completion status has been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to update meeting",
        description: error.message || "An error occurred while updating the meeting status.",
      });
    }
  });

  // Get filtered meetings based on the tab selection
  const getMeetingsForTab = (status: string) => {
    if (filter === "all") {
      // Show all meetings
      return meetings || [];
    } else {
      // Show only meetings of the selected status
      return filterMeetingsByStatus(meetings, filter);
    }
  };
  
  // Get filtered meetings for the current tab
  const filteredMeetings = getMeetingsForTab(filter);
  
  // Pagination calculations
  const totalMeetings = filteredMeetings?.length || 0;
  const totalPages = Math.ceil(totalMeetings / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalMeetings);
  const paginatedMeetings = filteredMeetings?.slice(startIndex, endIndex) || [];
  
  // Check if pagination should be shown
  const shouldShowPagination = totalMeetings > itemsPerPage;
  
  // Handle page changes
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };
  
  // Handle items per page changes
  const handleItemsPerPageChange = (items: number) => {
    setItemsPerPage(items);
    setCurrentPage(1); // Reset to first page when changing items per page
  };
  
  // Calculate meeting statistics
  const inProgressMeetings = filterMeetingsByStatus(meetings, "in-progress");
  const upcomingMeetings = filterMeetingsByStatus(meetings, "upcoming");
  const pastMeetings = filterMeetingsByStatus(meetings, "past");
  
  const totalMeetingMinutes = meetings?.reduce((total, meeting) => {
    const duration = (meeting.end_time - meeting.start_time) / 60; // duration in minutes
    return total + duration;
  }, 0) || 0;
  
  const totalMeetingHours = Math.floor(totalMeetingMinutes / 60);
  const remainingMinutes = Math.round(totalMeetingMinutes % 60);

  // Add function to handle edit button click
  const handleEditClick = (meeting: MeetingWithAllDay) => {
    setIsEditing(true);
    setSelectedMeeting(meeting);
    form.reset({
      title: meeting.title,
      description: meeting.description || "",
      meetingLink: meeting.location || "",
      startDate: new Date(meeting.start_time * 1000),
      endDate: new Date(meeting.end_time * 1000),
      allDay: meeting.all_day || false,
      isRecurring: meeting.is_recurring || false,
      recurrencePattern: meeting.recurrence_pattern as "daily" | "weekly" | "monthly" | "yearly" || "weekly",
      recurrenceInterval: meeting.recurrence_interval || 1,
      recurrenceEndDate: meeting.recurrence_end_date ? new Date(meeting.recurrence_end_date * 1000) : undefined,
    });
    setDialogOpen(true);
  };

  // Handle delete meeting click
  const handleDeleteClick = (meeting: MeetingWithAllDay) => {
    setMeetingToDelete(meeting);
    setDeleteDialogOpen(true);
  };

  // Handle confirm delete
  const handleConfirmDelete = () => {
    if (meetingToDelete) {
      deleteMeetingMutation.mutate(meetingToDelete.id);
      setDeleteDialogOpen(false);
      setMeetingToDelete(null);
    }
  };

  // Update onSubmit to handle isSubmitting state
  const onSubmit = async (data: MeetingFormValues) => {
    setIsSubmitting(true);
    try {
      if (isEditing) {
        await updateMeetingMutation.mutateAsync(data);
      } else {
        await createMeetingMutation.mutateAsync(data);
      }
    } catch (error) {
      console.error("Error submitting form:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">Meetings</h2>
          <p className="text-muted-foreground text-sm mt-1">Schedule and manage your meetings</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
          <div className="flex">
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                <span>New Meeting</span>
              </Button>
            </DialogTrigger>
          </div>
          <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center text-lg font-semibold">
                {isEditing ? (
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
                {isEditing 
                  ? "Make changes to your meeting details below." 
                  : "Fill in the details to schedule a new meeting."}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Meeting title" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Meeting details" 
                          {...field} 
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="meetingLink"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <span className="flex items-center">
                          <Video className="h-4 w-4 mr-1.5 text-indigo-500" />
                          Meeting Link
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter video call link (Zoom, Meet, etc.)" 
                          {...field} 
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
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
                        <FormLabel>All-day meeting</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date</FormLabel>
                      <Popover>
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
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={(date) => {
                              if (date) {
                                const newStartDate = new Date(date);
                                if (field.value) {
                                  // Preserve time from current value
                                  newStartDate.setHours(
                                    field.value.getHours(),
                                    field.value.getMinutes()
                                  );
                                } else {
                                  // Default to current time
                                  const now = new Date();
                                  newStartDate.setHours(now.getHours(), now.getMinutes());
                                }
                                field.onChange(newStartDate);
                                
                                // Also update end date to use the same date (but keep its time)
                                const endDate = form.getValues("endDate");
                                if (endDate) {
                                  const newEndDate = new Date(date);
                                  newEndDate.setHours(endDate.getHours(), endDate.getMinutes());
                                  form.setValue("endDate", newEndDate);
                                }
                              } else {
                                field.onChange(undefined);
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
                
                {!form.watch("allDay") && (
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="startDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel className="text-xs font-medium">Start Time</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  <Clock className="mr-2 h-4 w-4 text-indigo-500" />
                                  {field.value ? format(field.value, "h:mm a") : "Select time"}
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start" side="top">
                              <TimeSelect
                                value={field.value || new Date()}
                                onChange={(date) => {
                                  // Preserve the date part from the current value but update time
                                  if (field.value) {
                                    const newDate = new Date(field.value);
                                    newDate.setHours(date.getHours(), date.getMinutes());
                                    field.onChange(newDate);
                                  } else {
                                    field.onChange(date);
                                  }
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
                      control={form.control}
                      name="endDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel className="text-xs font-medium">End Time</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  <Clock className="mr-2 h-4 w-4 text-indigo-500" />
                                  {field.value ? format(field.value, "h:mm a") : "Select time"}
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start" side="top">
                              <TimeSelect
                                value={field.value || new Date(Date.now() + 60 * 60 * 1000)}
                                onChange={(date) => {
                                  // Get the current start date value
                                  const startDate = form.getValues("startDate");
                                  
                                  if (field.value && startDate) {
                                    // Create a new date based on start date (to ensure same day)
                                    const newDate = new Date(startDate);
                                    // But use the hours/minutes from the selected time
                                    newDate.setHours(date.getHours(), date.getMinutes());
                                    field.onChange(newDate);
                                  } else {
                                    field.onChange(date);
                                  }
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
                
                {/* Add recurring meeting options */}
                <FormField
                  control={form.control}
                  name="isRecurring"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Recurring Meeting</FormLabel>
                        <p className="text-sm text-muted-foreground">Schedule this meeting to recur at regular intervals</p>
                      </div>
                    </FormItem>
                  )}
                />
                
                {form.watch("isRecurring") && (
                  <div className="border rounded-md p-4 space-y-4 bg-gray-50 dark:bg-gray-900/20">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="recurrenceInterval"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Repeat Every</FormLabel>
                            <FormControl>
                              <div className="flex gap-2 items-center">
                                <Input
                                  type="number"
                                  min="1"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                                  value={field.value || 1}
                                  className="w-20"
                                />
                                <FormField
                                  control={form.control}
                                  name="recurrencePattern"
                                  render={({ field }) => (
                                    <Select
                                      value={field.value}
                                      onValueChange={field.onChange}
                                    >
                                      <SelectTrigger className="flex-1">
                                        <SelectValue placeholder="Select pattern" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="daily">Day(s)</SelectItem>
                                        <SelectItem value="weekly">Week(s)</SelectItem>
                                        <SelectItem value="monthly">Month(s)</SelectItem>
                                        <SelectItem value="yearly">Year(s)</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  )}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="recurrenceEndDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Ends On (Optional)</FormLabel>
                            <Popover open={recurrenceEndDatePickerOpen} onOpenChange={setRecurrenceEndDatePickerOpen}>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      "w-full pl-3 text-left font-normal",
                                      !field.value && "text-muted-foreground"
                                    )}
                                  >
                                    <CalendarIcon className="mr-2 h-4 w-4 text-indigo-500" />
                                    {field.value ? format(field.value, "PPP") : "No end date"}
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
                                  selected={field.value}
                                  onSelect={(date) => {
                                    field.onChange(date);
                                    if (date) {
                                      setRecurrenceEndDatePickerOpen(false);
                                    }
                                  }}
                                  initialFocus
                                  disabled={(date) => {
                                    const startDate = form.getValues("startDate");
                                    return startDate ? date < startDate : false;
                                  }}
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}
                
                <DialogFooter>
                  <Button 
                    type="submit" 
                    disabled={isSubmitting} 
                    className="w-full bg-[#4F46E5] hover:bg-[#4F46E5]/90 text-white font-medium"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {isEditing ? "Updating..." : "Creating..."}
                      </>
                    ) : (
                      <>
                        <Users className="mr-2 h-4 w-4" />
                        {isEditing ? "Update Meeting" : "Schedule Meeting"}
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Meeting statistics */}
      {meetings && meetings.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/20 dark:to-green-900/10 border-green-200 dark:border-green-900/50">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-medium text-green-600 dark:text-green-400">Completed</p>
                  <h3 className="text-2xl font-bold mt-1">{filterMeetingsByStatus(meetings, "completed").length}</h3>
                </div>
                <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/20 dark:to-purple-900/10 border-purple-200 dark:border-purple-900/50">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-medium text-purple-600 dark:text-purple-400">In Progress</p>
                  <h3 className="text-2xl font-bold mt-1">{inProgressMeetings.length}</h3>
                </div>
                <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <div className="h-2 w-2 rounded-full bg-purple-500 animate-pulse"></div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-900/10 border-blue-200 dark:border-blue-900/50">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Upcoming</p>
                  <h3 className="text-2xl font-bold mt-1">{upcomingMeetings.length}</h3>
                </div>
                <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <CalendarIcon className="h-4 w-4 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/20 dark:to-amber-900/10 border-amber-200 dark:border-amber-900/50">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Total Time</p>
                  <h3 className="text-2xl font-bold mt-1">
                    {totalMeetingHours}h {remainingMinutes > 0 ? `${remainingMinutes}m` : ''}
                  </h3>
                </div>
                <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-950/20 dark:to-indigo-900/10 border-indigo-200 dark:border-indigo-900/50">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">Total Meetings</p>
                  <h3 className="text-2xl font-bold mt-1">{meetings.length}</h3>
                </div>
                <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                  <Users className="h-4 w-4 text-indigo-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      <div className="flex space-x-2">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          onClick={() => setFilter("all")}
          size="sm"
        >
          All
        </Button>
        <Button
          variant={filter === "completed" ? "default" : "outline"}
          onClick={() => setFilter("completed")}
          size="sm"
          className={filter === "completed" ? "bg-green-600 hover:bg-green-700" : ""}
        >
          <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
          Completed
        </Button>
        <Button
          variant={filter === "in-progress" ? "default" : "outline"}
          onClick={() => setFilter("in-progress")}
          size="sm"
          className={filter === "in-progress" ? "bg-purple-600 hover:bg-purple-700" : ""}
        >
          <div className="h-2 w-2 rounded-full bg-purple-500 mr-2 animate-pulse"></div>
          In Progress
        </Button>
        <Button
          variant={filter === "upcoming" ? "default" : "outline"}
          onClick={() => setFilter("upcoming")}
          size="sm"
          className={filter === "upcoming" ? "bg-blue-600 hover:bg-blue-700" : ""}
        >
          Upcoming
        </Button>
        <Button
          variant={filter === "past" ? "default" : "outline"}
          onClick={() => setFilter("past")}
          size="sm"
          className={filter === "past" ? "bg-gray-600 hover:bg-gray-700" : ""}
        >
          Past
        </Button>
      </div>

      {/* Meeting display - update to show recurring indicators */}
      <div className="grid gap-6">
        {meetings?.length === 0 ? (
          <Card className="border border-dashed bg-muted/30">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-primary/10 p-4 mb-4">
                <CalendarIcon className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-medium mb-2">No meetings scheduled</h3>
              <p className="text-muted-foreground mb-4 max-w-md">
                Your calendar is clear. Click "New Meeting" to create a new meeting.
              </p>
              <Button 
                size="sm" 
                variant="outline" 
                className="mt-2"
                onClick={() => handleDialogChange(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Meeting
              </Button>
            </CardContent>
          </Card>
        ) : filteredMeetings.length === 0 ? (
          <Card className="border border-dashed bg-muted/30">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-primary/10 p-4 mb-4">
                <AlertCircle className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-medium mb-2">No {filter} meetings</h3>
              <p className="text-muted-foreground mb-4 max-w-md">
                There are no meetings matching the current filter.
              </p>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => setFilter("all")}>
                View All Meetings
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Group meetings by status */}
            {["completed", "in-progress", "upcoming", "past"].map((status) => {
              // Only show this status section if we're on the "all" tab or the matching status tab
              if (filter !== "all" && filter !== status) return null;
              
              // Get meetings for this status
              const statusMeetings = filterMeetingsByStatus(meetings, status);
              
              // Skip rendering if there are no meetings for this status
              if (statusMeetings.length === 0) {
                return null;
              }
              
              // Get meetings to display - in "All" tab, show at most 5 meetings of each status
              let displayMeetings;
              if (filter === "all") {
                // For "All" tab, show at most 5 meetings of each status
                displayMeetings = statusMeetings.slice(0, 5);
              } else {
                // For status-specific tabs, use the paginated meetings
                displayMeetings = paginatedMeetings;
              }
              
              return (
                <div key={status} className="space-y-3">
                  <h3 className="text-md font-medium capitalize flex items-center">
                    {status === "in-progress" ? (
                      <>
                        <div className="h-2 w-2 rounded-full bg-purple-500 mr-2 animate-pulse"></div>
                        In Progress
                      </>
                    ) : status === "upcoming" ? (
                      <>
                        <div className="h-2 w-2 rounded-full bg-blue-500 mr-2"></div>
                        Upcoming
                      </>
                    ) : status === "past" ? (
                      <>
                        <div className="h-2 w-2 rounded-full bg-gray-500 mr-2"></div>
                        Past
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                        Completed
                      </>
                    )}
                    <span className="text-xs text-muted-foreground ml-2">
                      ({statusMeetings.length})
                    </span>
                  </h3>
                  
                  <ScrollArea className="max-h-[600px]">
                    <div className="grid gap-3 pr-4">
                      {displayMeetings.map((meeting) => {
                        const meetingStatus = getMeetingStatus(meeting);
                        const startTime = new Date(meeting.start_time * 1000);
                        const endTime = new Date(meeting.end_time * 1000);
                        const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
                        
                        return (
                          <Card 
                            key={meeting.id} 
                            className={cn(
                              "overflow-hidden transition-all duration-300 hover:shadow-md",
                              meetingStatus === "in-progress" ? "border-l-4 border-l-purple-500" : 
                              meetingStatus === "upcoming" ? "border-l-4 border-l-blue-500" : 
                              meetingStatus === "completed" ? "border-l-4 border-l-green-500" :
                              "border-l-4 border-l-gray-300 opacity-80"
                            )}
                          >
                            <CardContent className="p-0">
                              <div className="flex items-stretch">
                                {/* Time column */}
                                <div className={cn(
                                  "w-20 flex-shrink-0 flex flex-col items-center justify-center p-4 text-center",
                                  meetingStatus === "in-progress" ? "bg-purple-50 text-purple-900 dark:bg-purple-900/20 dark:text-purple-100" : 
                                  meetingStatus === "upcoming" ? "bg-blue-50 text-blue-900 dark:bg-blue-900/20 dark:text-blue-100" :
                                  meetingStatus === "completed" ? "bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-100" :
                                  "bg-gray-50 text-gray-500 dark:bg-gray-800/20 dark:text-gray-400"
                                )}>
                                  {(meeting as MeetingWithAllDay).all_day ? (
                                    <>
                                      <span className="text-sm font-bold uppercase">All</span>
                                      <span className="text-sm font-bold uppercase">Day</span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="text-2xl font-bold">{format(startTime, "h")}</span>
                                      <span className="text-xs uppercase">{format(startTime, "mm a")}</span>
                                      <div className="my-2 border-b w-8 border-current opacity-30"></div>
                                      <span className="text-xs">{durationMinutes} min</span>
                                    </>
                                  )}
                                </div>
                                
                                {/* Content */}
                                <div className="flex-grow p-4">
                                  <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2">
                                        <h3 className="font-medium">{meeting.title}</h3>
                                        {meetingStatus === "in-progress" && (
                                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                                            <span className="h-1.5 w-1.5 rounded-full bg-purple-500 mr-1 animate-pulse"></span>
                                            Now
                                          </span>
                                        )}
                                      </div>
                                      
                                      {meeting.description && (
                                        <p className="text-sm text-muted-foreground">
                                          {meeting.description}
                                        </p>
                                      )}
                                      
                                      <p className="text-xs text-muted-foreground flex items-center">
                                        <CalendarIcon className="h-3 w-3 mr-1 opacity-70" />
                                        {formatDate(meeting.start_time, "EEE, MMM d")}
                                        {!(meeting as MeetingWithAllDay).all_day && (
                                          <> • {formatDate(meeting.start_time, "h:mm a")} - {formatDate(meeting.end_time, "h:mm a")}</>
                                        )}
                                      </p>
                                      
                                      {meeting.location && (
                                        <a
                                          href={meeting.location}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className={cn(
                                            "inline-flex items-center text-sm hover:underline mt-2 rounded-md px-2.5 py-1.5 transition-colors",
                                            meetingStatus === "in-progress" 
                                              ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-100 dark:hover:bg-green-900/50" 
                                              : meetingStatus === "upcoming"
                                              ? "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-100 dark:hover:bg-blue-900/50"
                                              : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800/30 dark:text-gray-300 dark:hover:bg-gray-800/50"
                                          )}
                                        >
                                          <Video className="h-4 w-4 mr-1.5" />
                                          {meetingStatus === "in-progress" ? "Join Now" : "Meeting Link"}
                                        </a>
                                      )}
                                      
                                      {/* Add recurring meeting indicator */}
                                      {meeting.is_recurring && (
                                        <div className="flex items-center mt-2">
                                          <span className="text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1 bg-indigo-100 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                            Repeats {meeting.recurrence_pattern} 
                                            {meeting.recurrence_interval && meeting.recurrence_interval > 1 
                                              ? ` (every ${meeting.recurrence_interval} ${meeting.recurrence_pattern}s)` 
                                              : ``}
                                            {meeting.recurrence_end_date 
                                              ? ` until ${formatDate(meeting.recurrence_end_date, "MMM d, yyyy")}` 
                                              : ``}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                    
                                    {/* Add context menu */}
                                    <div className="flex gap-2 ml-4">
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
                                            <MoreVertical className="h-4 w-4" />
                                            <span className="sr-only">More</span>
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem onSelect={() => handleEditClick(meeting)}>
                                            <Edit className="mr-2 h-4 w-4 text-indigo-500" />
                                            <span>Edit</span>
                                          </DropdownMenuItem>
                                          <DropdownMenuItem 
                                            onSelect={() => handleDeleteClick(meeting)}
                                            className="text-red-600"
                                          >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            <span>Delete</span>
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            onSelect={() => {
                                              toggleMeetingCompletionMutation.mutate({
                                                meetingId: meeting.id,
                                                data: { completed: !meeting.completed }
                                              });
                                            }}
                                          >
                                            {meeting.completed ? (
                                              <>
                                                <XCircle className="mr-2 h-4 w-4 text-amber-500" />
                                                <span>Mark as Incomplete</span>
                                              </>
                                            ) : (
                                              <>
                                                <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                                                <span>Mark as Completed</span>
                                              </>
                                            )}
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Pagination Controls */}
      {shouldShowPagination && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 border-t pt-4">
          <div className="text-sm text-muted-foreground">
            Showing {startIndex + 1}-{endIndex} of {totalMeetings} meetings
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center mr-4">
              <span className="text-sm mr-2">Rows per page:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                className="h-8 rounded-md border border-input bg-background p-1 text-sm"
              >
                {[5, 10, 20, 50, 100].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
                className="h-8 w-8 p-0"
              >
                <span className="sr-only">First page</span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M15.78 14.78a.75.75 0 0 1-1.06 0L9.22 9.28a.75.75 0 0 1 0-1.06l5.5-5.5a.75.75 0 1 1 1.06 1.06L10.56 8.5l5.22 5.22a.75.75 0 0 1 0 1.06Z" clipRule="evenodd" />
                  <path fillRule="evenodd" d="M7.78 14.78a.75.75 0 0 1-1.06 0L1.22 9.28a.75.75 0 0 1 0-1.06l5.5-5.5a.75.75 0 1 1 1.06 1.06L2.56 8.5l5.22 5.22a.75.75 0 0 1 0 1.06Z" clipRule="evenodd" />
                </svg>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="h-8 w-8 p-0"
              >
                <span className="sr-only">Previous page</span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
                </svg>
              </Button>
              
              {/* Page Numbers */}
              {totalPages <= 7 ? (
                // Show all page numbers if there are 7 or fewer
                [...Array(totalPages)].map((_, i) => (
                  <Button
                    key={i + 1}
                    variant={currentPage === i + 1 ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(i + 1)}
                    className="h-8 w-8 p-0"
                  >
                    {i + 1}
                  </Button>
                ))
              ) : (
                // Show a subset of pages with ellipses for many pages
                <>
                  {/* First page is always shown */}
                  {currentPage > 2 && (
                    <Button
                      variant={currentPage === 1 ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(1)}
                      className="h-8 w-8 p-0"
                    >
                      1
                    </Button>
                  )}
                  
                  {/* Ellipsis if not showing first pages */}
                  {currentPage > 3 && (
                    <div className="flex items-center justify-center h-8 w-8">
                      <span>...</span>
                    </div>
                  )}
                  
                  {/* Pages around current page */}
                  {[...Array(5)].map((_, i) => {
                    const pageNum = Math.max(
                      2,
                      Math.min(
                        currentPage - 2 + i,
                        totalPages - 1
                      )
                    );
                    
                    // Only show if within valid range and not already shown
                    if (pageNum >= 2 && pageNum <= totalPages - 1 && 
                        !(pageNum === 1 && currentPage <= 3) && 
                        !(pageNum === totalPages && currentPage >= totalPages - 2)) {
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => handlePageChange(pageNum)}
                          className="h-8 w-8 p-0"
                        >
                          {pageNum}
                        </Button>
                      );
                    }
                    return null;
                  }).filter(Boolean)}
                  
                  {/* Ellipsis if not showing last pages */}
                  {currentPage < totalPages - 2 && (
                    <div className="flex items-center justify-center h-8 w-8">
                      <span>...</span>
                    </div>
                  )}
                  
                  {/* Last page is always shown */}
                  {currentPage < totalPages - 1 && (
                    <Button
                      variant={currentPage === totalPages ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(totalPages)}
                      className="h-8 w-8 p-0"
                    >
                      {totalPages}
                    </Button>
                  )}
                </>
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages || totalPages === 0}
                className="h-8 w-8 p-0"
              >
                <span className="sr-only">Next page</span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages || totalPages === 0}
                className="h-8 w-8 p-0"
              >
                <span className="sr-only">Last page</span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M4.22 14.78a.75.75 0 0 0 1.06 0l5.5-5.5a.75.75 0 0 0 0-1.06l-5.5-5.5a.75.75 0 1 0-1.06 1.06L9.44 8.5 4.22 13.72a.75.75 0 0 0 0 1.06Z" clipRule="evenodd" />
                  <path fillRule="evenodd" d="M12.22 14.78a.75.75 0 0 0 1.06 0l5.5-5.5a.75.75 0 0 0 0-1.06l-5.5-5.5a.75.75 0 0 0-1.06 1.06l5.22 5.22-5.22 5.22a.75.75 0 0 0 0 1.06Z" clipRule="evenodd" />
                </svg>
              </Button>
            </div>
          </div>
        </div>
      )}

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
                    {formatDate(meetingToDelete.start_time, "EEE, MMM d")}
                    {!(meetingToDelete as MeetingWithAllDay).all_day && (
                      <> • {formatDate(meetingToDelete.start_time, "h:mm a")} - {formatDate(meetingToDelete.end_time, "h:mm a")}</>
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
            >
              Delete Meeting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add conflict confirmation dialog */}
      <Dialog open={conflictDialogOpen} onOpenChange={setConflictDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <AlertCircle className="h-5 w-5 mr-2 text-amber-500" />
              Calendar Conflict Detected
            </DialogTitle>
            <DialogDescription>
              This meeting overlaps with an existing calendar event.
            </DialogDescription>
          </DialogHeader>
          
          {conflictDetails && (
            <div className="py-4">
              <div className="rounded-lg border p-4 bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200">
                <p className="text-sm font-medium mb-2">
                  Your new meeting overlaps with:
                </p>
                <div className="space-y-2">
                  <p className="text-sm">
                    <span className="font-medium">{conflictDetails.eventTitle}</span>
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 flex items-center">
                    <CalendarIcon className="h-3 w-3 mr-1" />
                    {conflictDetails.eventDate} {conflictDetails.eventTime}
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 flex items-center mt-1">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-3 w-3 mr-1"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Type: {conflictDetails.eventType.charAt(0).toUpperCase() + conflictDetails.eventType.slice(1)}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Would you like to schedule this meeting anyway?
              </p>
            </div>
          )}
          
          <DialogFooter className="flex space-x-2 mt-2">
            <Button
              variant="outline"
              onClick={() => conflictDetails?.onCancel()}
            >
              Cancel
            </Button>
            <Button
              onClick={() => conflictDetails?.onConfirm()}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Schedule Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}