import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type UserSettings, insertUserSettingsSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { getUserSettings, updateUserSettings } from "@/lib/api";
import { queryClient, QUERY_KEYS } from "@/lib/queryClient";
import React from "react";
import { 
  Loader2, 
  Clock, 
  Palette, 
  Globe, 
  Calendar as CalendarIcon, 
  Bell, 
  BellOff,
  Save,
  Info
} from "lucide-react";
import { getUserTimezone } from "@/lib/timezone";
import { TimeSelect } from "./TimeSelect";
import { format } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/contexts/ThemeContext";

// Define a custom type for work hours that can be either a number (Unix timestamp) or an object
type WorkHour = number | { hour: number; minute: number };

// Define a custom interface that extends UserSettings but with the correct types for work hours
interface FormattedUserSettings extends Omit<UserSettings, 'work_start_hour' | 'work_end_hour'> {
  work_start_hour: WorkHour;
  work_end_hour: WorkHour;
}

const TIMEZONES = Intl.supportedValuesOf('timeZone');

// Helper functions for time handling
const createTimeFromHour = (hour: number) => {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return date;
};

const createTimeFromHourAndMinute = (hourMinute: { hour: number, minute: number }) => {
  const date = new Date();
  date.setHours(hourMinute.hour, hourMinute.minute || 0, 0, 0);
  return date;
};

const formatTimeValue = (value: any) => {
  if (value === null || value === undefined) {
    return "Select time";
  }
  
  if (typeof value === 'number') {
    // If it's just an hour number (0-24)
    const date = createTimeFromHour(value);
    return format(date, 'h:mm a');
  }
  
  if (typeof value === 'object' && 'hour' in value) {
    // If it's an object with hour and minute
    const date = createTimeFromHourAndMinute(value);
    return format(date, 'h:mm a');
  }
  
  return "Select time";
};

// Add a component to display the current timezone
const CurrentTimezone = () => {
  const timezone = getUserTimezone();
  const currentTime = new Date();
  
  return (
    <div className="bg-muted/50 rounded-lg p-2 mb-3 border border-border/50 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Info className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Current timezone: <span className="text-foreground">{timezone}</span></span>
      </div>
      <Badge variant="outline" className="text-xs font-medium">
        {currentTime.toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit',
          timeZoneName: 'short' 
        })}
      </Badge>
    </div>
  );
};

export default function Settings() {
  const { toast } = useToast();
  const { data: settings, isLoading, error } = useQuery<UserSettings>({
    queryKey: [QUERY_KEYS.SETTINGS],
    queryFn: getUserSettings,
  });
  
  // Get theme functions from context
  const { setTheme } = useTheme();

  // Log any errors for debugging
  React.useEffect(() => {
    if (error) {
      console.error("Error fetching settings:", error);
    }
  }, [error]);

  const form = useForm<FormattedUserSettings>({
    resolver: zodResolver(insertUserSettingsSchema),
    defaultValues: {
      timezone: "UTC",
      work_start_hour: 9,
      work_end_hour: 17,
      theme: "system",
      default_calendar_view: "month",
      show_notifications: true,
      notifications_enabled: true,
    },
  });

  // Helper function to convert a time object to a Unix timestamp
  const timeObjectToUnixTimestamp = (time: { hour: number, minute: number }): number => {
    const date = new Date();
    date.setHours(time.hour, time.minute, 0, 0);
    return Math.floor(date.getTime() / 1000); // Convert to seconds
  };

  // Helper function to convert a Unix timestamp to a time object
  const unixTimestampToTimeObject = (timestamp: number): { hour: number, minute: number } => {
    const date = new Date(timestamp * 1000); // Convert seconds to milliseconds
    return {
      hour: date.getHours(),
      minute: date.getMinutes()
    };
  };

  // Update form values when settings are loaded
  React.useEffect(() => {
    if (settings) {
      console.log("Settings loaded:", settings);
      
      // Format work hours from Unix timestamps to time objects
      const formattedSettings: FormattedUserSettings = { 
        ...settings,
        // Convert work hours to the appropriate format
        work_start_hour: typeof settings.work_start_hour === 'number' 
          ? unixTimestampToTimeObject(settings.work_start_hour)
          : settings.work_start_hour,
        work_end_hour: typeof settings.work_end_hour === 'number' 
          ? unixTimestampToTimeObject(settings.work_end_hour)
          : settings.work_end_hour
      };
      
      console.log("Formatted settings for form:", formattedSettings);
      form.reset(formattedSettings);
    }
  }, [settings, form]);

  const updateSettingsMutation = useMutation({
    mutationFn: (data: FormattedUserSettings) => updateUserSettings(data as any),
    onMutate: async (newSettings) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.SETTINGS] });
      
      // Snapshot the previous value
      const previousSettings = queryClient.getQueryData<UserSettings>([QUERY_KEYS.SETTINGS]);
      
      // Convert work hours to hour values for the optimistic update
      const optimisticSettings = { ...newSettings };
      
      // Ensure work hours are hour values (0-24) for the cache update
      if (optimisticSettings.work_start_hour && 
          typeof optimisticSettings.work_start_hour === 'object' && 
          'hour' in optimisticSettings.work_start_hour) {
        optimisticSettings.work_start_hour = optimisticSettings.work_start_hour.hour;
      }
      
      if (optimisticSettings.work_end_hour && 
          typeof optimisticSettings.work_end_hour === 'object' && 
          'hour' in optimisticSettings.work_end_hour) {
        optimisticSettings.work_end_hour = optimisticSettings.work_end_hour.hour;
      }
      
      // Optimistically update to the new value
      queryClient.setQueryData<UserSettings>([QUERY_KEYS.SETTINGS], (old) => {
        if (!old) return old;
        
        // Ensure work hours are numbers for type compatibility
        const typedOptimisticSettings: UserSettings = {
          ...old,
          ...optimisticSettings,
          // Ensure these are always numbers
          work_start_hour: typeof optimisticSettings.work_start_hour === 'number' 
            ? optimisticSettings.work_start_hour 
            : old.work_start_hour,
          work_end_hour: typeof optimisticSettings.work_end_hour === 'number' 
            ? optimisticSettings.work_end_hour 
            : old.work_end_hour,
          // Preserve the user_id field
          user_id: old.user_id
        };
        
        return typedOptimisticSettings;
      });
      
      // Return a context object with the previous settings
      return { previousSettings };
    },
    onError: (error: Error, _variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousSettings) {
        queryClient.setQueryData<UserSettings>([QUERY_KEYS.SETTINGS], context.previousSettings);
      }
      
      console.error("Error updating settings:", error);
      toast({
        variant: "destructive",
        title: "Failed to update settings",
        description: error.message || "An error occurred while saving your settings.",
      });
    },
    onSuccess: (data) => {
      // Update the cache with the server response
      queryClient.setQueryData<UserSettings>([QUERY_KEYS.SETTINGS], data);
      
      toast({
        title: "Settings updated",
        description: "Your preferences have been saved successfully.",
      });
    },
  });

  // Add state for time picker popovers
  const [startTimeOpen, setStartTimeOpen] = useState(false);
  const [endTimeOpen, setEndTimeOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Settings</h2>
        <Button 
          type="submit" 
          form="settings-form"
          disabled={updateSettingsMutation.isPending}
          className="gap-2"
        >
          {updateSettingsMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Settings
            </>
          )}
        </Button>
      </div>
      
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle>User Preferences</CardTitle>
          <CardDescription>
            Customize your experience with these personal settings
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Add the CurrentTimezone component */}
          <CurrentTimezone />
          
          <Form {...form}>
            <form
              id="settings-form"
              onSubmit={form.handleSubmit((data) => {
                console.log('Submitting settings with raw form data:', data);
                
                // Create a copy of the data that we can modify
                const formattedData: FormattedUserSettings = { ...data };
                
                // Extract just the hour values for work hours
                if (formattedData.work_start_hour && 
                    typeof formattedData.work_start_hour === 'object' && 
                    'hour' in formattedData.work_start_hour) {
                  // Extract just the hour value (0-24)
                  formattedData.work_start_hour = formattedData.work_start_hour.hour;
                  console.log('Extracted hour value for work_start_hour:', formattedData.work_start_hour);
                }
                
                if (formattedData.work_end_hour && 
                    typeof formattedData.work_end_hour === 'object' && 
                    'hour' in formattedData.work_end_hour) {
                  // Extract just the hour value (0-24)
                  formattedData.work_end_hour = formattedData.work_end_hour.hour;
                  console.log('Extracted hour value for work_end_hour:', formattedData.work_end_hour);
                }
                
                // Ensure hour values are within valid range (0-24)
                if (typeof formattedData.work_start_hour === 'number') {
                  formattedData.work_start_hour = Math.min(Math.max(0, formattedData.work_start_hour), 23);
                }
                
                if (typeof formattedData.work_end_hour === 'number') {
                  formattedData.work_end_hour = Math.min(Math.max(1, formattedData.work_end_hour), 24);
                }
                
                // Ensure boolean values are handled correctly for SQLite
                formattedData.show_notifications = Boolean(formattedData.show_notifications);
                formattedData.notifications_enabled = Boolean(formattedData.notifications_enabled);
                
                console.log('Final formatted data to be sent to server:', formattedData);
                updateSettingsMutation.mutate(formattedData);
              })}
              className="space-y-8"
            >
              {/* Appearance Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Palette className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-medium">Appearance</h3>
                </div>
                <Separator className="my-2" />
                
                <FormField
                  control={form.control}
                  name="theme"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Theme</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          // Also update the theme context directly for immediate effect
                          setTheme(value as 'light' | 'dark' | 'system');
                        }}
                        value={field.value as string}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full md:w-[250px]">
                            <SelectValue placeholder="Select theme" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="light" className="flex items-center">
                            <div className="flex items-center gap-2">
                              <div className="h-4 w-4 rounded-full bg-white border border-gray-200"></div>
                              <span>Light</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="dark" className="flex items-center">
                            <div className="flex items-center gap-2">
                              <div className="h-4 w-4 rounded-full bg-gray-900 border border-gray-700"></div>
                              <span>Dark</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="system" className="flex items-center">
                            <div className="flex items-center gap-2">
                              <div className="h-4 w-4 rounded-full bg-gradient-to-r from-white to-gray-900 border border-gray-300"></div>
                              <span>System (Auto)</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Choose your preferred theme for the application
                      </FormDescription>
                    </FormItem>
                  )}
                />
              </div>
              
              {/* Time & Location Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-medium">Time & Location</h3>
                </div>
                <Separator className="my-2" />
                
                <FormField
                  control={form.control}
                  name="timezone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Timezone</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value as string}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full md:w-[250px]">
                            <SelectValue placeholder="Select timezone" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-[300px]">
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

                <div className="grid gap-6 md:grid-cols-2 mt-4">
                  <FormField
                    control={form.control}
                    name="work_start_hour"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Work Start Time</FormLabel>
                        <FormControl>
                          <Popover open={startTimeOpen} onOpenChange={setStartTimeOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full justify-start text-left font-normal"
                              >
                                <Clock className="mr-2 h-4 w-4 text-primary" />
                                {formatTimeValue(field.value)}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 max-w-[240px]" align="start" side="top">
                              <TimeSelect
                                value={typeof field.value === 'number' 
                                  ? createTimeFromHour(field.value) 
                                  : (field.value && typeof field.value === 'object' && 'hour' in field.value)
                                    ? createTimeFromHourAndMinute(field.value)
                                    : createTimeFromHour(9)}
                                onChange={(date) => {
                                  // Save both hour and minute
                                  field.onChange({
                                    hour: date.getHours(),
                                    minute: date.getMinutes()
                                  });
                                }}
                                onComplete={() => {
                                  setStartTimeOpen(false);
                                }}
                                compact={true}
                              />
                            </PopoverContent>
                          </Popover>
                        </FormControl>
                        <FormDescription>
                          When your work day typically starts
                        </FormDescription>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="work_end_hour"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Work End Time</FormLabel>
                        <FormControl>
                          <Popover open={endTimeOpen} onOpenChange={setEndTimeOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full justify-start text-left font-normal"
                              >
                                <Clock className="mr-2 h-4 w-4 text-primary" />
                                {formatTimeValue(field.value)}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 max-w-[240px]" align="start" side="top">
                              <TimeSelect
                                value={typeof field.value === 'number' 
                                  ? createTimeFromHour(field.value) 
                                  : (field.value && typeof field.value === 'object' && 'hour' in field.value)
                                    ? createTimeFromHourAndMinute(field.value)
                                    : createTimeFromHour(17)}
                                onChange={(date) => {
                                  // Save both hour and minute
                                  field.onChange({
                                    hour: date.getHours(),
                                    minute: date.getMinutes()
                                  });
                                }}
                                onComplete={() => {
                                  setEndTimeOpen(false);
                                }}
                                compact={true}
                              />
                            </PopoverContent>
                          </Popover>
                        </FormControl>
                        <FormDescription>
                          When your work day typically ends
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              
              {/* Calendar Settings */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-medium">Calendar Settings</h3>
                </div>
                <Separator className="my-2" />
                
                <FormField
                  control={form.control}
                  name="default_calendar_view"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Calendar View</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value as string}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full md:w-[250px]">
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
              </div>
              
              {/* Notifications */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-medium">Notifications</h3>
                </div>
                <Separator className="my-2" />
                
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="notifications_enabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <FormLabel className="text-base">
                              Notifications Enabled
                            </FormLabel>
                            {field.value ? (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Enabled</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Disabled</Badge>
                            )}
                          </div>
                          <FormDescription>
                            Master switch to enable or disable all notifications
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={!!field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="show_notifications"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
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
                            checked={!!field.value}
                            onCheckedChange={field.onChange}
                            disabled={!form.watch("notifications_enabled")}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button 
                  type="submit" 
                  disabled={updateSettingsMutation.isPending}
                  className="gap-2"
                >
                  {updateSettingsMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Settings
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
