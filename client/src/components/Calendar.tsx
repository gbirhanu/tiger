import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, isSameDay, parseISO } from "date-fns";
import { type Appointment, insertAppointmentSchema } from "@shared/schema";
import { Calendar as CalendarPrimitive } from "@/components/ui/calendar";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Plus, Trash2 } from "lucide-react";

export default function Calendar() {
  const { toast } = useToast();
  const [date, setDate] = useState<Date>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);

  const form = useForm({
    resolver: zodResolver(insertAppointmentSchema),
    defaultValues: {
      title: "",
      description: "",
      startTime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      endTime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    },
  });

  const { data: appointments, isLoading } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments"],
  });

  const createAppointment = useMutation({
    mutationFn: async (data: any) => {
      const appointment = {
        ...data,
        startTime: new Date(data.startTime).toISOString(),
        endTime: new Date(data.endTime).toISOString()
      };
      const res = await apiRequest("POST", "/api/appointments", appointment);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      form.reset();
      setDialogOpen(false);
      toast({
        title: "Appointment created",
        description: "Your appointment has been created successfully.",
      });
    },
  });

  const deleteAppointment = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/appointments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      toast({
        title: "Appointment deleted",
        description: "Your appointment has been deleted successfully.",
      });
    },
  });

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      setDate(selectedDate);
      const now = new Date(selectedDate);
      now.setHours(9, 0, 0, 0); // Set default time to 9 AM
      const end = new Date(selectedDate);
      end.setHours(10, 0, 0, 0); // Set default end time to 10 AM

      form.setValue("startTime", format(now, "yyyy-MM-dd'T'HH:mm"));
      form.setValue("endTime", format(end, "yyyy-MM-dd'T'HH:mm"));
      setDialogOpen(true);
    }
  };

  if (isLoading) {
    return <div>Loading calendar...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Calendar</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Appointment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Appointment for {format(date, "PPP")}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((data) => createAppointment.mutate(data))}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
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
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter appointment description" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Time</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} className="w-full" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Time</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} className="w-full" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={createAppointment.isPending}>
                  Add Appointment
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="cursor-pointer">
        <CardContent className="pt-6">
          <CalendarPrimitive
            mode="single"
            selected={date}
            onSelect={handleDateSelect}
            className="rounded-md border w-full"
            modifiers={{
              hasEvents: (date) =>
                appointments?.some((appointment) =>
                  isSameDay(new Date(appointment.startTime), date)
                ) || false,
            }}
            modifiersStyles={{
              hasEvents: {
                fontWeight: "bold",
                color: "var(--primary)",
                backgroundColor: "var(--primary-foreground)",
              },
            }}
            components={{
              DayContent: ({ date: dayDate }) => (
                <div className="h-24 p-1">
                  <div className="text-sm mb-1">{dayDate.getDate()}</div>
                  <div className="space-y-1">
                    {appointments
                      ?.filter((appointment) =>
                        isSameDay(new Date(appointment.startTime), dayDate)
                      )
                      .map((appointment) => (
                        <div
                          key={appointment.id}
                          className="text-xs bg-primary/10 rounded p-1 truncate flex justify-between items-center group"
                        >
                          <div className="overflow-hidden">
                            <span className="block truncate">{appointment.title}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {format(new Date(appointment.startTime), "h:mm a")}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 opacity-0 group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteAppointment.mutate(appointment.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                  </div>
                </div>
              ),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}