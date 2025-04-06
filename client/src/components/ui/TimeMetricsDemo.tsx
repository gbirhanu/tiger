import { useState, useMemo } from "react";
import { format, addDays } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/DateRangePicker";

// Define a simple Task interface
interface Task {
  id: number;
  title: string;
  description?: string;
  completed: boolean;
  updated_at?: number;
  completed_subtasks?: number;
  total_subtasks?: number;
  has_subtasks?: boolean;
}

// Function to count tasks within a date range
const countTasksInDateRange = (tasks: Task[], fromDate: Date, toDate: Date) => {
  const startTimestamp = Math.floor(fromDate.getTime() / 1000);
  const endTimestamp = Math.floor(toDate.getTime() / 1000);
  
  // Filter tasks that were completed within the date range
  const tasksInRange = tasks.filter(task => {
    // Must be completed and have a timestamp
    if (!task.completed || !task.updated_at) return false;
    
    // Check if completion time is within range
    return task.updated_at >= startTimestamp && task.updated_at <= endTimestamp;
  });
  
  // Count subtasks completed in range
  const subtasksCount = tasks.reduce((count, task) => {
    const completedSubtasks = task.completed_subtasks || 0;
    // Only count if task has timestamp and is within range
    if (task.updated_at && task.updated_at >= startTimestamp && task.updated_at <= endTimestamp) {
      return count + completedSubtasks;
    }
    return count;
  }, 0);
  
  return {
    tasks: tasksInRange.length,
    subtasks: subtasksCount,
    total: tasksInRange.length + subtasksCount
  };
};

export function TimeMetricsDemo() {
  // Mock data for tasks - using realistic timestamps from the past month
  const mockTasks: Task[] = [
    // Tasks completed in the last week
    {
      id: 1,
      title: "Complete project proposal",
      description: "Draft and submit project proposal",
      completed: true,
      updated_at: Math.floor(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).getTime() / 1000), // 2 days ago
      completed_subtasks: 3,
      total_subtasks: 3,
      has_subtasks: true
    },
    {
      id: 2,
      title: "Review team documentation",
      description: "Review documentation for accuracy",
      completed: true,
      updated_at: Math.floor(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).getTime() / 1000), // 3 days ago
      completed_subtasks: 2,
      total_subtasks: 2,
      has_subtasks: true
    },
    // Tasks completed earlier in the month
    {
      id: 3,
      title: "Client meeting preparation",
      description: "Prepare presentation for client meeting",
      completed: true,
      updated_at: Math.floor(new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).getTime() / 1000), // 15 days ago
      completed_subtasks: 4,
      total_subtasks: 4,
      has_subtasks: true
    },
    {
      id: 4,
      title: "Quarterly report analysis",
      description: "Analyze and summarize quarterly reports",
      completed: true,
      updated_at: Math.floor(new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).getTime() / 1000), // 20 days ago
      completed_subtasks: 0,
      total_subtasks: 0,
      has_subtasks: false
    }
  ];

  // Date range selection state with defaults
  const today = new Date();
  const oneMonthAgo = new Date(today);
  oneMonthAgo.setMonth(today.getMonth() - 1);
  
  const [dateRange, setDateRange] = useState<{
    from: Date;
    to: Date;
  }>({
    from: oneMonthAgo,
    to: today,
  });
  
  // Get counts and metrics for the selected date range
  const metrics = countTasksInDateRange(mockTasks, dateRange.from, dateRange.to);
  
  // Create day-by-day data for a chart
  const chartData = useMemo(() => {
    const dayMap = new Map();
    let currentDate = new Date(dateRange.from);
    
    // Create entries for each day in the range
    while (currentDate <= dateRange.to) {
      const dateKey = format(currentDate, 'yyyy-MM-dd');
      dayMap.set(dateKey, {
        date: format(currentDate, 'MMM d'),
        tasks: 0,
        subtasks: 0
      });
      currentDate = addDays(currentDate, 1);
    }
    
    // Count tasks by date
    mockTasks.forEach(task => {
      if (task.completed && task.updated_at) {
        const taskDate = new Date(task.updated_at * 1000);
        const dateKey = format(taskDate, 'yyyy-MM-dd');
        
        if (dayMap.has(dateKey)) {
          const day = dayMap.get(dateKey);
          dayMap.set(dateKey, {
            ...day,
            tasks: day.tasks + 1,
            subtasks: day.subtasks + (task.completed_subtasks || 0)
          });
        }
      }
    });
    
    // Convert map to array and sort by date
    return Array.from(dayMap.values());
  }, [dateRange, mockTasks]);
  
  // Chart colors
  const CHART_COLORS = {
    blue: "#3B82F6",
    green: "#10B981"
  };
  
  return (
    <Card className="border p-4 mt-8">
      <CardHeader>
        <CardTitle className="text-lg">Time Metrics Demo</CardTitle>
        <CardDescription>Using mock data to demonstrate metrics functionality</CardDescription>
        
        {/* Date Range Picker */}
        <DateRangePicker 
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />
      </CardHeader>
      
      <CardContent>
        {/* Metrics Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md">
            <h3 className="text-sm font-medium text-blue-600 dark:text-blue-300">Tasks Completed</h3>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-200">{metrics.tasks}</p>
          </div>
          
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-md">
            <h3 className="text-sm font-medium text-green-600 dark:text-green-300">Subtasks Completed</h3>
            <p className="text-2xl font-bold text-green-700 dark:text-green-200">{metrics.subtasks}</p>
          </div>
          
          <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-md">
            <h3 className="text-sm font-medium text-purple-600 dark:text-purple-300">Total Items</h3>
            <p className="text-2xl font-bold text-purple-700 dark:text-purple-200">{metrics.total}</p>
          </div>
        </div>
        
        {/* Chart visualization */}
        <div className="h-64 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                angle={-45} 
                textAnchor="end" 
                height={70} 
                tick={{ fontSize: 12 }}
              />
              <YAxis />
              <Tooltip formatter={(value) => [value, '']} />
              <Legend />
              <Bar dataKey="tasks" name="Tasks" fill={CHART_COLORS.blue} />
              <Bar dataKey="subtasks" name="Subtasks" fill={CHART_COLORS.green} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Task list */}
        <div className="mt-8">
          <h3 className="font-medium mb-2">Tasks In Selected Range</h3>
          <div className="space-y-2">
            {mockTasks
              .filter(task => {
                if (!task.updated_at) return false;
                const taskDate = new Date(task.updated_at * 1000);
                return taskDate >= dateRange.from && taskDate <= dateRange.to;
              })
              .map(task => (
                <div key={task.id} className="border p-3 rounded-md">
                  <div className="flex justify-between">
                    <div>
                      <h4 className="font-medium">{task.title}</h4>
                      <p className="text-sm text-muted-foreground">{task.description}</p>
                    </div>
                    <div className="text-sm">
                      {new Date(task.updated_at! * 1000).toLocaleDateString()}
                    </div>
                  </div>
                  {task.has_subtasks && (
                    <div className="mt-2 text-sm">
                      <span className="text-green-600">
                        {task.completed_subtasks} of {task.total_subtasks} subtasks completed
                      </span>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 