import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { useTheme } from "@/contexts/ThemeContext";
import { useToast } from "@/hooks/use-toast";
import { useMarketingSettings } from "@/lib/hooks/useMarketingSettings";
import {
  getUserSettings,
  updateUserSettings,
  getAdminSettings,
  fetchAllPayments,
  approvePayment,
  rejectPayment,
  getUserPaymentHistory
} from "@/lib/api";
import { QUERY_KEYS } from "@/lib/queryClient";
import type { UserSettings, AdminSettings } from "../../../shared/schema";
import { insertUserSettingsSchema } from "../../../shared/schema";
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
import React from "react";
import { 
  Loader2, 
  Clock, 
  Palette, 
  Globe, 
  Calendar as CalendarIcon, 
  Bell, 
  Save,
  Info,
  Key,
  ShieldCheck,
  CreditCard,
  DollarSign,
  PackageOpen,
  User,
  Brain,
  Receipt
} from "lucide-react";
import { getUserTimezone } from "@/lib/timezone";
import { TimeSelect } from "./TimeSelect";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { AlertCircle } from "lucide-react";
import { 
  Alert,
  AlertDescription,
  AlertTitle
} from "@/components/ui/alert";

import { AdminPlanManager } from "./AdminPlanManager";
import AdminSettingsForm from "./AdminSettingsForm";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Define a custom type for work hours that can be either a number (Unix timestamp) or an object
type WorkHour = number | { hour: number; minute: number };

// Define a custom interface that extends UserSettings but with the correct types for work hours
interface FormattedUserSettings extends Omit<UserSettings, 'work_start_hour' | 'work_end_hour' | 'gemini_key'> {
  work_start_hour: WorkHour;
  work_end_hour: WorkHour;
  gemini_key: string;
  // Do NOT include admin properties here
}

// Define a separate interface for admin settings
interface FormattedAdminSettings {
  // Optional fields that may not be present when creating a new record
  id?: number;
  created_at?: number;
  updated_at?: number;
  
  // Required fields with proper types
  gemini_max_free_calls: number;
  enable_marketing: boolean;
  bank_account: string | null;
  bank_owner: string | null;
  subscription_amount: number;
  default_currency: string;
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

// Define admin settings query key constant at the top level

// Main component implementation that doesn't directly depend on useAuth
export const Settings = ({ user }: { user: any }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings, isLoading, error } = useQuery<UserSettings>({
    queryKey: [QUERY_KEYS.USER_SETTINGS],
    queryFn: getUserSettings,
  });
  
  // Get theme functions from context
  const { setTheme } = useTheme();
  
  // Get marketing settings to control subscription visibility
  const { 
    showSubscriptionFeatures, 
    showProUpgradeOptions, 
    formattedPrice 
  } = useMarketingSettings();

  // Add query for admin settings with better error and loading handling
  const { 
    data: adminSettings, 
    isLoading: isLoadingAdmin,
    error: adminError 
  } = useQuery({
    queryKey: [QUERY_KEYS.ADMIN_SETTINGS],
    queryFn: getAdminSettings,
    retry: 1
  });

  // Add a separate effect to log admin settings data
  React.useEffect(() => {
    if (adminSettings) {
      console.log("✅ Admin settings loaded successfully:", adminSettings);
    }
  }, [adminSettings]);

  // Add an effect to log any admin query errors
  React.useEffect(() => {
    if (adminError) {
      console.error("Error fetching admin settings:", adminError);
    }
  }, [adminError]);

  // Define a type for subscription payments
  interface SubscriptionPayment {
    id: number;
    user_id: number;
    user_email?: string; // This is added by the API for convenience
    user_name?: string; // This is added by the API for convenience
    amount: number;
    currency: string;
    transaction_id: string | null;
    deposited_by: string;
    deposited_date: number;
    payment_method: string;
    status: string;
    notes?: string | null;
    created_at: number;
    updated_at: number;
  }

  // Add query for all payments
  const { 
    data: payments = [] as SubscriptionPayment[],
    isLoading: isLoadingPayments,
    refetch: refetchPayments
  } = useQuery<SubscriptionPayment[]>({
    queryKey: ['all-payments'],
    queryFn: fetchAllPayments,
    enabled: user?.role === "admin"
  });

  // Add state for payment filter
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all");
  
  // Filter payments based on status
  const filteredPayments = useMemo(() => {
    if (paymentStatusFilter === "all") return payments;
    return payments.filter((payment: SubscriptionPayment) => payment.status === paymentStatusFilter);
  }, [payments, paymentStatusFilter]);

  // Log any errors for debugging
  React.useEffect(() => {
    if (error) {
      console.error("Error fetching settings:", error);
    }
  }, [error]);

  const form = useForm<FormattedUserSettings>({
    resolver: zodResolver(insertUserSettingsSchema),
    defaultValues: {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      work_start_hour: 9,
      work_end_hour: 17,
      theme: "system",
      default_calendar_view: "month",
      show_notifications: true,
      notifications_enabled: true,
      gemini_key: "",
    },
  });



 

  // Helper function to convert a Unix timestamp to a time object
  const unixTimestampToTimeObject = (timestamp: number): { hour: number, minute: number } => {
    // Check if it's a decimal hour value (e.g., 9.5 for 9:30)
    if (timestamp < 100) { // Small numbers are likely hour values, not timestamps
      const hour = Math.floor(timestamp);
      const minute = Math.round((timestamp - hour) * 60);
      return { hour, minute };
    }
    
    // Otherwise treat as a Unix timestamp
    const date = new Date(timestamp * 1000); // Convert seconds to milliseconds
    return {
      hour: date.getHours(),
      minute: date.getMinutes()
    };
  };

  // Update form values when settings are loaded
  React.useEffect(() => {
    if (settings) {
      // Format work hours from Unix timestamps to time objects
      const formattedSettings = { 
        ...settings,
        // Use the timezone from settings or fall back to system timezone
        timezone: settings.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        // Convert work hours to the appropriate format
        work_start_hour: typeof settings.work_start_hour === 'number' 
          ? unixTimestampToTimeObject(settings.work_start_hour)
          : settings.work_start_hour,
        work_end_hour: typeof settings.work_end_hour === 'number' 
          ? unixTimestampToTimeObject(settings.work_end_hour)
          : settings.work_end_hour,
        // Ensure gemini_key is properly set
        gemini_key: settings.gemini_key || "",
      };
      
      form.reset(formattedSettings as FormattedUserSettings);
    }
  }, [settings, form]);
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: FormattedUserSettings) => {
      console.log("🔄 Starting settings update mutation with data:", {
        ...data,
        gemini_key: data.gemini_key ? "[REDACTED]" : data.gemini_key
      });
      
      // Create a clean copy of data, only including fields that are defined
      // This ensures partial updates don't clear other fields
      const userOnlyData: any = {
        id: data.id,
        user_id: data.user_id,
      };
      
      // Only include fields that are actually defined in the data object
      if (data.timezone !== undefined) userOnlyData.timezone = data.timezone;
      if (data.work_start_hour !== undefined) userOnlyData.work_start_hour = data.work_start_hour;
      if (data.work_end_hour !== undefined) userOnlyData.work_end_hour = data.work_end_hour;
      if (data.theme !== undefined) userOnlyData.theme = data.theme;
      if (data.default_calendar_view !== undefined) userOnlyData.default_calendar_view = data.default_calendar_view;
      if (data.show_notifications !== undefined) userOnlyData.show_notifications = data.show_notifications;
      if (data.notifications_enabled !== undefined) userOnlyData.notifications_enabled = data.notifications_enabled;
      if (data.gemini_key !== undefined) userOnlyData.gemini_key = data.gemini_key;
      
      try {
        // Force a small delay to ensure UI has time to update and show loading state
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const result = await updateUserSettings(userOnlyData);
        console.log("✅ Settings update API call successful:", {
          ...result,
          gemini_key: result.gemini_key ? "[REDACTED]" : result.gemini_key
        });
        return result;
      } catch (error) {
        console.error("❌ Settings update API call failed:", error);
        throw error;
      }
    },
    onMutate: async (newSettings) => {
      console.log("🔄 Mutation started, optimistically updating UI...");
      
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.USER_SETTINGS] });
      
      // Snapshot the previous value
      const previousSettings = queryClient.getQueryData<UserSettings>([QUERY_KEYS.USER_SETTINGS]);
      
      // Create a deep copy of the previous settings
      const previousSettingsCopy = previousSettings ? JSON.parse(JSON.stringify(previousSettings)) : null;
      
      // Convert work hours to hour values for the optimistic update
      const optimisticSettings = { ...newSettings };
      
      // Convert time objects to decimal hours for the cache update
      if (optimisticSettings.work_start_hour && 
          typeof optimisticSettings.work_start_hour === 'object' && 
          'hour' in optimisticSettings.work_start_hour) {
        const hour = optimisticSettings.work_start_hour.hour;
        const minute = optimisticSettings.work_start_hour.minute || 0;
        optimisticSettings.work_start_hour = hour + (minute / 60);
      }
      
      if (optimisticSettings.work_end_hour && 
          typeof optimisticSettings.work_end_hour === 'object' && 
          'hour' in optimisticSettings.work_end_hour) {
        const hour = optimisticSettings.work_end_hour.hour;
        const minute = optimisticSettings.work_end_hour.minute || 0;
        optimisticSettings.work_end_hour = hour + (minute / 60);
      }
      
      // Ensure the user_id is preserved for all settings updates
      if (previousSettings?.user_id) {
        optimisticSettings.user_id = previousSettings.user_id;
        console.log("📝 Setting user_id in optimistic update to:", previousSettings.user_id);
      } else {
        console.warn("⚠️ No user_id found in previous settings for optimistic update");
      }
      
      // Optimistically update to the new value
      queryClient.setQueryData<UserSettings>([QUERY_KEYS.USER_SETTINGS], (old) => {
        if (!old) {
          console.warn("⚠️ No existing settings found in cache for optimistic update");
          return old;
        }
        
        // Create a deep copy of the old settings
        const oldCopy = JSON.parse(JSON.stringify(old));
        
        // Ensure work hours are numbers for type compatibility
        const typedOptimisticSettings: UserSettings = {
          ...oldCopy,
          ...optimisticSettings,
          // Ensure these are always numbers
          work_start_hour: typeof optimisticSettings.work_start_hour === 'number' 
            ? optimisticSettings.work_start_hour 
            : oldCopy.work_start_hour,
          work_end_hour: typeof optimisticSettings.work_end_hour === 'number' 
            ? optimisticSettings.work_end_hour 
            : oldCopy.work_end_hour,
          // Preserve the user_id field
          user_id: oldCopy.user_id
        };
        
        console.log("📋 Optimistically updated settings:", {
          ...typedOptimisticSettings,
          gemini_key: typedOptimisticSettings.gemini_key ? "[REDACTED]" : typedOptimisticSettings.gemini_key
        });
        return typedOptimisticSettings;
      });
      
      // Return a context object with the previous settings
      return { previousSettings: previousSettingsCopy };
    },
    onError: (error: any, _variables, context) => {
      console.error("❌ Settings update mutation failed:", error);
      
      // Rollback to previous state if available
      if (context?.previousSettings) {
        console.log("↩️ Rolling back to previous settings due to error");
        queryClient.setQueryData<UserSettings>([QUERY_KEYS.USER_SETTINGS], context.previousSettings);
      }
      
      toast({
        variant: "destructive",
        title: "Failed to update settings",
        description: error.message || "An error occurred while updating your settings.",
      });
    },
    onSuccess: (data) => {
      console.log("✅ Settings update mutation successful, received data:", {
        ...data,
        gemini_key: data.gemini_key ? "[REDACTED]" : data.gemini_key
      });
      
      // Update the cache with the server response
      queryClient.setQueryData<UserSettings>([QUERY_KEYS.USER_SETTINGS], data);
      
      // Also invalidate the query to ensure we have the latest data
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.USER_SETTINGS] });
      
      toast({
        title: "Settings updated",
        description: "Your settings have been updated successfully.",
      });
    },
    onSettled: () => {
      console.log("🏁 Settings mutation settled - either succeeded or failed");
      
      // Ensure loading state is reset - add this explicitly
      setTimeout(() => {
        console.log("🔄 Forcing reset of loading state");
      }, 500);
    }
  })

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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>
            Manage your application settings and preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs 
            defaultValue={
              // Get stored tab from localStorage or fallback to "general"
              typeof window !== "undefined" 
                ? user && user.role === "admin" && localStorage.getItem("settings-active-tab") === "usage"
                  ? "general" // Redirect admins away from usage tab
                  : localStorage.getItem("settings-active-tab") || "general" 
                : "general"
            } 
            className="w-full"
            onValueChange={(value) => {
              // Store selected tab in localStorage
              if (typeof window !== "undefined") {
                localStorage.setItem("settings-active-tab", value);
              }
            }}
          >
            <TabsList className="mb-4">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="api">API Integration</TabsTrigger>
              {/* Only show usage tab when marketing is enabled or user is already Pro */}
              {showSubscriptionFeatures && (!user || user.role !== "admin") && (
                <TabsTrigger value="usage">Usage</TabsTrigger>
              )}
              {/* Only show invoice history tab when marketing is enabled */}
              {showSubscriptionFeatures && (
                <TabsTrigger value="invoices">Invoice History</TabsTrigger>
              )}
              {user && user.role === "admin" && (
                <>
                  <TabsTrigger value="admin">Admin Settings</TabsTrigger>
                  {showSubscriptionFeatures && (
                    <>
                  <TabsTrigger value="plans">Subscription Plans</TabsTrigger>
                  <TabsTrigger value="payments">Payments</TabsTrigger>
                    </>
                  )}
                </>
              )}
            </TabsList>
            
            <Form {...form}>
              {/* Only render usage tab content when marketing is enabled */}
              {showSubscriptionFeatures && (
              <TabsContent value="usage" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">API Usage</CardTitle>
                    <CardDescription>
                      Track your Gemini API usage and limits
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoading || isLoadingAdmin ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                        <p>Loading usage data...</p>
                      </div>
                    ) : settings ? (
                      <div className="space-y-6">
                          {/* Pro Status Section - only show if marketing is enabled or user is already Pro */}
                          {(showSubscriptionFeatures || settings.is_pro) && (
                            <div className="rounded-lg border p-4">
                              {settings.is_pro ? (
                                <div className="flex flex-col space-y-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <ShieldCheck className="h-5 w-5 text-primary" />
                                      <h3 className="font-medium">Pro Subscription Active</h3>
                                    </div>
                                    <Badge variant="default" className="bg-primary">Pro</Badge>
                                  </div>
                                  
                                  <p className="text-sm text-muted-foreground">
                                    You have unlimited access to all AI features.
                                  </p>
                                  
                                  {settings.subscription_start_date && settings.subscription_end_date && (
                                    <div className="mt-2 bg-accent/30 p-3 rounded-md">
                                      <div className="text-sm">
                                        <span className="font-medium">Started:</span> {new Date(settings.subscription_start_date * 1000).toLocaleDateString()}
                                      </div>
                                      <div className="text-sm">
                                        <span className="font-medium">Expires:</span> {new Date(settings.subscription_end_date * 1000).toLocaleDateString()}
                                      </div>
                                      <div className="text-sm mt-1">
                                        <span className="font-medium">Status:</span> {
                                          settings.subscription_end_date > Math.floor(Date.now() / 1000) 
                                            ? 'Active' 
                                            : 'Expired'
                                        }
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : showProUpgradeOptions ? (
                                <div className="flex flex-col space-y-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <CreditCard className="h-5 w-5 text-muted-foreground" />
                                      <h3 className="font-medium">Free Plan</h3>
                                    </div>
                                    <Badge variant="outline">Free</Badge>
                                  </div>
                                  
                                  <p className="text-sm text-muted-foreground">
                                    You're currently on the free plan with limited AI usage.
                                  </p>
                                  
                                  <Button 
                                    variant="default" 
                                    className="w-full mt-2"
                                    onClick={() => {
                                      window.location.href = "/upgrade";
                                    }}
                                  >
                                    Upgrade to Pro
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex flex-col space-y-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <CreditCard className="h-5 w-5 text-muted-foreground" />
                                      <h3 className="font-medium">Free Plan</h3>
                                    </div>
                                    <Badge variant="outline">Free</Badge>
                                  </div>
                                  
                                  <p className="text-sm text-muted-foreground">
                                    You're currently on the free plan with limited AI usage.
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                        {/* Usage Statistics - always show */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-medium">Gemini API Calls</h3>
                              <p className="text-sm text-muted-foreground">
                                  {settings.is_pro 
                                    ? "Unlimited access with Pro subscription" 
                                    : `${settings.gemini_calls_count || 0} of ${adminSettings?.gemini_max_free_calls || 5} free calls used`}
                              </p>
                            </div>
                            <Badge 
                              variant={
                                  settings.is_pro
                                    ? "default"
                                    : (settings.gemini_calls_count || 0) >= (adminSettings?.gemini_max_free_calls || 5) 
                                  ? "destructive" 
                                  : (settings.gemini_calls_count || 0) > (adminSettings?.gemini_max_free_calls || 5) * 0.8 
                                    ? "secondary" 
                                    : "outline"
                              }
                            >
                                {settings.is_pro 
                                  ? "Unlimited" 
                                  : `${settings.gemini_calls_count || 0}/${adminSettings?.gemini_max_free_calls || 5}`}
                            </Badge>
                          </div>
                          
                            {/* Only show progress bar for free users */}
                            {!settings.is_pro && (
                              <div className="w-full bg-muted rounded-full h-2.5">
                                <div 
                                  className={`h-2.5 rounded-full ${
                                  (settings.gemini_calls_count || 0) >= (adminSettings?.gemini_max_free_calls || 5) 
                                      ? 'bg-destructive'
                                      : 'bg-primary'
                                }`}
                                style={{
                                  width: `${Math.min(
                                    ((settings.gemini_calls_count || 0) / (adminSettings?.gemini_max_free_calls || 5)) * 100,
                                    100
                                  )}%`
                                }}
                                ></div>
                            </div>
                            )}
                        </div>
                        
                          {/* API Key Info */}
                          <div className="space-y-2">
                            <h3 className="font-medium">API Integration</h3>
                            {settings.gemini_key ? (
                              <div className="flex justify-between items-center bg-accent/30 p-3 rounded-md">
                                <div>
                                  <p className="text-sm">You're using your own Gemini API key</p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Your own API key lets you bypass usage limits
                                  </p>
                                </div>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => {
                                    // You can set up a tab navigation system here
                                    localStorage.setItem('selectedSettingsTab', 'api');
                                    // Refresh or redirect
                                    window.location.reload();
                                  }}
                                >
                                  Manage API Key
                              </Button>
                          </div>
                        ) : (
                              <div className="flex justify-between items-center bg-accent/30 p-3 rounded-md">
                                <div>
                                  <p className="text-sm">No API key configured</p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Add your own Gemini API key to avoid usage limits
                                  </p>
                                </div>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => {
                                    // You can set up a tab navigation system here
                                    localStorage.setItem('selectedSettingsTab', 'api');
                                    // Refresh or redirect
                                    window.location.reload();
                                  }}
                                >
                                  Add API Key
                                </Button>
                          </div>
                        )}
                          </div>
                      </div>
                    ) : (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Error loading settings</AlertTitle>
                        <AlertDescription>
                            Unable to load your settings. Please try refreshing the page.
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              )}

              {/* Only render usage tab content when marketing is enabled */}
              {showSubscriptionFeatures && (
                <TabsContent value="invoices" className="space-y-6">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">Invoice History</CardTitle>
                        <CardDescription>
                          View your subscription payment history and receipts
                        </CardDescription>
                      </div>
                      <div className="bg-primary/10 text-primary p-3 rounded-full">
                        <Receipt className="h-5 w-5" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 rounded-lg p-4 mb-6">
                        <div className="flex items-start gap-3">
                          <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                          <div>
                            <h3 className="font-medium text-blue-800 dark:text-blue-300">Subscription Details</h3>
                            {settings?.is_pro ? (
                              <div className="text-sm text-blue-700 dark:text-blue-400 mt-1 space-y-1">
                                <p>You have an active Pro subscription that gives you unlimited access to all features.</p>
                                {settings.subscription_end_date && (
                                  <p>Your subscription is valid until <span className="font-medium">{new Date(settings.subscription_end_date * 1000).toLocaleDateString()}</span>.</p>
                                )}
                                <div className="pt-1">
                                  <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">Pro Plan</Badge>
                                </div>
                              </div>
                            ) : (
                              <div className="text-sm text-blue-700 dark:text-blue-400 mt-1 space-y-1">
                                <p>You're currently on the free plan with limited access to premium features.</p>
                                {showProUpgradeOptions && (
                                  <Button 
                                    variant="default" 
                                    size="sm"
                                    className="mt-2"
                                    onClick={() => window.location.href = "/upgrade"}
                                  >
                                    <CreditCard className="h-4 w-4 mr-2" />
                                    Upgrade to Pro
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {settings?.is_pro && (
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-base font-medium">Payment Records</h3>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="text-muted-foreground"
                            onClick={() => window.location.href = "/upgrade"}
                          >
                            <DollarSign className="h-4 w-4 mr-2" />
                            Make Payment
                          </Button>
                        </div>
                      )}
                      
                      {/* Fetch user payment history on tab load */}
                      <PaymentHistoryTable userId={user?.id} />
                    </CardContent>
                  </Card>
                </TabsContent>
              )}

              <TabsContent value="general" className="space-y-6">
                <form
                  id="general-settings-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    console.log("🔄 General form submit triggered");
                    
                    // Get only the general tab fields
                    const formValues = {
                      timezone: form.getValues("timezone"),
                      work_start_hour: form.getValues("work_start_hour"),
                      work_end_hour: form.getValues("work_end_hour"),
                      theme: form.getValues("theme"),
                      default_calendar_view: form.getValues("default_calendar_view"),
                    };
                    
                    console.log("📋 General settings form values:", formValues);
                    
                    // Create a formatted data object with only general settings, ensuring no admin properties are included
                    const formattedData: Partial<FormattedUserSettings> = { 
                      ...formValues,
                      id: settings?.id,
                      user_id: settings?.user_id 
                    };
                    
                    // Define callbacks for tracking the state
                    const callbacks = {
                      onSuccess: () => {
                        console.log("✅ General settings saved successfully");
                      },
                      onError: (error: any) => {
                        console.error("❌ Error saving general settings:", error);
                      }
                    };
                    
                    updateSettingsMutation.mutate(formattedData as FormattedUserSettings, callbacks);
                  }}
                  className="space-y-6"
                >
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
                    </CardContent>
                  </Card>
                  
                  <div className="flex justify-end mt-6">
                    <Button
                      type="submit"
                      disabled={updateSettingsMutation.isPending}
                      className="gap-2"
                    >
                      {updateSettingsMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          <span>Save General Settings</span>
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </TabsContent>

              {/* Notifications */}
              <TabsContent value="notifications">
                <form
                  id="notifications-settings-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    console.log("🔄 Notifications form submit triggered");
                    
                    // Get only notification fields
                    const formValues = {
                      notifications_enabled: form.getValues("notifications_enabled"),
                      show_notifications: form.getValues("show_notifications"),
                    };
                    
                    console.log("📋 Notifications form values:", formValues);
                    
                    // Create a formatted data object with only notification settings, ensuring no admin properties
                    const formattedData: Partial<FormattedUserSettings> = { 
                      ...formValues,
                      id: settings?.id,
                      user_id: settings?.user_id 
                    };
                    
                    // Define callbacks for tracking the state
                    const callbacks = {
                      onSuccess: () => {
                        console.log("✅ Notification settings saved successfully");
                      },
                      onError: (error: any) => {
                        console.error("❌ Error saving notification settings:", error);
                      }
                    };
                    
                    updateSettingsMutation.mutate(formattedData as FormattedUserSettings, callbacks);
                  }}
                  className="space-y-6"
                >
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
                                onCheckedChange={(checked) => {
                                  field.onChange(checked);
                                  // Update form value but don't call API or show toast
                                }}
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
                                onCheckedChange={(checked) => {
                                  field.onChange(checked);
                                  // Update form value but don't call API or show toast
                                }}
                                disabled={!form.watch("notifications_enabled")}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-end mt-6">
                    <Button
                      type="submit"
                      disabled={updateSettingsMutation.isPending}
                      className="gap-2"
                    >
                      {updateSettingsMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          <span>Save Notification Settings</span>
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </TabsContent>
                
              {/* AI Integration Section */}
              <TabsContent value="api">
                <form
                  id="api-settings-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    console.log("🔄 API form submit triggered");
                    
                    // Get only API integration fields
                    const formValues = {
                      gemini_key: form.getValues("gemini_key"),
                    };
                    
                    console.log("📋 API form values:", {
                      ...formValues,
                      gemini_key: formValues.gemini_key ? "[REDACTED]" : formValues.gemini_key
                    });
                    
                    // Create a formatted data object with only API settings, ensuring no admin properties
                    const formattedData: Partial<FormattedUserSettings> = { 
                      ...formValues,
                      id: settings?.id,
                      user_id: settings?.user_id 
                    };
                    
                    // Define callbacks for tracking the state
                    const callbacks = {
                      onSuccess: () => {
                        console.log("✅ API settings saved successfully");
                      },
                      onError: (error: any) => {
                        console.error("❌ Error saving API settings:", error);
                      }
                    };
                    
                    updateSettingsMutation.mutate(formattedData as FormattedUserSettings, callbacks);
                  }}
                  className="space-y-6"
                >
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Key className="h-5 w-5 text-primary" />
                      <h3 className="text-lg font-medium">AI Integration</h3>
                    </div>
                    <Separator className="my-2" />
                    
                    <FormField
                      control={form.control}
                      name="gemini_key"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gemini API Key</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="Enter your Gemini API key"
                              {...field}
                              value={field.value || ""}
                              onChange={(e) => {
                                console.log("🔑 Gemini key changed:", e.target.value ? "[REDACTED]" : "[EMPTY]");
                                field.onChange(e.target.value);
                              }}
                            />
                          </FormControl>
                          <FormDescription>
                            Enter your Gemini API key to use for generating subtasks and content. 
                            You can get a key from <a href="https://ai.google.dev/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google AI Studio</a>.
                          </FormDescription>
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="flex justify-end mt-6">
                    <Button
                      type="submit"
                      disabled={updateSettingsMutation.isPending}
                      className="gap-2"
                    >
                      {updateSettingsMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          <span>Save API Settings</span>
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </TabsContent>
                
              {/* Admin Settings */}
              <TabsContent value="admin" className="space-y-6">
                {!user || user.role !== "admin" ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Access Denied</AlertTitle>
                    <AlertDescription>
                      You don't have permission to access admin settings.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-lg p-4 mb-4">
                      <div className="flex items-start gap-3">
                        <ShieldCheck className="h-6 w-6 text-amber-600 dark:text-amber-400 mt-0.5" />
                        <div>
                          <h3 className="font-medium text-amber-800 dark:text-amber-300">Admin Settings</h3>
                          <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                            These settings control subscription features and marketing capabilities.
                            Changes here affect all users in the system.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Loading state */}
                    {isLoadingAdmin && (
                      <div className="flex items-center justify-center py-8">
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          <p className="text-muted-foreground">Loading admin settings...</p>
                        </div>
                      </div>
                    )}

                    {/* Error state */}
                    {adminError && !isLoadingAdmin && (
                      <Alert variant="destructive" className="mb-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error loading admin settings</AlertTitle>
                        <AlertDescription>
                          {adminError instanceof Error 
                            ? adminError.message 
                            : "There was an error loading the admin settings. Please try again."}
                        </AlertDescription>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-2"
                          onClick={() => queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN_SETTINGS] })}
                        >
                          Retry
                        </Button>
                      </Alert>
                    )}

                    {/* Admin form - only show when not loading and no errors */}
                    {!isLoadingAdmin && !adminError && (
                    
                        <div className="grid gap-4 md:grid-cols-1">
                          <AdminSettingsForm />
                        </div>
                        
                    )}
                  </>
                )}
              </TabsContent>

              {/* Only render subscription plan tab if marketing features are enabled */}
              {showSubscriptionFeatures && (
              <TabsContent value="plans" className="space-y-6">
                {!user || user.role !== "admin" ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Access Denied</AlertTitle>
                    <AlertDescription>
                      You don't have permission to access subscription plans.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 rounded-lg p-4 mb-4">
                      <div className="flex items-start gap-3">
                        <PackageOpen className="h-6 w-6 text-blue-600 dark:text-blue-400 mt-0.5" />
                        <div>
                          <h3 className="font-medium text-blue-800 dark:text-blue-300">Subscription Plans Management</h3>
                          <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                            Create and manage subscription plans that users can purchase. 
                            Define pricing, duration, and features for each plan.
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Use the AdminPlanManager component */}
                    <AdminPlanManager />
                  </>
                )}
              </TabsContent>
              )}

              {/* Only render payments tab if marketing features are enabled */}
              {showSubscriptionFeatures && (
              <TabsContent value="payments" className="space-y-6">
                {!user || user.role !== "admin" ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Access Denied</AlertTitle>
                    <AlertDescription>
                      You don't have permission to access payment records.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <Card className="overflow-hidden shadow-sm">
                      <CardHeader className="bg-muted/50 pb-3">
                        <CardTitle className="text-base">Subscription Payments</CardTitle>
                        <CardDescription>
                          Manage subscription payments from users
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-4">
                        {/* Add status filter */}
                        <div className="flex mb-4 space-x-2">
                          <Button 
                            variant={paymentStatusFilter === "all" ? "default" : "outline"} 
                            size="sm"
                            onClick={() => setPaymentStatusFilter("all")}
                          >
                            All
                          </Button>
                          <Button 
                            variant={paymentStatusFilter === "pending" ? "default" : "outline"} 
                            size="sm"
                            onClick={() => setPaymentStatusFilter("pending")}
                          >
                            Pending
                          </Button>
                          <Button 
                            variant={paymentStatusFilter === "approved" ? "default" : "outline"} 
                            size="sm"
                            onClick={() => setPaymentStatusFilter("approved")}
                          >
                            Approved
                          </Button>
                          <Button 
                            variant={paymentStatusFilter === "rejected" ? "default" : "outline"} 
                            size="sm"
                            onClick={() => setPaymentStatusFilter("rejected")}
                          >
                            Rejected
                          </Button>
                        </div>

                        {isLoadingPayments ? (
                          <div className="flex items-center justify-center py-6">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          </div>
                        ) : filteredPayments.length === 0 ? (
                          <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>No payments found</AlertTitle>
                            <AlertDescription>
                              {paymentStatusFilter === "all" 
                                ? "There are no subscription payments to review at this time."
                                : `There are no ${paymentStatusFilter} subscription payments to review at this time.`}
                            </AlertDescription>
                          </Alert>
                        ) : (
                          <div className="rounded-md border">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {filteredPayments.map((payment) => (
                                    <TableRow key={payment.id}>
                                      <TableCell>
                                        <div className="font-medium">{payment.user_name || "Unknown"}</div>
                                        <div className="text-sm text-muted-foreground">{payment.user_email || ""}</div>
                                      </TableCell>
                                      <TableCell>
                                        {new Date(payment.deposited_date * 1000).toLocaleDateString()}
                                      </TableCell>
                                      <TableCell>
                                        {payment.currency === 'USD' ? '$' : ''}{payment.amount} {payment.currency !== 'USD' ? payment.currency : ''}
                                      </TableCell>
                                      <TableCell>
                                        <Badge variant={
                                          payment.status === 'approved' ? 'default' : 
                                          payment.status === 'rejected' ? 'destructive' : 
                                          'outline'
                                        }>
                                          {payment.status}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {payment.status === 'pending' && (
                                          <div className="flex justify-end gap-2">
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => {
                                                if (confirm("Are you sure you want to approve this payment?")) {
                                                  approvePayment(payment.id)
                                                    .then(() => {
                                                      toast({
                                                        title: "Payment approved",
                                                        description: "The payment has been approved successfully."
                                                      });
                                                      refetchPayments();
                                                    })
                                                    .catch(error => {
                                                      console.error("Error approving payment:", error);
                                                      toast({
                                                        title: "Error",
                                                        description: "Failed to approve payment. Please try again.",
                                                        variant: "destructive"
                                                      });
                                                    });
                                                }
                                              }}
                                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                            >
                                              Approve
                                            </Button>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => {
                                                const reason = prompt("Enter a reason for rejection (optional):");
                                                if (reason !== null) {
                                                  rejectPayment(payment.id, reason)
                                                    .then(() => {
                                                      toast({
                                                        title: "Payment rejected",
                                                        description: "The payment has been rejected successfully."
                                                      });
                                                      refetchPayments();
                                                    })
                                                    .catch(error => {
                                                      console.error("Error rejecting payment:", error);
                                                      toast({
                                                        title: "Error",
                                                        description: "Failed to reject payment. Please try again.",
                                                        variant: "destructive"
                                                      });
                                                    });
                                                }
                                              }}
                                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                            >
                                              Reject
                                            </Button>
                                          </div>
                                        )}
                                        {payment.status !== 'pending' && (
                                          <div className="text-sm text-muted-foreground">
                                            {payment.status === 'approved' ? 'Approved' : 'Rejected'}
                                          </div>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                          </div>
                        )}
                        
                        <div className="flex justify-end mt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => refetchPayments()}
                            disabled={isLoadingPayments}
                          >
                            {isLoadingPayments ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <span>Refresh</span>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </TabsContent>
              )}
            </Form>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

// Payment History Table Component
const PaymentHistoryTable = ({ userId }: { userId?: number }) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);

  useEffect(() => {
    if (!userId) return;

    const fetchPaymentHistory = async () => {
      setIsLoading(true);
      try {
        const data = await getUserPaymentHistory(userId);
        setPayments(data || []);
      } catch (error) {
        console.error("Error fetching payment history:", error);
        toast({
          title: "Error",
          description: "Failed to load your payment history. Please try again.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchPaymentHistory();
  }, [userId, toast]);

  const sortedPayments = useMemo(() => {
    return [...payments].sort((a, b) => b.deposited_date - a.deposited_date);
  }, [payments]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
        <p>Loading your payment history...</p>
      </div>
    );
  }

  if (!userId) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>User information not available</AlertTitle>
        <AlertDescription>
          Please refresh the page or try logging in again.
        </AlertDescription>
      </Alert>
    );
  }

  if (sortedPayments.length === 0) {
    return (
      <div className="py-6 text-center">
        <div className="mb-4 flex justify-center">
          <div className="rounded-full bg-muted p-3">
            <Receipt className="h-6 w-6 text-muted-foreground" />
          </div>
        </div>
        <h3 className="font-medium">No payment history found</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          You don't have any subscription payments in your history yet.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Payment Method</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedPayments.map((payment) => (
            <TableRow key={payment.id}>
              <TableCell>
                {new Date(payment.deposited_date * 1000).toLocaleDateString()}
              </TableCell>
              <TableCell>
                {payment.currency === 'USD' ? '$' : ''}{payment.amount} {payment.currency !== 'USD' ? payment.currency : ''}
              </TableCell>
              <TableCell>
                {payment.payment_method || 'Bank Transfer'}
              </TableCell>
              <TableCell>
                <Badge variant={
                  payment.status === 'approved' ? 'default' : 
                  payment.status === 'rejected' ? 'destructive' : 
                  'outline'
                }>
                  {payment.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};


