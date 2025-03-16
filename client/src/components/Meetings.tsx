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
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { queryClient, QUERY_KEYS } from "@/lib/queryClient";
import { getMeetings, createMeeting, deleteMeeting } from "@/lib/api";
import { Plus, Trash2, Video, Loader2, CalendarIcon, Clock } from "lucide-react";
import { formatDate, getNow } from "@/lib/timezone";
import { TimeSelect } from "./TimeSelect";
import { cn } from "@/lib/utils";

interface MeetingsProps {
  isDialogOpen?: boolean;
  setIsDialogOpen?: (open: boolean) => void;
  initialDate?: Date | null;
}

// Create a schema that matches the form fields
const meetingFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  meetingLink: z.string().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
});

type MeetingFormValues = z.infer<typeof meetingFormSchema>;

// Add this helper function to determine meeting status
const getMeetingStatus = (meeting: Meeting) => {
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
const filterMeetingsByStatus = (meetings: Meeting[] | undefined, status: string): Meeting[] => {
  if (!meetings) return [];
  return meetings.filter(meeting => getMeetingStatus(meeting) === status);
};

export default function Meetings({ isDialogOpen, setIsDialogOpen, initialDate }: MeetingsProps = {}) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [startDatePickerOpen, setStartDatePickerOpen] = useState(false);
  const [endDatePickerOpen, setEndDatePickerOpen] = useState(false);
  
  // Create default start and end times
  const defaultStartTime = initialDate || getNow();
  const defaultEndTime = new Date(defaultStartTime.getTime() + 60 * 60 * 1000); // 1 hour later

  const form = useForm<MeetingFormValues>({
    resolver: zodResolver(meetingFormSchema),
    defaultValues: {
      title: "",
      description: "",
      meetingLink: "",
      startDate: defaultStartTime,
      endDate: defaultEndTime,
    },
  });

  // Reset form when initialDate changes
  useEffect(() => {
    if (initialDate) {
      const endDate = new Date(initialDate.getTime() + 60 * 60 * 1000); // 1 hour later
      form.reset({
        ...form.getValues(),
        startDate: initialDate,
        endDate: endDate
      });
    }
  }, [initialDate, form]);

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

  const { data: meetings, isLoading, error } = useQuery<Meeting[]>({
    queryKey: [QUERY_KEYS.MEETINGS],
    queryFn: getMeetings,
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

  const createMeetingMutation = useMutation({
    mutationFn: async (data: MeetingFormValues) => {
      console.log("Creating meeting with data:", data);
      
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
        start_time: Math.floor(data.startDate!.getTime() / 1000),
        end_time: Math.floor(data.endDate!.getTime() / 1000),
        attendees: null, // Required by the type
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000)
      };
      
      console.log("Formatted meeting data:", meeting);
      return createMeeting(meeting);
    },
    onMutate: async (data) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.MEETINGS] });
      
      // Snapshot the previous value
      const previousMeetings = queryClient.getQueryData<Meeting[]>([QUERY_KEYS.MEETINGS]) || [];
      
      // Create an optimistic meeting with a temporary ID
      const optimisticMeeting: Meeting = {
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
      } as Meeting;
      
      console.log("Adding optimistic meeting:", optimisticMeeting);
      
      // Optimistically update the meetings list
      queryClient.setQueryData<Meeting[]>([QUERY_KEYS.MEETINGS], [...previousMeetings, optimisticMeeting]);
      
      // Return the context
      return { previousMeetings };
    },
    onError: (error: Error, _variables, context) => {
      // If the mutation fails, use the context to roll back
      if (context?.previousMeetings) {
        queryClient.setQueryData<Meeting[]>([QUERY_KEYS.MEETINGS], context.previousMeetings);
      }
      
      console.error("Error creating meeting:", error);
      toast({
        variant: "destructive",
        title: "Failed to create meeting",
        description: error.message || "An error occurred while creating the meeting.",
      });
    },
    onSuccess: () => {
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
      const previousMeetings = queryClient.getQueryData<Meeting[]>([QUERY_KEYS.MEETINGS]) || [];
      
      // Optimistically remove the meeting from the list
      queryClient.setQueryData<Meeting[]>([QUERY_KEYS.MEETINGS], 
        previousMeetings.filter(meeting => meeting.id !== id)
      );
      
      // Return the context
      return { previousMeetings };
    },
    onError: (error: Error, _variables, context) => {
      // If the mutation fails, use the context to roll back
      if (context?.previousMeetings) {
        queryClient.setQueryData<Meeting[]>([QUERY_KEYS.MEETINGS], context.previousMeetings);
      }
      
      console.error("Error deleting meeting:", error);
      toast({
        variant: "destructive",
        title: "Failed to delete meeting",
        description: error.message || "An error occurred while deleting the meeting.",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MEETINGS] });
      toast({
        title: "Meeting deleted",
        description: "Your meeting has been deleted successfully.",
      });
    },
  });

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
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all duration-300 shadow-md hover:shadow-lg">
              <Plus className="h-4 w-4 mr-2" />
              Schedule Meeting
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">Schedule New Meeting</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((data) => {
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
                className="space-y-5"
              >
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Meeting Title</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Enter meeting title" 
                            {...field} 
                            className="focus-visible:ring-primary"
                          />
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
                        <FormLabel className="text-sm font-medium">Description</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="What's this meeting about?" 
                            {...field} 
                            className="focus-visible:ring-primary"
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
                        <FormLabel className="text-sm font-medium">
                          <span className="flex items-center">
                            <Video className="h-4 w-4 mr-1.5 text-primary/70" />
                            Meeting Link
                          </span>
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Enter video call link (Zoom, Meet, etc.)" 
                            {...field} 
                            className="focus-visible:ring-primary"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="bg-muted/30 p-4 rounded-lg border border-border/50 space-y-4">
                  <h4 className="text-sm font-medium flex items-center text-muted-foreground">
                    <CalendarIcon className="h-4 w-4 mr-1.5 text-primary/70" />
                    Meeting Schedule
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="startDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel className="text-xs font-medium">Start Time</FormLabel>
                          <Popover open={startDatePickerOpen} onOpenChange={setStartDatePickerOpen}>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4 text-primary/70" />
                                  {field.value ? (
                                    formatDate(field.value, "EEE, MMM d • h:mm a")
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
                                className="rounded-md border"
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
                      control={form.control}
                      name="endDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel className="text-xs font-medium">End Time</FormLabel>
                          <Popover open={endDatePickerOpen} onOpenChange={setEndDatePickerOpen}>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4 text-primary/70" />
                                  {field.value ? (
                                    formatDate(field.value, "EEE, MMM d • h:mm a")
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
                                className="rounded-md border"
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
                </div>
                
                <Button 
                  type="submit" 
                  disabled={createMeetingMutation.isPending} 
                  className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all duration-300"
                >
                  {createMeetingMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      Schedule Meeting
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Meeting statistics */}
      {meetings && meetings.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/20 dark:to-green-900/10 border-green-200 dark:border-green-900/50">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-medium text-green-600 dark:text-green-400">In Progress</p>
                  <h3 className="text-2xl font-bold mt-1">{inProgressMeetings.length}</h3>
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
          
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/20 dark:to-purple-900/10 border-purple-200 dark:border-purple-900/50">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-medium text-purple-600 dark:text-purple-400">Total Meetings</p>
                  <h3 className="text-2xl font-bold mt-1">{meetings.length}</h3>
                </div>
                <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <Video className="h-4 w-4 text-purple-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Meeting categories */}
      <div className="grid gap-6">
        {meetings?.length === 0 ? (
          <Card className="border border-dashed bg-muted/30">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-primary/10 p-4 mb-4">
                <Calendar className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-medium mb-2">No meetings scheduled</h3>
              <p className="text-muted-foreground mb-4 max-w-md">
                Your calendar is clear. Click "Schedule Meeting" to create a new meeting.
              </p>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="mt-2">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Meeting
                </Button>
              </DialogTrigger>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Group meetings by status */}
            {["in-progress", "upcoming", "past"].map((status) => {
              const filteredMeetings = filterMeetingsByStatus(meetings, status);
              
              if (filteredMeetings.length === 0 && status === "past") {
                return null; // Don't show past meetings section if empty
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
                      ({filteredMeetings.length})
                    </span>
                  </h3>
                  
                  <div className="grid gap-3">
                    {filteredMeetings.map((meeting) => {
                      const meetingStatus = getMeetingStatus(meeting);
                      const startTime = new Date(meeting.start_time * 1000);
                      const endTime = new Date(meeting.end_time * 1000);
                      const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
                      
                      return (
                        <Card 
                          key={meeting.id} 
                          className={cn(
                            "overflow-hidden transition-all duration-300 hover:shadow-md",
                            meetingStatus === "in-progress" ? "border-l-4 border-l-green-500" : 
                            meetingStatus === "upcoming" ? "border-l-4 border-l-blue-500" : 
                            "border-l-4 border-l-gray-300 opacity-80"
                          )}
                        >
                          <CardContent className="p-0">
                            <div className="flex items-stretch">
                              {/* Time column */}
                              <div className={cn(
                                "w-20 flex-shrink-0 flex flex-col items-center justify-center p-4 text-center",
                                meetingStatus === "in-progress" ? "bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-100" : 
                                meetingStatus === "upcoming" ? "bg-blue-50 text-blue-900 dark:bg-blue-900/20 dark:text-blue-100" : 
                                "bg-gray-50 text-gray-500 dark:bg-gray-800/20 dark:text-gray-400"
                              )}>
                                <span className="text-2xl font-bold">{format(startTime, "h")}</span>
                                <span className="text-xs uppercase">{format(startTime, "mm a")}</span>
                                <div className="my-2 border-b w-8 border-current opacity-30"></div>
                                <span className="text-xs">{durationMinutes} min</span>
                              </div>
                              
                              {/* Content */}
                              <div className="flex-grow p-4">
                                <div className="flex justify-between items-start">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <h3 className="font-medium">{meeting.title}</h3>
                                      {meetingStatus === "in-progress" && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                          <span className="h-1.5 w-1.5 rounded-full bg-green-500 mr-1 animate-pulse"></span>
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
                                      {formatDate(meeting.start_time, "EEE, MMM d")} • {formatDate(meeting.start_time, "h:mm a")} - {formatDate(meeting.end_time, "h:mm a")}
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
                                  </div>
                                  
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => deleteMeetingMutation.mutate(meeting.id)}
                                    disabled={deleteMeetingMutation.isPending}
                                    className="opacity-50 hover:opacity-100 transition-opacity"
                                  >
                                    {deleteMeetingMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}