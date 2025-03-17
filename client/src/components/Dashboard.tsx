import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import TaskManager from "./TaskManager";
import NotesBoard from "./NotesBoard";
import PomodoroTimer from "./PomodoroTimer";
import Calendar from "./Calendar";
import Appointments from "./Appointments";
import { LayoutGrid, CheckSquare, StickyNote, Timer, CalendarDays, Video, Settings as SettingsIcon, Flame, LogOut, Moon, Sun, ChevronRight, Home, Clock, Search, Bell, MapPin, User, HelpCircle, Menu, X, NotebookIcon, Calendar as CalendarIcon, Users, BarChart as BarChartIcon } from "lucide-react";
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
  PieChart,
  Pie,
} from "recharts";
import Meetings from "./Meetings";
import Settings from "./Settings";
import Profile from "./Profile";
import Help from "./Help";
import { useAuth } from "@/contexts/AuthContext";
import { getAppointments, getNotes, getPomodoroSettings, getTasks, getMeetings, getTasksWithSubtasks } from "@/lib/api";
import { ProfileDropdown } from "./ui/ProfileDropdown";
import { formatDate, getNow, getUserTimezone } from "@/lib/timezone";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "@/hooks/use-toast";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { NotificationsDropdown } from "./ui/NotificationsDropdown";
import { TaskReminderService } from "./TaskReminderService";
import { QUERY_KEYS } from "@/lib/queryClient";
import LongNotesBoard from "./LongNotesBoard";
import UserManagement from "./UserManagement";
import { useState, useMemo, useEffect } from "react";
import type { Task, Subtask, TaskWithSubtasks } from "../../../shared/schema";

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

// Task Completion Metrics Component
interface TaskCompletionMetricsProps {
  tasks: TaskWithSubtaskCounts[];
}

// Extended Task interface to include subtask-related properties
interface TaskWithSubtaskCounts extends Task {
  completed_subtasks?: number;
  total_subtasks?: number;
  subtasks?: Subtask[];
}

const TaskCompletionMetrics = ({ tasks = [] }: TaskCompletionMetricsProps) => {
  const [timeframe, setTimeframe] = useState<'hourly' | 'daily' | 'weekly' | 'monthly'>('daily');
  
  // Debug tasks data structure
  console.log('TaskCompletionMetrics - tasks:', tasks);
  
  // Check if tasks have the necessary properties
  useEffect(() => {
    if (!Array.isArray(tasks) || tasks.length === 0) {
      console.warn('TaskCompletionMetrics: No tasks provided or tasks is not an array');
      return;
    }
    
    // Check if tasks have the necessary properties
    const hasCompletedTasks = tasks.some(task => task.completed);
    if (!hasCompletedTasks) {
      console.warn('TaskCompletionMetrics: No completed tasks found');
    }
    
    // Check if tasks have updated_at timestamps
    const hasTimestamps = tasks.some(task => task.updated_at);
    if (!hasTimestamps) {
      console.warn('TaskCompletionMetrics: No tasks with updated_at timestamps found');
    }
  }, [tasks]);
  
  // Helper function to get month index from month name
  const getMonthIndex = (monthName: string) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.findIndex(m => m === monthName);
  };
  
  // Get subtasks from tasks that have them
  const subtasks = useMemo(() => {
    // First, try to extract subtasks directly from task objects
    const directSubtasks = tasks
      .filter(task => 'subtasks' in task && Array.isArray((task as any).subtasks))
      .flatMap(task => (task as any).subtasks || []);
    
    console.log('Direct subtasks found:', directSubtasks.length);
    
    // If we have direct subtasks, use them
    if (directSubtasks.length > 0) {
      return directSubtasks;
    }
    
    // Otherwise, create synthetic subtasks based on completed_subtasks count
    const syntheticSubtasks = tasks
      .filter(task => {
        // Check if task has completed_subtasks property
        const hasCompletedSubtasks = 
          task && 
          typeof task === 'object' && 
          'completed_subtasks' in task && 
          (task as any).completed_subtasks > 0;
        
        if (hasCompletedSubtasks) {
          console.log('Task with completed_subtasks:', task.id, (task as any).completed_subtasks);
        }
        return hasCompletedSubtasks;
      })
      .flatMap(task => {
        // Create synthetic subtask objects for each completed subtask
        return Array.from({ length: (task as any).completed_subtasks || 0 }, (_, i) => ({
          id: `${task.id}-subtask-${i}`,
          title: `Subtask ${i+1}`,
          completed: true,
          // Use the task's updated_at as an approximation for the subtask completion time
          updated_at: task.updated_at,
          task_id: task.id
        }));
      });
    
    console.log('Synthetic subtasks created:', syntheticSubtasks.length);
    
    // If we still don't have any subtasks, create some dummy ones for tasks that are completed
    if (syntheticSubtasks.length === 0) {
      console.log('No subtasks found, creating dummy subtasks for completed tasks');
      
      // Create dummy subtasks for completed tasks
      const dummySubtasks = tasks
        .filter(task => task.completed && task.updated_at)
        .map(task => ({
          id: `${task.id}-dummy-subtask`,
          title: `Subtask for ${task.title}`,
          completed: true,
          updated_at: task.updated_at,
          task_id: task.id
        }));
      
      console.log('Dummy subtasks created:', dummySubtasks.length);
      return dummySubtasks;
    }
    
    return syntheticSubtasks;
  }, [tasks]);
  
  // Calculate hourly metrics
  const hourlyData = useMemo(() => {
    const data = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      displayHour: hour === 0 ? '12 AM' : hour === 12 ? '12 PM' : hour < 12 ? `${hour} AM` : `${hour - 12} PM`,
      tasks: 0,
      subtasks: 0
    }));
    
    // Process tasks
    tasks.forEach(task => {
      if (task.completed && task.updated_at) {
        const date = new Date(task.updated_at * 1000);
        const hour = date.getHours();
        if (hour >= 0 && hour < 24) {
          data[hour].tasks += 1;
        }
      }
    });
    
    // Process subtasks
    subtasks.forEach(subtask => {
      if (subtask.completed && subtask.updated_at) {
        const date = new Date(subtask.updated_at * 1000);
        const hour = date.getHours();
        if (hour >= 0 && hour < 24) {
          data[hour].subtasks += 1;
        }
      }
    });
    
    console.log('Hourly data:', data);
    return data;
  }, [tasks, subtasks]);
  
  // Calculate daily metrics (last 7 days)
  const dailyData = useMemo(() => {
    const today = new Date();
    const data = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(today.getDate() - i);
      return {
        date: formatDate(date, 'EEE'),
        fullDate: formatDate(date, 'MMM d'),
        tasks: 0,
        subtasks: 0,
        timestamp: Math.floor(date.getTime() / 1000)
      };
    }).reverse();
    
    // Process tasks
    tasks.forEach(task => {
      if (task.completed && task.updated_at) {
        const completedDate = new Date(task.updated_at * 1000);
        const dayIndex = data.findIndex(day => {
          const dayDate = new Date();
          const [_, month, dayNum] = day.fullDate.split(' ');
          dayDate.setMonth(getMonthIndex(month));
          dayDate.setDate(parseInt(dayNum));
          
          const dayStart = new Date(dayDate);
          dayStart.setHours(0, 0, 0, 0);
          
          const dayEnd = new Date(dayDate);
          dayEnd.setHours(23, 59, 59, 999);
          
          return completedDate >= dayStart && completedDate <= dayEnd;
        });
        
        if (dayIndex !== -1) {
          data[dayIndex].tasks += 1;
        }
      }
    });
    
    // Process subtasks
    subtasks.forEach(subtask => {
      if (subtask.completed && subtask.updated_at) {
        const completedDate = new Date(subtask.updated_at * 1000);
        const dayIndex = data.findIndex(day => {
          const dayDate = new Date();
          const [_, month, dayNum] = day.fullDate.split(' ');
          dayDate.setMonth(getMonthIndex(month));
          dayDate.setDate(parseInt(dayNum));
          
          const dayStart = new Date(dayDate);
          dayStart.setHours(0, 0, 0, 0);
          
          const dayEnd = new Date(dayDate);
          dayEnd.setHours(23, 59, 59, 999);
          
          return completedDate >= dayStart && completedDate <= dayEnd;
        });
        
        if (dayIndex !== -1) {
          data[dayIndex].subtasks += 1;
        }
      }
    });
    
    console.log('Daily data:', data);
    return data;
  }, [tasks, subtasks]);
  
  // Calculate weekly metrics (last 4 weeks)
  const weeklyData = useMemo(() => {
    const today = new Date();
    const data = Array.from({ length: 4 }, (_, i) => {
      const date = new Date();
      date.setDate(today.getDate() - (i * 7));
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      return {
        week: `Week ${4-i}`,
        label: `${formatDate(weekStart, 'MMM d')} - ${formatDate(weekEnd, 'MMM d')}`,
        tasks: 0,
        subtasks: 0,
        startTimestamp: Math.floor(weekStart.getTime() / 1000),
        endTimestamp: Math.floor(weekEnd.getTime() / 1000)
      };
    }).reverse();
    
    // Process tasks
    tasks.forEach(task => {
      if (task.completed && task.updated_at) {
        const weekIndex = data.findIndex(week => 
          task.updated_at >= week.startTimestamp && task.updated_at <= week.endTimestamp
        );
        if (weekIndex !== -1) {
          data[weekIndex].tasks += 1;
        }
      }
    });
    
    // Process subtasks
    subtasks.forEach(subtask => {
      if (subtask.completed && subtask.updated_at) {
        const weekIndex = data.findIndex(week => 
          subtask.updated_at >= week.startTimestamp && subtask.updated_at <= week.endTimestamp
        );
        if (weekIndex !== -1) {
          data[weekIndex].subtasks += 1;
        }
      }
    });
    
    console.log('Weekly data:', data);
    return data;
  }, [tasks, subtasks]);
  
  // Calculate monthly metrics (last 6 months)
  const monthlyData = useMemo(() => {
    const today = new Date();
    const data = Array.from({ length: 6 }, (_, i) => {
      const date = new Date();
      date.setMonth(today.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
      
      return {
        month: formatDate(date, 'MMM'),
        label: formatDate(date, 'MMMM yyyy'),
        tasks: 0,
        subtasks: 0,
        startTimestamp: Math.floor(monthStart.getTime() / 1000),
        endTimestamp: Math.floor(monthEnd.getTime() / 1000)
      };
    }).reverse();
    
    // Process tasks
    tasks.forEach(task => {
      if (task.completed && task.updated_at) {
        const monthIndex = data.findIndex(month => 
          task.updated_at >= month.startTimestamp && task.updated_at <= month.endTimestamp
        );
        if (monthIndex !== -1) {
          data[monthIndex].tasks += 1;
        }
      }
    });
    
    // Process subtasks
    subtasks.forEach(subtask => {
      if (subtask.completed && subtask.updated_at) {
        const monthIndex = data.findIndex(month => 
          subtask.updated_at >= month.startTimestamp && subtask.updated_at <= month.endTimestamp
        );
        if (monthIndex !== -1) {
          data[monthIndex].subtasks += 1;
        }
      }
    });
    
    console.log('Monthly data:', data);
    return data;
  }, [tasks, subtasks]);
  
  // Get the appropriate data based on selected timeframe
  const chartData = useMemo(() => {
    let data;
    switch (timeframe) {
      case 'hourly': data = hourlyData; break;
      case 'daily': data = dailyData; break;
      case 'weekly': data = weeklyData; break;
      case 'monthly': data = monthlyData; break;
      default: data = dailyData;
    }
    
    // Check if data has at least one non-zero value
    const hasData = Array.isArray(data) && data.some(item => 
      (item.tasks && item.tasks > 0) || (item.subtasks && item.subtasks > 0)
    );
    
    if (!hasData) {
      console.warn(`No data available for timeframe: ${timeframe}`);
    } else {
      console.log(`Data available for timeframe: ${timeframe}`, data);
    }
    
    return data;
  }, [timeframe, hourlyData, dailyData, weeklyData, monthlyData]);
  
  // Calculate total completions
  const totals = useMemo(() => {
    const taskTotal = tasks.filter(task => task.completed).length;
    const subtaskTotal = subtasks.filter(subtask => subtask.completed).length;
    return {
      tasks: taskTotal,
      subtasks: subtaskTotal,
      total: taskTotal + subtaskTotal
    };
  }, [tasks, subtasks]);
  
  // Calculate peak performance times
  const peakTimes = useMemo(() => {
    // Find hour with most completions
    let peakHour = { hour: 0, count: 0 };
    hourlyData.forEach(hourData => {
      if (hourData && typeof hourData.hour === 'number') {
        const total = hourData.tasks + hourData.subtasks;
        if (total > peakHour.count) {
          peakHour = { hour: hourData.hour, count: total };
        }
      }
    });
    
    // Find day with most completions
    let peakDay = { day: '', count: 0 };
    dailyData.forEach(day => {
      if (day && day.date) {
        const total = day.tasks + day.subtasks;
        if (total > peakDay.count) {
          peakDay = { day: day.date, count: total };
        }
      }
    });
    
    return {
      hour: peakHour.hour,
      hourDisplay: peakHour.hour >= 0 && peakHour.hour < hourlyData.length ? 
        hourlyData[peakHour.hour].displayHour : 
        `${peakHour.hour % 12 || 12}${peakHour.hour < 12 ? 'AM' : 'PM'}`,
      hourCount: peakHour.count,
      day: peakDay.day,
      dayCount: peakDay.count
    };
  }, [hourlyData, dailyData]);
  
  // Get X-axis data key based on timeframe
  const getXAxisDataKey = () => {
    switch (timeframe) {
      case 'hourly': return 'displayHour';
      case 'daily': return 'date';
      case 'weekly': return 'week';
      case 'monthly': return 'month';
      default: return 'date';
    }
  };
  
  // Get tooltip label formatter based on timeframe
  const getTooltipLabelFormatter = (label: string) => {
    if (!label) return 'Unknown';
    
    if (timeframe === 'hourly') return `Hour: ${label}`;
    
    if (timeframe === 'daily' && Array.isArray(dailyData)) {
      const item = dailyData.find(d => d && d.date === label);
      return item && item.fullDate ? item.fullDate : label;
    }
    
    if (timeframe === 'weekly' && Array.isArray(weeklyData)) {
      const item = weeklyData.find(d => d && d.week === label);
      return item && item.label ? item.label : label;
    }
    
    if (timeframe === 'monthly' && Array.isArray(monthlyData)) {
      const item = monthlyData.find(d => d && d.month === label);
      return item && item.label ? item.label : label;
    }
    
    return label;
  };
  
  return (
    <Card className="mt-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex justify-between items-center">
          <div className="flex items-center gap-2">
            <BarChartIcon className="h-5 w-5 text-primary" />
            <span>Task Completion Metrics</span>
          </div>
          <div className="flex gap-1">
            <Button 
              variant={timeframe === 'hourly' ? 'default' : 'outline'} 
              size="sm" 
              className="h-7 text-xs"
              onClick={() => setTimeframe('hourly')}
            >
              Hourly
            </Button>
            <Button 
              variant={timeframe === 'daily' ? 'default' : 'outline'} 
              size="sm" 
              className="h-7 text-xs"
              onClick={() => setTimeframe('daily')}
            >
              Daily
            </Button>
            <Button 
              variant={timeframe === 'weekly' ? 'default' : 'outline'} 
              size="sm" 
              className="h-7 text-xs"
              onClick={() => setTimeframe('weekly')}
            >
              Weekly
            </Button>
            <Button 
              variant={timeframe === 'monthly' ? 'default' : 'outline'} 
              size="sm" 
              className="h-7 text-xs"
              onClick={() => setTimeframe('monthly')}
            >
              Monthly
            </Button>
          </div>
        </CardTitle>
        <CardDescription>
          Analyze your task and subtask completion patterns over time
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
          <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800">
            <CardContent className="p-4">
              <div className="text-sm text-blue-600 dark:text-blue-300 font-medium">Tasks Completed</div>
              <div className="text-2xl font-bold mt-1 text-blue-700 dark:text-blue-200">{totals.tasks}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800">
            <CardContent className="p-4">
              <div className="text-sm text-green-600 dark:text-green-300 font-medium">Subtasks Completed</div>
              <div className="text-2xl font-bold mt-1 text-green-700 dark:text-green-200">{totals.subtasks}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800">
            <CardContent className="p-4">
              <div className="text-sm text-purple-600 dark:text-purple-300 font-medium">Peak Hour</div>
              <div className="text-2xl font-bold mt-1 text-purple-700 dark:text-purple-200">
                {peakTimes.hourDisplay}
                <span className="text-sm font-normal ml-2">({peakTimes.hourCount} items)</span>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800">
            <CardContent className="p-4">
              <div className="text-sm text-amber-600 dark:text-amber-300 font-medium">Most Productive Day</div>
              <div className="text-2xl font-bold mt-1 text-amber-700 dark:text-amber-200">
                {peakTimes.day}
                <span className="text-sm font-normal ml-2">({peakTimes.dayCount} items)</span>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="h-[300px]">
          {chartData && Array.isArray(chartData) && chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis 
                  dataKey={getXAxisDataKey()} 
                  tick={{ fontSize: 12 }}
                  interval={timeframe === 'hourly' ? 2 : 0}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  formatter={(value, name) => [value, name === 'tasks' ? 'Tasks' : 'Subtasks']}
                  labelFormatter={(label) => getTooltipLabelFormatter(label)}
                  contentStyle={{
                    backgroundColor: 'var(--background)',
                    borderColor: 'var(--border)',
                    borderRadius: '6px',
                    fontSize: '12px',
                  }}
                />
                <Legend />
                <Bar 
                  dataKey="tasks" 
                  name="Tasks" 
                  fill={CHART_COLORS.blue} 
                  radius={[4, 4, 0, 0]} 
                  barSize={timeframe === 'hourly' ? 8 : 20}
                />
                <Bar 
                  dataKey="subtasks" 
                  name="Subtasks" 
                  fill={CHART_COLORS.green} 
                  radius={[4, 4, 0, 0]} 
                  barSize={timeframe === 'hourly' ? 8 : 20}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <BarChartIcon className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-muted-foreground">No task completion data available</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Complete some tasks to see metrics</p>
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-6 text-sm text-muted-foreground">
          <p>
            {timeframe === 'hourly' && 'Hourly breakdown shows when you complete most tasks during the day.'}
            {timeframe === 'daily' && 'Daily view shows your task completion pattern over the last 7 days.'}
            {timeframe === 'weekly' && 'Weekly view shows your productivity trends over the last 4 weeks.'}
            {timeframe === 'monthly' && 'Monthly view shows your long-term productivity over the last 6 months.'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

const DashboardOverview = () => {
  const { data: tasks = [], error: tasksError, isLoading: tasksLoading } = useQuery({
    queryKey: [QUERY_KEYS.TASKS],
    queryFn: async () => {
      const response = await getTasks();
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

  // Debug data
  useEffect(() => {
    console.log("Tasks data:", tasks);
    console.log("Tasks with subtasks:", tasksWithSubtasksIds);
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
    // 1. It has subtasks (is in the tasksWithSubtasksIds array)
    // 2. It's not completed
    const inProgress = tasks.filter(task => {
      const taskWithSubtasks = task as TaskWithSubtaskCounts;
      return !task.completed && 
        (tasksWithSubtasksSet.has(task.id) || 
         (taskWithSubtasks.total_subtasks && taskWithSubtasks.total_subtasks > 0));
    }).length;
    
    // A task is not started if:
    // 1. It's not completed
    // 2. It doesn't have subtasks OR has no started subtasks
    const notStarted = tasks.filter(task => {
      const taskWithSubtasks = task as TaskWithSubtaskCounts;
      return !task.completed && 
        !tasksWithSubtasksSet.has(task.id) &&
        (!taskWithSubtasks.total_subtasks || taskWithSubtasks.total_subtasks === 0);
    }).length;
    
    return {
      completed,
      inProgress,
      notStarted,
      withSubtasks: tasksWithSubtasksSet.size
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
    // Debug tasks data
    console.log("Tasks for productivity trends:", tasks);
    console.log("Completed tasks for trends:", tasks.filter((task: any) => task.completed).length);
    
    const trends = last7Days.map(day => {
      // Get timestamp for start and end of the day
      const startOfDay = new Date(day.date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(day.date);
      endOfDay.setHours(23, 59, 59, 999);
      
      const startTimestamp = Math.floor(startOfDay.getTime() / 1000);
      const endTimestamp = Math.floor(endOfDay.getTime() / 1000);
      
      // Debug day range
      try {
        console.log(`Day: ${day.dateString}, Start: ${new Date(startTimestamp * 1000).toString()}, End: ${new Date(endTimestamp * 1000).toString()}`);
      } catch (error) {
        console.error(`Error logging day range for ${day.dateString}:`, error);
      }
      
      // Count completed tasks for this day - check both updated_at and completed_at
      const tasksCompleted = Array.isArray(tasks) 
        ? tasks.filter((task: any) => {
            // If task is completed and has a timestamp
            if (!task.completed) return false;
            
            // Check updated_at (when the task was last modified)
            const updatedAt = task.updated_at || 0;
            
            // Check if the task was completed on this day
            const completed = updatedAt >= startTimestamp && updatedAt <= endTimestamp;
            
            if (completed) {
              console.log(`Task ${task.id} completed on ${day.dateString}, timestamp: ${updatedAt}`);
            }
            
            return completed;
          }).length
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
      
      // Debug counts for this day
      try {
        console.log(`${day.dateString}: Tasks=${tasksCompleted}, Meetings=${meetingsAttended}, Appointments=${appointmentsAttended}`);
      } catch (error) {
        console.error(`Error logging day counts for ${day.dateString}:`, error);
      }
      
      return {
        name: day.shortDate,
        fullDate: day.dateString,
        tasks: tasksCompleted,
        meetings: meetingsAttended,
        appointments: appointmentsAttended,
        total: tasksCompleted + meetingsAttended + appointmentsAttended
      };
    });
    
    // Debug final trends data
    try {
      console.log("Productivity trends:", trends);
    } catch (error) {
      console.error("Error logging productivity trends:", error);
    }
    
    return trends;
  }, [tasks, meetings, appointments, last7Days]);

  // Calculate hourly activity distribution (24-hour format)
  const hourlyActivityData = useMemo(() => {
    // Debug tasks data
    try {
      console.log("Tasks for hourly distribution:", tasks);
      console.log("Completed tasks for hourly:", tasks.filter((task: any) => task.completed).length);
    } catch (error) {
      console.error("Error logging hourly task data:", error);
    }
    
    // Initialize hourly data structure
    const hourlyData = Array.from({ length: 24 }, (_, hour) => ({
      hour: hour,
      displayHour: hour === 0 ? '12 AM' : hour === 12 ? '12 PM' : hour < 12 ? `${hour} AM` : `${hour - 12} PM`,
      tasks: 0,
      meetings: 0,
      appointments: 0,
      total: 0
    }));

    // Populate with task data
    if (Array.isArray(tasks)) {
      tasks.forEach((task: any) => {
        if (task && task.completed && task.updated_at) {
          try {
            // Convert Unix timestamp to Date object
            const date = new Date(task.updated_at * 1000);
            const hour = date.getHours();
            
            // Debug task completion hour
            console.log(`Task ${task.id} completed at hour ${hour}, timestamp: ${task.updated_at}, date: ${date.toString()}`);
            
            if (hour >= 0 && hour < 24) {
              hourlyData[hour].tasks += 1;
              hourlyData[hour].total += 1;
            }
          } catch (error) {
            console.error(`Error processing task ${task.id} with timestamp ${task.updated_at}:`, error);
          }
        }
      });
    }

    // Populate with meeting data
    if (Array.isArray(meetings)) {
      meetings.forEach((meeting: any) => {
        if (meeting && meeting.start_time) {
          const date = new Date(meeting.start_time * 1000);
          const hour = date.getHours();
          if (hour >= 0 && hour < 24) {
            hourlyData[hour].meetings += 1;
            hourlyData[hour].total += 1;
          }
        }
      });
    }

    // Populate with appointment data
    if (Array.isArray(appointments)) {
      appointments.forEach((apt: any) => {
        if (apt && apt.start_time) {
          const date = new Date(apt.start_time * 1000);
          const hour = date.getHours();
          if (hour >= 0 && hour < 24) {
            hourlyData[hour].appointments += 1;
            hourlyData[hour].total += 1;
          }
        }
      });
    }
    
    // Debug hourly data
    try {
      console.log("Hourly activity data:", hourlyData);
      
      // Check if there's any data
      const hasData = hourlyData.some(item => item.total > 0);
      console.log("Hourly data has values:", hasData);
    } catch (error) {
      console.error("Error logging hourly activity data:", error);
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
    console.log("Tasks for monthly trends:", tasks);
    console.log("Completed tasks:", tasks.filter((task: any) => task.completed).length);
    
    const trends = last6Months.map(monthData => {
      // Create date objects using the user's timezone
      const startOfMonth = new Date(monthData.date);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const endOfMonth = new Date(monthData.date.getFullYear(), monthData.date.getMonth() + 1, 0);
      endOfMonth.setHours(23, 59, 59, 999);
      
      const startTimestamp = Math.floor(startOfMonth.getTime() / 1000);
      const endTimestamp = Math.floor(endOfMonth.getTime() / 1000);
      
      // Debug timestamps
      try {
        console.log(`Month: ${monthData.month}, Start: ${new Date(startTimestamp * 1000).toString()}, End: ${new Date(endTimestamp * 1000).toString()}`);
      } catch (error) {
        console.error(`Error logging month range for ${monthData.month}:`, error);
      }
      
      // Count tasks created in this month
      const tasksCreated = Array.isArray(tasks) 
        ? tasks.filter((task: any) => {
            const created = task.created_at >= startTimestamp && task.created_at <= endTimestamp;
            return created;
          }).length
        : 0;
      
      // Count tasks completed in this month
      const tasksCompleted = Array.isArray(tasks) 
        ? tasks.filter((task: any) => {
            if (!task.completed || !task.updated_at) return false;
            
            const completed = task.updated_at >= startTimestamp && task.updated_at <= endTimestamp;
            return completed;
          }).length
        : 0;
      
      // Debug counts for this month
      try {
        console.log(`${monthData.month}: Created=${tasksCreated}, Completed=${tasksCompleted}`);
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
      console.log("Monthly completion trends:", trends);
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

      {/* Task Completion Metrics - Full width section */}
      {Array.isArray(tasks) && tasks.length > 0 && (
        <>
          {/* Debug task structure */}
          <div style={{ display: 'none' }}>
          </div>
          <TaskCompletionMetrics tasks={tasks as TaskWithSubtaskCounts[]} />
        </>
      )}
    </div>
  );
};

export default function Dashboard() {
  // Use localStorage to persist the selected navigation item
  const [selectedNav, setSelectedNav] = React.useState<string>(() => {
    // Try to get the saved navigation from localStorage
    const savedNav = localStorage.getItem('selectedNav');
    // Return the saved nav or default to "Dashboard"
    return savedNav || "Dashboard";
  });
  const { logout, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const [isMobileView, setIsMobileView] = React.useState(false);

  // Define navItems inside the component to access user
  const navItems = React.useMemo(() => {
    // Base navigation items that all users can see
    const baseItems = [
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
        title: "Sticky Notes",
        icon: <StickyNote className="h-4 w-4" />,
        component: <NotesBoard />,
      },
      {
        title: "Long Notes",
        icon: <NotebookIcon className="h-4 w-4" />,
        component: <LongNotesBoard />,
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
        title: "Appointments",
        icon: <CalendarIcon className="h-4 w-4" />,
        component: <Appointments />,
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
    
    // Add admin-only items
    if (user?.role === 'admin') {
      baseItems.push({
        title: "User Management",
        icon: <Users className="h-4 w-4" />,
        component: <UserManagement />,
      });
    }
    
    return baseItems;
  }, [user?.role]);

  // Update localStorage when navigation changes
  React.useEffect(() => {
    localStorage.setItem('selectedNav', selectedNav);
  }, [selectedNav]);

  // Check if we're in mobile view
  React.useEffect(() => {
    const checkMobileView = () => {
      setIsMobileView(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };

    // Initial check
    checkMobileView();

    // Add event listener for window resize
    window.addEventListener('resize', checkMobileView);

    // Cleanup
    return () => window.removeEventListener('resize', checkMobileView);
  }, []);

  return (
    <NotificationsProvider>
      <TaskReminderService />
      
      {/* Mobile menu button - only visible on small screens */}
      {isMobileView && (
        <div className="fixed top-4 left-4 z-50">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm border border-border shadow-md"
          >
            {isSidebarOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>
      )}

      {/* Mobile view */}
      {isMobileView ? (
        <div className="h-screen flex flex-col">
          {/* Sidebar for mobile - conditionally shown */}
          <div 
            className={cn(
              "bg-[hsl(var(--background))] flex flex-col shadow-md z-40 fixed inset-y-0 left-0 w-[280px] transition-transform duration-300 ease-in-out",
              isSidebarOpen ? "translate-x-0" : "-translate-x-full"
            )}
          >
            {/* Sidebar content */}
            {renderSidebarContent()}
          </div>

          {/* Overlay for mobile */}
          {isSidebarOpen && (
            <div 
              className="fixed inset-0 bg-black/50 z-30 backdrop-blur-sm"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}

          {/* Main content for mobile */}
          <div className="flex-1 bg-[hsl(var(--background))] h-screen flex flex-col overflow-hidden">
            <ScrollArea className="flex-1 thin-scrollbar">
              <div className="p-4 md:p-6">
                {renderMainContent()}
              </div>
            </ScrollArea>
          </div>
        </div>
      ) : (
        /* Desktop view with resizable panels */
        <ResizablePanelGroup
          direction="horizontal"
          className="h-screen items-stretch"
        >
          {/* Resizable sidebar */}
          <ResizablePanel 
            defaultSize={22} 
            minSize={15} 
            maxSize={30} 
            className="bg-[hsl(var(--background))] flex flex-col h-screen shadow-sm"
          >
            {renderSidebarContent()}
          </ResizablePanel>

          <ResizableHandle withHandle className="w-2 bg-[hsl(var(--border))]" />

          {/* Main content area */}
          <ResizablePanel 
            defaultSize={78} 
            minSize={70} 
            maxSize={85} 
            className="bg-[hsl(var(--background))] h-screen flex flex-col"
          >
            <ScrollArea className="flex-1 thin-scrollbar">
              <div className="p-6">
                {renderMainContent()}
              </div>
            </ScrollArea>
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
    </NotificationsProvider>
  );

  // Helper function to render sidebar content
  function renderSidebarContent() {
    return (
      <>
        {/* App branding - now clickable */}
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div 
              className="flex items-center gap-2.5 cursor-pointer justify-center group" 
              onClick={() => {
                setSelectedNav("Dashboard");
                if (isMobileView) setIsSidebarOpen(false);
              }}
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
                onClick={() => {
                  setSelectedNav(item.title);
                  if (isMobileView) setIsSidebarOpen(false);
                }}
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
      </>
    );
  }

  // Helper function to render main content
  function renderMainContent() {
    console.log("Selected navigation item:", selectedNav);
    
    // Find the matching nav item
    const navItem = navItems.find(item => item.title === selectedNav);
    console.log("Found nav item:", navItem?.title);
    
    // If we found a matching nav item, render its component
    if (navItem) {
      return (
        <div className="w-full">
          {navItem.component}
        </div>
      );
    }
    
    // Fallback to Dashboard if no matching nav item
    return <DashboardOverview />;
  }
}

// Helper function to get greeting based on time of day
const getGreeting = () => {
  // Get the current date in the user's timezone
  const timezone = getUserTimezone();
  const now = new Date();
  
  // Format the date in the user's timezone to get the correct hour
  const timeString = formatDate(now, 'HH');
  const hour = parseInt(timeString, 10);
  
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};