import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type UserSettings, insertUserSettingsSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

const TIMEZONES = Intl.supportedValuesOf('timeZone');

export default function Settings() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useQuery<UserSettings>({
    queryKey: ["/api/user-settings"],
  });

  const form = useForm({
    resolver: zodResolver(insertUserSettingsSchema),
    defaultValues: settings || {
      timezone: "UTC",
      workStartHour: 9,
      workEndHour: 17,
      theme: "system",
      defaultCalendarView: "month",
      showNotifications: true,
    },
  });

  const updateSettings = useMutation({
    mutationFn: async (data: Partial<UserSettings>) => {
      const res = await apiRequest("PATCH", "/api/user-settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-settings"] });
      toast({
        title: "Settings updated",
        description: "Your preferences have been saved successfully.",
      });
    },
  });

  if (isLoading) {
    return <div>Loading settings...</div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Settings</h2>
      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((data) => updateSettings.mutate(data))}
              className="space-y-6"
            >
              <FormField
                control={form.control}
                name="theme"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Theme</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select theme" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Choose your preferred theme for the application
                    </FormDescription>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timezone</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select timezone" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TIMEZONES.map((tz) => (
                          <SelectItem key={tz} value={tz}>
                            {tz}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Your local timezone for accurate scheduling
                    </FormDescription>
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="workStartHour"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Work Start Hour</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={23}
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        When your work day typically starts (24h format)
                      </FormDescription>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="workEndHour"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Work End Hour</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={23}
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        When your work day typically ends (24h format)
                      </FormDescription>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="defaultCalendarView"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Calendar View</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select default view" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="month">Month</SelectItem>
                        <SelectItem value="week">Week</SelectItem>
                        <SelectItem value="day">Day</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Choose how you prefer to view your calendar by default
                    </FormDescription>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="showNotifications"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Desktop Notifications
                      </FormLabel>
                      <FormDescription>
                        Receive notifications for upcoming events and tasks
                      </FormDescription>
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

              <Button type="submit" disabled={updateSettings.isPending}>
                Save Settings
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
