import React, { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  DialogDescription,
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
import { 
  getPomodoroSettings, 
  updatePomodoroSettings,
  getStudySessions,
  createStudySession,
  updateStudySession,
  deleteStudySession,
  getAuthToken,
  getStudySession
} from "@/lib/api";
import { queryClient, QUERY_KEYS } from "@/lib/queryClient";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Loader2, 
  Settings as SettingsIcon, 
  AlertCircle, 
  Coffee, 
  Brain, 
  Moon, 
  CheckCircle2, 
  Volume2, 
  VolumeX, 
  Bell, 
  Flame,
  BookOpen,
  BarChart2,
  Clock,
  Calendar,
  Trash
} from "lucide-react";
import { PomodoroSettings, StudySession } from "@shared/schema";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { motion, AnimatePresence } from "framer-motion";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

// Asset paths
const NOTIFICATION_SOUND_PATH = "/assets/bell_not.wav";
const APP_LOGO_PATH = "/assets/tiger_logo.png"; // Updated path to the tiger logo in assets folder

// LocalStorage keys
const LOCALSTORAGE_KEYS = {
  SESSION: 'pomodoroActiveSession',
  FOCUS_TIME: 'pomodoroFocusTime',
  BREAKS: 'pomodoroBreaks',
  TIMER_LEFT: 'pomodoroTimeLeft',
  TIMER_STATE: 'pomodoroTimerState',
  TIMER_SESSIONS_COMPLETED: 'pomodoroSessionsCompleted',
  TIMER_IS_RUNNING: 'pomodoroIsRunning',
  TIMER_IS_PAUSED: 'pomodoroIsPaused',
};

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

// Update the formSchema to include study session fields
const studySessionFormSchema = z.object({
  title: z.string().min(1, { message: "Title is required" }),
  description: z.string().optional(),
  subject: z.string().optional(),
  goal: z.string().optional(),
});

type StudySessionFormValues = z.infer<typeof studySessionFormSchema>;

export default function PomodoroTimer() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_SETTINGS.work_duration * 60);
  const [timerState, setTimerState] = useState<TimerState>("work");
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showCompletionAnimation, setShowCompletionAnimation] = useState(false);
  const [currentStudySession, setCurrentStudySession] = useState<StudySession | null>(null);
  const [isStudySessionDialogOpen, setIsStudySessionDialogOpen] = useState(false);
  const [totalFocusTime, setTotalFocusTime] = useState(0);
  const [totalBreaks, setTotalBreaks] = useState(0);
  const [isStatsDialogOpen, setIsStatsDialogOpen] = useState(false);
  const [resumeSessionData, setResumeSessionData] = useState<{
    session?: StudySession;
    focusTime?: number;
    breaks?: number;
    timeLeft?: number;
    timerState?: TimerState;
    sessionsCompleted?: number;
    isRunning?: boolean;
    isPaused?: boolean;
  } | null>(null);
  
  // Refs for internal state tracking
  const prevFocusTimeRef = useRef(totalFocusTime);
  const prevBreaksRef = useRef(totalBreaks);
  const updatingSessionRef = useRef(false);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasShownSoundErrorRef = useRef(false);  // Track if we've shown the sound error
  
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

    // Check for existing session AND timer state in localStorage on mount
    try {
      const storedSessionStr = localStorage.getItem(LOCALSTORAGE_KEYS.SESSION);
      const storedFocusTimeStr = localStorage.getItem(LOCALSTORAGE_KEYS.FOCUS_TIME);
      const storedBreaksStr = localStorage.getItem(LOCALSTORAGE_KEYS.BREAKS);
      const storedTimeLeftStr = localStorage.getItem(LOCALSTORAGE_KEYS.TIMER_LEFT);
      const storedTimerState = localStorage.getItem(LOCALSTORAGE_KEYS.TIMER_STATE) as TimerState | null;
      const storedSessionsCompletedStr = localStorage.getItem(LOCALSTORAGE_KEYS.TIMER_SESSIONS_COMPLETED);
      const storedIsRunningStr = localStorage.getItem(LOCALSTORAGE_KEYS.TIMER_IS_RUNNING);
      const storedIsPausedStr = localStorage.getItem(LOCALSTORAGE_KEYS.TIMER_IS_PAUSED);

      let potentialResumeData: typeof resumeSessionData = {};
      let hasSessionData = false;
      let hasTimerData = false;

      // --- Session Data --- 
      if (storedSessionStr && storedFocusTimeStr && storedBreaksStr) {
        const storedSession = JSON.parse(storedSessionStr) as StudySession;
        const storedFocusTime = parseInt(storedFocusTimeStr, 10);
        const storedBreaks = parseInt(storedBreaksStr, 10);
        
        // Only restore sessions that are explicitly not completed
        if (storedSession && 
            typeof storedSession === 'object' && 
            storedSession.id && 
            storedSession.completed === false && 
            !isNaN(storedFocusTime) && 
            !isNaN(storedBreaks)) {
          potentialResumeData = { ...potentialResumeData, session: storedSession, focusTime: storedFocusTime, breaks: storedBreaks };
          hasSessionData = true;
        } else {
          // If session is completed or invalid, clear it from localStorage
          console.log("Clearing invalid or completed session from localStorage");
          localStorage.removeItem(LOCALSTORAGE_KEYS.SESSION);
          localStorage.removeItem(LOCALSTORAGE_KEYS.FOCUS_TIME);
          localStorage.removeItem(LOCALSTORAGE_KEYS.BREAKS);
        }
      }

      // --- Timer Data --- 
      if (storedTimeLeftStr && storedTimerState && storedSessionsCompletedStr && storedIsRunningStr && storedIsPausedStr) {
        const storedTimeLeft = parseInt(storedTimeLeftStr, 10);
        const storedSessionsCompleted = parseInt(storedSessionsCompletedStr, 10);
        const storedIsRunning = storedIsRunningStr === 'true';
        const storedIsPaused = storedIsPausedStr === 'true';
        
        // Validate timer state
        if (!isNaN(storedTimeLeft) && storedTimeLeft >= 0 &&
            ['work', 'break', 'longBreak'].includes(storedTimerState) &&
            !isNaN(storedSessionsCompleted) && storedSessionsCompleted >= 0) {
              potentialResumeData = {
                ...potentialResumeData,
                timeLeft: storedTimeLeft,
                timerState: storedTimerState,
                sessionsCompleted: storedSessionsCompleted,
                isRunning: storedIsRunning,
                isPaused: storedIsPaused,
              };
              hasTimerData = true;
        }
      }

      // If we found valid data (either session or timer or both), prompt user
      if (hasSessionData || hasTimerData) {
        setResumeSessionData(potentialResumeData);
      } else {
        // Clear any potentially inconsistent stored data
        clearLocalStorageState();
      }
    } catch (error) {
      console.error("Error reading state from localStorage:", error);
      clearLocalStorageState(); // Clear potentially corrupted data
    }
  }, []); // Empty dependency array ensures this runs only once on mount

  // Persist active session and timer state to localStorage
  useEffect(() => {
    try {
      if (currentStudySession && !currentStudySession.completed) {
        localStorage.setItem(LOCALSTORAGE_KEYS.SESSION, JSON.stringify(currentStudySession));
        localStorage.setItem(LOCALSTORAGE_KEYS.FOCUS_TIME, String(totalFocusTime));
        localStorage.setItem(LOCALSTORAGE_KEYS.BREAKS, String(totalBreaks));
      } else {
        // Clear localStorage if session ends or is null
        localStorage.removeItem(LOCALSTORAGE_KEYS.SESSION);
        localStorage.removeItem(LOCALSTORAGE_KEYS.FOCUS_TIME);
        localStorage.removeItem(LOCALSTORAGE_KEYS.BREAKS);
      }

      // Persist timer state if it's running or paused (not in initial state)
      if (isRunning || isPaused) {
        localStorage.setItem(LOCALSTORAGE_KEYS.TIMER_LEFT, String(timeLeft));
        localStorage.setItem(LOCALSTORAGE_KEYS.TIMER_STATE, timerState);
        localStorage.setItem(LOCALSTORAGE_KEYS.TIMER_SESSIONS_COMPLETED, String(sessionsCompleted));
        localStorage.setItem(LOCALSTORAGE_KEYS.TIMER_IS_RUNNING, String(isRunning));
        localStorage.setItem(LOCALSTORAGE_KEYS.TIMER_IS_PAUSED, String(isPaused));
      } else {
        // Clear timer state if timer is reset/stopped and not paused
        localStorage.removeItem(LOCALSTORAGE_KEYS.TIMER_LEFT);
        localStorage.removeItem(LOCALSTORAGE_KEYS.TIMER_STATE);
        localStorage.removeItem(LOCALSTORAGE_KEYS.TIMER_SESSIONS_COMPLETED);
        localStorage.removeItem(LOCALSTORAGE_KEYS.TIMER_IS_RUNNING);
        localStorage.removeItem(LOCALSTORAGE_KEYS.TIMER_IS_PAUSED);
      }

    } catch (error) {
      console.error("Error saving state to localStorage:", error);
    }
  }, [currentStudySession, totalFocusTime, totalBreaks, timeLeft, timerState, sessionsCompleted, isRunning, isPaused]);

  // Helper to clear all persisted state
  const clearLocalStorageState = () => {
    // Log that we're clearing localStorage (helps with debugging)
    console.log("Clearing all localStorage state");
    
    // Remove all pomodoro-related localStorage items
    Object.values(LOCALSTORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  };

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

  // TIMER COUNTDOWN EFFECT - Core timer functionality
  // This effect decrements the timeLeft counter every second when the timer is running
  useEffect(() => {
    // Only setup the timer if isRunning is true
    if (!isRunning) return;
    
    // Set up the interval to decrement timeLeft every second
    const timerInterval = setInterval(() => {
      setTimeLeft((prevTimeLeft) => {
        // If timer reaches zero, clear the interval and return 0
        if (prevTimeLeft <= 1) {
          clearInterval(timerInterval);
          return 0;
        }
        // Otherwise decrement by 1 second
        return prevTimeLeft - 1;
      });
    }, 1000);
    
    // Clean up the interval when component unmounts or dependencies change
    return () => {
      clearInterval(timerInterval);
    };
  }, [isRunning]); // Only re-run this effect when isRunning changes

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
      
      
      return updatePomodoroSettings(cleanData);
    },
    onMutate: async (data) => {
      
      
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["settings", "pomodoro"] });
      
      // Snapshot the previous value
      const previousSettings = queryClient.getQueryData(["settings", "pomodoro"]);
      
      // Create a proper deep copy to avoid reference issues
      const previousSettingsCopy = previousSettings ? JSON.parse(JSON.stringify(previousSettings)) : null;
      
      // Create optimistic update with validated numeric values
      const optimisticSettings = {
        work_duration: Number(data.work_duration),
        break_duration: Number(data.break_duration),
        long_break_duration: Number(data.long_break_duration),
        sessions_before_long_break: Number(data.sessions_before_long_break)
      };
      
      
      
      // Update the cache with the optimistic data
      queryClient.setQueryData(["settings", "pomodoro"], optimisticSettings);
      
      return { previousSettings: previousSettingsCopy };
    },
    onError: (error: any, _variables, context) => {
      console.error("Failed to update pomodoro settings:", error);
      
      // Rollback to previous state if available
      if (context?.previousSettings) {
        
        queryClient.setQueryData(["settings", "pomodoro"], context.previousSettings);
      }
      
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message || "An error occurred while updating your settings. Please try again.",
      });
    },
    onSuccess: (data) => {
      
      
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
      
      // Simply fetch the settings again from the server
      queryClient.invalidateQueries({ queryKey: ["settings", "pomodoro"] });
      
      setIsSettingsDialogOpen(false);
      toast({
        title: "Settings Updated",
        description: "Your Pomodoro timer settings have been updated successfully.",
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

  // Sound play function with simplified, robust implementation
  const playSound = useCallback((type: 'work' | 'break' | 'longBreak') => {
    if (!soundEnabled) return;
    
    try {
      // Always use the reliable notification sound path we know exists
      const soundUrl = NOTIFICATION_SOUND_PATH;
      
      
      // Create new audio element
      const audio = new Audio(soundUrl);
      audio.volume = 0.7;
      
      // Play with error handling
      audio.play()
          .then(() => {
            
          
          // Clean up resources when done
          audio.addEventListener('ended', () => {
            audio.src = '';
          });
        })
        .catch(err => {
          
          
          // Only show this error once per session
          if (!hasShownSoundErrorRef.current) {
            hasShownSoundErrorRef.current = true;
            toast({
              variant: "destructive",
              title: "Sound Error",
              description: "Browser blocked sound autoplay. Try clicking anywhere on the page first."
            });
            
            // Try to enable sound on next user interaction
            const enableSound = () => {
              const audio = new Audio(soundUrl);
              audio.volume = 0.7;
              audio.play().catch(e => console.log("Still couldn't play sound after interaction"));
              document.removeEventListener('click', enableSound);
            };
            
            document.addEventListener('click', enableSound, { once: true });
          }
        });
    } catch (error) {
      console.error("Error creating audio:", error);
    }
  }, [soundEnabled, toast]);

  // Preload sounds to avoid delay when actually needed
  useEffect(() => {
    if (soundEnabled) {
      // Simple preload approach
      try {
        const audio = new Audio();
        audio.src = NOTIFICATION_SOUND_PATH;
        audio.preload = 'auto';
        
        // Just load it without playing
        audio.load();
        
      } catch (err) {
        
      }
    }
  }, [soundEnabled]);

  // Timer completion effect - handles transition between work and break sessions
  useEffect(() => {
    // Local variables to avoid closure issues
    const localIsRunning = isRunning;
    const localTimerSeconds = timeLeft;
    const localTimerState = timerState;
    const localSessions = sessionsCompleted;
    const localSessionsBeforeLongBreak = settings?.sessions_before_long_break || 4;
    
    // Check if timer is running and has completed
    if (localIsRunning && localTimerSeconds <= 0) {
      if (localTimerState === "work") {
        // Completed a work session
        const newSessionsCompleted = localSessions + 1;
        const newTotalFocusTime = totalFocusTime + (settings?.work_duration || 25) * 60;
        
        // Play sound
        playSound('work');
        
        // Show notification
        showNotification("Work session completed! 🎉", "Time for a well-deserved break!");
        
        // Show toast notification
        toast({
          title: "Work session completed! 🎉",
          description: "Time for a well-deserved break! Click play to start.",
          duration: 5000,
        });
        
        // Calculate next mode (break or long break)
        let nextMode: TimerState = "break";
        if (newSessionsCompleted % localSessionsBeforeLongBreak === 0) {
          nextMode = "longBreak";
        }
        
        // Update state with a small delay to prevent state thrashing
        setTimeout(() => {
          setTotalFocusTime(newTotalFocusTime);
        setSessionsCompleted(newSessionsCompleted);
        
          // Set the next mode with appropriate duration
          if (nextMode === "break") {
          setTimerState("break");
          setTimeLeft((settings?.break_duration || 5) * 60);
      } else {
            setTimerState("longBreak");
            setTimeLeft((settings?.long_break_duration || 15) * 60);
          }
          
          // Pause the timer when transitioning to a break - user must press play to start the break
          setIsRunning(false);
          setIsPaused(true);
        }, 100);
      } else if (localTimerState === "break" || localTimerState === "longBreak") {
        // Completed a break session
        const newTotalBreaks = totalBreaks + 1;
        
        // Play sound
        playSound(localTimerState);
        
        // Show appropriate notification
        const isLongBreak = localTimerState === "longBreak";
        const title = isLongBreak ? "Long break completed! 💪" : "Break completed! ⏱️";
        const description = "Ready for another focused session? Click play to start.";
        
        // Show desktop notification
        showNotification(title, description);
        
        // Show toast
      toast({
          title,
          description,
          duration: 5000,
        });
        
        // Special handling for cycle completion after a long break
        if (isLongBreak) {
          // After a long break completes, we start a new cycle
          // We should keep the session count as a multiple of sessions_before_long_break
          // to maintain proper tracking of completed cycles
          const sessionsBeforeLongBreak = settings?.sessions_before_long_break || 4;
          
          // Calculate the number of completed full cycles
          const completedFullCycles = Math.floor(localSessions / sessionsBeforeLongBreak);
          
          // The adjusted session count is the number of completed cycles * sessions per cycle
          // This keeps the count as a multiple of sessions_before_long_break
          const adjustedSessions = completedFullCycles * sessionsBeforeLongBreak;
          
          // Update state with adjusted sessions count to start a new cycle
          setTimeout(() => {
            setTotalBreaks(newTotalBreaks);
            setTimerState("work");
            setTimeLeft((settings?.work_duration || 25) * 60);
            setSessionsCompleted(adjustedSessions);
            
            // Pause the timer when transitioning to work - user must press play to start working
            setIsRunning(false);
            setIsPaused(true);
          }, 100);
        } else {
          // Regular break completion
          setTimeout(() => {
            setTotalBreaks(newTotalBreaks);
            setTimerState("work");
            setTimeLeft((settings?.work_duration || 25) * 60);
            
            // Pause the timer when transitioning to work - user must press play to start working
            setIsRunning(false);
            setIsPaused(true);
          }, 100);
        }
      }
    }
  }, [
    isRunning, 
    timeLeft, 
    timerState, 
    sessionsCompleted, 
    totalFocusTime, 
    totalBreaks, 
    settings, 
    soundEnabled,
    toast,
    playSound,
    showNotification
  ]);

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

  // Form for study session
  const studySessionForm = useForm<StudySessionFormValues>({
    resolver: zodResolver(studySessionFormSchema),
    defaultValues: {
      title: "",
      description: "",
      subject: "",
      goal: "",
    }
  });

  // Query for study sessions
  const { data: studySessions, isLoading: isLoadingStudySessions } = useQuery({
    queryKey: [QUERY_KEYS.STUDY_SESSIONS],
    queryFn: getStudySessions,
    enabled: isStatsDialogOpen, // Only fetch when stats dialog is open
  });

  // Create study session mutation
  const createStudySessionMutation = useMutation({
    mutationFn: createStudySession,
    onSuccess: (data) => {
      setCurrentStudySession(data);
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.STUDY_SESSIONS] });
      toast({
        title: "Study Session Started",
        description: "Your study session has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to Start Session",
        description: error.message || "Something went wrong when creating your study session.",
      });
    }
  });

  // Update study session mutation
  const updateStudySessionMutation = useMutation({
    mutationFn: (data: { id: number | string; title?: string; description?: string | null; subject?: string | null; goal?: string | null; completed?: boolean; total_focus_time?: number; total_breaks?: number; }) => {
      // Convert data to appropriate format before sending
      const sanitizedData = {
        ...data,
        // Ensure these are always numbers, not strings
        id: typeof data.id === 'string' ? parseInt(data.id) : data.id,
        total_focus_time: data.total_focus_time !== undefined ? Number(data.total_focus_time) : undefined,
        total_breaks: data.total_breaks !== undefined ? Number(data.total_breaks) : undefined,
        // Explicitly set completed to boolean
        completed: data.completed === true ? true : data.completed === false ? false : undefined
      };
      
      console.log("Updating study session with data:", sanitizedData);
      return updateStudySession(sanitizedData.id, sanitizedData);
    },
    onSuccess: (data) => {
      // Immediately invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.STUDY_SESSIONS] });
      
      // Handle state reset ONLY if the session was completed
      if (data.completed && currentStudySession && currentStudySession.id === data.id) {
        // Reset all state related to the current session
        setCurrentStudySession(null);
        clearLocalStorageState();
        setTotalFocusTime(0);
        setTotalBreaks(0);
        setTimerState("work");
        setTimeLeft((settings?.work_duration || 25) * 60);
        setSessionsCompleted(0);
        setIsRunning(false);
        setIsPaused(false);
      } 
      // If this is the current session and it's not completed, update local state
      else if (!data.completed && currentStudySession && currentStudySession.id === data.id) {
        // Update the current study session with the latest data from the server
        setCurrentStudySession(data);
        
        // Update localStorage to persist these changes
        localStorage.setItem(LOCALSTORAGE_KEYS.SESSION, JSON.stringify(data));
      }
      
      toast({
        title: data.completed ? "Study Session Completed" : "Study Session Updated",
        description: data.completed 
          ? "Your study session has been marked as completed." 
          : "Your study session has been updated successfully.",
      });
    },
    onError: (error: any) => {
      console.error("Failed to update study session:", error);
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.STUDY_SESSIONS] });
      
      toast({
        variant: "destructive",
        title: "Failed to Update Session",
        description: error.message || "Something went wrong. Please try again.",
      });
    }
  });

  // Delete study session mutation
  const deleteStudySessionMutation = useMutation({
    mutationFn: async (id: string) => {
      return await deleteStudySession(id);
    },
    onMutate: async (id) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.STUDY_SESSIONS] });
      
      // Snapshot the previous sessions
      const previousSessions = queryClient.getQueryData([QUERY_KEYS.STUDY_SESSIONS]);
      
      // Optimistically update sessions by filtering out the deleted one
      queryClient.setQueryData(
        [QUERY_KEYS.STUDY_SESSIONS], 
        (old: any) => old ? old.filter((session: any) => session.id !== parseInt(id)) : []
      );
      
      // Return the snapshot to roll back if needed
      return { previousSessions };
    },
    onSuccess: () => {
      // Invalidate and refetch the study sessions query to get fresh data
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.STUDY_SESSIONS] });
      
      toast({
        title: "Session Deleted",
        description: "The study session has been permanently deleted.",
      });
      
      // Reset state
      setSessionToDelete(null);
      setShowDeleteConfirm(false);
    },
    onError: (error, id, context) => {
      console.error("Failed to delete study session:", error);
      // Roll back to the previous sessions if mutation fails
      if (context?.previousSessions) {
        queryClient.setQueryData([QUERY_KEYS.STUDY_SESSIONS], context.previousSessions);
      }
      
      toast({
        title: "Delete Failed",
        description: "Failed to delete the session. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Track work session completions and update the database
  useEffect(() => {
    // Skip if we're already in the process of updating
    if (updatingSessionRef.current) {
      return;
    }
    
    // Only run if we have a current study session and values have actually changed
    if (currentStudySession && currentStudySession.id) {
      const focusTimeChanged = prevFocusTimeRef.current !== totalFocusTime;
      const breaksChanged = prevBreaksRef.current !== totalBreaks;
      
      // Skip if nothing has changed
      if (!focusTimeChanged && !breaksChanged) {
        return;
      }
      
      // Set updating flag to prevent re-entrance immediately
      updatingSessionRef.current = true;
      
      // Store current values for comparison
      const newFocusTime = totalFocusTime;
      const newBreaks = totalBreaks;
      
      // Update our refs with the new values
      prevFocusTimeRef.current = newFocusTime;
      prevBreaksRef.current = newBreaks;
      
      // Clear any existing timeout to avoid multiple updates
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = null;
      }
      
      // Debounce the update to avoid rapid successive API calls
      updateTimeoutRef.current = setTimeout(() => {
        try {
          // Only update if the component is still mounted and we have a current session
          if (currentStudySession && currentStudySession.id) {
            updateStudySessionMutation.mutate({
              id: currentStudySession.id,
              total_focus_time: newFocusTime,
              total_breaks: newBreaks
            });
          }
        } catch (error) {
          console.error("Error updating study session:", error);
          toast({
            variant: "destructive",
            title: "Update Error",
            description: "Failed to update study session data.",
          });
        } finally {
          // Always reset flags regardless of success/failure
          updatingSessionRef.current = false;
          updateTimeoutRef.current = null;
        }
      }, 2000); // Increased debounce to 2 seconds to further reduce API calls
    }
    
    // Clean up the timeout if the component unmounts or dependencies change
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = null;
      }
      updatingSessionRef.current = false;
    };
  }, [totalFocusTime, totalBreaks, currentStudySession, updateStudySessionMutation, toast]);

  // Handle study session form submission
  const onSubmitStudySession = (data: StudySessionFormValues) => {
    if (currentStudySession) {
      // Create updated session data by merging current data with form data
      const updatedSessionData = {
        id: currentStudySession.id,
        ...data,
        total_focus_time: totalFocusTime,
        total_breaks: totalBreaks,
      };
      
      // Optimistically update the current session in the UI first
      const optimisticSession = {
        ...currentStudySession,
        ...data, // Update with new form values
      };
      
      // Update the local state immediately for better user experience
      setCurrentStudySession(optimisticSession);
      
      // Also update localStorage
      localStorage.setItem(LOCALSTORAGE_KEYS.SESSION, JSON.stringify(optimisticSession));
      
      // Then update on the server
      updateStudySessionMutation.mutate(updatedSessionData);
    } else {
      // Create new session
      createStudySessionMutation.mutate({
        ...data,
        total_focus_time: 0,
        total_breaks: 0,
      });
    }
    setIsStudySessionDialogOpen(false);
  };

  // Format time in hours and minutes
  const formatTimeHoursMinutes = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  // End the current study session - simplified to use updateStudySessionMutation
  const endStudySession = () => {
    if (currentStudySession) {
      // Store the session ID before clearing state
      const sessionId = currentStudySession.id;
      const sessionFocusTime = totalFocusTime;
      const sessionBreaks = totalBreaks;
      
      // Immediately update local state to hide UI and reset timer
      setCurrentStudySession(null);
      clearLocalStorageState();
      
      // Reset all other state
      setTotalFocusTime(0);
      setTotalBreaks(0);
      setTimerState("work");
      setTimeLeft((settings?.work_duration || 25) * 60);
      setSessionsCompleted(0);
      setIsRunning(false);
      setIsPaused(false);
      
      // Update the study session in the database using the mutation
      // Make sure completed is explicitly set to true as a boolean
      updateStudySessionMutation.mutate({
        id: sessionId,
        completed: true,
        total_focus_time: Number(sessionFocusTime),
        total_breaks: Number(sessionBreaks),
      });
    }
  };

  // State for the confirmation dialog
  const [showEndSessionConfirm, setShowEndSessionConfirm] = useState(false);
  
  // Handler for the End button click
  const handleEndSessionClick = useCallback(() => {
    setShowEndSessionConfirm(true);
  }, []);

  // Add state for delete confirmation dialog
  const [sessionToDelete, setSessionToDelete] = useState<StudySession | null>(null);

  // Add a new variable for the confirmation dialog
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Add state to track which session is currently loading during resume
  const [resumeLoadingId, setResumeLoadingId] = useState<number | null>(null);

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
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 flex flex-col gap-4 sm:gap-6 items-center">
      {settingsError && (
        <Alert variant="destructive" className="w-full mb-4 sm:mb-6">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle>Settings Error</AlertTitle>
          <AlertDescription>
            Failed to load your timer settings. Using default values.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Pomodoro Timer Card Container - now centered with session card as overlay */}
      <div className="w-full md:max-w-2xl mx-auto relative">
        
        {/* Session card overlay - positioned at the top right on larger screens, full width on mobile */}
        {currentStudySession && !currentStudySession.completed && !showEndSessionConfirm && (
          <div className="w-full sm:w-64 sm:absolute sm:top-3 sm:right-3 sm:z-10 mb-4 sm:mb-0">
            <Card className="shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-blue-200 dark:border-blue-800 w-full">
              <CardContent className="py-2 px-3">
              <div className="flex flex-col space-y-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <BookOpen className="h-4 w-4 text-blue-600 flex-shrink-0" />
                      <h3 
                        className="font-semibold text-sm truncate" 
                        title={currentStudySession.title}
                      >
                        {currentStudySession.title}
                      </h3>
                  </div>
                    <Badge className="bg-blue-600 text-xs py-0 px-2 flex-shrink-0">Active</Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">Focus:</span>
                    <span className="text-xs font-semibold text-blue-600">
                      {formatTimeHoursMinutes(totalFocusTime)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">Breaks:</span>
                    <span className="text-xs font-semibold text-emerald-600">
                      {totalBreaks}
                    </span>
                  </div>
                </div>
                
                <div className="flex justify-between">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="h-7 text-xs border-blue-300 hover:bg-blue-100 dark:border-blue-700 dark:hover:bg-blue-900"
                    onClick={() => {
                      studySessionForm.reset({
                        title: currentStudySession.title,
                        description: currentStudySession.description || "",
                        subject: currentStudySession.subject || "",
                        goal: currentStudySession.goal || "",
                      });
                      setIsStudySessionDialogOpen(true);
                    }}
                  >
                    <SettingsIcon className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="h-7 text-xs border-red-300 hover:bg-red-100 dark:border-red-700 dark:hover:bg-red-900 hover:text-red-600"
                      onClick={handleEndSessionClick}
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    End
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
      </div>
        )}

        <Card className={`shadow-xl hover:shadow-2xl transition-all duration-500 ${currentTheme.shadow} overflow-hidden relative ${currentTheme.bgGradient} ${currentTheme.borderColor} w-full`}>
          <div className="absolute top-0 left-0 w-full h-1 overflow-hidden">
            <div 
              className={`h-full ${currentTheme.progress} transition-all duration-300`} 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          
          <CardContent className="pt-6 sm:pt-8 pb-4 sm:pb-6 px-4 sm:px-6">
            <div className="flex flex-col items-center">
              {/* Timer state indicator */}
              <div className={`flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full mb-3 sm:mb-4 ${currentTheme.secondary} ${currentTheme.border}`}>
                {currentTheme.icon}
              </div>
              
              <h2 className="text-lg sm:text-xl font-semibold mb-1" style={{ color: currentTheme.primary }}>
                {currentTheme.label}
              </h2>
              
              <p className="text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6 text-center italic px-2">
                "{motivationalQuote}"
              </p>
              
              {/* Timer display */}
              <div className="text-5xl sm:text-7xl font-bold mb-6 sm:mb-8 tabular-nums tracking-tight" style={{ color: currentTheme.primary }}>
                {formatTime(timeLeft)}
              </div>
              
              {/* Session counter */}
              <div className="flex flex-col items-center gap-2 mb-4 sm:mb-6">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  {Array.from({ length: settings?.sessions_before_long_break || 4 }).map((_, i) => {
                    // Calculate the current position in the cycle, accounting for long breaks
                    const sessionsBeforeLongBreak = settings?.sessions_before_long_break || 4;
                    const currentPositionInCycle = sessionsCompleted % sessionsBeforeLongBreak;
                    
                    // Determine if this dot should be active based on different timer states
                    // This logic handles various states of the Pomodoro cycle:
                    //  1. During a work session - dots are filled based on completed sessions
                    //  2. During a break session - same as work, showing progress in current cycle
                    //  3. During a long break - all dots are filled to show the cycle is complete
                    //  4. After long break completion - no dots are filled (new cycle starts)
                    let isActive = false;
                    
                    if (timerState === 'longBreak') {
                      // During a long break, all dots should be active to indicate a completed cycle
                      isActive = true;
                    } else if (currentPositionInCycle === 0 && sessionsCompleted > 0) {
                      // If we're at the start of a new cycle (but not at the very beginning with 0 sessions)
                      // and not in a long break, no dots should be active as we're starting fresh
                      isActive = false;
                    } else {
                      // Normal case: dots are active up to the current position
                      isActive = i < currentPositionInCycle;
                    }
                    
                    // Determine if this dot should pulse (always the next dot that will be filled)
                    // This provides a visual indication of which session is currently in progress
                    const shouldPulse = !isActive && 
                                       i === currentPositionInCycle && 
                                       isRunning && 
                                       timerState === "work";
                    
                    // Create color styling based on timer state
                    let dotColor = isActive 
                      ? currentTheme.progress 
                      : shouldPulse 
                        ? `${currentTheme.progress} animate-pulse` 
                        : 'bg-gray-300 dark:bg-gray-700';
                    
                    return (
                  <div 
                    key={i} 
                        className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full transition-all duration-300 ${dotColor}`}
                        title={`Session ${i + 1}/${sessionsBeforeLongBreak}`}
                  ></div>
                    );
                  })}
              </div>
              
                {/* Added total sessions counter with cycle information */}
                <div className="text-xs text-muted-foreground flex flex-col items-center">
                  <div>
                    Total Sessions: <span className="font-semibold" style={{ color: currentTheme.primary }}>{sessionsCompleted}</span>
                  </div>
                  {sessionsCompleted > 0 && (
                    <div className="mt-1">
                      Completed Cycles: <span className="font-semibold" style={{ color: currentTheme.primary }}>
                        {Math.floor(sessionsCompleted / (settings?.sessions_before_long_break || 4))}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Controls - made responsive for different screen sizes */}
              <div className="flex items-center gap-2 sm:gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full ${currentTheme.border} hover:bg-opacity-20 transition-all duration-300`}
                  onClick={() => {
                    // Reset functionality - completely reset the timer
                    setIsRunning(false);
                    setIsPaused(false);
                    setTimerState("work");
                    setTimeLeft((settings?.work_duration || 25) * 60);
                    setSessionsCompleted(0);
                    clearLocalStorageState(); // Clear persisted state on manual reset
                  }}
                >
                  <RotateCcw className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: currentTheme.primary }} />
                </Button>
                
                <Button
                  variant={isRunning ? "outline" : "default"}
                  size="icon"
                  className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full ${isRunning ? currentTheme.border : ''} transition-all duration-300 ${
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
                    <Pause className={`h-5 w-5 sm:h-6 sm:w-6 ${!isRunning ? 'text-white' : ''}`} style={{ color: isRunning ? currentTheme.primary : '' }} />
                  ) : (
                    <Play className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  )}
                </Button>
                
                {/* Sound toggle */}
                <Button
                  variant="outline"
                  size="icon"
                  className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full ${currentTheme.border} hover:bg-opacity-20 transition-all duration-300`}
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
                    <Volume2 className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: currentTheme.primary }} />
                  ) : (
                    <VolumeX className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: currentTheme.primary }} />
                  )}
                </Button>
                
                {/* Settings button */}
                <Button
                  variant="outline"
                  size="icon"
                  className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full ${currentTheme.border} hover:bg-opacity-20 transition-all duration-300`}
                  onClick={() => setIsSettingsDialogOpen(true)}
                >
                  <SettingsIcon className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: currentTheme.primary }} />
                </Button>
              </div>
              
              {/* Additional action buttons */}
              <div className="flex flex-wrap justify-center mt-4 sm:mt-6 gap-2 sm:gap-3">
                {/* Start Study Session Button - Only show if no active session */}
                {!currentStudySession && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs flex items-center gap-1.5 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950 border-blue-200 dark:border-blue-800"
                    onClick={() => {
                      studySessionForm.reset({
                        title: "",
                        description: "",
                        subject: "",
                        goal: "",
                      });
                      setIsStudySessionDialogOpen(true);
                    }}
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    Start Study Session
                  </Button>
                )}
                
                {/* View Stats Button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs flex items-center gap-1.5 hover:bg-purple-50 hover:text-purple-600 dark:hover:bg-purple-950 border-purple-200 dark:border-purple-800"
                  onClick={() => setIsStatsDialogOpen(true)}
                >
                  <BarChart2 className="h-3.5 w-3.5" />
                  View Stats
                </Button>
              </div>
              
              {/* Sound test button */}
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 sm:mt-3 text-xs flex items-center gap-1.5 text-muted-foreground hover:text-primary"
                onClick={() => {
                  // Test the sound using our improved sound function
                  if (!soundEnabled) {
                    toast({
                      title: "Sound is Disabled",
                      description: "Enable sound notifications to test the sound.",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  playSound('work');
                      toast({
                    title: "Testing Sound",
                    description: "If you don't hear anything, check your volume or click anywhere on the page",
                  });
                }}
              >
                <Bell className="h-3.5 w-3.5" />
                Test Sound
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialogs remain outside the flex flow for cards */}
      {/* Study Session Dialog */}
      <Dialog open={isStudySessionDialogOpen} onOpenChange={setIsStudySessionDialogOpen}>
        <DialogContent className="sm:max-w-md max-w-[95vw] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl font-semibold">
              <BookOpen className="h-5 w-5" />
              {currentStudySession ? "Edit Study Session" : "Start New Study Session"}
            </DialogTitle>
            <DialogDescription>
              {currentStudySession 
                ? "Update the details of your current study session." 
                : "Create a new study session to track your focus time and progress."}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...studySessionForm}>
            <form onSubmit={studySessionForm.handleSubmit(onSubmitStudySession)} className="space-y-4 py-4">
              <FormField
                control={studySessionForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Math Homework" {...field} />
                    </FormControl>
                    <FormDescription className="text-xs sm:text-sm">
                      Give your study session a descriptive title
                    </FormDescription>
                  </FormItem>
                )}
              />
              
              <FormField
                control={studySessionForm.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject</FormLabel>
                    <FormControl>
                      <Input placeholder="Mathematics, Physics, etc." {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={studySessionForm.control}
                name="goal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Goal</FormLabel>
                    <FormControl>
                      <Input placeholder="Complete 3 practice problems" {...field} />
                    </FormControl>
                    <FormDescription className="text-xs sm:text-sm">
                      What do you want to accomplish?
                    </FormDescription>
                  </FormItem>
                )}
              />
              
              <FormField
                control={studySessionForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Additional notes about your study session" 
                        className="resize-none" 
                        rows={3} 
                        {...field} 
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <div className="flex justify-between pt-2">
                <Button
                  type="button" 
                  variant="outline"
                  onClick={() => setIsStudySessionDialogOpen(false)}
                  disabled={createStudySessionMutation.isPending || updateStudySessionMutation.isPending}
                  className="w-24 sm:w-28"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createStudySessionMutation.isPending || updateStudySessionMutation.isPending}
                  className="w-32 sm:w-36 bg-blue-600 hover:bg-blue-700"
                >
                  {(createStudySessionMutation.isPending || updateStudySessionMutation.isPending) ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                      Saving...
                    </>
                  ) : currentStudySession ? (
                    "Update Session"
                  ) : (
                    "Start Session"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Stats Dialog */}
      <Dialog open={isStatsDialogOpen} onOpenChange={setIsStatsDialogOpen}>
        <DialogContent className="sm:max-w-md max-w-[95vw] max-h-[80vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl font-semibold">
              <BarChart2 className="h-5 w-5" />
              Study Statistics
            </DialogTitle>
            <DialogDescription>
              View your study session history and performance metrics.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-2">
            {isLoadingStudySessions ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !studySessions || studySessions.length === 0 ? (
              <div className="text-center py-4 space-y-2">
                <BookOpen className="h-10 w-10 mx-auto text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No study sessions found.</p>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Start a new study session to track your progress.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Summary stats */}
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 sm:p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Total Focus Time</p>
                    <p className="text-lg sm:text-xl font-bold text-blue-600">
                      {formatTimeHoursMinutes(studySessions.reduce((total: number, session: StudySession) => 
                        total + (session.total_focus_time ? Number(session.total_focus_time) : 0), 0
                      ))}
                    </p>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2 sm:p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Sessions Completed</p>
                    <p className="text-lg sm:text-xl font-bold text-emerald-600">
                      {studySessions.filter((session: StudySession) => session.completed).length}
                    </p>
                  </div>
                </div>
                
                {/* Performance Graph */}
                <div>
                  <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-blue-600" />
                    Focus Time Trend
                  </h3>
                  <div className="h-[120px] bg-slate-50 dark:bg-slate-900/30 rounded-md p-2 sm:p-3 border">
                    {studySessions.length > 0 && (
                      <PerformanceGraph sessions={studySessions} />
                    )}
                  </div>
                </div>
                
                {/* Recent sessions */}
                <div>
                  <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-indigo-600" />
                    Recent Study Sessions
                  </h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1 sm:pr-2">
                    {studySessions
                      .sort((a: StudySession, b: StudySession) => b.created_at - a.created_at)
                      .slice(0, 5)
                      .map((session: StudySession) => (
                        <div 
                          key={session.id} 
                          className="border rounded-md p-2 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-sm">{session.title}</p>
                              {session.subject && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {session.subject}
                                </p>
                              )}
                            </div>
                            <Badge className={`${session.completed ? 
                              "bg-emerald-600" : "bg-blue-600"} text-xs py-0 px-2`}
                            >
                              {session.completed ? "Completed" : "In Progress"}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-1 text-xs">
                            <div>
                              <span className="text-muted-foreground">Focus:</span>{" "}
                              {formatTimeHoursMinutes(session.total_focus_time ? Number(session.total_focus_time) : 0)}
                            </div>
                            <div>
                              <span className="text-muted-foreground">Breaks:</span>{" "}
                              {session.total_breaks ? Number(session.total_breaks) : 0}
                            </div>
                          </div>
                          
                          {/* Session controls - available for all sessions */}
                          <div className="flex gap-2 mt-2 justify-end">
                            {!session.completed && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs border-blue-300 hover:bg-blue-100 dark:border-blue-700 dark:hover:bg-blue-900"
                                  onClick={async () => {
                                    try {
                                      // Set loading state for this specific session
                                      setResumeLoadingId(session.id);
                                      
                                      // Fetch the latest session data first to ensure it's up-to-date
                                      const freshSessionData = await getStudySession(session.id);
                                      
                                      if (!freshSessionData) {
                                        throw new Error("Failed to fetch session data");
                                      }
                                      
                                      // Resume this session with fresh data
                                      setCurrentStudySession(freshSessionData);
                                      setTotalFocusTime(freshSessionData.total_focus_time || 0);
                                      setTotalBreaks(freshSessionData.total_breaks || 0);
                                      
                                      // Reset timer to work state
                                      // Convert string values to numbers to ensure proper types
                                      const focusTime = typeof freshSessionData.total_focus_time === 'string' 
                                        ? parseInt(freshSessionData.total_focus_time, 10) 
                                        : freshSessionData.total_focus_time || 0;
                                      
                                      const breaks = typeof freshSessionData.total_breaks === 'string'
                                        ? parseInt(freshSessionData.total_breaks, 10)
                                        : freshSessionData.total_breaks || 0;
                                      
                                      // Set timer state
                                      setTimerState("work");
                                      setTimeLeft((settings?.work_duration || 25) * 60);
                                      setIsPaused(true);  // Set to paused so user can decide when to start
                                      setIsRunning(false);
                                      setSessionsCompleted(0);  // Reset sessions counter
                                      
                                      // Save all state to localStorage for persistence - comprehensive approach
                                      localStorage.setItem(LOCALSTORAGE_KEYS.SESSION, JSON.stringify(freshSessionData));
                                      localStorage.setItem(LOCALSTORAGE_KEYS.FOCUS_TIME, String(focusTime));
                                      localStorage.setItem(LOCALSTORAGE_KEYS.BREAKS, String(breaks));
                                      
                                      // Also save timer state
                                      localStorage.setItem(LOCALSTORAGE_KEYS.TIMER_LEFT, String((settings?.work_duration || 25) * 60));
                                      localStorage.setItem(LOCALSTORAGE_KEYS.TIMER_STATE, "work");
                                      localStorage.setItem(LOCALSTORAGE_KEYS.TIMER_SESSIONS_COMPLETED, "0");
                                      localStorage.setItem(LOCALSTORAGE_KEYS.TIMER_IS_RUNNING, "false");
                                      localStorage.setItem(LOCALSTORAGE_KEYS.TIMER_IS_PAUSED, "true");
                                      
                                      // Close the stats dialog
                                      setIsStatsDialogOpen(false);
                                      
                                      toast({
                                        title: "Session Resumed",
                                        description: `Resumed study session: ${freshSessionData.title}`,
                                      });
                                    } catch (error) {
                                      console.error("Failed to resume session:", error);
                                      toast({
                                        title: "Resume Failed",
                                        description: "Failed to resume the session. Please try again.",
                                        variant: "destructive",
                                      });
                                    } finally {
                                      // Clear loading state
                                      setResumeLoadingId(null);
                                    }
                                  }}
                                  disabled={resumeLoadingId === session.id}
                                >
                                  {resumeLoadingId === session.id ? (
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  ) : (
                                    <Play className="h-3 w-3 mr-1" />
                                  )}
                                  {resumeLoadingId === session.id ? "Loading..." : "Resume"}
                                </Button>
                                
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs border-red-300 hover:bg-red-100 dark:border-red-700 dark:hover:bg-red-900 hover:text-red-600"
                                  onClick={async () => {
                                    try {
                                      // Clone the session
                                      const sessionToEnd = {...session};
                                      
                                      // First update UI optimistically
                                      queryClient.setQueryData([QUERY_KEYS.STUDY_SESSIONS], (oldSessions: StudySession[] | undefined) => {
                                        if (!oldSessions) return [];
                                        return oldSessions.map(s => 
                                          s.id === sessionToEnd.id ? {...s, completed: true} : s
                                        );
                                      });
                                      
                                      // If this is current active session, clear timer state
                                      if (currentStudySession && currentStudySession.id === sessionToEnd.id) {
                                        setCurrentStudySession(null);
                                        clearLocalStorageState();
                                        setTotalFocusTime(0);
                                        setTotalBreaks(0);
                                        setTimerState("work");
                                        setTimeLeft((settings?.work_duration || 25) * 60);
                                        setSessionsCompleted(0);
                                        setIsRunning(false);
                                        setIsPaused(false);
                                      }
                                      
                                      // Ensure we explicitly convert all values to proper types before updating
                                      const total_focus_time = Number(
                                        typeof session.total_focus_time === 'string' 
                                          ? parseInt(session.total_focus_time, 10) 
                                          : session.total_focus_time || 0
                                      );
                                      
                                      const total_breaks = Number(
                                        typeof session.total_breaks === 'string' 
                                          ? parseInt(session.total_breaks, 10) 
                                          : session.total_breaks || 0
                                      );
                                      
                                      // Call updateStudySessionMutation directly
                                      updateStudySessionMutation.mutate({
                                        id: sessionToEnd.id,
                                        completed: true,
                                        total_focus_time,
                                        total_breaks
                                      });
                                      
                                      toast({
                                        title: "Session Completed",
                                        description: "Session has been marked as completed.",
                                      });
                                    } catch (error) {
                                      console.error("End session operation failed:", error);
                                      toast({
                                        title: "End Failed",
                                        description: "Failed to end the session. Please try again.",
                                        variant: "destructive",
                                      });
                                    }
                                  }}
                                >
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  End
                                </Button>
                              </>
                            )}
                            
                            {/* Delete button for all sessions */}
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs border-gray-300 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-900 hover:text-gray-600"
                              onClick={() => {
                                // Set the session to delete and show confirmation dialog
                                setSessionToDelete(session);
                                setShowDeleteConfirm(true);
                              }}
                            >
                              <Trash className="h-3 w-3 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex justify-center mt-4">
              <Button 
                onClick={() => setIsStatsDialogOpen(false)}
                className="w-full"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Settings Dialog */}
      <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
        <DialogContent className="sm:max-w-md max-w-[95vw] max-h-[85vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl font-semibold">
              <SettingsIcon className="h-5 w-5" />
              Pomodoro Settings
            </DialogTitle>
            <DialogDescription>
              Customize your timer durations and notification preferences.
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="durations" className="mt-3 sm:mt-4">
            <TabsList className="grid grid-cols-2 mb-3 sm:mb-4 w-full">
              <TabsTrigger value="durations">Time Settings</TabsTrigger>
              <TabsTrigger value="preferences">Preferences</TabsTrigger>
            </TabsList>

            {/* Make TabsContent scrollable if needed */}
            <div className="max-h-[60vh] overflow-y-auto px-1 py-2 sm:py-4"> {/* Added wrapper for scrolling */}
              <TabsContent value="durations">
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-4 sm:space-y-5 py-2 sm:py-4"
                  >
                    <FormField
                      control={form.control}
                      name="work_duration"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex justify-between items-center">
                            <FormLabel className="text-sm sm:text-base flex items-center gap-2">
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
                              className="py-3 sm:py-4"
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
                            <FormLabel className="text-sm sm:text-base flex items-center gap-2">
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
                              className="py-3 sm:py-4"
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
                            <FormLabel className="text-sm sm:text-base flex items-center gap-2">
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
                              className="py-3 sm:py-4"
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
                            <FormLabel className="text-sm sm:text-base flex items-center gap-2">
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
                              className="py-3 sm:py-4"
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
                        className="w-24 sm:w-28"
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={updateSettings.isPending}
                        className="w-28 sm:w-32"
                        style={{ backgroundColor: timerTheme.work.primary }}
                      >
                        {updateSettings.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
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
                <div className="space-y-5 sm:space-y-6 py-2 sm:py-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="text-sm sm:text-base font-medium flex items-center gap-2">
                        {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                        Sound Notifications
                      </div>
                      <div className="text-xs sm:text-sm text-muted-foreground">
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
                      <div className="text-sm sm:text-base font-medium flex items-center gap-2">
                        <Bell className="h-4 w-4" />
                        Desktop Notifications
                      </div>
                      <div className="text-xs sm:text-sm text-muted-foreground">
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
                  
                  <div className="pt-3 sm:pt-4">
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
                              description: "Could not play sound. Check your volume or click anywhere on the page",
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
                      className="w-full mb-3 sm:mb-4"
                    >
                      <Bell className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
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
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Resume Session Dialog */}
      <AlertDialog open={!!resumeSessionData} onOpenChange={(open) => { if (!open) setResumeSessionData(null); }}>
        <AlertDialogContent className="max-w-[95vw] sm:max-w-md p-4 sm:p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg sm:text-xl">Resume Previous State?</AlertDialogTitle>
            <AlertDialogDescription>
              {resumeSessionData?.session && (
                <span className="block mb-1">You have an unfinished study session: <span className="font-semibold">{resumeSessionData.session.title || 'Untitled Session'}</span>.</span>
              )}
              {resumeSessionData?.timeLeft !== undefined && resumeSessionData?.timerState && (
                <span className="block mb-1">The timer was stopped at <span className="font-semibold">{formatTime(resumeSessionData.timeLeft)}</span> in the <span className="font-semibold">{resumeSessionData.timerState}</span> phase.</span>
              )}
              <span className="block">Would you like to resume where you left off?</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <AlertDialogCancel className="mt-2 sm:mt-0" onClick={() => {
              // Discard: Clear all persisted state and close dialog
              clearLocalStorageState();
              setResumeSessionData(null);
            }}>Discard</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              // Resume: Set state from stored data (session and/or timer) and close dialog
              if (resumeSessionData) {
                // Restore session if available
                if (resumeSessionData.session && resumeSessionData.focusTime !== undefined && resumeSessionData.breaks !== undefined) {
                  setCurrentStudySession(resumeSessionData.session);
                  setTotalFocusTime(resumeSessionData.focusTime);
                  setTotalBreaks(resumeSessionData.breaks);
                }
                // Restore timer if available - make sure to restore sessionsCompleted properly
                if (resumeSessionData.timeLeft !== undefined && 
                    resumeSessionData.timerState && 
                    resumeSessionData.sessionsCompleted !== undefined && 
                    resumeSessionData.isRunning !== undefined && 
                    resumeSessionData.isPaused !== undefined) {
                  setTimeLeft(resumeSessionData.timeLeft);
                  setTimerState(resumeSessionData.timerState);
                  // Make sure to restore the sessions count correctly
                  setSessionsCompleted(resumeSessionData.sessionsCompleted);
                  setIsRunning(resumeSessionData.isRunning);
                  // Ensure isPaused is set correctly based on isRunning
                  setIsPaused(resumeSessionData.isPaused);
                  
                  // Store the session count again to ensure consistency
                  localStorage.setItem(LOCALSTORAGE_KEYS.TIMER_SESSIONS_COMPLETED, 
                    String(resumeSessionData.sessionsCompleted));
                  
                }
              }
              setResumeSessionData(null);
            }}>Resume State</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* End Session Confirmation Dialog */}
      <AlertDialog open={showEndSessionConfirm} onOpenChange={setShowEndSessionConfirm}>
        <AlertDialogContent className="max-w-[95vw] sm:max-w-md p-4 sm:p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg sm:text-xl">End Study Session?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block">Are you sure you want to end the current study session? This action cannot be undone.</span>
              <span className="block mt-1">The session will be marked as completed, and all progress will be saved.</span>
            </AlertDialogDescription>
            
            {currentStudySession && (
              <div className="mt-4 p-2 sm:p-3 bg-gray-50 dark:bg-gray-900 rounded-md text-left">
                <div className="font-semibold text-sm mb-2">{currentStudySession.title}</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Total Focus:</span>{" "}
                    <span className="font-semibold text-blue-600">{formatTimeHoursMinutes(totalFocusTime)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Breaks:</span>{" "}
                    <span className="font-semibold text-emerald-600">{totalBreaks}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Sessions:</span>{" "}
                    <span className="font-semibold text-violet-600">{sessionsCompleted}</span>
                  </div>
                </div>
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <AlertDialogCancel className="mt-2 sm:mt-0" onClick={() => setShowEndSessionConfirm(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                endStudySession();
                setShowEndSessionConfirm(false);
              }}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              End Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Delete Session Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="max-w-[95vw] sm:max-w-md p-4 sm:p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg sm:text-xl">Delete Study Session?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">Are you sure you want to delete this study session? This action cannot be undone.</span>
              {sessionToDelete && (
                <span className="block mt-4 p-2 sm:p-3 bg-gray-50 dark:bg-gray-900 rounded-md text-left">
                  <span className="block font-semibold text-sm mb-2">{sessionToDelete.title}</span>
                  <span className="block grid grid-cols-2 gap-2 text-xs">
                    <span className="block">
                      <span className="text-muted-foreground">Total Focus:</span>{" "}
                      <span className="font-semibold text-blue-600">
                        {formatTimeHoursMinutes(sessionToDelete.total_focus_time ? Number(sessionToDelete.total_focus_time) : 0)}
                      </span>
                    </span>
                    <span className="block">
                      <span className="text-muted-foreground">Breaks:</span>{" "}
                      <span className="font-semibold text-emerald-600">
                        {sessionToDelete.total_breaks ? Number(sessionToDelete.total_breaks) : 0}
                      </span>
                    </span>
                  </span>
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <AlertDialogCancel className="mt-2 sm:mt-0" onClick={() => {
              setSessionToDelete(null);
              setShowDeleteConfirm(false);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (sessionToDelete) {
                  // If this is the current session, clear it
                  if (currentStudySession && currentStudySession.id === sessionToDelete.id) {
                    setCurrentStudySession(null);
                    clearLocalStorageState();
                    setTotalFocusTime(0);
                    setTotalBreaks(0);
                    setTimerState("work");
                    setTimeLeft((settings?.work_duration || 25) * 60);
                    setSessionsCompleted(0);
                    setIsRunning(false);
                    setIsPaused(false);
                  }
                  
                  // Delete the session
                  deleteStudySessionMutation.mutate(String(sessionToDelete.id));
                }
                setSessionToDelete(null);
                setShowDeleteConfirm(false);
              }}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Delete Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const PerformanceGraph = ({ sessions }: { sessions: StudySession[] }) => {
  // Get the last 7 sessions or fewer if not enough data
  const recentSessions = [...sessions]
    .sort((a, b) => {
      // Ensure we're comparing numbers for reliable sorting
      const dateA = typeof a.created_at === 'number' ? a.created_at : 
                   typeof a.created_at === 'string' ? parseInt(a.created_at, 10) : 0;
      const dateB = typeof b.created_at === 'number' ? b.created_at : 
                   typeof b.created_at === 'string' ? parseInt(b.created_at, 10) : 0;
      return dateB - dateA;
    })
    .slice(-7);
  
  // Find the maximum focus time to scale the graph
  const maxFocusTime = Math.max(
    ...recentSessions.map(session => session.total_focus_time ? Number(session.total_focus_time) : 0),
    900 // Min 15 mins (instead of 30) for better visualization of short sessions
  );
  
  // Helper function to parse different date formats
  function parseSessionDate(dateValue: any): Date {
    if (!dateValue) return new Date();
    try {
      // For numeric timestamp (Unix timestamp in seconds)
      if (typeof dateValue === 'number') {
        // Check if timestamp is in seconds (typical for Unix timestamps in DB)
        if (dateValue < 20000000000) { // If less than year ~2603, likely seconds not milliseconds
          return new Date(dateValue * 1000);
        }
        return new Date(dateValue);
      }
      
      // For string timestamps
      if (typeof dateValue === 'string') {
        // Check if it's a numeric string (Unix timestamp)
        if (!isNaN(Number(dateValue))) {
          const numValue = Number(dateValue);
          // Check if timestamp is in seconds
          if (numValue < 20000000000) {
            return new Date(numValue * 1000);
          }
          return new Date(numValue);
        }
        
        // For ISO format strings
        if (dateValue.includes('-')) {
          // Handle space instead of T in ISO format
          return new Date(dateValue.replace(' ', 'T'));
        }
      }
      
      // Default fallback
      return new Date(dateValue);
    } catch (e) {
      console.error("Error parsing date:", e, dateValue);
      return new Date();
    }
  }
  
  return (
    <div className="w-full h-full flex items-end justify-around gap-1 sm:gap-2 pt-6 sm:pt-8"> {/* Added responsive gaps */}
      {recentSessions.length > 0 ? recentSessions.map((session, index) => {
        const focusMinutes = Math.floor((session.total_focus_time || 0) / 60);
        const heightPercent = Math.max(((session.total_focus_time || 0) / maxFocusTime) * 100, 5);
        const isCompleted = session.completed;
        const barColor = isCompleted ? 'bg-emerald-500' : 'bg-blue-500';
        const hoverColor = isCompleted ? 'group-hover:bg-emerald-600' : 'group-hover:bg-blue-600';

        let dateLabel = "N/A";
        try {
          const date = parseSessionDate(session.created_at);
          if (!isNaN(date.getTime())) {
            // More compact date format for mobile
            dateLabel = date.toLocaleDateString(undefined, { 
              month: 'short', 
              day: 'numeric' 
            });
          }
        } catch (e) {
          console.error("Date formatting error:", e);
        }

        return (
          <div
            key={session.id || index} // Use session.id if available
            className="group relative flex flex-col items-center h-full flex-1 cursor-default"
          >
            {/* Custom Tooltip */}
            <div className="absolute bottom-full left-1/2 mb-2 w-max max-w-[120px] sm:max-w-xs px-2 py-1 bg-gray-800 text-white text-[10px] sm:text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 whitespace-nowrap transform -translate-x-1/2 pointer-events-none">
              <p className="font-semibold truncate">{session.title || "Untitled"}</p>
              <p>{focusMinutes} minutes focus</p>
              <p className="text-gray-300 text-[9px] sm:text-[10px]">{dateLabel}</p>
            </div>

            {/* Bar */}
            <div
              className={`w-3/4 max-w-[16px] sm:max-w-[20px] rounded-t-md ${barColor} ${hoverColor} transition-all duration-300 ease-out origin-bottom group-hover:scale-105`}
              style={{ height: `${heightPercent}%` }}
            ></div>

            {/* Date Label */}
            <div className="text-[8px] sm:text-[10px] text-muted-foreground mt-1 truncate w-full text-center">
              {dateLabel}
            </div>
          </div>
        );
      }) : (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs sm:text-sm">
          No recent session data to display
        </div>
      )}
    </div>
  );
};
