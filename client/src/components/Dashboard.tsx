import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import TaskManager from "./TaskManager";
import NotesBoard from "./NotesBoard";
import PomodoroTimer from "./PomodoroTimer";
import Calendar from "./Calendar";
import { LayoutGrid, CheckSquare, StickyNote, Timer, CalendarDays, Video, Settings as SettingsIcon, Flame, LogOut, Moon, Sun, ChevronRight, Home, Clock, Search, Bell, MapPin, User, HelpCircle } from "lucide-react";
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  BarChart,
  Bar, 
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
  RadialBarChart,
  RadialBar,
} from "recharts";
import Meetings from "./Meetings";
import Settings from "./Settings";
import Profile from "./Profile";
import Help from "./Help";
import { useAuth } from "@/contexts/AuthContext";
import { getAppointments, getNotes, getPomodoroSettings, getTasks, getMeetings, getTasksWithSubtasks } from "@/lib/api";
import { ProfileDropdown } from "./ui/ProfileDropdown";
import { formatDate, getNow } from "@/lib/timezone";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "@/hooks/use-toast";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { NotificationsDropdown } from "./ui/NotificationsDropdown";
import { TaskReminderService } from "./TaskReminderService";
import { QUERY_KEYS } from "@/lib/queryClient";

interface NavItem {
  title: string;
  icon: React.ReactNode;
  component: React.ReactNode;
}

const CHART_COLORS = {
  green: "#10B981",
  blue: "#3B82F6",
  indigo: "#4F46E5",
  purple: "#8B5CF6",
  yellow: "#FBBF24",
  red: "#EF4444",
  gray: "#94A3B8"
};

const DashboardOverview = () => {
  const { data: tasks = [], error: tasksError, isLoading: tasksLoading } = useQuery({
    queryKey: [QUERY_KEYS.TASKS],
    queryFn: async () => {
      const response = await getTasks();
      
      return response;
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
    queryKey: ["meetings"],
    queryFn: async () => {
      const response = await getMeetings();
      return response;
    },
  });

  const { data: appointments = [], error: appointmentsError, isLoading: appointmentsLoading } = useQuery({
    queryKey: ["appointments"],
    queryFn: async () => {
      const response = await getAppointments();
      return response;
    },
  });

  const { data: tasksWithSubtasksIds = [], isLoading: tasksWithSubtasksLoading } = useQuery({
    queryKey: ["tasks-with-subtasks"],
    queryFn: async () => {
      const response = await getTasksWithSubtasks();
      return response;
    },
  });

 

  // Calculate task statistics safely
  const taskStats = {
    completed: Array.isArray(tasks) ? tasks.filter((task: any) => task.completed).length : 0,
    inProgress: Array.isArray(tasks) ? tasks.filter((task: any) => !task.completed && task.due_date).length : 0,
    notStarted: Array.isArray(tasks) ? tasks.filter((task: any) => !task.completed && !task.due_date).length : 0,
    withSubtasks: Array.isArray(tasksWithSubtasksIds) ? tasksWithSubtasksIds.length : 0,
  };

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
    total: Array.isArray(tasks) ? tasks.reduce((sum, task: any) => sum + (task.total_subtasks || 0), 0) : 0,
    completed: Array.isArray(tasks) ? tasks.reduce((sum, task: any) => sum + (task.completed_subtasks || 0), 0) : 0,
  };

  // Calculate meeting statistics
  const meetingStats = {
    total: Array.isArray(meetings) ? meetings.length : 0,
    upcoming: Array.isArray(meetings) ? meetings.filter((meeting: any) => 
      meeting.start_time && new Date(meeting.start_time * 1000) > new Date()
    ).length : 0,
    past: Array.isArray(meetings) ? meetings.filter((meeting: any) => 
      meeting.start_time && new Date(meeting.start_time * 1000) <= new Date()
    ).length : 0,
  };

  // Calculate appointment statistics
  const appointmentStats = {
    total: Array.isArray(appointments) ? appointments.length : 0,
    upcoming: Array.isArray(appointments) ? appointments.filter((apt: any) => 
      apt.start_time && new Date(apt.start_time * 1000) > new Date()
    ).length : 0,
    past: Array.isArray(appointments) ? appointments.filter((apt: any) => 
      apt.start_time && new Date(apt.start_time * 1000) <= new Date()
    ).length : 0,
  };

  // Calculate productivity trends (last 7 days)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return {
      date,
      dateString: formatDate(date, "EEE, MMM d"),
      shortDate: formatDate(date, "EEE")
    };
  }).reverse();

  const productivityTrends = last7Days.map(day => {
    // Get timestamp for start and end of the day
    const startOfDay = new Date(day.date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(day.date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const startTimestamp = Math.floor(startOfDay.getTime() / 1000);
    const endTimestamp = Math.floor(endOfDay.getTime() / 1000);
    
    // Count completed tasks for this day
    const tasksCompleted = Array.isArray(tasks) 
      ? tasks.filter((task: any) => 
          task.completed && 
          task.updated_at >= startTimestamp && 
          task.updated_at <= endTimestamp
        ).length
      : 0;
    
    // Count meetings attended for this day
    const meetingsAttended = Array.isArray(meetings)
      ? meetings.filter((meeting: any) =>
          meeting.start_time >= startTimestamp &&
          meeting.start_time <= endTimestamp
        ).length
      : 0;
    
    // Count appointments attended for this day
    const appointmentsAttended = Array.isArray(appointments)
      ? appointments.filter((apt: any) =>
          apt.start_time >= startTimestamp &&
          apt.start_time <= endTimestamp
        ).length
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

  // Calculate hourly activity distribution (24-hour format)
  const hourlyActivityData = Array.from({ length: 24 }, (_, hour) => ({
    hour: hour,
    displayHour: hour === 0 ? '12 AM' : hour === 12 ? '12 PM' : hour < 12 ? `${hour} AM` : `${hour - 12} PM`,
    tasks: 0,
    meetings: 0,
    appointments: 0,
    total: 0
  }));

  // Populate hourly activity data
  if (Array.isArray(tasks)) {
    tasks.forEach((task: any) => {
      if (task && task.updated_at) {
        const date = new Date(task.updated_at * 1000);
        const hour = date.getHours();
        if (hourlyActivityData[hour]) {
          hourlyActivityData[hour].tasks += 1;
          hourlyActivityData[hour].total += 1;
        }
      }
    });
  }

  if (Array.isArray(meetings)) {
    meetings.forEach((meeting: any) => {
      if (meeting && meeting.start_time) {
        const date = new Date(meeting.start_time * 1000);
        const hour = date.getHours();
        if (hourlyActivityData[hour]) {
          hourlyActivityData[hour].meetings += 1;
          hourlyActivityData[hour].total += 1;
        }
      }
    });
  }

  if (Array.isArray(appointments)) {
    appointments.forEach((apt: any) => {
      if (apt && apt.start_time) {
        const date = new Date(apt.start_time * 1000);
        const hour = date.getHours();
        if (hourlyActivityData[hour]) {
          hourlyActivityData[hour].appointments += 1;
          hourlyActivityData[hour].total += 1;
        }
      }
    });
  }

  // Calculate monthly task completion trends (last 6 months)
  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    return {
      date: new Date(date.getFullYear(), date.getMonth(), 1),
      month: formatDate(date, "MMM yyyy")
    };
  }).reverse();

  const monthlyCompletionTrends = last6Months.map(monthData => {
    const startOfMonth = new Date(monthData.date);
    const endOfMonth = new Date(monthData.date.getFullYear(), monthData.date.getMonth() + 1, 0, 23, 59, 59, 999);
    
    const startTimestamp = Math.floor(startOfMonth.getTime() / 1000);
    const endTimestamp = Math.floor(endOfMonth.getTime() / 1000);
    
    // Count tasks created in this month
    const tasksCreated = Array.isArray(tasks) 
      ? tasks.filter((task: any) => 
          task.created_at >= startTimestamp && 
          task.created_at <= endTimestamp
        ).length
      : 0;
    
    // Count tasks completed in this month
    const tasksCompleted = Array.isArray(tasks) 
      ? tasks.filter((task: any) => 
          task.completed && 
          task.updated_at >= startTimestamp && 
          task.updated_at <= endTimestamp
        ).length
      : 0;
    
    return {
      name: monthData.month,
      created: tasksCreated,
      completed: tasksCompleted,
      completion_rate: tasksCreated > 0 ? Math.round((tasksCompleted / tasksCreated) * 100) : 0
    };
  });

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

  // Calculate notes by date safely
  const last5Days = Array.from({ length: 5 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return formatDate(date, "MMM d");
  }).reverse();

 

  // Get upcoming appointments safely
  const upcomingAppointments = Array.isArray(appointments) ? appointments
    .filter((apt: any) => apt.start_time && new Date(apt.start_time * 1000) > new Date())
    .sort((a: any, b: any) => new Date(a.start_time * 1000).getTime() - new Date(b.start_time * 1000).getTime())
    .slice(0, 3) : [];

  // Get upcoming meetings safely
  const upcomingMeetings = Array.isArray(meetings) ? meetings
    .filter((meeting: any) => meeting.start_time && new Date(meeting.start_time * 1000) > new Date())
    .sort((a: any, b: any) => new Date(a.start_time * 1000).getTime() - new Date(b.start_time * 1000).getTime())
    .slice(0, 3) : [];

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
            <h2 className="text-2xl font-bold tracking-tight">
              {getGreeting()}, <span className="text-primary">{localStorage.getItem("userName")?.split(" ")[0] || "User"}</span>
            </h2>
            <p className="text-muted-foreground mt-1">
              Here's what's happening with your tasks and schedule today.
            </p>
          </div>
          <div className="mt-4 md:mt-0 flex items-center gap-3">
            <Button 
              variant="default" 
              size="sm" 
              className="gap-2"
              onClick={() => {
                // Navigate to Tasks
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
                // Navigate to Calendar
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
              <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
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
              <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-lg">
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
              <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-lg">
                <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Productivity Score */}
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Productivity Score</h3>
              <p className="text-sm text-muted-foreground mt-1">Based on your task completion and event attendance</p>
            </div>
            
            {/* Calculate productivity score based on task completion rate and meeting attendance */}
            {(() => {
              // Calculate task completion percentage
              const taskCompletionRate = tasks.length > 0 
                ? (taskStats.completed / tasks.length) * 100 
                : 0;
              
              // Calculate subtask completion percentage
              const subtaskCompletionRate = subtaskStats.total > 0 
                ? (subtaskStats.completed / subtaskStats.total) * 100 
                : 0;
              
              // Calculate meeting attendance rate
              const meetingAttendanceRate = meetingStats.past > 0 
                ? ((meetingStats.past - meetingStats.upcoming) / meetingStats.past) * 100 
                : 0;
              
              // Calculate overall productivity score (weighted average)
              const productivityScore = Math.round(
                (taskCompletionRate * 0.4) + 
                (subtaskCompletionRate * 0.4) + 
                (meetingAttendanceRate * 0.2)
              );
              
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
              
              return (
                <div className="flex flex-col items-center">
                  <div className="relative w-24 h-24 flex items-center justify-center">
                    <svg className="w-full h-full" viewBox="0 0 100 100">
                      {/* Background circle */}
                      <circle 
                        cx="50" 
                        cy="50" 
                        r="45" 
                        fill="none" 
                        stroke="hsl(var(--border))" 
                        strokeWidth="10" 
                      />
                      {/* Progress circle */}
                      <circle 
                        cx="50" 
                        cy="50" 
                        r="45" 
                        fill="none" 
                        stroke={`url(#${scoreGradient})`} 
                        strokeWidth="10" 
                        strokeDasharray={`${productivityScore * 2.83} 283`}
                        strokeDashoffset="0" 
                        strokeLinecap="round" 
                        transform="rotate(-90 50 50)" 
                      />
                      {/* Gradient definition */}
                      <defs>
                        <linearGradient id={scoreGradient} x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor={scoreGradient.split(' ')[0].replace('from-', '')} />
                          <stop offset="100%" stopColor={scoreGradient.split(' ')[1].replace('to-', '')} />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center flex-col">
                      <span className={`text-2xl font-bold ${scoreColor}`}>{productivityScore}%</span>
                    </div>
                  </div>
                  <span className={`mt-2 font-medium ${scoreColor}`}>{scoreCategory}</span>
                </div>
              );
            })()}
          </div>
          
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="flex flex-col items-center">
              <div className="w-full bg-muted rounded-full h-2.5">
                <div 
                  className="bg-green-600 h-2.5 rounded-full" 
                  style={{ width: `${tasks.length > 0 ? (taskStats.completed / tasks.length) * 100 : 0}%` }}
                ></div>
              </div>
              <span className="text-xs text-muted-foreground mt-1">Task Completion</span>
            </div>
            
            <div className="flex flex-col items-center">
              <div className="w-full bg-muted rounded-full h-2.5">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full" 
                  style={{ width: `${subtaskStats.total > 0 ? (subtaskStats.completed / subtaskStats.total) * 100 : 0}%` }}
                ></div>
              </div>
              <span className="text-xs text-muted-foreground mt-1">Subtask Completion</span>
            </div>
            
            <div className="flex flex-col items-center">
              <div className="w-full bg-muted rounded-full h-2.5">
                <div 
                  className="bg-indigo-600 h-2.5 rounded-full" 
                  style={{ width: `${meetingStats.past > 0 ? ((meetingStats.past - meetingStats.upcoming) / meetingStats.past) * 100 : 0}%` }}
                ></div>
              </div>
              <span className="text-xs text-muted-foreground mt-1">Meeting Attendance</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts and data visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
              {productivityTrends.every(item => item.total === 0) ? (
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
              {monthlyCompletionTrends.every(item => item.created === 0 && item.completed === 0) ? (
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
              {hourlyActivityData.every(item => item.total === 0) ? (
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
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value, name) => [value, typeof name === 'string' ? name.charAt(0).toUpperCase() + name.slice(1) : name]}
                    labelFormatter={(label) => `Hour: ${label}`}
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
    </div>
  );
};

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    icon: <LayoutGrid className="h-4 w-4" />,
    component: <DashboardOverview />,
  },
  {
    title: "Tasks",
    icon: <CheckSquare className="h-4 w-4" />,
    component: React.createElement(TaskManager),
  },
  {
    title: "Notes",
    icon: <StickyNote className="h-4 w-4" />,
    component: <NotesBoard />,
  },
  {
    title: "Pomodoro",
    icon: <Timer className="h-4 w-4" />,
    component: <PomodoroTimer />,
  },
  {
    title: "Calendar",
    icon: <CalendarDays className="h-4 w-4" />,
    component: <Calendar />,
  },
  {
    title: "Meetings",
    icon: <Video className="h-4 w-4" />,
    component: <Meetings />,
  },
  {
    title: "Settings",
    icon: <SettingsIcon className="h-4 w-4" />,
    component: <Settings />,
  },
  
];

export default function Dashboard() {
  // Use localStorage to persist the selected navigation item
  const [selectedNav, setSelectedNav] = React.useState<string>(() => {
    // Try to get the saved navigation from localStorage
    const savedNav = localStorage.getItem('selectedNav');
    // Return the saved nav or default to "Dashboard"
    return savedNav || "Dashboard";
  });
  const { logout } = useAuth();
  const { theme, setTheme } = useTheme();

  // Update localStorage when navigation changes
  React.useEffect(() => {
    localStorage.setItem('selectedNav', selectedNav);
  }, [selectedNav]);

  return (
    <NotificationsProvider>
      <TaskReminderService />
      <ResizablePanelGroup
        direction="horizontal"
        className="h-screen items-stretch"
      >
        {/* Resizable sidebar with slightly larger initial width */}
        <ResizablePanel defaultSize={22} minSize={15} maxSize={30} className="bg-[hsl(var(--background))] flex flex-col h-screen shadow-sm">
          {/* App branding - now clickable */}
          <div className="px-4 py-4">
            <div className="flex items-center justify-between">
              <div 
                className="flex items-center gap-2.5 cursor-pointer justify-center group" 
                onClick={() => setSelectedNav("Dashboard")}
              >
                <div className="flex items-center justify-center
                  rounded-full
                  bg-gradient-to-br from-yellow-500 to-amber-700
                  p-1
                  shadow-lg
                  group-hover:from-yellow-400 group-hover:to-amber-600
                  transition-all
                  duration-300
                  transform group-hover:scale-105
                  border-2 border-yellow-400/40
                ">
                  <img 
                    src="/assets/tiger_logo.png" 
                    alt="Tiger" 
                    className="h-8 w-8 drop-shadow-md" 
                  />
                </div>
                <div className="flex items-center">
                  <h2 className="text-xl
                    font-extrabold
                    bg-gradient-to-r from-yellow-500 to-amber-700
                    bg-clip-text text-transparent
                    group-hover:from-yellow-400 group-hover:to-amber-600
                    transition-colors
                    duration-300
                    cursor-pointer
                  ">Tiger</h2>
                  <span className="text-xs text-amber-500 ml-0.5">
                    <sup className="font-semibold">TM</sup>
                  </span>
                </div>
              </div>
              
              {/* Add a theme toggle button */}
              <div className="flex items-center">
                {theme === "dark" ? (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setTheme("light")}
                    className="h-8 w-8 rounded-full hover:bg-yellow-100/10 transition-colors duration-200"
                  >
                    <Sun className="h-4 w-4 text-yellow-400" />
                  </Button>
                ) : (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setTheme("dark")}
                    className="h-8 w-8 rounded-full hover:bg-slate-200 transition-colors duration-200"
                  >
                    <Moon className="h-4 w-4 text-slate-700" />
                  </Button>
                )}
              </div>
            </div>
          </div>
          {/* add divider for light and dark theme */}
          {theme === "light" ? (
            <div className="h-[1px] bg-gray-200" />
          ) : (
            <div className="h-[1px] bg-gray-700" />
          )}
          {/* User Profile Section */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <ProfileDropdown />
              {theme === "light" ? (
                <div className="w-[1px] h-10 bg-gray-200" /> 
              ) : (
                <div className="w-[1px] h-10 bg-gray-700" />
              )}
              <NotificationsDropdown />
            </div>
          </div>
          {/* add divider for light and dark theme */}
          {theme === "light" ? (
            <div className="h-[1px] bg-gray-200" />
          ) : (
            <div className="h-[1px] bg-gray-700" />
          )}
          {/* Navigation - independently scrollable */}
          <ScrollArea className="flex-1 thin-scrollbar px-3">
            <div className="space-y-1.5 py-4">
              {navItems.map((item) => (
                <Button
                  key={item.title}
                  variant={selectedNav === item.title ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "w-full justify-start gap-3 mb-1 px-3 py-5 font-medium transition-all duration-300 rounded-lg",
                    {
                      "bg-gradient-to-r from-primary/90 to-primary text-primary-foreground shadow-md": selectedNav === item.title,
                      "hover:bg-[hsl(var(--primary)/0.08)] hover:text-primary hover:translate-x-1": selectedNav !== item.title,
                    }
                  )}
                  onClick={() => setSelectedNav(item.title)}
                >
                  <div className={cn(
                    "w-9 h-9 flex items-center justify-center rounded-md transition-all duration-300",
                    selectedNav === item.title 
                      ? "bg-[hsl(var(--primary-foreground)/0.3)] text-primary-foreground shadow-inner" 
                      : "bg-[hsl(var(--muted)/0.5)] text-muted-foreground"
                  )}>
                    {item.icon}
                  </div>
                  <span className="truncate font-medium">{item.title}</span>
                  {selectedNav === item.title && (
                    <ChevronRight className="ml-auto h-4 w-4 text-primary-foreground/70" />
                  )}
                </Button>
              ))}
            </div>
          </ScrollArea>
          
          {/* Fixed logout button at bottom */}
          <div className="p-4">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-3 px-3 py-5 font-medium transition-all duration-300 bg-gradient-to-r hover:from-red-500/10 hover:to-red-600/10 hover:text-red-600 hover:border-red-200 rounded-lg group"
              onClick={() => logout()}
            >
              <div className="w-9 h-9 flex items-center justify-center rounded-md bg-red-50 text-red-500 group-hover:bg-red-100 transition-colors duration-300">
                <LogOut className="h-4 w-4" />
              </div>
              <span className="font-medium">Logout</span>
            </Button>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle className="w-2 bg-[hsl(var(--border))]" />

        {/* Main content area */}
        <ResizablePanel defaultSize={78} minSize={70} maxSize={85} className="bg-[hsl(var(--background))] h-screen flex flex-col">
          {/* Main content header with breadcrumb */}
        
          
          {/* Main content with independent scrolling */}
          <ScrollArea className="flex-1 thin-scrollbar">
            <div className="p-6">
              {/* Conditional rendering based on selected navigation item */}
              {selectedNav === "Dashboard" && <DashboardOverview />}
              {selectedNav === "Tasks" && <TaskManager /> }
              {selectedNav === "Notes" && <NotesBoard />}
              {selectedNav === "Pomodoro" && <PomodoroTimer />}
              {selectedNav === "Calendar" && <Calendar />}
              {selectedNav === "Meetings" && <Meetings />}
              {selectedNav === "Settings" && <Settings />}
              {selectedNav === "Profile" && <Profile />}
              {selectedNav === "Help" && <Help />}
            </div>
          </ScrollArea>
        </ResizablePanel>
      </ResizablePanelGroup>
    </NotificationsProvider>
  );
}

// Helper function to get greeting based on time of day
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};