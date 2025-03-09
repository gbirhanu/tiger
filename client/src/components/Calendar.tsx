import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
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
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
    },
  });

  const { data: appointments, isLoading } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments"],
  });

  const createAppointment = useMutation({
    mutationFn: async (data: any) => {
      const appointment = {
        ...data,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime)
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

  const appointmentsForDate = appointments?.filter(
    (appointment) =>
      format(new Date(appointment.startTime), "yyyy-MM-dd") ===
      format(date, "yyyy-MM-dd"),
  );

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      setDate(selectedDate);
      const now = new Date(selectedDate);
      now.setHours(9, 0, 0, 0); // Set default time to 9 AM
      const end = new Date(selectedDate);
      end.setHours(10, 0, 0, 0); // Set default end time to 10 AM

      form.setValue("startTime", now.toISOString().slice(0, 16));
      form.setValue("endTime", end.toISOString().slice(0, 16));
      setDialogOpen(true);
    }
  };

  if (isLoading) {
    return <div>Loading calendar...</div>;
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card className="cursor-pointer">
        <CardContent className="pt-6">
          <CalendarPrimitive
            mode="single"
            selected={date}
            onSelect={handleDateSelect}
            className="rounded-md border w-full" // Added w-full for wider date selection
          />
        </CardContent>
      </Card>

      <div className="space-y-4">
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
                        <Input type="datetime-local" {...field} />
                      </FormControl>
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
                        <Input type="datetime-local" {...field} />
                      </FormControl>
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

        <div className="space-y-2">
          {appointmentsForDate?.map((appointment) => (
            <Card key={appointment.id}>
              <CardContent className="pt-6 flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{appointment.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {appointment.description}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(appointment.startTime), "h:mm a")} -{" "}
                    {format(new Date(appointment.endTime), "h:mm a")}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteAppointment.mutate(appointment.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}