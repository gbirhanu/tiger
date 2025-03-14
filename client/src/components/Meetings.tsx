import React, { useState } from "react";
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
import { Plus, Trash2, Video, Loader2, CalendarIcon } from "lucide-react";
import { formatDate, getNow } from "@/lib/timezone";
import { TimeSelect } from "./TimeSelect";
import { cn } from "@/lib/utils";

// Create a schema that matches the form fields
const meetingFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  meetingLink: z.string().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
});

type MeetingFormValues = z.infer<typeof meetingFormSchema>;

export default function Meetings() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [startDatePickerOpen, setStartDatePickerOpen] = useState(false);
  const [endDatePickerOpen, setEndDatePickerOpen] = useState(false);
  
  // Create default start and end times
  const defaultStartTime = getNow();
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
        start_time: Math.floor(data.startDate.getTime() / 1000),
        end_time: Math.floor(data.endDate.getTime() / 1000),
        attendees: null, // Required by the type
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
        start_time: Math.floor(data.startDate.getTime() / 1000),
        end_time: Math.floor(data.endDate.getTime() / 1000),
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Meetings</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Schedule Meeting
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Schedule New Meeting</DialogTitle>
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
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter meeting title" {...field} />
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
                        <Input placeholder="Enter meeting description" {...field} />
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
                      <FormLabel>Meeting Link</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter video call link (Zoom, Meet, etc.)" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Start Time</FormLabel>
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
                                <CalendarIcon className="mr-2 h-4 w-4" />
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
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>End Time</FormLabel>
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
                                <CalendarIcon className="mr-2 h-4 w-4" />
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
                <Button type="submit" disabled={createMeetingMutation.isPending} className="w-full">
                  {createMeetingMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Schedule Meeting"
                  )}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {meetings?.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center py-10 text-muted-foreground">
              No meetings scheduled. Click "Schedule Meeting" to create one.
            </CardContent>
          </Card>
        ) : (
          meetings?.map((meeting) => (
            <Card key={meeting.id}>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h3 className="font-medium">{meeting.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {meeting.description}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(meeting.start_time, "PPP h:mm a")} -{" "}
                      {formatDate(meeting.end_time, "h:mm a")}
                    </p>
                    {meeting.location && (
                      <a
                        href={meeting.location}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-sm text-primary hover:underline mt-2"
                      >
                        <Video className="h-4 w-4 mr-1" />
                        Join Meeting
                      </a>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMeetingMutation.mutate(meeting.id)}
                    disabled={deleteMeetingMutation.isPending}
                  >
                    {deleteMeetingMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}