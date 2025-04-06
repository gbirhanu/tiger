import React, { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { z } from "zod";
import { type Appointment, type Meeting } from "@shared/schema";
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
import { getAppointments, createAppointment, deleteAppointment, getMeetings } from "@/lib/api";
import { Plus, Trash2, CalendarIcon, Loader2, Clock, MapPin, AlertCircle, Pencil, History, MoreVertical, Edit, XCircle, CheckCircle } from "lucide-react";
import { formatDate, getNow } from "@/lib/timezone";
import { TimeSelect } from "./TimeSelect";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent } from "@/components/ui/tabs";
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

// Create a schema for the form
const formSchema = z.object({
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
  recurrencePattern: z.enum(["daily", "weekly", "monthly", "yearly"]).optional(),
  recurrenceInterval: z.number().optional(),
  recurrenceEndDate: z.date().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface AppointmentsProps {
  isDialogOpen?: boolean;
  setIsDialogOpen?: (open: boolean) => void;
  initialDate?: Date | null;
  selectedAppointmentId?: number | null;
}

interface MeetingWithAllDay extends Meeting {
  all_day?: boolean;
}

// Functions to check for conflicts
const checkAppointmentOverlap = (
  appointments: Appointment[] | undefined,
  startTime: number,
  endTime: number,
  isAllDay: boolean,
  excludeAppointmentId?: number
): Appointment | null => {
  if (!appointments || appointments.length === 0) return null;
  
  return appointments.find((appointment) => {
    // Skip comparing with itself if updating
    if (excludeAppointmentId && appointment.id === excludeAppointmentId) return false;
    
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
  }) || null;
};

// Function to check if meetings overlap
const checkMeetingOverlap = (
  meetings: MeetingWithAllDay[] | undefined,
  startTime: number,
  endTime: number,
  isAllDay: boolean
): { overlapping: MeetingWithAllDay; type: string } | null => {
  if (!meetings || meetings.length === 0) return null;
  
  const overlappingMeeting = meetings.find((meeting) => {
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
      
      return (
        (newStartDay <= existingEndDay && newEndDay >= existingStartDay)
      );
    }
    
    // Regular time-based overlap check
    return (
      (startTime < meeting.end_time && endTime > meeting.start_time)
    );
  });
  
  return overlappingMeeting ? { overlapping: overlappingMeeting, type: "meeting" } : null;
};

// Function to check if appointments overlap with each other
const checkAppointmentSelfOverlap = (
  appointments: Appointment[] | undefined,
  startTime: number,
  endTime: number,
  isAllDay: boolean,
  excludeAppointmentId?: number
): { overlapping: Appointment; type: string } | null => {
  if (!appointments || appointments.length === 0) return null;
  
  const overlappingAppointment = appointments.find((appointment) => {
    // Skip comparing with itself if updating
    if (excludeAppointmentId && appointment.id === excludeAppointmentId) return false;
    
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

// Function to check all calendar conflicts
const checkCalendarConflicts = (
  startTime: number,
  endTime: number,
  isAllDay: boolean,
  excludeAppointmentId?: number,
  appointmentsData?: Appointment[],
  meetingsData?: MeetingWithAllDay[]
) => {
  // Check for appointment-appointment overlap
  const appointmentOverlap = checkAppointmentSelfOverlap(
    appointmentsData, 
    startTime, 
    endTime, 
    isAllDay,
    excludeAppointmentId
  );
  
  if (appointmentOverlap) {
    return appointmentOverlap;
  }
  
  // Check for appointment-meeting overlap
  const meetingOverlap = checkMeetingOverlap(
    meetingsData, 
    startTime, 
    endTime, 
    isAllDay
  );
  
  if (meetingOverlap) {
    return meetingOverlap;
  }
  
  return null;
};

export default function Appointments({ isDialogOpen, setIsDialogOpen, initialDate, selectedAppointmentId }: AppointmentsProps = {}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(isDialogOpen || false);
  const [filter, setFilter] = useState<"all" | "completed" | "in-progress" | "upcoming" | "past">("all");
  const [isEditing, setIsEditing] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
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
  const [appointmentToDelete, setAppointmentToDelete] = useState<Appointment | null>(null);

  // Add recurrence states
  const [recurrenceEndDatePickerOpen, setRecurrenceEndDatePickerOpen] = useState(false);

  // Handle external dialog control
  React.useEffect(() => {
    if (isDialogOpen !== undefined) {
      setOpen(isDialogOpen);
    }
  }, [isDialogOpen]);

  // Update external state when dialog changes
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (setIsDialogOpen) {
      setIsDialogOpen(newOpen);
    }
  };

  // Fetch appointments
  const { data: appointments = [], isLoading, refetch } = useQuery({
    queryKey: [QUERY_KEYS.APPOINTMENTS],
    queryFn: async () => {
      try {
        const data = await getAppointments();
        
        return data;
      } catch (err) {
        console.error("Error fetching appointments:", err);
        toast({
          variant: "destructive",
          title: "Error loading appointments",
          description: "There was a problem loading your appointments.",
        });
        throw err;
      }
    },
  });
  
  // Fetch meetings to check for conflicts
  const { data: meetings = [] } = useQuery({
    queryKey: [QUERY_KEYS.MEETINGS],
    queryFn: getMeetings
  });

  // Form for creating appointments
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      date: initialDate || new Date(),
      allDay: false,
      startHour: new Date().getHours(),
      startMinute: 0,
      endHour: new Date().getHours() + 1,
      endMinute: 0,
      isRecurring: false,
      recurrencePattern: "weekly",
      recurrenceInterval: 1,
      recurrenceEndDate: undefined,
    },
  });

  // Reset form when initialDate changes
  React.useEffect(() => {
    if (initialDate) {
      form.reset({
        ...form.getValues(),
        date: initialDate,
        startHour: initialDate.getHours(),
        startMinute: 0,
        endHour: initialDate.getHours() + 1,
        endMinute: 0,
        isRecurring: false,
        recurrencePattern: "weekly",
        recurrenceInterval: 1,
        recurrenceEndDate: undefined,
      });
    }
  }, [initialDate, form]);

  // Create appointment mutation
  const createAppointmentMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const { date, startHour, startMinute, endHour, endMinute, allDay, isRecurring, recurrencePattern, recurrenceInterval, recurrenceEndDate, ...rest } = data;
      
      // Create JS Date objects for start and end times
      const startDate = new Date(date);
      startDate.setHours(startHour, startMinute, 0, 0);
        
      const endDate = new Date(date);
      endDate.setHours(endHour, endMinute, 0, 0);
      
      // Convert to Unix timestamps (seconds)
      const startTimestamp = Math.floor(startDate.getTime() / 1000);
      const endTimestamp = Math.floor(endDate.getTime() / 1000);
      
      // Create the appointment data to be sent to the API
      const appointmentData = {
        title: rest.title,
        description: rest.description === undefined ? null : rest.description,
        start_time: startTimestamp,
        end_time: endTimestamp,
        all_day: allDay,
        completed: false, // Add completed field
        is_recurring: isRecurring,
        recurrence_pattern: isRecurring && recurrencePattern ? recurrencePattern : null,
        recurrence_interval: isRecurring && recurrenceInterval ? recurrenceInterval : null,
        recurrence_end_date: isRecurring && recurrenceEndDate ? Math.floor(recurrenceEndDate.getTime() / 1000) : null,
        parent_appointment_id: null, // Add parent_appointment_id field
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000)
      };
      
      // Check for conflicts
      const conflict = checkCalendarConflicts(
        startTimestamp,
        endTimestamp,
        allDay,
        undefined,
        appointments,
        meetings
      );
      
      // Show conflict confirmation dialog if there's a conflict
      if (conflict) {
        return new Promise((resolve, reject) => {
          const conflictDate = new Date(conflict.overlapping.start_time * 1000);
          const formattedDate = formatDate(conflictDate, "EEEE, MMMM d");
          const formattedTime = formatDate(conflictDate, "h:mm a");
          
          setConflictDetails({
            eventType: conflict.type,
            eventTitle: conflict.overlapping.title,
            eventDate: formattedDate,
            eventTime: formattedTime,
            onConfirm: async () => {
              try {
                const newAppointment = await createAppointment(appointmentData);
              setConflictDialogOpen(false);
                handleOpenChange(false);
                resolve(newAppointment);
              } catch (error) {
                reject(error);
              }
            },
            onCancel: () => {
              setConflictDialogOpen(false);
              reject(new Error("Appointment creation cancelled due to conflict"));
            }
          });
          
          setConflictDialogOpen(true);
        });
      }
      
      // If no conflict, create the appointment
      return createAppointment(appointmentData);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.APPOINTMENTS]
      });
      
      toast({
        title: "Appointment created",
        description: "Your appointment has been scheduled successfully.",
      });
      
      handleOpenChange(false);
      form.reset();
    },
    onError: (error) => {
      console.error("Error creating appointment:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "There was a problem scheduling your appointment. Please try again.",
      });
    }
  });

  // Delete appointment mutation
  const deleteMutation = useMutation({
    mutationFn: deleteAppointment,
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Appointment deleted successfully",
      });
      refetch();
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.APPOINTMENTS] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete appointment",
        variant: "destructive",
      });
    },
  });

  // Update appointment mutation
  const updateAppointmentMutation = useMutation({
    mutationFn: async ({ appointmentId, data }: { appointmentId: number, data: Partial<Appointment> }) => {
      try {
        // Format the data before sending to ensure proper types
        const formattedData: Record<string, any> = {};
        
        // Only include fields that are present in the data object
        if ('title' in data) formattedData.title = data.title;
        if ('description' in data) formattedData.description = data.description === undefined ? null : data.description;
        if ('start_time' in data) formattedData.start_time = data.start_time;
        if ('end_time' in data) formattedData.end_time = data.end_time;
        if ('all_day' in data) formattedData.all_day = Boolean(data.all_day);
        if ('is_recurring' in data) formattedData.is_recurring = Boolean(data.is_recurring);
        if ('recurrence_pattern' in data) formattedData.recurrence_pattern = data.recurrence_pattern;
        if ('recurrence_interval' in data) formattedData.recurrence_interval = data.recurrence_interval;
        if ('recurrence_end_date' in data) formattedData.recurrence_end_date = data.recurrence_end_date;
        if ('parent_appointment_id' in data) formattedData.parent_appointment_id = data.parent_appointment_id;
        
        // Add updated timestamp
        formattedData.updated_at = Math.floor(Date.now() / 1000);
        
        console.log("Updating appointment:", appointmentId, formattedData);
        
        // Use API request
        const response = await apiRequest(
          'PATCH',
          `/appointments/${appointmentId}`,
          formattedData
        );
        
        if (!response.ok) {
          const errorData = await response.text();
          console.error("API error response:", errorData);
          throw new Error(`API error: ${response.status} ${errorData}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error("Error in updateAppointmentMutation:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.APPOINTMENTS]
      });
      
      toast({
        title: "Appointment updated",
        description: "Your appointment has been updated successfully.",
      });
    },
    onError: (error) => {
      console.error("Error updating appointment:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "There was a problem updating your appointment. Please try again.",
      });
    }
  });

  // Add a toggle completion mutation
  const toggleCompletionMutation = useMutation({
    mutationFn: async ({ appointmentId, completed }: { appointmentId: number, completed: boolean }) => {
      try {
        console.log(`Toggling appointment ${appointmentId} completion to ${completed}`);
        
        // Simple update data with just the completed flag
        const updateData = {
          completed: completed
        };
        
        // Use API request
        const response = await apiRequest(
          'PATCH',
          `/appointments/${appointmentId}`,
          updateData
        );
        
        if (!response.ok) {
          const errorData = await response.text();
          console.error("API error response:", errorData);
          throw new Error(`API error: ${response.status} ${errorData}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error("Error toggling appointment completion:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.APPOINTMENTS]
      });
      
      toast({
        title: "Appointment updated",
        description: "Appointment completion status has been updated.",
      });
    },
    onError: (error) => {
      console.error("Error updating appointment:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "There was a problem updating the appointment status.",
      });
    }
  });

  // Add a function to handle toggling completion
  const handleToggleCompletion = (appointment: Appointment) => {
    if (!appointment) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No appointment selected",
      });
      return;
    }
    
    // Toggle the completed status
    toggleCompletionMutation.mutate({
      appointmentId: appointment.id,
      completed: !appointment.completed
    });
  };

  // Add function to handle edit button click
  const handleEditClick = (appointment: Appointment) => {
    setIsEditing(true);
    setSelectedAppointment(appointment);
    form.reset({
      title: appointment.title,
      description: appointment.description || "",
      date: new Date(appointment.start_time * 1000),
      allDay: appointment.all_day,
      startHour: new Date(appointment.start_time * 1000).getHours(),
      startMinute: new Date(appointment.start_time * 1000).getMinutes(),
      endHour: new Date(appointment.end_time * 1000).getHours(),
      endMinute: new Date(appointment.end_time * 1000).getMinutes(),
      isRecurring: appointment.is_recurring || false,
      recurrencePattern: appointment.recurrence_pattern as "daily" | "weekly" | "monthly" | "yearly" || "weekly",
      recurrenceInterval: appointment.recurrence_interval || 1,
      recurrenceEndDate: appointment.recurrence_end_date ? new Date(appointment.recurrence_end_date * 1000) : undefined,
    });
    handleOpenChange(true);
  };

  // Handle delete appointment click
  const handleDeleteClick = (appointment: Appointment) => {
    setAppointmentToDelete(appointment);
    setDeleteDialogOpen(true);
  };

  // Handle confirm delete
  const handleConfirmDelete = () => {
    if (appointmentToDelete) {
      deleteMutation.mutate(appointmentToDelete.id);
      setDeleteDialogOpen(false);
      setAppointmentToDelete(null);
    }
  };

  // Update form submit handler
  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    try {
      if (isEditing && selectedAppointment) {
        // Extract data from form values
        const { date, startHour, startMinute, endHour, endMinute, allDay, isRecurring, recurrencePattern, recurrenceInterval, recurrenceEndDate, ...rest } = data;
        
        // Create JS Date objects for start and end times
        const startDate = new Date(date);
        startDate.setHours(startHour, startMinute, 0, 0);
        
        const endDate = new Date(date);
        endDate.setHours(endHour, endMinute, 0, 0);
        
        // Convert to Unix timestamps (seconds)
        const startTimestamp = Math.floor(startDate.getTime() / 1000);
        const endTimestamp = Math.floor(endDate.getTime() / 1000);
        
        await updateAppointmentMutation.mutateAsync({
          appointmentId: selectedAppointment.id,
          data: {
            title: rest.title,
            description: rest.description === undefined ? null : rest.description,
            start_time: startTimestamp,
            end_time: endTimestamp,
            all_day: allDay,
            // Preserve completion status
            completed: selectedAppointment.completed,
            is_recurring: isRecurring,
            recurrence_pattern: isRecurring && recurrencePattern ? recurrencePattern : null,
            recurrence_interval: isRecurring && recurrenceInterval ? recurrenceInterval : null,
            recurrence_end_date: isRecurring && recurrenceEndDate ? Math.floor(recurrenceEndDate.getTime() / 1000) : null,
            parent_appointment_id: selectedAppointment.parent_appointment_id, // Preserve parent_appointment_id
            updated_at: Math.floor(Date.now() / 1000)
          }
        });
        
        handleOpenChange(false);
      } else {
        await createAppointmentMutation.mutateAsync(data);
      }
    } catch (error) {
      console.error("Error submitting form:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper function to determine appointment status
  const getAppointmentStatus = (appointment: Appointment): "completed" | "in-progress" | "upcoming" | "past" => {
    // First check if the appointment is marked as completed
    if (appointment.completed) {
      return "completed";
    }
    
    const now = Date.now();
    const startTime = appointment.start_time * 1000;
    const endTime = appointment.end_time * 1000;
    
    if (now >= startTime && now <= endTime) {
      return "in-progress";
    } else if (startTime > now) {
      return "upcoming";
    } else {
      return "past";
    }
  };
  
  // Get appointments filtered by their status (upcoming, past, etc.)
  const getAppointmentsByStatus = (appointments: Appointment[] | undefined, status: string): Appointment[] => {
    if (!appointments) return [];
    
    if (status === "all") {
      return appointments;
    }
    
    // Use the getAppointmentStatus function for consistency
    return appointments.filter(appointment => getAppointmentStatus(appointment) === status);
  };
  
  // Get filtered appointments based on the current tab/filter
  const filteredAppointments = getAppointmentsByStatus(appointments, filter);
  
  // Pagination calculations
  const totalAppointments = filteredAppointments.length;
  const totalPages = Math.ceil(totalAppointments / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalAppointments);
  const paginatedAppointments = filteredAppointments.slice(startIndex, endIndex);
  
  // Check if pagination should be shown
  const shouldShowPagination = totalAppointments > itemsPerPage;
  
  // Handle page changes
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };
  
  // Handle items per page changes
  const handleItemsPerPageChange = (items: number) => {
    setItemsPerPage(items);
    setCurrentPage(1); // Reset to first page when changing items per page
  };
  
  // Calculate appointment statistics
  const inProgressAppointments = getAppointmentsByStatus(appointments, "in-progress");
  const upcomingAppointments = getAppointmentsByStatus(appointments, "upcoming");
  const pastAppointments = getAppointmentsByStatus(appointments, "past");
  
  // Calculate total appointment minutes
  const totalAppointmentMinutes = appointments?.reduce((total, appointment) => {
    const duration = (appointment.end_time - appointment.start_time) / 60; // duration in minutes
    return total + duration;
  }, 0) || 0;
  
  const totalAppointmentHours = Math.floor(totalAppointmentMinutes / 60);
  const remainingMinutes = Math.round(totalAppointmentMinutes % 60);

  // Add event listener for opening the appointment edit dialog from Calendar
  const handleEditAppointment = useCallback((event: Event) => {
    
    const customEvent = event as CustomEvent;
    
    if (customEvent.detail && customEvent.detail.appointment) {
      const appointmentData = customEvent.detail.appointment;
      
      
      // Convert Unix timestamps to Date objects
      const startDate = new Date(appointmentData.start_time * 1000);
      
      // Extract hours and minutes for form
      const startHour = startDate.getHours();
      const startMinute = startDate.getMinutes();
      
      let endHour = startHour + 1;
      let endMinute = startMinute;
      
      // If end_time exists, use it
      if (appointmentData.end_time) {
        const endDate = new Date(appointmentData.end_time * 1000);
        endHour = endDate.getHours();
        endMinute = endDate.getMinutes();
      }
      
      // Reset form with appointment data
      form.reset({
        title: appointmentData.title,
        description: appointmentData.description || "",
        date: startDate,
        allDay: appointmentData.all_day || false,
        startHour,
        startMinute,
        endHour,
        endMinute,
        isRecurring: appointmentData.is_recurring || false,
        recurrencePattern: appointmentData.recurrence_pattern as "daily" | "weekly" | "monthly" | "yearly" || "weekly",
        recurrenceInterval: appointmentData.recurrence_interval || 1,
        recurrenceEndDate: appointmentData.recurrence_end_date ? new Date(appointmentData.recurrence_end_date * 1000) : undefined,
      });
      
      // Set editing mode
      setIsEditing(true);
      setSelectedAppointment(appointmentData);
      
      // Open dialog
      handleOpenChange(true);
    } else {
      console.error("No appointment data found in event detail:", customEvent);
    }
  }, [form, handleOpenChange]);

  React.useEffect(() => {
    
    document.addEventListener('edit-appointment', handleEditAppointment as EventListener);
    
    return () => {
      document.removeEventListener('edit-appointment', handleEditAppointment as EventListener);
    };
  }, [handleEditAppointment]);

  // Handle external appointment selection
  React.useEffect(() => {
    if (selectedAppointmentId) {
      const appointment = appointments.find(a => a.id === selectedAppointmentId);
      if (appointment) {
        
        handleEditClick(appointment);
      }
    }
  }, [selectedAppointmentId, appointments]);

  // Check localStorage for an appointment ID to edit
  React.useEffect(() => {
    const editAppointmentId = localStorage.getItem('editAppointmentId');
    if (editAppointmentId && appointments.length > 0) {
      const appointmentId = parseInt(editAppointmentId);
      const appointment = appointments.find(a => a.id === appointmentId);
      if (appointment) {
        
        handleEditClick(appointment);
        // Clear the localStorage item to prevent reopening on refresh
        localStorage.removeItem('editAppointmentId');
      }
    }
  }, [appointments]);

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
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">Appointments</h2>
          <p className="text-muted-foreground text-sm mt-1">Schedule and manage your appointments</p>
        </div>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              <span>New Appointment</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center text-lg font-semibold">
                {isEditing ? (
                  <>
                    <Pencil className="h-5 w-5 mr-2 text-purple-500" />
                    Edit Appointment
                  </>
                ) : (
                  <>
                    <Clock className="h-5 w-5 mr-2 text-purple-500" />
                    Schedule New Appointment
                  </>
                )}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {isEditing 
                  ? "Make changes to your appointment details below." 
                  : "Fill in the details to schedule a new appointment."}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Appointment title" {...field} />
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
                          placeholder="Appointment details" 
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
                  name="date"
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
                        <FormLabel>All-day appointment</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
                
                {!form.watch("allDay") && (
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="startHour"
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
                                  <Clock className="mr-2 h-4 w-4 text-purple-500" />
                                  {form.watch("startHour").toString().padStart(2, '0')}:{form.watch("startMinute").toString().padStart(2, '0')}
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start" side="top">
                              <TimeSelect
                                value={(() => {
                                  const date = new Date();
                                  date.setHours(field.value, form.watch("startMinute"));
                                  return date;
                                })()}
                                onChange={(date) => {
                                  field.onChange(date.getHours());
                                  form.setValue("startMinute", date.getMinutes());
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
                      name="endHour"
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
                                  <Clock className="mr-2 h-4 w-4 text-purple-500" />
                                  {form.watch("endHour").toString().padStart(2, '0')}:{form.watch("endMinute").toString().padStart(2, '0')}
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start" side="top">
                              <TimeSelect
                                value={(() => {
                                  const date = new Date();
                                  date.setHours(field.value, form.watch("endMinute"));
                                  return date;
                                })()}
                                onChange={(date) => {
                                  field.onChange(date.getHours());
                                  form.setValue("endMinute", date.getMinutes());
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
                
                {/* Add recurring appointment options */}
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
                        <FormLabel>Recurring Appointment</FormLabel>
                        <p className="text-sm text-muted-foreground">Schedule this appointment to recur at regular intervals</p>
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
                                    <CalendarIcon className="mr-2 h-4 w-4 text-purple-500" />
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
                                    const formDate = form.getValues("date");
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
                  </div>
                )}
                
                <DialogFooter>
                  <Button 
                    type="submit" 
                    disabled={isSubmitting} 
                    className="w-full bg-[#8B5CF6] hover:bg-[#8B5CF6]/90 text-white font-medium"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {isEditing ? "Updating..." : "Creating..."}
                      </>
                    ) : (
                      <>
                        <Clock className="mr-2 h-4 w-4" />
                        {isEditing ? "Update Appointment" : "Schedule Appointment"}
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      
      {appointments && appointments.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/20 dark:to-green-900/10 border-green-200 dark:border-green-900/50">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-medium text-green-600 dark:text-green-400">Completed</p>
                  <h3 className="text-2xl font-bold mt-1">{getAppointmentsByStatus(appointments, "completed").length}</h3>
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
                  <h3 className="text-2xl font-bold mt-1">{inProgressAppointments.length}</h3>
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
                  <h3 className="text-2xl font-bold mt-1">{upcomingAppointments.length}</h3>
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
                    {totalAppointmentHours}h {remainingMinutes > 0 ? `${remainingMinutes}m` : ''}
                  </h3>
                </div>
                <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/20 dark:to-purple-900/10 border-purple-200 dark:border-purple-900/50">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-medium text-purple-600 dark:text-purple-400">Total Appointments</p>
                  <h3 className="text-2xl font-bold mt-1">{appointments.length}</h3>
                </div>
                <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <CalendarIcon className="h-4 w-4 text-purple-500" />
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
          <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
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
      
      <div className="grid gap-6">
        {appointments?.length === 0 ? (
          <Card className="border border-dashed bg-muted/30">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-primary/10 p-4 mb-4">
                <CalendarIcon className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-medium mb-2">No appointments scheduled</h3>
              <p className="text-muted-foreground mb-4 max-w-md">
                Your calendar is clear. Click "New Appointment" to create a new appointment.
              </p>
              <Button 
                size="sm" 
                variant="outline" 
                className="mt-2"
                onClick={() => handleOpenChange(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Appointment
              </Button>
            </CardContent>
          </Card>
        ) : filteredAppointments.length === 0 ? (
          <Card className="border border-dashed bg-muted/30">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-primary/10 p-4 mb-4">
                <AlertCircle className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-medium mb-2">No {filter} appointments</h3>
              <p className="text-muted-foreground mb-4 max-w-md">
                There are no appointments matching the current filter.
              </p>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => setFilter("all")}>
                View All Appointments
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Group appointments by status */}
            {["completed", "in-progress", "upcoming", "past"].map((status) => {
              // Only show this status section if we're on the "all" tab or the matching status tab
              if (filter !== "all" && filter !== status) return null;
              
              // Get appointments for this status directly from the source
              const statusAppointments = getAppointmentsByStatus(appointments, status);
              
              // Skip rendering if there are no appointments for this status
              if (statusAppointments.length === 0) {
                return null;
              }
              
              // Get appointments to display - in "All" tab, show at most 5 appointments of each status
              let displayAppointments;
              if (filter === "all") {
                // For "All" tab, show at most 5 appointments of each status
                displayAppointments = statusAppointments.slice(0, 5);
              } else {
                // For status-specific tabs, use the paginated appointments
                displayAppointments = paginatedAppointments;
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
                      ({statusAppointments.length})
                    </span>
                  </h3>
                  
                  <ScrollArea className="max-h-[600px]">
                    <div className="grid gap-3 pr-4">
                      {displayAppointments.map((appointment) => {
                        const appointmentStatus = getAppointmentStatus(appointment);
                        const startTime = new Date(appointment.start_time * 1000);
                        const endTime = new Date(appointment.end_time * 1000);
                        const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
                        
                        return (
                          <Card 
                            key={appointment.id} 
                            className={cn(
                              "overflow-hidden transition-all duration-300 hover:shadow-md",
                              appointmentStatus === "in-progress" ? "border-l-4 border-l-purple-500" : 
                              appointmentStatus === "upcoming" ? "border-l-4 border-l-blue-500" : 
                              appointmentStatus === "completed" ? "border-l-4 border-l-green-500" :
                              "border-l-4 border-l-gray-300 opacity-80"
                            )}
                          >
                            <CardContent className="p-0">
                              <div className="flex items-stretch">
                                {/* Time column */}
                                <div className={cn(
                                  "w-20 flex-shrink-0 flex flex-col items-center justify-center p-4 text-center",
                                  appointmentStatus === "in-progress" ? "bg-purple-50 text-purple-900 dark:bg-purple-900/20 dark:text-purple-100" : 
                                  appointmentStatus === "upcoming" ? "bg-blue-50 text-blue-900 dark:bg-blue-900/20 dark:text-blue-100" :
                                  appointmentStatus === "completed" ? "bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-100" :
                                  "bg-gray-50 text-gray-500 dark:bg-gray-800/20 dark:text-gray-400"
                                )}>
                                  {appointment.all_day ? (
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
                                        <h3 className="font-medium">{appointment.title}</h3>
                                        {appointmentStatus === "in-progress" && (
                                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                                            <span className="h-1.5 w-1.5 rounded-full bg-purple-500 mr-1 animate-pulse"></span>
                                            Now
                                          </span>
                                        )}
                                      </div>
                                      
                                      {appointment.description && (
                                        <p className="text-sm text-muted-foreground">
                                          {appointment.description}
                                        </p>
                                      )}
                                      
                                      {/* Add recurring appointment indicator */}
                                      {appointment.is_recurring && (
                                        <p className="text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1 mt-1">
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                          </svg>
                                          Repeats {appointment.recurrence_pattern}
                                          {appointment.recurrence_interval && appointment.recurrence_interval > 1 
                                            ? ` (every ${appointment.recurrence_interval} ${appointment.recurrence_pattern}s)` 
                                            : ``}
                                          {appointment.recurrence_end_date 
                                            ? ` until ${formatDate(appointment.recurrence_end_date, "MMM d, yyyy")}` 
                                            : ``}
                                        </p>
                                      )}
                                      
                                      <p className="text-xs text-muted-foreground flex items-center">
                                        <CalendarIcon className="h-3 w-3 mr-1 opacity-70" />
                                        {formatDate(appointment.start_time, "EEE, MMM d")}
                                        {!appointment.all_day && (
                                          <> • {formatDate(appointment.start_time, "h:mm a")} - {formatDate(appointment.end_time, "h:mm a")}</>
                                        )}
                                      </p>
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
                                          <DropdownMenuItem onSelect={() => handleEditClick(appointment)}>
                                            <Edit className="mr-2 h-4 w-4 text-purple-500" />
                                            <span>Edit</span>
                                          </DropdownMenuItem>
                                          <DropdownMenuItem 
                                            onSelect={() => handleDeleteClick(appointment)}
                                            className="text-red-600"
                                          >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            <span>Delete</span>
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            onSelect={() => {
                                              handleToggleCompletion(appointment);
                                            }}
                                          >
                                            {appointment.completed ? (
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
            
            {/* Pagination Controls */}
            {shouldShowPagination && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 border-t pt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {startIndex + 1}-{endIndex} of {totalAppointments} appointments
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
                        <path fillRule="evenodd" d="M7.78 14.78a.75.75 0 0 1-1.06 0L1.22 9.28a.75.75 0 0 1 0-1.06l5.5-5.5a.75.75 0 1 0-1.06 1.06L2.56 8.5l5.22 5.22a.75.75 0 0 0 0 1.06Z" clipRule="evenodd" />
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
          </>
        )}
      </div>
      
      {/* Add conflict confirmation dialog */}
      <Dialog open={conflictDialogOpen} onOpenChange={setConflictDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <AlertCircle className="h-5 w-5 mr-2 text-amber-500" />
              Calendar Conflict Detected
            </DialogTitle>
            <DialogDescription>
              This appointment overlaps with an existing calendar event.
            </DialogDescription>
          </DialogHeader>
          
          {conflictDetails && (
            <div className="py-4">
              <div className="rounded-lg border p-4 bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200">
                <p className="text-sm font-medium mb-2">
                  Your new appointment overlaps with:
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
                Would you like to schedule this appointment anyway?
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
      
      {/* Add delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Trash2 className="h-5 w-5 mr-2 text-destructive" />
              Confirm Deletion
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this appointment? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          {appointmentToDelete && (
            <div className="py-4">
              <div className="rounded-lg border p-4 bg-destructive/5 text-destructive-foreground">
                <p className="text-sm font-medium mb-2">
                  You are about to delete:
                </p>
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    {appointmentToDelete.title}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center">
                    <CalendarIcon className="h-3 w-3 mr-1 opacity-70" />
                    {formatDate(appointmentToDelete.start_time, "EEE, MMM d")}
                    {!appointmentToDelete.all_day && (
                      <> • {formatDate(appointmentToDelete.start_time, "h:mm a")} - {formatDate(appointmentToDelete.end_time, "h:mm a")}</>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter className="flex space-x-2 mt-2">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setAppointmentToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDelete}
              variant="destructive"
            >
              Delete Appointment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 