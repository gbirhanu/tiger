import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/lib/queryClient";
import { formatDate, getGreeting, getUserTimezone } from "@/lib/timezone";
import { Card, CardContent, } from "@/components/ui/card"
import { Button } from "@/components/ui/button";
import { ResponsiveContainer, RadialBarChart, RadialBar, Legend, Tooltip } from "recharts";
import { CheckSquare, CalendarDays, Flame, StickyNote, Clock, Video, MapPin, ChartBar, TrendingUpDown, TrendingDown, User2Icon, UsersRound, TrendingUp, Sparkles, Pin, ChevronUp, ChevronDown, AlertCircle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

import React from "react";
import { startOfDay, endOfDay, getTime } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import {
  BarChart,
  Bar, 
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  
  AreaChart,
  Area,

} from "recharts";

import { getAppointments, getNotes, getPomodoroSettings, getTasks, getMeetings, getTasksWithSubtasks, getSubtasks, getUserSettings, generateSubtasks as generateSubtasksApi } from "@/lib/api";

import {  useMemo, useEffect, useState } from "react";
import type { Task, Subtask } from "../../../shared/schema";
import { TaskMetricsSummary } from "./TaskMetricsSummary";
import { DayPlannerWizard } from "./DayPlannerWizard";
import { AnimatePresence, motion } from "framer-motion";
import StickyNoteWall from "./StickyNotesWall";

const CHART_COLORS = {
  green: "#10B981",
  blue: "#3B82F6",
  indigo: "#4F46E5",
  purple: "#8B5CF6",
  yellow: "#FBBF24",
  red: "#EF4444",
  gray: "#94A3B8"
};

// Extended Task interface to include subtask-related properties
interface TaskWithSubtaskCounts extends Task {
  completed_subtasks?: number;
  total_subtasks?: number;
  subtasks?: Subtask[];
  has_subtasks?: boolean;
}

export const DashboardOverview = () => {
  const { data: tasks = [], error: tasksError, isLoading: tasksLoading } = useQuery({
    queryKey: [QUERY_KEYS.TASKS],
    queryFn: async () => {
      const response = await getTasks();
      console.log(response);
      // Cast the response to include subtask counts
      return response as TaskWithSubtaskCounts[];
    },
  });

  const { data: notes = [], error: notesError, isLoading: notesLoading } = useQuery({
    queryKey: [QUERY_KEYS.NOTES],
    queryFn: async () => {
      const response = await getNotes();
      return response;
    },
  });

  const { data: meetings = [], error: meetingsError, isLoading: meetingsLoading } = useQuery({
    queryKey: [QUERY_KEYS.MEETINGS],
    queryFn: async () => {
      const response = await getMeetings();
      return response;
    },
  });

  const { data: appointments = [], error: appointmentsError, isLoading: appointmentsLoading } = useQuery({
    queryKey: [QUERY_KEYS.APPOINTMENTS],
    queryFn: async () => {
      const response = await getAppointments();
      return response
    },
  });

  const { data: tasksWithSubtasksIds = [], isLoading: tasksWithSubtasksLoading } = useQuery({
    queryKey: [QUERY_KEYS.TASKS_WITH_SUBTASKS],
    queryFn: async () => {
      const response = await getTasksWithSubtasks();
      return response;
    },
  });

  // Debug data
  useEffect(() => {
    
    
  }, [tasks, tasksWithSubtasksIds]);

  // Calculate task statistics with improved logic
  const taskStats = useMemo(() => {
    if (!Array.isArray(tasks)) return { completed: 0, inProgress: 0, notStarted: 0, withSubtasks: 0 };
    
    // Get IDs of tasks with subtasks for easier lookup
    const tasksWithSubtasksSet = new Set(
      Array.isArray(tasksWithSubtasksIds) ? tasksWithSubtasksIds : []
    );
    
    // Count tasks by status
    const completed = tasks.filter(task => task.completed).length;
    
    // A task is in progress if:
    // 1. It is not completed AND
    // 2. Either it has a description, OR it has at least one completed subtask
    const inProgress = tasks.filter(task => 
      !task.completed && (task.completed_subtasks && task.completed_subtasks > 0)
    ).length;

    console.log("inprogress", inProgress);

    const notStarted = tasks.length - completed - inProgress;
    
    // Count tasks with subtasks
    const withSubtasks = tasks.filter(task => 
      task.has_subtasks || 
      tasksWithSubtasksSet.has(task.id)
    ).length;
    
    return {
      completed,
      inProgress,
      notStarted,
      withSubtasks
    };
  }, [tasks, tasksWithSubtasksIds]);

  // Task progress data for radial chart
  const taskProgressData = [
    {
      name: "Completed",
      value: taskStats.completed,
      fill: "#22c55e", // green
    },
    {
      name: "In Progress",
      value: taskStats.inProgress,
      fill: "#eab308", // yellow
    },
    {
      name: "Not Started",
      value: taskStats.notStarted,
      fill: "#ef4444", // red
    },
  ];

  // Calculate subtask completion statistics
  const subtaskStats = {
    total: Array.isArray(tasks) ? tasks.reduce((sum, task) => {
      const taskWithSubtasks = task as TaskWithSubtaskCounts;
      return sum + (taskWithSubtasks.total_subtasks || 0);
    }, 0) : 0,
    completed: Array.isArray(tasks) ? tasks.reduce((sum, task) => {
      const taskWithSubtasks = task as TaskWithSubtaskCounts;
      return sum + (taskWithSubtasks.completed_subtasks || 0);
    }, 0) : 0,
  };

  // Calculate meeting statistics
  const meetingStats = useMemo(() => {
    const now = new Date();
    const TIMEZONE = getUserTimezone();
    
    // Helper function to convert timestamp to user's timezone
    const convertToTargetTimezone = (timestamp: number) => {
      if (!timestamp) return null;
      
      // If it's a number, convert from seconds to milliseconds if needed
      const milliseconds = timestamp < 10000000000 
        ? timestamp * 1000  // Convert seconds to milliseconds
        : timestamp;       // Already in milliseconds
      
      const date = new Date(milliseconds);
      const zonedDate = toZonedTime(date, TIMEZONE);
      return getTime(zonedDate); // Return millisecond timestamp for easier comparison
    };
    
    const nowMs = getTime(now);
    
    return {
      total: Array.isArray(meetings) ? meetings.length : 0,
      upcoming: Array.isArray(meetings) ? meetings.filter((meeting: any) => {
        if (!meeting.start_time) return false;
        const startTimeMs = convertToTargetTimezone(meeting.start_time);
        return startTimeMs ? startTimeMs > nowMs : false;
      }).length : 0,
      past: Array.isArray(meetings) ? meetings.filter((meeting: any) => {
        if (!meeting.start_time) return false;
        const startTimeMs = convertToTargetTimezone(meeting.start_time);
        return startTimeMs ? startTimeMs <= nowMs : false;
      }).length : 0,
    };
  }, [meetings]);

  // Calculate appointment statistics
  const appointmentStats = useMemo(() => {
    const now = new Date();
    const TIMEZONE = getUserTimezone();
    
    // Helper function to convert timestamp to user's timezone
    const convertToTargetTimezone = (timestamp: number) => {
      if (!timestamp) return null;
      
      // If it's a number, convert from seconds to milliseconds if needed
      const milliseconds = timestamp < 10000000000 
        ? timestamp * 1000  // Convert seconds to milliseconds
        : timestamp;       // Already in milliseconds
      
      const date = new Date(milliseconds);
      const zonedDate = toZonedTime(date, TIMEZONE);
      return getTime(zonedDate); // Return millisecond timestamp for easier comparison
    };
    
    const nowMs = getTime(now);
    
    return {
      total: Array.isArray(appointments) ? appointments.length : 0,
      upcoming: Array.isArray(appointments) ? appointments.filter((apt: any) => {
        if (!apt.start_time) return false;
        const startTimeMs = convertToTargetTimezone(apt.start_time);
        return startTimeMs ? startTimeMs > nowMs : false;
      }).length : 0,
      past: Array.isArray(appointments) ? appointments.filter((apt: any) => {
        if (!apt.start_time) return false;
        const startTimeMs = convertToTargetTimezone(apt.start_time);
        return startTimeMs ? startTimeMs <= nowMs : false;
      }).length : 0,
    };
  }, [appointments]);

  // Calculate productivity trends (last 7 days) with improved timestamp handling
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return {
      date,
      dateString: formatDate(date, "EEE, MMM d"),
      shortDate: formatDate(date, "EEE")
    };
  }).reverse();

  const productivityTrends = useMemo(() => {
    // Get user timezone
    const TIMEZONE = getUserTimezone();
    
    // Helper function to convert any timestamp to target timezone
    const convertToTargetTimezone = (timestamp: number) => {
      if (!timestamp) return null;
      
      // If it's a number, convert from seconds to milliseconds if needed
      const milliseconds = timestamp < 10000000000 
        ? timestamp * 1000  // Convert seconds to milliseconds
        : timestamp;       // Already in milliseconds
      
      const date = new Date(milliseconds);
      const zonedDate = toZonedTime(date, TIMEZONE);
      return zonedDate;
    };
    
    const trends = last7Days.map((day: { date: Date; dateString: string; shortDate: string }) => {
      // Get timestamp for start and end of the day
      const startOfDay = new Date(day.date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(day.date);
      endOfDay.setHours(23, 59, 59, 999);
      
      const startTimestamp = Math.floor(startOfDay.getTime() / 1000);
      const endTimestamp = Math.floor(endOfDay.getTime() / 1000);
      
      // Count completed tasks for this day - check both updated_at and completed_at
      const tasksCompleted = Array.isArray(tasks) 
        ? tasks.filter((task: any) => {
            // If task is completed and has a timestamp
            if (!task.completed) return false;
            
            // Convert updated_at to user's timezone
            const updatedAt = task.updated_at || 0;
            const updatedDate = convertToTargetTimezone(updatedAt);
            
            if (!updatedDate) return false;
            
            // Check if the task was completed on this day (using same day comparison)
            const taskDate = new Date(updatedDate);
            const completed = 
              taskDate.getFullYear() === day.date.getFullYear() &&
              taskDate.getMonth() === day.date.getMonth() &&
              taskDate.getDate() === day.date.getDate();
            
            return completed;
          }).length
        : 0;
      
      // Count meetings attended for this day
      const meetingsAttended = Array.isArray(meetings)
        ? meetings.filter((meeting: any) => {
            // Only include meetings that are completed
            if (!meeting.completed) return false;
            if (!meeting.start_time) return false;
            
            // Convert timestamp to user's timezone
            const startTime = convertToTargetTimezone(meeting.start_time);
            
            if (!startTime) return false;
            
            // Check if the meeting was on this day
            const meetingDate = new Date(startTime);
            return (
              meetingDate.getFullYear() === day.date.getFullYear() &&
              meetingDate.getMonth() === day.date.getMonth() &&
              meetingDate.getDate() === day.date.getDate()
            );
          }).length
        : 0;
      
      // Count appointments attended for this day
      const appointmentsAttended = Array.isArray(appointments)
        ? appointments.filter((apt: any) => {
            // Only include appointments that are completed
            if (!apt.completed) return false;
            if (!apt.start_time) return false;
            
            // Convert timestamp to user's timezone
            const startTime = convertToTargetTimezone(apt.start_time);
            
            if (!startTime) return false;
            
            // Check if the appointment was on this day
            const aptDate = new Date(startTime);
            return (
              aptDate.getFullYear() === day.date.getFullYear() &&
              aptDate.getMonth() === day.date.getMonth() &&
              aptDate.getDate() === day.date.getDate()
            );
          }).length
        : 0;
      
      return {
        name: day.shortDate,
        fullDate: day.dateString,
        tasks: tasksCompleted,
        meetings: meetingsAttended,
        appointments: appointmentsAttended,
        total: tasksCompleted + meetingsAttended + appointmentsAttended
      };
    });
    
    return trends;
  }, [tasks, meetings, appointments, last7Days]);

  const getProductivityScore = () => {
    // Calculate task completion percentage
    const taskCompletionRate = tasks.length > 0 
      ? (taskStats.completed / tasks.length) * 100 
      : 0;
    
    // Calculate subtask completion percentage
    const subtaskCompletionRate = subtaskStats.total > 0 
      ? (subtaskStats.completed / subtaskStats.total) * 100 
      : 0;
    
    // Calculate meeting completion rate (meetings marked as completed)
    const meetingCompletionRate = meetingStats.past > 0 
      ? (Array.isArray(meetings) 
          ? meetings.filter(m => m.completed).length / meetingStats.past * 100
          : 0)
      : 0;

    // Calculate appointment completion rate (appointments marked as completed)
    const appointmentCompletionRate = appointmentStats.past > 0 
      ? (Array.isArray(appointments) 
          ? appointments.filter(a => a.completed).length / appointmentStats.past * 100
          : 0)
      : 0;

    // Compute overdue meetings and appointments that aren't marked as completed
    const overdueMeetings = Array.isArray(meetings) 
      ? meetings.filter(m => !m.completed && m.end_time < Math.floor(Date.now() / 1000)).length
      : 0;
    
    const overdueAppointments = Array.isArray(appointments) 
      ? appointments.filter(a => !a.completed && a.end_time < Math.floor(Date.now() / 1000)).length
      : 0;

    // Calculate overall productivity score (weighted average)
    const weightedScore = (
      taskCompletionRate * 0.4 + 
      subtaskCompletionRate * 0.2 + 
      meetingCompletionRate * 0.2 + 
      appointmentCompletionRate * 0.2
    );
    
    // Reduce score if there are overdue items
    const overdueCount = overdueMeetings + overdueAppointments;
    const overduePenalty = overdueCount > 0 ? Math.min(overdueCount * 5, 30) : 0;
    
    const finalScore = Math.max(0, Math.min(100, weightedScore - overduePenalty));
    const productivityScore = Math.round(finalScore);
    
    // Determine score category and colors
    let scoreCategory = "Low";
    let scoreColor = "text-red-600 dark:text-red-400";
    let scoreGradient = "from-red-500 to-red-300";
    let scoreBg = "bg-red-100 dark:bg-red-900/30";
    
    if (productivityScore >= 70) {
      scoreCategory = "Excellent";
      scoreColor = "text-green-600 dark:text-green-400";
      scoreGradient = "from-green-500 to-green-300";
      scoreBg = "bg-green-100 dark:bg-green-900/30";
    } else if (productivityScore >= 50) {
      scoreCategory = "Good";
      scoreColor = "text-amber-600 dark:text-amber-400";
      scoreGradient = "from-amber-500 to-amber-300";
      scoreBg = "bg-amber-100 dark:bg-amber-900/30";
    } else if (productivityScore >= 30) {
      scoreCategory = "Average";
      scoreColor = "text-orange-600 dark:text-orange-400";
      scoreGradient = "from-orange-500 to-orange-300";
      scoreBg = "bg-orange-100 dark:bg-orange-900/30";
    } 

    return {
      productivityScore,
      taskCompletionRate: Math.round(taskCompletionRate),
      subtaskCompletionRate: Math.round(subtaskCompletionRate),
      meetingCompletionRate: Math.round(meetingCompletionRate),
      appointmentCompletionRate: Math.round(appointmentCompletionRate),
      overdueMeetings,
      overdueAppointments,
      scoreCategory,
      scoreColor,
      scoreGradient,
      scoreBg
    };
  };

  // Calculate hourly activity distribution (24-hour format)
  const hourlyActivityData = useMemo(() => {
    // Get user timezone
    const TIMEZONE = getUserTimezone();
    
    // Define interface for hourly data
    interface HourlyDataItem {
      hour: number;
      displayHour: string;
      tasks: number;
      meetings: number;
      appointments: number;
      total: number;
      isCurrentHour?: boolean;
    }
    
    // Improved helper function to convert any timestamp to target timezone with proper error handling
    const convertToTargetTimezone = (timestamp: number): Date | null => {
      try {
      if (!timestamp) return null;
      
      // If it's a number, convert from seconds to milliseconds if needed
      const milliseconds = timestamp < 10000000000 
        ? timestamp * 1000  // Convert seconds to milliseconds
        : timestamp;       // Already in milliseconds
      
      const date = new Date(milliseconds);
        
        // Validate the date is valid before conversion
        if (isNaN(date.getTime())) {
          console.warn(`Invalid timestamp detected: ${timestamp}`);
          return null;
        }
        
        // Convert to user's timezone
      const zonedDate = toZonedTime(date, TIMEZONE);
      return zonedDate;
      } catch (error) {
        console.error(`Error converting timestamp ${timestamp} to timezone ${TIMEZONE}:`, error);
        return null;
      }
    };
    
    // Initialize hourly data structure with proper labels
    const hourlyData: HourlyDataItem[] = Array.from({ length: 24 }, (_, hour) => {
      // Format display hour in a more readable way
      let displayHour;
      if (hour === 0) displayHour = '12 AM';
      else if (hour === 12) displayHour = '12 PM';
      else if (hour < 12) displayHour = `${hour} AM`;
      else displayHour = `${hour - 12} PM`;
      
      return {
        hour,
        displayHour,
      tasks: 0,
      meetings: 0,
      appointments: 0,
      total: 0
      };
    });

    // Track if we have any data at all
    let hasAnyData = false;

    // Populate with task data
    if (Array.isArray(tasks)) {
      tasks.forEach((task: any) => {
        if (task && task.completed && task.updated_at) {
            // Convert timestamp to user's timezone
            const zonedDate = convertToTargetTimezone(task.updated_at);
            
            if (zonedDate) {
              const hour = zonedDate.getHours();
              
              if (hour >= 0 && hour < 24) {
                hourlyData[hour].tasks += 1;
                hourlyData[hour].total += 1;
              hasAnyData = true;
              }
          }
        }
      });
    }

    // Populate with meeting data - show completed meetings
    if (Array.isArray(meetings)) {
      meetings.forEach((meeting: any) => {
        if (meeting && meeting.start_time) {
          // Only count completed meetings
          if (meeting.completed) {
          // Convert timestamp to user's timezone
          const zonedDate = convertToTargetTimezone(meeting.start_time);
          
          if (zonedDate) {
            const hour = zonedDate.getHours();
            if (hour >= 0 && hour < 24) {
              hourlyData[hour].meetings += 1;
              hourlyData[hour].total += 1;
                hasAnyData = true;
              }
            }
          }
        }
      });
    }

    // Populate with appointment data - show completed appointments
    if (Array.isArray(appointments)) {
      appointments.forEach((apt: any) => {
        if (apt && apt.start_time) {
          // Only count completed appointments
          if (apt.completed) {
          // Convert timestamp to user's timezone
          const zonedDate = convertToTargetTimezone(apt.start_time);
          
          if (zonedDate) {
            const hour = zonedDate.getHours();
            if (hour >= 0 && hour < 24) {
              hourlyData[hour].appointments += 1;
              hourlyData[hour].total += 1;
                hasAnyData = true;
              }
            }
          }
        }
      });
    }
    
    // Add current hour marker to the data if we have any data
    if (hasAnyData) {
      const now = new Date();
      const currentHour = toZonedTime(now, TIMEZONE).getHours();
      
      // Mark the current hour (will be shown in the UI)
      if (currentHour >= 0 && currentHour < 24) {
        hourlyData[currentHour].isCurrentHour = true;
      }
    }
    
    return hourlyData;
  }, [tasks, meetings, appointments]);

  // Calculate monthly task completion trends (last 6 months)
  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    return {
      date: new Date(date.getFullYear(), date.getMonth(), 1),
      month: formatDate(date, "MMM yyyy")
    };
  }).reverse();

  const monthlyCompletionTrends = useMemo(() => {
    // Debug tasks data
    
    // Get user timezone
    const TIMEZONE = getUserTimezone();
    
    // Helper function to convert any timestamp to target timezone
    const convertToTargetTimezone = (timestamp: number) => {
      if (!timestamp) return null;
      
      // If it's a number, convert from seconds to milliseconds if needed
      const milliseconds = timestamp < 10000000000 
        ? timestamp * 1000  // Convert seconds to milliseconds
        : timestamp;       // Already in milliseconds
      
      const date = new Date(milliseconds);
      const zonedDate = toZonedTime(date, TIMEZONE);
      return zonedDate;
    };
    
    const trends = last6Months.map(monthData => {
      // Get the year and month for comparison
      const year = monthData.date.getFullYear();
      const month = monthData.date.getMonth();
      
      // Count tasks created in this month
      const tasksCreated = Array.isArray(tasks) 
        ? tasks.filter((task: any) => {
            if (!task.created_at) return false;
            
            // Convert timestamp to user's timezone
            const createdDate = convertToTargetTimezone(task.created_at);
            if (!createdDate) return false;
            
            // Check if created in this month
            return (
              createdDate.getFullYear() === year &&
              createdDate.getMonth() === month
            );
          }).length
        : 0;
      
      // Count tasks completed in this month
      const tasksCompleted = Array.isArray(tasks) 
        ? tasks.filter((task: any) => {
            if (!task.completed || !task.updated_at) return false;
            
            // Convert timestamp to user's timezone
            const updatedDate = convertToTargetTimezone(task.updated_at);
            if (!updatedDate) return false;
            
            // Check if completed in this month
            return (
              updatedDate.getFullYear() === year &&
              updatedDate.getMonth() === month
            );
          }).length
        : 0;
      
      // Debug counts for this month
      try {
        
      } catch (error) {
        console.error(`Error logging month counts for ${monthData.month}:`, error);
      }
      
      return {
        name: monthData.month,
        created: tasksCreated,
        completed: tasksCompleted,
        completion_rate: tasksCreated > 0 ? Math.round((tasksCompleted / tasksCreated) * 100) : 0
      };
    });
    
    // Debug final trends data
    try {
      
    } catch (error) {
      console.error("Error logging monthly completion trends:", error);
    }
    
    return trends;
  }, [tasks, last6Months]);

  // Calculate task priority distribution
  const taskPriorityStats = {
    high: Array.isArray(tasks) ? tasks.filter((task: any) => task.priority === 'high').length : 0,
    medium: Array.isArray(tasks) ? tasks.filter((task: any) => task.priority === 'medium').length : 0,
    low: Array.isArray(tasks) ? tasks.filter((task: any) => task.priority === 'low').length : 0,
  };

  const taskPriorityData = [
    { name: 'High', value: taskPriorityStats.high, fill: CHART_COLORS.red },
    { name: 'Medium', value: taskPriorityStats.medium, fill: CHART_COLORS.yellow },
    { name: 'Low', value: taskPriorityStats.low, fill: CHART_COLORS.green },
  ].filter(item => item.value > 0);

  // Get upcoming appointments safely
  const upcomingAppointments = useMemo(() => {
    const now = new Date();
    const TIMEZONE = getUserTimezone();
    
    // Helper function to convert timestamp to user's timezone
    const convertToTargetTimezone = (timestamp: number) => {
      if (!timestamp) return null;
      
      // If it's a number, convert from seconds to milliseconds if needed
      const milliseconds = timestamp < 10000000000 
        ? timestamp * 1000  // Convert seconds to milliseconds
        : timestamp;       // Already in milliseconds
      
      const date = new Date(milliseconds);
      const zonedDate = toZonedTime(date, TIMEZONE);
      return getTime(zonedDate); // Return millisecond timestamp for easier comparison
    };
    
    const nowMs = getTime(now);
    
    return Array.isArray(appointments) 
      ? appointments
          .filter((apt: any) => {
            if (!apt.start_time) return false;
            const startTimeMs = convertToTargetTimezone(apt.start_time);
            return startTimeMs ? startTimeMs > nowMs : false;
          })
          .sort((a: any, b: any) => {
            const aTimeMs = convertToTargetTimezone(a.start_time) || 0;
            const bTimeMs = convertToTargetTimezone(b.start_time) || 0;
            return aTimeMs - bTimeMs;
          })
          .slice(0, 3) 
      : [];
  }, [appointments]);

  // Get upcoming meetings safely
  const upcomingMeetings = useMemo(() => {
    const now = new Date();
    const TIMEZONE = getUserTimezone();
    
    // Helper function to convert timestamp to user's timezone
    const convertToTargetTimezone = (timestamp: number) => {
      if (!timestamp) return null;
      
      // If it's a number, convert from seconds to milliseconds if needed
      const milliseconds = timestamp < 10000000000 
        ? timestamp * 1000  // Convert seconds to milliseconds
        : timestamp;       // Already in milliseconds
      
      const date = new Date(milliseconds);
      const zonedDate = toZonedTime(date, TIMEZONE);
      return getTime(zonedDate); // Return millisecond timestamp for easier comparison
    };
    
    const nowMs = getTime(now);
    
    return Array.isArray(meetings) 
      ? meetings
          .filter((meeting: any) => {
            if (!meeting.start_time) return false;
            const startTimeMs = convertToTargetTimezone(meeting.start_time);
            return startTimeMs ? startTimeMs > nowMs : false;
          })
          .sort((a: any, b: any) => {
            const aTimeMs = convertToTargetTimezone(a.start_time) || 0;
            const bTimeMs = convertToTargetTimezone(b.start_time) || 0;
            return aTimeMs - bTimeMs;
          })
          .slice(0, 3) 
      : [];
  }, [meetings]);

  const [showDayPlanner, setShowDayPlanner] = useState(false);
  const [currentNoteIndex, setCurrentNoteIndex] = useState(0);

  if (tasksError || notesError || appointmentsError || meetingsError) {
    return (
      <div className="p-4 text-red-500">
        Error loading dashboard data. Please try again later.
      </div>
    );
  }

  if (tasksLoading || notesLoading || appointmentsLoading || meetingsLoading || tasksWithSubtasksLoading) {
    return (
      <div className="p-4">
        Loading dashboard data...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome section with greeting based on time of day */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-6 rounded-xl  shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight">
              {getGreeting()}, <span className="text-primary">{localStorage.getItem("userName")?.split(" ")[0] || "User"}</span>
            </h2>
            <div className="border-r-2 border-r-yellow-700 dark:border-r-gray-700 pl-2 bg-gray-100 dark:bg-gray-800 p-2 rounded-lg w-fit flex items-center gap-2">
            <CalendarDays className="h-4 w-4" /> 
            {formatDate(new Date(), "MMM d, yyyy ")}
            {/* add clock teller here */}
            <span className="text-sm font-medium border-l pl-2 border-l-yellow-700 dark:border-l-gray-700 flex items-center">
              <Clock className="h-3 w-3 mr-1" />
              <span id="currentTime">{formatDate(new Date(), "h:mm a")}</span>
            </span>
            <script dangerouslySetInnerHTML={{__html: `
              function updateClock() {
                const timeElement = document.getElementById('currentTime');
                if (timeElement) {
                  const now = new Date();
                  
                  try {
                    // Get the user's timezone or use browser default
                    const userTimezone = localStorage.getItem('userTimezone') || Intl.DateTimeFormat().resolvedOptions().timeZone;
                    
                    // Format time with timezone
                    const options = { 
                      hour: 'numeric', 
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: true
                    };
                    
                    const formatter = new Intl.DateTimeFormat('en-US', options);
                    timeElement.textContent = formatter.format(now);
                  } catch (error) {
                    // Fallback if there's an error
                    timeElement.textContent = now.toLocaleTimeString();
                  }
                }
                setTimeout(updateClock, 1000);
              }
              updateClock();
            `}} />
            </div>
            </div>
            <p className="text-muted-foreground mt-1">
              Here's what's happening with your tasks and schedule today.
            </p>
          </div>
          <div className="mt-4 md:mt-0 flex items-center gap-3">
            <Button 
              variant="default" 
              size="sm" 
              className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              onClick={() => setShowDayPlanner(true)}
            >
              <CalendarDays className="h-4 w-4" />
              <span>Plan My Day</span>
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              className="gap-2"
              onClick={() => {
                localStorage.setItem('selectedNav', 'Tasks');
                window.location.reload();
              }}
            >
              <CheckSquare className="h-4 w-4" />
              <span>View Tasks</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2"
              onClick={() => {
                localStorage.setItem('selectedNav', 'Calendar');
                window.location.reload();
              }}
            >
              <CalendarDays className="h-4 w-4" />
              <span>Calendar</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Stats overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="overflow-hidden border-l-4 border-l-blue-500">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Tasks</p>
                <h3 className="text-2xl font-bold mt-1">{Array.isArray(tasks) ? tasks.length : 0}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {taskStats.completed} completed
                </p>
              </div>
              <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg cursor-pointer"
                onClick={() => {
                  localStorage.setItem('selectedNav', 'Tasks');
                  window.location.reload();
                }}
              >
                <CheckSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-l-4 border-l-green-500">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Completion Rate</p>
                <h3 className="text-2xl font-bold mt-1">
                  {Array.isArray(tasks) && tasks.length > 0
                    ? Math.round((taskStats.completed / tasks.length) * 100)
                    : 0}%
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {taskStats.inProgress} in progress
                </p>
              </div>
              <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-lg">
                <Flame className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-l-4 border-l-amber-500">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Notes</p>
                <h3 className="text-2xl font-bold mt-1">{Array.isArray(notes) ? notes.length : 0}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {Array.isArray(notes) ? notes.filter((note: any) => note.pinned).length : 0} pinned
                </p>
              </div>
              <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-lg cursor-pointer"
                onClick={() => {
                  localStorage.setItem('selectedNav', 'Notes');
                  window.location.reload();
                }}
              >
                <StickyNote className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>



        <Card className="overflow-hidden border-l-4 border-l-purple-500">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Upcoming</p>
                <h3 className="text-2xl font-bold mt-1">
                  {upcomingMeetings.length + upcomingAppointments.length}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {upcomingMeetings.length} meetings, {upcomingAppointments.length} appointments
                </p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className={`bg-purple-100 dark:bg-purple-900/30 p-2 rounded-lg  ${upcomingAppointments.length > 0 ? 'opacity-100 cursor-pointer' : 'opacity-50'}`} 
                onClick={() => {
                  if(upcomingAppointments.length > 0){
                    localStorage.setItem('selectedNav', 'Appointments');
                    window.location.reload();
                  }
                  }}
                  title="View Appointments"
                >
                  <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div className={`bg-purple-100 dark:bg-purple-900/30 p-2 rounded-lg  ${upcomingMeetings.length > 0 ? 'opacity-100 cursor-pointer' : 'opacity-50'}`} 
                onClick={() => {
                    if(upcomingMeetings.length > 0){
                    localStorage.setItem('selectedNav', 'Meetings');
                    window.location.reload();
                  }
                }}
                title="View Meetings"
                >
                  <Video className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Productivity Score */}
      <Card className="relative overflow-hidden shadow-md">
        <div className={cn(
          "absolute inset-0 bg-gradient-to-br",
          getProductivityScore().productivityScore >= 70 ? "from-green-100 via-green-50 to-transparent dark:from-green-900/30 dark:via-green-800/10 dark:to-transparent" :
          getProductivityScore().productivityScore >= 50 ? "from-amber-100 via-amber-50 to-transparent dark:from-amber-900/30 dark:via-amber-800/10 dark:to-transparent" : 
          getProductivityScore().productivityScore >= 30 ? "from-orange-100 via-orange-50 to-transparent dark:from-orange-900/30 dark:via-orange-800/10 dark:to-transparent" : 
          "from-red-100 via-red-50 to-transparent dark:from-red-900/30 dark:via-red-800/10 dark:to-transparent"
        )} />
        <CardContent className="p-6 relative z-10">
          <div className="flex flex-col space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ChartBar className={cn(
                  "h-5 w-5",
                  getProductivityScore().scoreColor
                )} />
                <h3 className="text-lg font-bold mb-0">Productivity Score</h3>
              </div>
              <div className={cn(
                "px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 border",
                getProductivityScore().productivityScore >= 70 ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800" :
                getProductivityScore().productivityScore >= 50 ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800" : 
                getProductivityScore().productivityScore >= 30 ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800" : 
                "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800"
              )}>
                {getProductivityScore().productivityScore >= 70 ? <Sparkles className="h-3.5 w-3.5" /> : 
                 getProductivityScore().productivityScore >= 50 ? <TrendingUp className="h-3.5 w-3.5" /> :
                 getProductivityScore().productivityScore >= 30 ? <TrendingUpDown className="h-3.5 w-3.5" /> :
                 <TrendingDown className="h-3.5 w-3.5" />}
                {getProductivityScore().scoreCategory}
                </div>
            </div>
            
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="flex flex-col items-center justify-center relative">
                {/* Remove the redundant border div and rely only on the SVG circle */}
                
                {/* Dynamic progress ring based on score */}
                <svg className="absolute inset-0" width="152" height="152" viewBox="0 0 152 152">
                  <circle 
                    cx="76" 
                    cy="76" 
                    r="70" 
                    fill="none" 
                    strokeWidth="6" 
                    stroke={getProductivityScore().productivityScore >= 70 ? "#22c55e" : 
                            getProductivityScore().productivityScore >= 50 ? "#eab308" : 
                            getProductivityScore().productivityScore >= 30 ? "#f97316" : "#ef4444"}
                    strokeDasharray={`${getProductivityScore().productivityScore * 4.5} 1000`}
                    strokeLinecap="round"
                    transform="rotate(-90 76 76)"
                    style={{ transition: "stroke-dasharray 1s ease" }}
                    className="opacity-70 dark:opacity-40"
                  />
                </svg>
                
                <div className={cn(
                  "relative h-36 w-36 rounded-full flex items-center justify-center",
                  "bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900",
                  "shadow-lg border-0",
                  // Remove the border here since we're using the SVG circle for the colored ring
                )}>
                  <span className={cn(
                    "text-5xl font-bold",
                    getProductivityScore().scoreColor
                  )}>
                    {getProductivityScore().productivityScore}
                  </span>
                  {getProductivityScore().productivityScore >= 80 && (
                    <Sparkles className="absolute top-0 right-0 h-8 w-8 text-yellow-400 animate-pulse" />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-3 px-3 py-1.5 rounded-full bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700">
                  {getProductivityScore().productivityScore < 50 ? (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  ) : (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  )}
                  <span className="text-sm font-medium">
                    {getProductivityScore().productivityScore < 50 ? "Needs attention" : "On track"}
                  </span>
                </div>
              </div>
              
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6 md:mt-0">
                <div className={cn(
                  "p-4 rounded-lg flex items-center gap-3 border transition-all hover:shadow-md",
                  getProductivityScore().taskCompletionRate >= 70 ? "bg-green-50/70 border-green-200 dark:bg-green-900/20 dark:border-green-800/40" :
                  getProductivityScore().taskCompletionRate >= 40 ? "bg-amber-50/70 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800/40" :
                  "bg-red-50/70 border-red-200 dark:bg-red-900/20 dark:border-red-800/40"
                )}>
                  <div className={cn(
                    "h-14 w-14 rounded-full flex items-center justify-center relative",
                    getProductivityScore().taskCompletionRate >= 70 ? "bg-green-100 dark:bg-green-800" :
                    getProductivityScore().taskCompletionRate >= 40 ? "bg-amber-100 dark:bg-amber-800" :
                    "bg-red-100 dark:bg-red-800"
                  )}>
                    {/* Mini circular progress indicator */}
                    <svg className="absolute inset-0" width="56" height="56" viewBox="0 0 56 56">
                      <circle 
                        cx="28" 
                        cy="28" 
                        r="24" 
                        fill="none" 
                        strokeWidth="3" 
                        stroke={getProductivityScore().taskCompletionRate >= 70 ? "#22c55e" : 
                                getProductivityScore().taskCompletionRate >= 40 ? "#eab308" : "#ef4444"}
                        strokeDasharray={`${getProductivityScore().taskCompletionRate * 1.51} 1000`}
                        strokeLinecap="round"
                        transform="rotate(-90 28 28)"
                        className="opacity-80 dark:opacity-60"
                      />
                    </svg>
                    <CheckSquare className={cn(
                      "h-6 w-6 z-10",
                      getProductivityScore().taskCompletionRate >= 70 ? "text-green-600 dark:text-green-300" :
                      getProductivityScore().taskCompletionRate >= 40 ? "text-amber-600 dark:text-amber-300" :
                      "text-red-600 dark:text-red-300"
                    )} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium">Tasks</p>
                      {getProductivityScore().taskCompletionRate >= 70 && <Sparkles className="h-3.5 w-3.5 text-green-500" />}
                    </div>
                    <div className="flex items-center mt-1">
                      <p className={cn(
                        "text-2xl font-bold",
                        getProductivityScore().taskCompletionRate >= 70 ? "text-green-600 dark:text-green-400" :
                        getProductivityScore().taskCompletionRate >= 40 ? "text-amber-600 dark:text-amber-400" :
                        "text-red-600 dark:text-red-400"
                      )}>
                        {getProductivityScore().taskCompletionRate}%
                      </p>
                      <span className="text-xs ml-2 text-gray-500 dark:text-gray-400">completion</span>
                    </div>
                  </div>
                </div>
            
                <div className={cn(
                  "p-4 rounded-lg flex items-center gap-3 border transition-all hover:shadow-md",
                  getProductivityScore().subtaskCompletionRate >= 70 ? "bg-indigo-50/70 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800/40" :
                  getProductivityScore().subtaskCompletionRate >= 40 ? "bg-indigo-50/50 border-indigo-200/80 dark:bg-indigo-900/10 dark:border-indigo-800/30" :
                  "bg-red-50/70 border-red-200 dark:bg-red-900/20 dark:border-red-800/40"
                )}>
                  <div className={cn(
                    "h-14 w-14 rounded-full flex items-center justify-center relative",
                    getProductivityScore().subtaskCompletionRate >= 70 ? "bg-indigo-100 dark:bg-indigo-800" :
                    getProductivityScore().subtaskCompletionRate >= 40 ? "bg-indigo-100/70 dark:bg-indigo-800/70" :
                    "bg-red-100 dark:bg-red-800"
                  )}>
                    {/* Mini circular progress indicator */}
                    <svg className="absolute inset-0" width="56" height="56" viewBox="0 0 56 56">
                      <circle 
                        cx="28" 
                        cy="28" 
                        r="24" 
                        fill="none" 
                        strokeWidth="3" 
                        stroke={getProductivityScore().subtaskCompletionRate >= 70 ? "#6366f1" : 
                                getProductivityScore().subtaskCompletionRate >= 40 ? "#818cf8" : "#ef4444"}
                        strokeDasharray={`${getProductivityScore().subtaskCompletionRate * 1.51} 1000`}
                        strokeLinecap="round"
                        transform="rotate(-90 28 28)"
                        className="opacity-80 dark:opacity-60"
                      />
                    </svg>
                    <CheckSquare className={cn(
                      "h-6 w-6 z-10",
                      getProductivityScore().subtaskCompletionRate >= 70 ? "text-indigo-600 dark:text-indigo-300" :
                      getProductivityScore().subtaskCompletionRate >= 40 ? "text-indigo-600/70 dark:text-indigo-300/70" :
                      "text-red-600 dark:text-red-300"
                    )} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium">Subtasks</p>
                      {getProductivityScore().subtaskCompletionRate >= 70 && <Sparkles className="h-3.5 w-3.5 text-indigo-500" />}
                    </div>
                    <div className="flex items-center mt-1">
                      <p className={cn(
                        "text-2xl font-bold",
                        getProductivityScore().subtaskCompletionRate >= 70 ? "text-indigo-600 dark:text-indigo-400" :
                        getProductivityScore().subtaskCompletionRate >= 40 ? "text-indigo-600/80 dark:text-indigo-400/80" :
                        "text-red-600 dark:text-red-400"
                      )}>
                        {getProductivityScore().subtaskCompletionRate}%
                      </p>
                      <span className="text-xs ml-2 text-gray-500 dark:text-gray-400">completion</span>
                    </div>
                  </div>
                </div>
              
                <div className={cn(
                  "p-4 rounded-lg flex items-center gap-3 border transition-all hover:shadow-md",
                  getProductivityScore().meetingCompletionRate >= 70 ? "bg-purple-50/70 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800/40" :
                  getProductivityScore().meetingCompletionRate >= 40 ? "bg-purple-50/50 border-purple-200/80 dark:bg-purple-900/10 dark:border-purple-800/30" :
                  "bg-red-50/70 border-red-200 dark:bg-red-900/20 dark:border-red-800/40"
                )}>
                  <div className={cn(
                    "h-14 w-14 rounded-full flex items-center justify-center relative",
                    getProductivityScore().meetingCompletionRate >= 70 ? "bg-purple-100 dark:bg-purple-800" :
                    getProductivityScore().meetingCompletionRate >= 40 ? "bg-purple-100/70 dark:bg-purple-800/70" :
                    "bg-red-100 dark:bg-red-800"
                  )}>
                    {/* Mini circular progress indicator */}
                    <svg className="absolute inset-0" width="56" height="56" viewBox="0 0 56 56">
                      <circle 
                        cx="28" 
                        cy="28" 
                        r="24" 
                        fill="none" 
                        strokeWidth="3" 
                        stroke={getProductivityScore().meetingCompletionRate >= 70 ? "#9333ea" : 
                                getProductivityScore().meetingCompletionRate >= 40 ? "#a855f7" : "#ef4444"}
                        strokeDasharray={`${getProductivityScore().meetingCompletionRate * 1.51} 1000`}
                        strokeLinecap="round"
                        transform="rotate(-90 28 28)"
                        className="opacity-80 dark:opacity-60"
                      />
                    </svg>
                    <Video className={cn(
                      "h-6 w-6 z-10",
                      getProductivityScore().meetingCompletionRate >= 70 ? "text-purple-600 dark:text-purple-300" :
                      getProductivityScore().meetingCompletionRate >= 40 ? "text-purple-600/70 dark:text-purple-300/70" :
                      "text-red-600 dark:text-red-300"
                    )} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium">Meetings</p>
                      {getProductivityScore().meetingCompletionRate >= 70 && <Sparkles className="h-3.5 w-3.5 text-purple-500" />}
                    </div>
                    <div className="flex items-center mt-1">
                      <p className={cn(
                        "text-2xl font-bold",
                        getProductivityScore().meetingCompletionRate >= 70 ? "text-purple-600 dark:text-purple-400" :
                        getProductivityScore().meetingCompletionRate >= 40 ? "text-purple-600/80 dark:text-purple-400/80" :
                        "text-red-600 dark:text-red-400"
                      )}>
                        {getProductivityScore().meetingCompletionRate}%
                      </p>
                      <span className="text-xs ml-2 text-gray-500 dark:text-gray-400">completion</span>
                    </div>
                  </div>
                </div>
              
                <div className={cn(
                  "p-4 rounded-lg flex items-center gap-3 border transition-all hover:shadow-md",
                  getProductivityScore().appointmentCompletionRate >= 70 ? "bg-teal-50/70 border-teal-200 dark:bg-teal-900/20 dark:border-teal-800/40" :
                  getProductivityScore().appointmentCompletionRate >= 40 ? "bg-teal-50/50 border-teal-200/80 dark:bg-teal-900/10 dark:border-teal-800/30" :
                  "bg-red-50/70 border-red-200 dark:bg-red-900/20 dark:border-red-800/40"
                )}>
                  <div className={cn(
                    "h-14 w-14 rounded-full flex items-center justify-center relative",
                    getProductivityScore().appointmentCompletionRate >= 70 ? "bg-teal-100 dark:bg-teal-800" :
                    getProductivityScore().appointmentCompletionRate >= 40 ? "bg-teal-100/70 dark:bg-teal-800/70" :
                    "bg-red-100 dark:bg-red-800"
                  )}>
                    {/* Mini circular progress indicator */}
                    <svg className="absolute inset-0" width="56" height="56" viewBox="0 0 56 56">
                      <circle 
                        cx="28" 
                        cy="28" 
                        r="24" 
                        fill="none" 
                        strokeWidth="3" 
                        stroke={getProductivityScore().appointmentCompletionRate >= 70 ? "#0d9488" : 
                                getProductivityScore().appointmentCompletionRate >= 40 ? "#14b8a6" : "#ef4444"}
                        strokeDasharray={`${getProductivityScore().appointmentCompletionRate * 1.51} 1000`}
                        strokeLinecap="round"
                        transform="rotate(-90 28 28)"
                        className="opacity-80 dark:opacity-60"
                      />
                    </svg>
                    <Clock className={cn(
                      "h-6 w-6 z-10",
                      getProductivityScore().appointmentCompletionRate >= 70 ? "text-teal-600 dark:text-teal-300" :
                      getProductivityScore().appointmentCompletionRate >= 40 ? "text-teal-600/70 dark:text-teal-300/70" :
                      "text-red-600 dark:text-red-300"
                    )} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium">Appointments</p>
                      {getProductivityScore().appointmentCompletionRate >= 70 && <Sparkles className="h-3.5 w-3.5 text-teal-500" />}
                    </div>
                    <div className="flex items-center mt-1">
                      <p className={cn(
                        "text-2xl font-bold",
                        getProductivityScore().appointmentCompletionRate >= 70 ? "text-teal-600 dark:text-teal-400" :
                        getProductivityScore().appointmentCompletionRate >= 40 ? "text-teal-600/80 dark:text-teal-400/80" :
                        "text-red-600 dark:text-red-400"
                      )}>
                        {getProductivityScore().appointmentCompletionRate}%
                      </p>
                      <span className="text-xs ml-2 text-gray-500 dark:text-gray-400">completion</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
              
            {(getProductivityScore().overdueMeetings > 0 || getProductivityScore().overdueAppointments > 0) && (
              <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-md p-4 flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-800/80 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-red-800 dark:text-red-300">Overdue Items Require Attention</h4>
                  <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                    You have {getProductivityScore().overdueMeetings + getProductivityScore().overdueAppointments} past items that need to be marked as completed:
                    {getProductivityScore().overdueMeetings > 0 && (
                      <span className="flex items-center gap-1.5 mt-1.5">
                        <ChevronRight className="h-3 w-3" />
                        {getProductivityScore().overdueMeetings} meeting{getProductivityScore().overdueMeetings !== 1 ? 's' : ''}
                      </span>
                    )}
                    {getProductivityScore().overdueAppointments > 0 && (
                      <span className="flex items-center gap-1.5 mt-1">
                        <ChevronRight className="h-3 w-3" />
                        {getProductivityScore().overdueAppointments} appointment{getProductivityScore().overdueAppointments !== 1 ? 's' : ''}
                      </span>
                    )}
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      className="h-8 text-xs px-3 flex items-center gap-1"
                      onClick={() => {
                        localStorage.setItem('selectedNav', 'Meetings');
                        window.location.reload();
                      }}
                    >
                      <Video className="h-3.5 w-3.5" />
                      Review Meetings
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      className="h-8 text-xs px-3 flex items-center gap-1"
                      onClick={() => {
                        localStorage.setItem('selectedNav', 'Appointments');
                        window.location.reload();
                      }}
                    >
                      <Clock className="h-3.5 w-3.5" />
                      Review Appointments
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Charts and data visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* <StickyNoteWall notes={notes} currentNoteIndex={currentNoteIndex} setCurrentNoteIndex={setCurrentNoteIndex} /> */}
        {/* Task Progress Chart */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Task Progress</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  cx="50%"
                  cy="50%"
                  innerRadius="20%"
                  outerRadius="90%"
                  barSize={20}
                  data={taskProgressData}
                >
                  <RadialBar
                    background
                    dataKey="value"
                    cornerRadius={12}
                    label={{ position: 'insideStart', fill: '#888', fontSize: 12 }}
                  />
                  <Legend
                    iconSize={10}
                    layout="vertical"
                    verticalAlign="middle"
                    align="right"
                    wrapperStyle={{ fontSize: '12px' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--background)',
                      borderColor: 'var(--border)',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Upcoming Events</h3>
            <div className="space-y-4">
              {upcomingMeetings.length > 0 || upcomingAppointments.length > 0 ? (
                <>
                  {upcomingMeetings.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-muted-foreground">Meetings</h4>
                      {upcomingMeetings.map((meeting: any) => (
                        <div key={meeting.id} className="flex justify-between items-center p-3 rounded-lg bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/40 hover:bg-indigo-50/80 dark:hover:bg-indigo-900/20 transition-colors duration-200">
                          <div>
                            <p className="font-medium">{meeting.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-xs text-muted-foreground">
                                {formatDate(new Date(meeting.start_time * 1000), "PPP")}
                              </p>
                              <div className="w-1 h-1 rounded-full bg-muted-foreground"></div>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(new Date(meeting.start_time * 1000), "p")}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {meeting.location && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 px-2 rounded-md bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-800/50 border-indigo-200 dark:border-indigo-800 transition-colors"
                                onClick={() => {
                                  window.open(meeting.location, '_blank');
                                }}
                                title="Join Meeting"
                              >
                                <Video className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-300 mr-1" />
                                <span className="text-xs text-indigo-600 dark:text-indigo-300">Join</span>
                              </Button>
                            )}
                           
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {upcomingAppointments.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-muted-foreground">Appointments</h4>
                      {upcomingAppointments.map((appointment: any) => (
                        <div key={appointment.id} className="flex justify-between items-center p-3 rounded-lg bg-purple-50/50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800/40 hover:bg-purple-50/80 dark:hover:bg-purple-900/20 transition-colors duration-200">
                          <div>
                            <p className="font-medium">{appointment.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-xs text-muted-foreground">
                                {formatDate(new Date(appointment.start_time * 1000), "PPP")}
                              </p>
                              <div className="w-1 h-1 rounded-full bg-muted-foreground"></div>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(new Date(appointment.start_time * 1000), "p")}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {appointment.location_link && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 px-2 rounded-md bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-800/50 border-purple-200 dark:border-purple-800 transition-colors"
                                onClick={() => {
                                  window.open(appointment.location_link, '_blank');
                                }}
                                title="View Location"
                              >
                                <MapPin className="h-3.5 w-3.5 text-purple-600 dark:text-purple-300 mr-1" />
                                <span className="text-xs text-purple-600 dark:text-purple-300">Location</span>
                              </Button>
                            )}
                            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-purple-100 dark:bg-purple-800/60 shadow-sm">
                              <Clock className="h-4 w-4 text-purple-600 dark:text-purple-300" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CalendarDays className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">No upcoming events</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Your schedule is clear for now</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Productivity Trends Chart */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Productivity Trends (Last 7 Days)</h3>
            <div className="h-[300px]">
              {productivityTrends.length > 0 && productivityTrends.every(item => item.total === 0) ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No activity in the last 7 days
                </div>
              ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productivityTrends} className="mt-2">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value, name) => [value, typeof name === 'string' ? name.charAt(0).toUpperCase() + name.slice(1) : name]}
                    labelFormatter={(label) => {
                      const item = productivityTrends.find(item => item.name === label);
                      return item ? item.fullDate : label;
                    }}
                    contentStyle={{
                      backgroundColor: 'var(--background)',
                      borderColor: 'var(--border)',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="tasks" name="Tasks Completed" stackId="a" fill={CHART_COLORS.green} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="meetings" name="Meetings Attended" stackId="a" fill={CHART_COLORS.indigo} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="appointments" name="Appointments Attended" stackId="a" fill={CHART_COLORS.purple} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Monthly Task Completion Trends */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Monthly Task Completion</h3>
            <div className="h-[300px]">
              {monthlyCompletionTrends.length > 0 && monthlyCompletionTrends.every(item => item.created === 0 && item.completed === 0) ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No task data available for the last 6 months
                </div>
              ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyCompletionTrends} className="mt-2">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value, name) => {
                      if (name === 'completion_rate') return [`${value}%`, 'Completion Rate'];
                      return [value, typeof name === 'string' ? name.charAt(0).toUpperCase() + name.slice(1) : name];
                    }}
                    contentStyle={{
                      backgroundColor: 'var(--background)',
                      borderColor: 'var(--border)',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <defs>
                    <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.blue} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={CHART_COLORS.blue} stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.green} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={CHART_COLORS.green} stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="created" 
                    name="Tasks Created" 
                    stroke={CHART_COLORS.blue} 
                    strokeWidth={2}
                    dot={{ r: 4, strokeWidth: 2 }}
                    activeDot={{ r: 6, strokeWidth: 2 }}
                  />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="completed" 
                    name="Tasks Completed" 
                    stroke={CHART_COLORS.green} 
                    strokeWidth={2}
                    dot={{ r: 4, strokeWidth: 2 }}
                    activeDot={{ r: 6, strokeWidth: 2 }}
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="completion_rate" 
                    name="Completion Rate" 
                    stroke={CHART_COLORS.yellow} 
                    strokeWidth={2}
                    dot={{ r: 4, strokeWidth: 2, fill: CHART_COLORS.yellow }}
                    activeDot={{ r: 6, strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Hourly Activity Distribution */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Hourly Activity Distribution</h3>
            <div className="h-[300px]">
              {hourlyActivityData.length > 0 && hourlyActivityData.every(item => item.total === 0) ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No activity data available
                </div>
              ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hourlyActivityData} className="mt-2">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis 
                    dataKey="displayHour" 
                    interval={3} 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value, index) => {
                      // Check if this is the current hour and highlight it
                      const item = hourlyActivityData[index * 3];
                      if (item && item.isCurrentHour) {
                        return `[${value}]`;
                      }
                      return value;
                    }}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value, name) => [value, typeof name === 'string' ? name.charAt(0).toUpperCase() + name.slice(1) : name]}
                    labelFormatter={(label, payload) => {
                      const dataItem = payload[0]?.payload;
                      if (dataItem?.isCurrentHour) {
                        return `Hour: ${label} (Current hour)`;
                      }
                      return `Hour: ${label}`;
                    }}
                    contentStyle={{
                      backgroundColor: 'var(--background)',
                      borderColor: 'var(--border)',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <defs>
                    <linearGradient id="colorTasks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.green} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={CHART_COLORS.green} stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="colorMeetings" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.indigo} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={CHART_COLORS.indigo} stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="colorAppointments" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.purple} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={CHART_COLORS.purple} stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <Area 
                    type="monotone" 
                    dataKey="tasks" 
                    name="Tasks" 
                    stackId="1"
                    stroke={CHART_COLORS.green} 
                    fillOpacity={1}
                    fill="url(#colorTasks)" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="meetings" 
                    name="Meetings" 
                    stackId="1"
                    stroke={CHART_COLORS.indigo} 
                    fillOpacity={1}
                    fill="url(#colorMeetings)" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="appointments" 
                    name="Appointments" 
                    stackId="1"
                    stroke={CHART_COLORS.purple} 
                    fillOpacity={1}
                    fill="url(#colorAppointments)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Task Priority Distribution */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Task Priority Distribution</h3>
            <div className="h-[300px]">
              {taskPriorityData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No tasks available
                </div>
              ) : (
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart 
                  cx="50%" 
                  cy="50%" 
                  innerRadius="20%" 
                  outerRadius="80%" 
                  barSize={20} 
                  data={taskPriorityData}
                  startAngle={180} 
                  endAngle={0}
                >
                  <RadialBar
                    label={{ position: 'insideStart', fill: '#fff', fontWeight: 600 }}
                    background
                    dataKey="value"
                    cornerRadius={10}
                  />
                  <Legend 
                    iconSize={10} 
                    layout="vertical" 
                    verticalAlign="middle" 
                    align="right"
                    wrapperStyle={{ fontSize: '12px', paddingLeft: '10px' }}
                  />
                  <Tooltip
                    formatter={(value) => [`${value} tasks`, 'Count']}
                    contentStyle={{
                      backgroundColor: 'var(--background)',
                      borderColor: 'var(--border)',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <TaskMetricsSummary tasks={tasks as Task[]} />

      {/* Day Planner Wizard */}
      {showDayPlanner && (
        <DayPlannerWizard 
          onClose={() => setShowDayPlanner(false)}
          existingTasks={tasks}
          existingMeetings={meetings}
          existingAppointments={appointments}
        />
      )}
    </div>
  );
};

