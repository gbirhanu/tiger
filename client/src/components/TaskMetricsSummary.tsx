import React, { useState, useMemo } from 'react';
import {

  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CalendarIcon, TrendingUp, TrendingDown, BarChart2, ChevronRight, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, startOfHour, startOfDay, startOfWeek, startOfMonth, addHours, addDays, addWeeks, addMonths, isBefore, getTime } from 'date-fns';
import { toZonedTime, format as formatTZ } from 'date-fns-tz';
import { getUserTimezone } from '@/lib/timezone';

const TIMEZONE = getUserTimezone();

// Helper function to convert any timestamp to target timezone
const convertToTargetTimezone = (timestamp: string | number) => {
  if (typeof timestamp === 'string') {
    // If it's a string (SQLite datetime format), parse it as UTC
    const date = new Date(timestamp + 'Z');
    const zonedDate = toZonedTime(date, TIMEZONE);
    return getTime(zonedDate);
  } else if (typeof timestamp === 'number') {
    // If it's a number, convert from seconds to milliseconds if needed
    const milliseconds = timestamp < 10000000000 
      ? timestamp * 1000  // Convert seconds to milliseconds
      : timestamp;       // Already in milliseconds
    
    const date = new Date(milliseconds);
    const zonedDate = toZonedTime(date, TIMEZONE);
    return getTime(zonedDate);
  }
  return null;
};

const generateMockData = (tasks: any[], range: 'hour' | 'day' | 'week' | 'month' | 'custom', customRange?: { from: Date; to: Date }) => {
  const now = Date.now();
  const nowZoned = toZonedTime(new Date(now), TIMEZONE);
  let start: Date;
  let increment: (date: Date) => Date;
  let format_string: string;
  let points: number;
  let end: Date = nowZoned;

  switch (range) {
    case 'custom':
      if (!customRange?.from || !customRange?.to) return [];
      start = startOfDay(toZonedTime(customRange.from, TIMEZONE));
      end = toZonedTime(customRange.to, TIMEZONE);
      increment = (date) => addDays(date, 1);
      format_string = 'MMM d';
      points = Math.ceil((getTime(end) - getTime(start)) / (1000 * 60 * 60 * 24)) + 1;
      break;
    case 'hour':
      start = startOfHour(addHours(nowZoned, -23));
      increment = (date) => addHours(date, 1);
      format_string = 'hh:mm a';
      points = 24;
      break;
    case 'day':
      start = startOfDay(addDays(nowZoned, -6));
      increment = (date) => addDays(date, 1);
      format_string = 'EEE';
      points = 7;
      break;
    case 'week':
      start = startOfWeek(addWeeks(nowZoned, -11));
      increment = (date) => addWeeks(date, 1);
      format_string = 'MMM d';
      points = 12;
      break;
    case 'month':
      start = startOfMonth(addMonths(nowZoned, -11));
      increment = (date) => addMonths(date, 1);
      format_string = 'MMM';
      points = 12;
      break;
  }

  const data = [];
  let current = start;

  for (let i = 0; i < points; i++) {
    const next = increment(current);
    const startTime = getTime(current);
    const endTime = i === points - 1 ? getTime(end) : getTime(next);

    const completedTasks = tasks.filter(
      task => {
        // Properly convert task.updated_at to user's timezone
        const updateTime = convertToTargetTimezone(task.updated_at);
        
        // Only include if we have a valid date
        if (!updateTime) return false;
        
        return task.completed && 
               !task.task_id && // Only include main tasks (not subtasks)
               updateTime >= startTime && 
               updateTime <= endTime;
      }
    ).length;

    data.push({
      date: formatTZ(current, format_string, { timeZone: TIMEZONE }),
      completed: completedTasks
    });

    current = next;
  }

  return data;
};

interface Task {
  id: number;
  completed: boolean;
  updated_at: number;
  task_id?: number;  // This will be undefined for main tasks, and will exist for subtasks
}

interface ProductivityChartProps {
  tasks: Task[];
  className?: string;
}

interface DateRange {
  from: Date;
  to: Date;
}

const CHART_COLORS = {
  primary: "hsl(var(--border))",
  
  primaryTransparent: "hsla(var(--primary) / 0.2)",
  secondary: "#3B82F6",
  accent: "#8B5CF6",
  muted: "hsl(var(--muted))",
  border: "hsl(var(--border))"
};

export function TaskMetricsSummary({ tasks, className }: ProductivityChartProps) {
  const [timeRange, setTimeRange] = useState<'hour' | 'day' | 'week' | 'month' | 'custom'>('day');
  const [dateRange, setDateRange] = useState<DateRange>({
    from: toZonedTime(addDays(new Date(), -7), TIMEZONE),
    to: toZonedTime(new Date(), TIMEZONE),
  });

  const chartData = useMemo(() => 
    generateMockData(tasks, timeRange, timeRange === 'custom' ? dateRange : undefined), 
    [tasks, timeRange, dateRange]
  );

  // Calculate period trend
  const trendData = useMemo(() => {
    // Get the total completed tasks
    const totalCompleted = chartData.reduce((sum, item) => sum + item.completed, 0);
    
    // To calculate the trend direction, we still compare first half vs second half
    const firstHalf = chartData.slice(0, Math.floor(chartData.length / 2));
    const secondHalf = chartData.slice(Math.floor(chartData.length / 2));
    
    const firstHalfTotal = firstHalf.reduce((sum, item) => sum + item.completed, 0);
    const secondHalfTotal = secondHalf.reduce((sum, item) => sum + item.completed, 0);
    
    // Calculate trend direction based on change between periods
    let direction = 'neutral';
    if (firstHalfTotal === 0) {
      direction = secondHalfTotal > 0 ? 'up' : 'neutral';
    } else {
      direction = secondHalfTotal > firstHalfTotal ? 'up' : 
                  secondHalfTotal < firstHalfTotal ? 'down' : 'neutral';
    }
    
    // Get total tasks from the tasks array (excluding subtasks)
    const totalTasksCount = tasks.filter(task => !task.task_id).length;
    
    // Calculate percentage of completed tasks over total tasks
    const percentage = totalTasksCount > 0 
      ? Math.round((totalCompleted / totalTasksCount) * 100)
      : 0;
    
    return { percentage, direction };
  }, [chartData, tasks]);

  // Get current period total tasks
  const totalTasks = useMemo(() => 
    chartData.reduce((sum, item) => sum + item.completed, 0),
    [chartData]
  );

  // Get appropriate range label based on timeRange
  const rangeLabel = useMemo(() => {
    switch(timeRange) {
      case 'hour': return 'Last 24 Hours';
      case 'day': return 'Last 7 Days';
      case 'week': return 'Last 12 Weeks';
      case 'month': return 'Last 12 Months';
      case 'custom': return `${format(dateRange.from, "MMM d")} - ${format(dateRange.to, "MMM d, yyyy")}`;
    }
  }, [timeRange, dateRange]);

  return (
    <Card className={cn("w-full overflow-hidden bg-gradient-to-br from-card to-background border shadow-md", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10">
              <BarChart2 className="w-5 h-5 text-primary" />
            </div>
            <span>Task Completion Metrics</span>
          </div>
          <div className="flex flex-col items-start gap-4 w-full md:w-auto">
            <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)} className="w-full">
              <TabsList className="grid w-full grid-cols-5 lg:w-[500px] h-12 sm:h-10">
                <TabsTrigger value="hour" className="text-xs py-3 sm:py-2 truncate">Hourly</TabsTrigger>
                <TabsTrigger value="day" className="text-xs py-3 sm:py-2 truncate">Daily</TabsTrigger>
                <TabsTrigger value="week" className="text-xs py-3 sm:py-2 truncate">Weekly</TabsTrigger>
                <TabsTrigger value="month" className="text-xs py-3 sm:py-2 truncate">Monthly</TabsTrigger>
                <TabsTrigger value="custom" className="text-xs py-3 sm:py-2 truncate">Custom</TabsTrigger>
              </TabsList>
            </Tabs>
            
            {timeRange === 'custom' && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="justify-start text-left font-normal h-12 sm:h-10 text-xs w-full md:w-auto mt-2 md:mt-0 overflow-hidden text-ellipsis whitespace-nowrap"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                    <span className="truncate">
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "MMM d")} -{" "}
                            {format(dateRange.to, "MMM d")}
                          </>
                        ) : (
                          format(dateRange.from, "MMM d")
                        )
                      ) : (
                        <span>Pick dates</span>
                      )}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 max-w-[95vw] max-h-[90vh] overflow-auto" align="center">
                  <div className="max-w-[350px] min-w-[280px]">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={dateRange?.from}
                      selected={{
                        from: dateRange?.from,
                        to: dateRange?.to,
                      }}
                      onSelect={(range) => {
                        if (range?.from && range?.to) {
                          setDateRange({ from: range.from, to: range.to });
                        }
                      }}
                      numberOfMonths={1}
                      className="rounded-md"
                    />
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="col-span-2 flex items-center">
            <div className="text-sm text-muted-foreground">
              <span className="block font-medium text-foreground">{rangeLabel}</span>
              <p>Task completion metrics showing your productivity patterns over time.</p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-6">
            <div className="text-center">
              <span className="text-2xl font-bold block text-foreground">{totalTasks}</span>
              <span className="text-xs text-muted-foreground">Tasks Completed</span>
            </div>
            <div className="text-center">
              <div className="flex items-center gap-1 justify-center">
                <span className="text-2xl font-bold block text-foreground">{trendData.percentage}%</span>
                {trendData.direction === 'up' ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : trendData.direction === 'down' ? (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                ) : null}
              </div>
              <span className="text-xs text-muted-foreground">
                {trendData.direction === 'up' ? 'Increase' : trendData.direction === 'down' ? 'Decrease' : 'No Change'}
              </span>
            </div>
          </div>
        </div>
        
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{
                top: 20,
                right: 30,
                left: 20,
                bottom: 25,
              }}
            >
              <defs>
                <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.8}/>
                  <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} opacity={0.2} />
              <XAxis
                dataKey="date"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                padding={{ left: 10, right: 10 }}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}`}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  color: 'hsl(var(--foreground))',
                }}
                labelStyle={{ 
                  color: 'hsl(var(--foreground))', 
                  fontWeight: 600, 
                  marginBottom: '4px',
                  fontSize: '13px',
                }}
                itemStyle={{ 
                  padding: '2px 0',
                  color: 'hsl(var(--foreground))',
                  fontSize: '12px',
                }}
                formatter={(value: number) => [`${value} tasks`, 'Completed']}
                cursor={{ 
                  stroke: 'hsl(var(--primary))',
                  strokeWidth: 2,
                  strokeDasharray: '4 4',
                }}
              />
              <Legend 
                wrapperStyle={{ 
                  fontSize: '12px', 
                  marginTop: '8px',
                  color: 'hsl(var(--foreground))',
                }}
                formatter={(value) => (
                  <span style={{ 
                    color: 'hsl(var(--foreground))', 
                    fontSize: '12px',
                    fontWeight: 500,
                  }}>
                    Tasks Completed
                  </span>
                )}
              />
              <Area
                type="monotone"
                dataKey="completed"
                name="Completed"
                stroke={CHART_COLORS.primary}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorCompleted)"
                activeDot={{
                  r: 6,
                  fill: CHART_COLORS.primary,
                  stroke: 'hsl(var(--background))',
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        
        {totalTasks === 0 && (
          <div className="flex items-center justify-center p-4 mt-4 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ClipboardList className="h-5 w-5" />
              <span>No task completion data available for this period</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}