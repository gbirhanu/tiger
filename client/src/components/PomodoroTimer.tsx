import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { getPomodoroSettings, updatePomodoroSettings } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Play, Pause, RotateCcw, Loader2, Settings, AlertCircle } from "lucide-react";
import { PomodoroSettings } from "@shared/schema";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type TimerState = "work" | "break" | "longBreak";

// Create a validation schema for Pomodoro settings
const formSchema = z.object({
  work_duration: z.number()
    .int()
    .min(1, { message: "Work duration must be at least 1 minute" })
    .max(120, { message: "Work duration cannot exceed 120 minutes" }),
  break_duration: z.number()
    .int()
    .min(1, { message: "Break duration must be at least 1 minute" })
    .max(60, { message: "Break duration cannot exceed 60 minutes" }),
  long_break_duration: z.number()
    .int()
    .min(1, { message: "Long break duration must be at least 1 minute" })
    .max(120, { message: "Long break duration cannot exceed 120 minutes" }),
  sessions_before_long_break: z.number()
    .int()
    .min(1, { message: "Must complete at least 1 session before a long break" })
    .max(10, { message: "Cannot exceed 10 sessions before a long break" }),
});

type PomodoroSettingsPartial = z.infer<typeof formSchema>;

const DEFAULT_SETTINGS: PomodoroSettingsPartial = {
  work_duration: 25,
  break_duration: 5,
  long_break_duration: 15,
  sessions_before_long_break: 4,
};

export default function PomodoroTimer() {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_SETTINGS.work_duration * 60);
  const [timerState, setTimerState] = useState<TimerState>("work");
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);

  // Get pomodoro settings from the server
  const { data: settings, isLoading: isLoadingSettings, error: settingsError } = useQuery({
    queryKey: ["settings", "pomodoro"],
    queryFn: getPomodoroSettings,
  });

  React.useEffect(() => {
    if (settingsError) {
      console.error("Failed to fetch pomodoro settings:", settingsError);
      toast({
        title: "Error fetching settings",
        description: "Could not load your settings. Using defaults instead.",
        variant: "destructive",
      });
    }
  }, [settingsError, toast]);

  // Initialize form with settings or defaults
  const form = useForm<PomodoroSettingsPartial>({
    resolver: zodResolver(formSchema),
    defaultValues: DEFAULT_SETTINGS,
  });

  // Set form values when settings load
  useEffect(() => {
    if (settings) {
      form.reset({
        work_duration: settings.work_duration,
        break_duration: settings.break_duration,
        long_break_duration: settings.long_break_duration,
        sessions_before_long_break: settings.sessions_before_long_break,
      });
    }
  }, [settings, form]);

  // Reset timer when settings change
  useEffect(() => {
    if (!isRunning && settings) {
      // Reset timer based on current state
      if (timerState === 'work') {
        setTimeLeft(settings.work_duration * 60);
      } else if (timerState === 'break') {
        setTimeLeft(settings.break_duration * 60);
      } else {
        setTimeLeft(settings.long_break_duration * 60);
      }
    }
  }, [settings, isRunning, timerState]);

  const updateSettings = useMutation({
    mutationFn: (data: PomodoroSettingsPartial) => {
      // The sanitization now happens in the API function itself
      // We'll just pass the numeric values here
      const cleanData = {
        work_duration: Number(data.work_duration),
        break_duration: Number(data.break_duration),
        long_break_duration: Number(data.long_break_duration),
        sessions_before_long_break: Number(data.sessions_before_long_break)
      };
      
      console.log("Calling updatePomodoroSettings with:", cleanData);
      return updatePomodoroSettings(cleanData);
    },
    onSuccess: (data) => {
      console.log("Settings update successful:", data);
      
      // Update timer immediately if not running
      if (!isRunning) {
        if (timerState === 'work') {
          setTimeLeft(data.work_duration * 60);
        } else if (timerState === 'break') {
          setTimeLeft(data.break_duration * 60);
        } else {
          setTimeLeft(data.long_break_duration * 60);
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ["settings", "pomodoro"] });
      setIsSettingsDialogOpen(false);
      toast({
        title: "Settings Updated",
        description: "Your Pomodoro timer settings have been updated successfully.",
      });
    },
    onError: (error: any) => {
      console.error("Failed to update pomodoro settings:", error);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message || "An error occurred while updating your settings. Please try again.",
      });
    },
  });

  const onSubmit = (data: PomodoroSettingsPartial) => {
    try {
      // Simplify validation - just ensure we have positive integers within bounds
      const validatedData = {
        work_duration: Math.max(1, Math.min(120, Math.floor(Number(data.work_duration) || 25))),
        break_duration: Math.max(1, Math.min(60, Math.floor(Number(data.break_duration) || 5))),
        long_break_duration: Math.max(1, Math.min(120, Math.floor(Number(data.long_break_duration) || 15))),
        sessions_before_long_break: Math.max(1, Math.min(10, Math.floor(Number(data.sessions_before_long_break) || 4))),
      };
      
      // Submit the data - API will handle further sanitization
      updateSettings.mutate(validatedData);
    } catch (error: any) {
      console.error("Error processing form data:", error);
      toast({
        variant: "destructive",
        title: "Invalid Input",
        description: "Please make sure all fields contain valid numbers.",
      });
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => time - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsRunning(false);
      if (timerState === "work") {
        const newSessionsCompleted = sessionsCompleted + 1;
        setSessionsCompleted(newSessionsCompleted);
        
        if (settings && newSessionsCompleted % settings.sessions_before_long_break === 0) {
          setTimerState("longBreak");
          setTimeLeft(settings.long_break_duration * 60);
        } else {
          setTimerState("break");
          setTimeLeft((settings?.break_duration || 5) * 60);
        }
      } else {
        setTimerState("work");
        setTimeLeft((settings?.work_duration || 25) * 60);
      }
      
      toast({
        title: `${timerState === "work" ? "Break" : "Work"} time!`,
        description: `Time to ${timerState === "work" ? "take a break" : "focus"}!`,
      });
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, timeLeft, timerState, settings, sessionsCompleted]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getMaxTime = () => {
    const currentSettings = settings || DEFAULT_SETTINGS;
    switch (timerState) {
      case "work":
        return currentSettings.work_duration * 60;
      case "break":
        return currentSettings.break_duration * 60;
      case "longBreak":
        return currentSettings.long_break_duration * 60;
    }
  };

  const progress = (timeLeft / getMaxTime()) * 100;

  // Show loading state
  if (isLoadingSettings) {
    return (
      <Card className="w-full max-w-2xl mx-auto shadow-lg">
        <CardContent className="py-12 flex flex-col items-center">
          <Loader2 className="h-12 w-12 animate-spin mb-6 text-primary" />
          <p className="text-lg font-medium">Loading timer settings...</p>
        </CardContent>
      </Card>
    );
  }

  // Determine the current timer theme colors
  const timerTheme = {
    work: {
      primary: 'rgba(124, 58, 237, 1)', // Purple for work/focus (Violet-600)
      secondary: 'rgba(124, 58, 237, 0.15)',
      border: 'border-violet-600',
      progress: 'bg-violet-600',
      shadow: 'shadow-violet-600/20',
    },
    break: {
      primary: 'rgba(16, 185, 129, 1)', // Green for break
      secondary: 'rgba(16, 185, 129, 0.15)',
      border: 'border-emerald-500',
      progress: 'bg-emerald-500',
      shadow: 'shadow-emerald-500/20',
    },
    longBreak: {
      primary: 'rgba(79, 70, 229, 1)', // Indigo for long break
      secondary: 'rgba(79, 70, 229, 0.15)',
      border: 'border-indigo-600',
      progress: 'bg-indigo-600',
      shadow: 'shadow-indigo-600/20',
    }
  };

  // Get the current theme based on timer state
  const currentTheme = timerTheme[timerState];

  return (
    <div className="space-y-6 w-full max-w-2xl mx-auto">
      {settingsError && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load your timer settings. Using default values.
          </AlertDescription>
        </Alert>
      )}
      
      <Card className={`shadow-xl hover:shadow-2xl transition-all duration-300 ${currentTheme.shadow} overflow-hidden`}>
        {/* Top colored bar that reflects current timer state */}
        <div 
          className="h-3" 
          style={{ backgroundColor: currentTheme.primary }}
        />
        
        {/* Timer state indicator */}
        <div className="flex justify-center -mt-3">
          <div 
            className={`px-4 py-1 rounded-full text-sm font-medium text-white`}
            style={{ backgroundColor: currentTheme.primary }}
          >
            {timerState === "work" ? "Focus Time" : timerState === "break" ? "Short Break" : "Long Break"}
          </div>
        </div>

        <CardContent className="pt-6 pb-8 flex flex-col items-center">
          {/* Session indicator */}
          <div className="mb-2 text-md text-muted-foreground">
            Session {sessionsCompleted + 1} / {settings?.sessions_before_long_break || DEFAULT_SETTINGS.sessions_before_long_break}
          </div>

          {/* Main timer display */}
          <div 
            className="text-8xl font-bold mb-8 tracking-tighter relative"
            style={{ color: currentTheme.primary }}
          >
            {formatTime(timeLeft)}
            
            {/* Progress circle around timer */}
            <div 
              className="absolute inset-0 w-full h-full rounded-full -z-10" 
              style={{ 
                backgroundColor: currentTheme.secondary,
                padding: '0.75rem'
              }}
            />
          </div>
          
          {/* Progress bar */}
          <div className="w-full h-4 bg-muted rounded-full mb-8 relative overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-500 ease-in-out"
              style={{ 
                width: `${progress}%`,
                backgroundColor: currentTheme.primary
              }}
            />
          </div>
          
          {/* Controls */}
          <div className="flex gap-4 mb-6 justify-center">
            <Button
              onClick={() => setIsRunning(!isRunning)}
              size="lg"
              variant={isRunning ? "destructive" : "default"}
              className={`w-32 h-12 text-lg ${isRunning ? '' : 'bg-opacity-90 hover:bg-opacity-100'}`}
              style={{ 
                backgroundColor: isRunning ? undefined : currentTheme.primary,
                borderColor: isRunning ? undefined : currentTheme.primary
              }}
            >
              {isRunning ? (
                <><Pause className="h-5 w-5 mr-2" /> Pause</>
              ) : (
                <><Play className="h-5 w-5 mr-2" /> Start</>
              )}
            </Button>
            <Button
              onClick={() => {
                setIsRunning(false);
                setTimeLeft(getMaxTime());
              }}
              size="lg"
              variant="outline"
              className="w-28 h-12"
            >
              <RotateCcw className="h-5 w-5 mr-2" /> Reset
            </Button>
            <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="lg" variant="outline" className="w-28 h-12">
                  <Settings className="h-5 w-5 mr-2" /> Setup
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-xl">Pomodoro Settings</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-5 py-4"
                  >
                    <FormField
                      control={form.control}
                      name="work_duration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base">Work Duration (minutes)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              {...field} 
                              value={field.value}
                              onChange={e => field.onChange(parseInt(e.target.value, 10) || 1)}
                              min={1}
                              max={120}
                              className="text-base" 
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="break_duration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base">Break Duration (minutes)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              {...field} 
                              value={field.value}
                              onChange={e => field.onChange(parseInt(e.target.value, 10) || 1)}
                              min={1}
                              max={60}
                              className="text-base" 
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="long_break_duration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base">Long Break Duration (minutes)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              {...field} 
                              value={field.value}
                              onChange={e => field.onChange(parseInt(e.target.value, 10) || 1)}
                              min={1}
                              max={120}
                              className="text-base" 
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="sessions_before_long_break"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base">Sessions Before Long Break</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              {...field} 
                              value={field.value}
                              onChange={e => field.onChange(parseInt(e.target.value, 10) || 1)}
                              min={1}
                              max={10}
                              className="text-base" 
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-between pt-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setIsSettingsDialogOpen(false)}
                        disabled={updateSettings.isPending}
                        className="w-28"
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={updateSettings.isPending}
                        className="w-28"
                      >
                        {updateSettings.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          "Save Settings"
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
          
          {/* Additional info */}
          <div className="text-center text-sm text-muted-foreground max-w-md">
            {timerState === "work" 
              ? "Focus on your task. Stay in the zone." 
              : timerState === "break" 
                ? "Take a short break. Stretch or relax your eyes."
                : "Take a longer break. Get up and move around."
            }
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
