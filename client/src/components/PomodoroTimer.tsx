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
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { getPomodoroSettings, updatePomodoroSettings } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Play, Pause, RotateCcw, Loader2, Settings as SettingsIcon, AlertCircle, Coffee, Brain, Moon, CheckCircle2, Volume2, VolumeX, Bell, Flame } from "lucide-react";
import { PomodoroSettings } from "@shared/schema";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { motion, AnimatePresence } from "framer-motion";

// Asset paths
const NOTIFICATION_SOUND_PATH = "/assets/bell_not.wav";
const APP_LOGO_PATH = "/assets/tiger_logo.png"; // Updated path to the tiger logo in assets folder

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

// Motivational quotes for different timer states
const MOTIVATIONAL_QUOTES = {
  work: [
    "Stay focused, stay strong!",
    "Deep work leads to great results.",
    "One focused session at a time.",
    "Your future self will thank you for this focus.",
    "Concentration is the secret of strength.",
  ],
  break: [
    "Take a moment to breathe and relax.",
    "Short breaks improve long-term productivity.",
    "Rest is as important as work.",
    "Recharge your mental batteries.",
    "A quick break now means better focus later.",
  ],
  longBreak: [
    "You've earned this longer break!",
    "Take time to stretch and move around.",
    "Great job completing your sessions!",
    "Rest well to work better.",
    "Celebrate your progress so far!",
  ],
};

export default function PomodoroTimer() {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_SETTINGS.work_duration * 60);
  const [timerState, setTimerState] = useState<TimerState>("work");
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showCompletionAnimation, setShowCompletionAnimation] = useState(false);
  
  // Get a random motivational quote based on the current timer state
  const getRandomQuote = () => {
    const quotes = MOTIVATIONAL_QUOTES[timerState];
    return quotes[Math.floor(Math.random() * quotes.length)];
  };
  
  const [motivationalQuote, setMotivationalQuote] = useState(() => getRandomQuote());
  
  // Update the quote when timer state changes
  useEffect(() => {
    setMotivationalQuote(getRandomQuote());
  }, [timerState]);
  
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    typeof Notification !== 'undefined' && Notification.permission === "granted"
  );

  // Request notification permission
  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      toast({
        title: "Notifications not supported",
        description: "Your browser doesn't support desktop notifications",
        variant: "destructive",
      });
      return false;
    }
    
    if (Notification.permission === "granted") {
      return true;
    }
    
    if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission();
      return permission === "granted";
    }
    
    return false;
  };

  // Show desktop notification
  const showNotification = React.useCallback((title: string, body: string) => {
    if (!notificationsEnabled) return;
    
    if (Notification.permission === "granted") {
      const notification = new Notification(title, {
        body: body,
        icon: APP_LOGO_PATH,
      });
      
      // Auto close after 5 seconds
      setTimeout(() => notification.close(), 5000);
      
      // Handle click on notification
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    }
  }, [notificationsEnabled]);

  // Request notification permission on component mount
  useEffect(() => {
    if (notificationsEnabled) {
      requestNotificationPermission();
    }
  }, []);

  // Get pomodoro settings from the server
  const { data: settings, isLoading: isLoadingSettings, error: settingsError } = useQuery({
    queryKey: ["settings", "pomodoro"],
    queryFn: getPomodoroSettings,
  });

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
    // Only reset timer when settings change or when explicitly reset (not when pausing)
    if (!isRunning && !isPaused && settings) {
      if (timerState === 'work') {
        setTimeLeft(settings.work_duration * 60);
      } else if (timerState === 'break') {
        setTimeLeft(settings.break_duration * 60);
      } else {
        setTimeLeft(settings.long_break_duration * 60);
      }
    }
  }, [settings, isRunning, isPaused, timerState]);

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

  // Play sound effect based on timer state
  const playSound = React.useCallback((type: 'work' | 'break' | 'longBreak') => {
    if (!soundEnabled) return;
    
    try {
      const audio = new Audio(NOTIFICATION_SOUND_PATH);
      audio.volume = 0.7; // Set volume to 70%
      
      // Preload the audio
      audio.load();
      
      // Play the sound with better error handling
      const playPromise = audio.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log(`Successfully played ${type} sound notification`);
          })
          .catch(error => {
            console.error("Error playing sound:", error);
            toast({
              title: "Sound Playback Error",
              description: "Could not play notification sound. Check your browser settings.",
              variant: "destructive",
            });
          });
      }
    } catch (error) {
      console.error("Error creating audio object:", error);
    }
  }, [soundEnabled, toast]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    // Only start the timer if isRunning is true and there's time left
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => time - 1);
      }, 1000);
    } 
    // Handle timer completion
    else if (timeLeft === 0) {
      setIsRunning(false);
      
      // Show completion animation
      setShowCompletionAnimation(true);
      setTimeout(() => setShowCompletionAnimation(false), 3000);
      
      if (timerState === "work") {
        const newSessionsCompleted = sessionsCompleted + 1;
        setSessionsCompleted(newSessionsCompleted);
        
        if (settings && newSessionsCompleted % settings.sessions_before_long_break === 0) {
          setTimerState("longBreak");
          setTimeLeft(settings.long_break_duration * 60);
          playSound('longBreak');
          showNotification("Long Break Time!", "Great job completing your sessions! Time for a longer break.");
        } else {
          setTimerState("break");
          setTimeLeft((settings?.break_duration || 5) * 60);
          playSound('break');
          showNotification("Break Time!", "Good work! Take a short break to recharge.");
        }
      } else {
        setTimerState("work");
        setTimeLeft((settings?.work_duration || 25) * 60);
        playSound('work');
        showNotification("Focus Time!", "Break is over. Time to get back to work!");
      }
      
      toast({
        title: `${timerState === "work" ? "Break" : "Work"} time!`,
        description: `Time to ${timerState === "work" ? "take a break" : "focus"}!`,
      });
    }

    // Clean up the interval when the component unmounts or when dependencies change
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isRunning, timeLeft, timerState, settings, sessionsCompleted, toast, playSound, showNotification]);

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
      primary: 'rgba(139, 92, 246, 1)', // Purple for work/focus (Violet-500)
      secondary: 'rgba(139, 92, 246, 0.15)',
      border: 'border-violet-500',
      progress: 'bg-gradient-to-r from-violet-600 to-violet-400',
      shadow: 'shadow-violet-500/30',
      icon: <Brain className="h-6 w-6" />,
      label: 'Focus Time',
      bgGradient: 'bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-900/20 dark:to-violet-800/20',
      borderColor: 'border-violet-200 dark:border-violet-800',
    },
    break: {
      primary: 'rgba(16, 185, 129, 1)', // Green for break (Emerald-500)
      secondary: 'rgba(16, 185, 129, 0.15)',
      border: 'border-emerald-500',
      progress: 'bg-gradient-to-r from-emerald-600 to-emerald-400',
      shadow: 'shadow-emerald-500/30',
      icon: <Coffee className="h-6 w-6" />,
      label: 'Short Break',
      bgGradient: 'bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20',
      borderColor: 'border-emerald-200 dark:border-emerald-800',
    },
    longBreak: {
      primary: 'rgba(79, 70, 229, 1)', // Indigo for long break (Indigo-600)
      secondary: 'rgba(79, 70, 229, 0.15)',
      border: 'border-indigo-600',
      progress: 'bg-gradient-to-r from-indigo-600 to-indigo-400',
      shadow: 'shadow-indigo-600/30',
      icon: <Moon className="h-6 w-6" />,
      label: 'Long Break',
      bgGradient: 'bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20',
      borderColor: 'border-indigo-200 dark:border-indigo-800',
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
      
      <Card className={`shadow-xl hover:shadow-2xl transition-all duration-500 ${currentTheme.shadow} overflow-hidden relative ${currentTheme.bgGradient} ${currentTheme.borderColor}`}>
        <div className="absolute top-0 left-0 w-full h-1 overflow-hidden">
          <div 
            className={`h-full ${currentTheme.progress} transition-all duration-300`} 
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        
        <CardContent className="pt-8 pb-6 px-6">
          <div className="flex flex-col items-center">
            {/* Timer state indicator */}
            <div className={`flex items-center justify-center w-16 h-16 rounded-full mb-4 ${currentTheme.secondary} ${currentTheme.border}`}>
              {currentTheme.icon}
            </div>
            
            <h2 className="text-xl font-semibold mb-1" style={{ color: currentTheme.primary }}>
              {currentTheme.label}
            </h2>
            
            <p className="text-sm text-muted-foreground mb-6 text-center italic">
              "{motivationalQuote}"
            </p>
            
            {/* Timer display */}
            <div className="text-7xl font-bold mb-8 tabular-nums tracking-tight" style={{ color: currentTheme.primary }}>
              {formatTime(timeLeft)}
            </div>
            
            {/* Session counter */}
            <div className="flex items-center gap-2 mb-6">
              {Array.from({ length: settings?.sessions_before_long_break || 4 }).map((_, i) => (
                <div 
                  key={i} 
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    i < sessionsCompleted 
                      ? `bg-opacity-100 ${currentTheme.progress}` 
                      : 'bg-gray-300 dark:bg-gray-700'
                  }`}
                ></div>
              ))}
            </div>
            
            {/* Controls */}
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                className={`w-12 h-12 rounded-full ${currentTheme.border} hover:bg-opacity-20 transition-all duration-300`}
                onClick={() => {
                  // Reset functionality - completely reset the timer
                  setIsRunning(false);
                  setIsPaused(false);
                  setTimerState("work");
                  setTimeLeft((settings?.work_duration || 25) * 60);
                  setSessionsCompleted(0);
                }}
              >
                <RotateCcw className="h-5 w-5" style={{ color: currentTheme.primary }} />
              </Button>
              
              <Button
                variant={isRunning ? "outline" : "default"}
                size="icon"
                className={`w-16 h-16 rounded-full ${isRunning ? currentTheme.border : ''} transition-all duration-300 ${
                  !isRunning ? currentTheme.progress : ''
                }`}
                onClick={() => {
                  // Pause/Play functionality - toggle the timer without resetting
                  if (isRunning) {
                    setIsRunning(false);
                    setIsPaused(true);
                  } else {
                    setIsRunning(true);
                    setIsPaused(false);
                  }
                }}
              >
                {isRunning ? (
                  <Pause className={`h-6 w-6 ${!isRunning ? 'text-white' : ''}`} style={{ color: isRunning ? currentTheme.primary : '' }} />
                ) : (
                  <Play className="h-6 w-6 text-white" />
                )}
              </Button>
              
              {/* Sound toggle */}
              <Button
                variant="outline"
                size="icon"
                className={`w-12 h-12 rounded-full ${currentTheme.border} hover:bg-opacity-20 transition-all duration-300`}
                onClick={() => {
                  // Toggle sound and show feedback
                  const newSoundEnabled = !soundEnabled;
                  setSoundEnabled(newSoundEnabled);
                  
                  toast({
                    title: newSoundEnabled ? "Sound Enabled" : "Sound Disabled",
                    description: newSoundEnabled 
                      ? "Timer completion sounds are now enabled" 
                      : "Timer completion sounds are now disabled",
                  });
                }}
              >
                {soundEnabled ? (
                  <Volume2 className="h-5 w-5" style={{ color: currentTheme.primary }} />
                ) : (
                  <VolumeX className="h-5 w-5" style={{ color: currentTheme.primary }} />
                )}
              </Button>
              
              {/* Settings button */}
              <Button
                variant="outline"
                size="icon"
                className={`w-12 h-12 rounded-full ${currentTheme.border} hover:bg-opacity-20 transition-all duration-300`}
                onClick={() => setIsSettingsDialogOpen(true)}
              >
                <SettingsIcon className="h-5 w-5" style={{ color: currentTheme.primary }} />
              </Button>
            </div>
            
            {/* Sound test button */}
            <Button
              variant="ghost"
              size="sm"
              className="mt-6 text-xs flex items-center gap-1.5 text-muted-foreground hover:text-primary"
              onClick={() => {
                // Test the sound
                if (!soundEnabled) {
                  toast({
                    title: "Sound is Disabled",
                    description: "Enable sound notifications to test the sound.",
                    variant: "destructive",
                  });
                  return;
                }
                
                try {
                  const audio = new Audio(NOTIFICATION_SOUND_PATH);
                  audio.volume = 0.7;
                  audio.load();
                  audio.play().catch(error => {
                    console.error("Error playing test sound:", error);
                    toast({
                      title: "Sound Test Failed",
                      description: "Could not play sound. Check your browser settings.",
                      variant: "destructive",
                    });
                  });
                  
                  toast({
                    title: "Sound Test",
                    description: "Sound is playing. Make sure your volume is turned up.",
                  });
                } catch (error) {
                  console.error("Error creating audio object:", error);
                  toast({
                    title: "Sound Test Failed",
                    description: "Could not create audio object. Check your browser settings.",
                    variant: "destructive",
                  });
                }
              }}
            >
              <Bell className="h-3.5 w-3.5" />
              Test Sound
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Settings Dialog */}
      <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
              <SettingsIcon className="h-5 w-5" />
              Pomodoro Settings
            </DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue="durations" className="mt-4">
            <TabsList className="grid grid-cols-2 mb-4">
              <TabsTrigger value="durations">Time Settings</TabsTrigger>
              <TabsTrigger value="preferences">Preferences</TabsTrigger>
            </TabsList>
            
            <TabsContent value="durations">
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
                        <div className="flex justify-between items-center">
                          <FormLabel className="text-base flex items-center gap-2">
                            <Brain className="h-4 w-4 text-violet-500" />
                            Work Duration
                          </FormLabel>
                          <span className="font-medium">{field.value} min</span>
                        </div>
                        <FormControl>
                          <Slider
                            min={1}
                            max={120}
                            step={1}
                            value={[field.value]}
                            onValueChange={(value) => field.onChange(value[0])}
                            className="py-4"
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Focus session length (1-120 minutes)
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="break_duration"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex justify-between items-center">
                          <FormLabel className="text-base flex items-center gap-2">
                            <Coffee className="h-4 w-4 text-emerald-500" />
                            Break Duration
                          </FormLabel>
                          <span className="font-medium">{field.value} min</span>
                        </div>
                        <FormControl>
                          <Slider
                            min={1}
                            max={60}
                            step={1}
                            value={[field.value]}
                            onValueChange={(value) => field.onChange(value[0])}
                            className="py-4"
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Short break length (1-60 minutes)
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="long_break_duration"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex justify-between items-center">
                          <FormLabel className="text-base flex items-center gap-2">
                            <Moon className="h-4 w-4 text-indigo-500" />
                            Long Break Duration
                          </FormLabel>
                          <span className="font-medium">{field.value} min</span>
                        </div>
                        <FormControl>
                          <Slider
                            min={1}
                            max={120}
                            step={1}
                            value={[field.value]}
                            onValueChange={(value) => field.onChange(value[0])}
                            className="py-4"
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Long break length (1-120 minutes)
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="sessions_before_long_break"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex justify-between items-center">
                          <FormLabel className="text-base flex items-center gap-2">
                            <Flame className="h-4 w-4 text-amber-500" />
                            Sessions Before Long Break
                          </FormLabel>
                          <span className="font-medium">{field.value}</span>
                        </div>
                        <FormControl>
                          <Slider
                            min={1}
                            max={10}
                            step={1}
                            value={[field.value]}
                            onValueChange={(value) => field.onChange(value[0])}
                            className="py-4"
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Number of work sessions before a long break (1-10)
                        </FormDescription>
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
                      style={{ backgroundColor: timerTheme.work.primary }}
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
            </TabsContent>
            
            <TabsContent value="preferences">
              <div className="space-y-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-base font-medium flex items-center gap-2">
                      {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                      Sound Notifications
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Play sounds when timer completes
                    </div>
                  </div>
                  <Switch
                    checked={soundEnabled}
                    onCheckedChange={(checked) => {
                      setSoundEnabled(checked);
                      toast({
                        title: checked ? "Sound Enabled" : "Sound Disabled",
                        description: checked 
                          ? "Timer completion sounds are now enabled" 
                          : "Timer completion sounds are now disabled",
                      });
                    }}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-base font-medium flex items-center gap-2">
                      <Bell className="h-4 w-4" />
                      Desktop Notifications
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Show notifications when timer completes
                    </div>
                  </div>
                  <Switch
                    checked={notificationsEnabled}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        requestNotificationPermission().then(granted => {
                          setNotificationsEnabled(granted);
                        });
                      } else {
                        setNotificationsEnabled(false);
                      }
                    }}
                  />
                </div>
                
                <div className="pt-4">
                  <Button 
                    onClick={() => {
                      // Test the sound
                      if (!soundEnabled) {
                        toast({
                          title: "Sound is Disabled",
                          description: "Enable sound notifications to test the sound.",
                          variant: "destructive",
                        });
                        return;
                      }
                      
                      try {
                        const audio = new Audio(NOTIFICATION_SOUND_PATH);
                        audio.volume = 0.7;
                        audio.load();
                        audio.play().catch(error => {
                          console.error("Error playing test sound:", error);
                          toast({
                            title: "Sound Test Failed",
                            description: "Could not play sound. Check your browser settings.",
                            variant: "destructive",
                          });
                        });
                        
                        toast({
                          title: "Sound Test",
                          description: "Sound is playing. Make sure your volume is turned up.",
                        });
                      } catch (error) {
                        console.error("Error creating audio object:", error);
                        toast({
                          title: "Sound Test Failed",
                          description: "Could not create audio object. Check your browser settings.",
                          variant: "destructive",
                        });
                      }
                    }}
                    variant="outline"
                    className="w-full mb-4"
                  >
                    <Bell className="mr-2 h-4 w-4" />
                    Test Sound Notification
                  </Button>
                  
                  <Button 
                    onClick={() => setIsSettingsDialogOpen(false)}
                    className="w-full"
                    style={{ backgroundColor: timerTheme.work.primary }}
                  >
                    Save Preferences
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
