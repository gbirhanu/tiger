import React, { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { z } from "zod";
import { type Appointment } from "@shared/schema";
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
import { getAppointments, createAppointment, deleteAppointment } from "@/lib/api";
import { Plus, Trash2, CalendarIcon, Loader2, Clock, MapPin, AlertCircle, Pencil } from "lucide-react";
import { formatDate, getNow } from "@/lib/timezone";
import { TimeSelect } from "./TimeSelect";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

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
});

type FormValues = z.infer<typeof formSchema>;

interface AppointmentsProps {
  isDialogOpen?: boolean;
  setIsDialogOpen?: (open: boolean) => void;
  initialDate?: Date | null;
  selectedAppointmentId?: number | null;
}

export default function Appointments({ isDialogOpen, setIsDialogOpen, initialDate, selectedAppointmentId }: AppointmentsProps = {}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(isDialogOpen || false);
  const [filter, setFilter] = useState<"all" | "upcoming" | "past" | "in-progress">("all");
  const [isEditing, setIsEditing] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        console.log("Appointments fetched:", data);
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
      });
    }
  }, [initialDate, form]);

  // Create appointment mutation
  const createMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const date = new Date(values.date);
      
      // Calculate start and end times
      let startTime: number;
      let endTime: number;
      
      if (values.allDay) {
        // All-day event
        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        startTime = Math.floor(startDate.getTime() / 1000);
        
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);
        endTime = Math.floor(endDate.getTime() / 1000);
      } else {
        // Specific time event
        const startDate = new Date(date);
        startDate.setHours(values.startHour, values.startMinute, 0, 0);
        startTime = Math.floor(startDate.getTime() / 1000);
        
        const endDate = new Date(date);
        endDate.setHours(values.endHour, values.endMinute, 0, 0);
        endTime = Math.floor(endDate.getTime() / 1000);
      }
      
      // Validate times
      if (endTime <= startTime) {
        throw new Error("End time must be after start time");
      }
      
      // Create appointment
      return createAppointment({
        title: values.title,
        description: values.description || "",
        start_time: startTime,
        end_time: endTime,
        all_day: values.allDay,
        created_at: Date.now(),
        updated_at: Date.now()
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Appointment created successfully",
      });
      handleOpenChange(false);
      form.reset();
      refetch();
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.APPOINTMENTS] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create appointment",
        variant: "destructive",
      });
    },
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

  // Add update appointment mutation
  const updateAppointmentMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      if (!selectedAppointment) throw new Error("No appointment selected for update");
      if (!data.date) throw new Error("Date is required");
      
      const date = new Date(data.date);
      
      // Calculate start and end times
      let startTime: number;
      let endTime: number;
      
      if (data.allDay) {
        // All-day event
        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        startTime = Math.floor(startDate.getTime() / 1000);
        
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);
        endTime = Math.floor(endDate.getTime() / 1000);
      } else {
        // Specific time event
        const startDate = new Date(date);
        startDate.setHours(data.startHour, data.startMinute, 0, 0);
        startTime = Math.floor(startDate.getTime() / 1000);
        
        const endDate = new Date(date);
        endDate.setHours(data.endHour, data.endMinute, 0, 0);
        endTime = Math.floor(endDate.getTime() / 1000);
      }
      
      // Validate times
      if (endTime <= startTime) {
        throw new Error("End time must be after start time");
      }
      
      // Update appointment using apiRequest directly
      const response = await apiRequest('PUT', `/api/appointments/${selectedAppointment.id}`, {
        title: data.title,
        description: data.description || null,
        start_time: startTime,
        end_time: endTime,
        all_day: data.allDay,
        updated_at: Math.floor(Date.now() / 1000)
      });
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.APPOINTMENTS] });
      handleOpenChange(false);
      setIsEditing(false);
      setSelectedAppointment(null);
      toast({
        title: "Appointment updated",
        description: "The appointment has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to update appointment",
        description: error.message || "An error occurred while updating the appointment.",
      });
    }
  });

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
    });
    handleOpenChange(true);
  };

  // Update form submit handler
  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    try {
      if (isEditing) {
        await updateAppointmentMutation.mutateAsync(data);
      } else {
        await createMutation.mutateAsync(data);
      }
    } catch (error) {
      console.error("Error submitting form:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper function to determine appointment status
  const getAppointmentStatus = (appointment: Appointment): "in-progress" | "upcoming" | "past" => {
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

  // Filter appointments by status
  const filterAppointmentsByStatus = (appointments: Appointment[], status: string): Appointment[] => {
    if (status === "all") {
      return appointments;
    }
    
    return appointments.filter(appointment => getAppointmentStatus(appointment) === status);
  };

  // Get filtered appointments
  const filteredAppointments = filterAppointmentsByStatus(appointments, filter);
  
  // Get appointments by status
  const inProgressAppointments = filterAppointmentsByStatus(appointments, "in-progress");
  const upcomingAppointments = filterAppointmentsByStatus(appointments, "upcoming");
  const pastAppointments = filterAppointmentsByStatus(appointments, "past");
  
  // Calculate total appointment minutes
  const totalAppointmentMinutes = appointments?.reduce((total, appointment) => {
    const duration = (appointment.end_time - appointment.start_time) / 60; // duration in minutes
    return total + duration;
  }, 0) || 0;
  
  const totalAppointmentHours = Math.floor(totalAppointmentMinutes / 60);
  const remainingMinutes = Math.round(totalAppointmentMinutes % 60);

  // Add event listener for opening the appointment edit dialog from Calendar
  const handleEditAppointment = useCallback((event: Event) => {
    console.log("Edit appointment event received:", event);
    const customEvent = event as CustomEvent;
    
    if (customEvent.detail && customEvent.detail.appointment) {
      const appointmentData = customEvent.detail.appointment;
      console.log("Appointment data structure:", JSON.stringify(appointmentData, null, 2));
      
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
        endMinute
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
    console.log("Adding edit-appointment event listener");
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
        console.log("Opening edit dialog for appointment with ID:", selectedAppointmentId);
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
        console.log("Found appointment to edit from localStorage:", appointment);
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
          <DialogContent className="sm:max-w-[500px]">
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/20 dark:to-green-900/10 border-green-200 dark:border-green-900/50">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-medium text-green-600 dark:text-green-400">In Progress</p>
                  <h3 className="text-2xl font-bold mt-1">{inProgressAppointments.length}</h3>
                </div>
                <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
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
          variant={filter === "in-progress" ? "default" : "outline"}
          onClick={() => setFilter("in-progress")}
          size="sm"
          className={filter === "in-progress" ? "bg-green-600 hover:bg-green-700" : ""}
        >
          <div className="h-2 w-2 rounded-full bg-green-500 mr-2 animate-pulse"></div>
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
            {["in-progress", "upcoming", "past"].map((status) => {
              if (filter !== "all" && filter !== status) return null;
              
              const filteredByStatus = filterAppointmentsByStatus(appointments, status);
              
              if (filteredByStatus.length === 0) {
                return null;
              }
              
              return (
                <div key={status} className="space-y-3">
                  <h3 className="text-md font-medium capitalize flex items-center">
                    {status === "in-progress" ? (
                      <>
                        <div className="h-2 w-2 rounded-full bg-green-500 mr-2 animate-pulse"></div>
                        In Progress
                      </>
                    ) : status === "upcoming" ? (
                      <>
                        <div className="h-2 w-2 rounded-full bg-blue-500 mr-2"></div>
                        Upcoming
                      </>
                    ) : (
                      <>
                        <div className="h-2 w-2 rounded-full bg-gray-500 mr-2"></div>
                        Past
                      </>
                    )}
                    <span className="text-xs text-muted-foreground ml-2">
                      ({filteredByStatus.length})
                    </span>
                  </h3>
                  
                  <ScrollArea className="max-h-[600px]">
                    <div className="grid gap-3 pr-4">
                      {filteredByStatus.map((appointment) => {
                        const appointmentStatus = getAppointmentStatus(appointment);
                        const startTime = new Date(appointment.start_time * 1000);
                        const endTime = new Date(appointment.end_time * 1000);
                        const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
                        
                        return (
                          <Card 
                            key={appointment.id} 
                            className={cn(
                              "overflow-hidden transition-all duration-300 hover:shadow-md",
                              appointmentStatus === "in-progress" ? "border-l-4 border-l-green-500" : 
                              appointmentStatus === "upcoming" ? "border-l-4 border-l-blue-500" : 
                              "border-l-4 border-l-gray-300 opacity-80"
                            )}
                          >
                            <CardContent className="p-0">
                              <div className="flex items-stretch">
                                {/* Time column */}
                                <div className={cn(
                                  "w-20 flex-shrink-0 flex flex-col items-center justify-center p-4 text-center",
                                  appointmentStatus === "in-progress" ? "bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-100" : 
                                  appointmentStatus === "upcoming" ? "bg-blue-50 text-blue-900 dark:bg-blue-900/20 dark:text-blue-100" : 
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
                                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                            <span className="h-1.5 w-1.5 rounded-full bg-green-500 mr-1 animate-pulse"></span>
                                            Now
                                          </span>
                                        )}
                                      </div>
                                      
                                      {appointment.description && (
                                        <p className="text-sm text-muted-foreground">
                                          {appointment.description}
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
                                    
                                    <div className="flex gap-2 ml-4">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleEditClick(appointment)}
                                        className="h-8 w-8 hover:bg-muted"
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => {
                                          if (window.confirm("Are you sure you want to delete this appointment?")) {
                                            deleteMutation.mutate(appointment.id);
                                          }
                                        }}
                                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
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
    </div>
  );
} 