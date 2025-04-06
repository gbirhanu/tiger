import { Task, Subtask } from '@shared/schema';
import React, { useMemo, useState } from 'react';
import { toZonedTime, format } from 'date-fns-tz';
import { startOfHour, subHours, getTime, addHours } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { getSubtasks } from '@/lib/api';
import { QUERY_KEYS } from '@/lib/queryClient';
import { getUserTimezone } from '@/lib/timezone';

// Constants
const MS_PER_HOUR = 60 * 60 * 1000; // Milliseconds in an hour
const GRAPH_HOURS_WINDOW = 12; // Show last 12 hours
const HEIGHT = 30; // SVG height in pixels
const WIDTH = 100; // SVG width in pixels

interface TaskWithSubtasks extends Task {
  subtasks: Subtask[];
  has_subtasks?: boolean;
  completed_subtasks?: number;
  total_subtasks?: number;
  position?: number; // Add position field
}

// Interface for tooltip state
interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  count: number;
  hour: string;
}

const TaskActivityGraph = ({ task }: { task: TaskWithSubtasks }) => {
  const TARGET_TIMEZONE = getUserTimezone(); // Get user's timezone from settings
  
  // State for tooltip
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    count: 0,
    hour: '',
  });
  
  // Check if the task has subtasks, regardless of their completion status
  if (!('has_subtasks' in task) || !task.has_subtasks) {
    return null;
  }
  
  // Get the subtasks from subtask table by task id
  const { data: subtasks, isLoading } = useQuery({
    queryKey: [QUERY_KEYS.SUBTASKS, task.id],
    queryFn: () => getSubtasks(task.id),
  });
  
  // Update task with subtasks
  const taskSubtasks = subtasks || task.subtasks || [];
  
  // Helper function to convert any timestamp to target timezone
  const convertToTargetTimezone = (timestamp: string | number) => {
    if (typeof timestamp === 'string') {
      // If it's a string (SQLite datetime format), parse it as UTC
      const date = new Date(timestamp + 'Z');
      const zonedDate = toZonedTime(date, TARGET_TIMEZONE);
      return getTime(zonedDate);
    } else if (typeof timestamp === 'number') {
      // If it's a number, convert from seconds to milliseconds if needed
      const milliseconds = timestamp < 10000000000 
        ? timestamp * 1000  // Convert seconds to milliseconds
        : timestamp;       // Already in milliseconds
      
      const date = new Date(milliseconds);
      const zonedDate = toZonedTime(date, TARGET_TIMEZONE);
      return getTime(zonedDate);
    }
    return null;
  };

  // Calculate hourly completion counts
  const hourlyCounts = useMemo(() => {
    // Current time in the target timezone
    const nowUtc = Date.now();
    const nowZoned = toZonedTime(new Date(nowUtc), TARGET_TIMEZONE);
    const currentHourStartZoned = startOfHour(nowZoned);
    const windowStartHourStartZoned = subHours(currentHourStartZoned, GRAPH_HOURS_WINDOW - 1); // Subtract one less hour to include current hour

    const windowStartUtcTs = getTime(windowStartHourStartZoned);
    const windowEndUtcTs = getTime(nowZoned); // Use current time instead of hour start

    // Initialize counts array for each hour
    const counts = Array(GRAPH_HOURS_WINDOW).fill(0);

    // Filter and process completed subtasks
    const completedSubtasks = taskSubtasks.filter((subtask) => {
      if (!subtask.completed) return false;
      
      const completionTime = convertToTargetTimezone(subtask.updated_at);
      
      return (
        typeof completionTime === 'number' &&
        !isNaN(completionTime) &&
        completionTime >= windowStartUtcTs &&
        completionTime <= windowEndUtcTs // Include current time
      );
    });

    // Bin completions into hourly slots
    completedSubtasks.forEach((subtask) => {
      const completionTime = convertToTargetTimezone(subtask.updated_at);
      
      if (completionTime !== null) {
        const hourIndex = Math.floor((completionTime - windowStartUtcTs) / MS_PER_HOUR);
        if (hourIndex >= 0 && hourIndex < GRAPH_HOURS_WINDOW) {
          counts[hourIndex]++;
        }
      }
    });

    return counts;
  }, [taskSubtasks, task.id, TARGET_TIMEZONE]);

  // Generate hour labels for tooltip - keep all hooks before any conditional returns
  const hourLabels = useMemo(() => {
    const nowUtc = Date.now();
    const nowZoned = toZonedTime(new Date(nowUtc), TARGET_TIMEZONE);
    const currentHourStartZoned = startOfHour(nowZoned);
    const windowStartHourStartZoned = subHours(currentHourStartZoned, GRAPH_HOURS_WINDOW - 1); // Subtract one less hour to include current hour
    
    return Array(GRAPH_HOURS_WINDOW).fill(0).map((_, index) => {
      const hourDate = addHours(windowStartHourStartZoned, index);
      return format(hourDate, 'h a', { timeZone: TARGET_TIMEZONE });
    });
  }, [TARGET_TIMEZONE]);

  // Prepare data for the graph
  const graphData = useMemo(() => {
    return hourlyCounts;
  }, [hourlyCounts]);
  
  // Check if there are any completed subtasks - AFTER all hooks have been called
  const hasCompletedSubtasks = hourlyCounts.some(count => count > 0);
  
  // If no completed subtasks, don't show the graph at all
  if (!hasCompletedSubtasks) {
    return null;
  }

  // Calculate the maximum value for scaling the y-axis
  const maxCount = Math.max(...graphData, 1); // Ensure at least 1 to avoid division by zero

  // Generate the SVG path for the line
  const createPath = (): string => {
    const points = graphData.map((count, index) => {
      const x = (index / (GRAPH_HOURS_WINDOW - 1)) * WIDTH; // Spread points across width
      const y = HEIGHT - (count / maxCount) * HEIGHT; // Scale y based on max count
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    return `M ${points.join(' L ')}`;
  };
  
  // Generate the SVG path for the area fill
  const createAreaPath = (): string => {
    const points = graphData.map((count, index) => {
      const x = (index / (GRAPH_HOURS_WINDOW - 1)) * WIDTH; // Spread points across width
      const y = HEIGHT - (count / maxCount) * HEIGHT; // Scale y based on max count
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    
    // Add points to close the path at the bottom
    return `M 0,${HEIGHT} L ${points.join(' L ')} L ${WIDTH},${HEIGHT} Z`;
  };

  const pathData = createPath();
  const areaPathData = createAreaPath();
  
  const strokeColor = "#10B981"; // Green for activity (we know there is activity at this point)
  
  // Create enhanced gradient colors with more stops for a professional look
  const primaryColor = "16, 185, 129";
  const secondaryColor = "5, 150, 105";
  
  // Handle mouse interactions for data points
  const handleMouseOver = (count: number, index: number, x: number, y: number) => {
    setTooltip({
      visible: true,
      x: x,
      y: y,
      count: count,
      hour: hourLabels[index],
    });
  };

  const handleMouseOut = () => {
    setTooltip({ ...tooltip, visible: false });
  };

  return (
    <div
      className="w-full h-[30px] mt-1 relative"
      title={`Subtask completions per hour (Last ${GRAPH_HOURS_WINDOW}h)`}
    >
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-full overflow-visible" aria-hidden="true">
        {/* Define enhanced gradients and filters */}
        <defs>
          {/* Main vertical gradient */}
          <linearGradient id={`activity-gradient-${task.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={`rgba(${primaryColor}, 0.8)`} />
            <stop offset="40%" stopColor={`rgba(${primaryColor}, 0.6)`} />
            <stop offset="70%" stopColor={`rgba(${primaryColor}, 0.3)`} />
            <stop offset="100%" stopColor={`rgba(${primaryColor}, 0.05)`} />
          </linearGradient>
          
          {/* Horizontal gradient overlay for depth */}
          <linearGradient id={`activity-gradient-horizontal-${task.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={`rgba(${secondaryColor}, 0.15)`} />
            <stop offset="50%" stopColor={`rgba(${primaryColor}, 0.25)`} />
            <stop offset="100%" stopColor={`rgba(${secondaryColor}, 0.15)`} />
          </linearGradient>
          
          {/* Pattern overlay for texture */}
          <pattern id={`activity-dots-${task.id}`} x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
            <rect x="0" y="0" width="4" height="4" fill="none"/>
            <circle cx="2" cy="2" r="0.5" fill={`rgba(${primaryColor}, 0.3)`} />
          </pattern>
          
          {/* SVG Filter for glow effect */}
          <filter id={`activity-glow-${task.id}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          
          {/* Composite gradient with pattern */}
          <mask id={`activity-mask-${task.id}`}>
            <path d={areaPathData} fill="white" />
          </mask>
        </defs>
        
        {/* Base area fill with main gradient */}
        <path
          d={areaPathData}
          fill={`url(#activity-gradient-${task.id})`}
          strokeWidth="0"
          className="transition-opacity duration-300 ease-in-out"
        />
        
        {/* Horizontal gradient overlay for depth */}
        <path
          d={areaPathData}
          fill={`url(#activity-gradient-horizontal-${task.id})`}
          strokeWidth="0"
          style={{ mixBlendMode: 'overlay' }}
          className="transition-opacity duration-300 ease-in-out"
        />
        
        {/* Pattern overlay for texture */}
        <rect 
          x="0" 
          y="0" 
          width={WIDTH} 
          height={HEIGHT} 
          fill={`url(#activity-dots-${task.id})`} 
          mask={`url(#activity-mask-${task.id})`}
          className="opacity-40"
        />
        
        {/* Animated subtle waves for dynamic effect */}
        <path
          d={areaPathData}
          fill="none"
          stroke={`rgba(${primaryColor}, 0.2)`}
          strokeWidth="0.5"
          strokeDasharray="1,2"
          className="animate-pulse opacity-60"
          style={{ animationDuration: '3s' }}
        />
        
        {/* Line path with enhanced styling */}
        <path
          d={pathData}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`drop-shadow(0px 1px 1px rgba(0, 0, 0, 0.15))`}
          className="filter brightness-110"
        />
        
        {/* Glow effect for the line */}
        <path
          d={pathData}
          fill="none"
          stroke={`rgba(${primaryColor}, 0.4)`}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#activity-glow-${task.id})`}
          className="opacity-60"
        />
        
        {/* Data points as dots - only show for significant points */}
        {graphData.map((count, index) => {
          // Only show dots for points with data or at evenly spaced intervals
          const shouldShowDot = count > 0 || index % 6 === 0;
          if (!shouldShowDot) return null;
          
          const x = (index / (GRAPH_HOURS_WINDOW - 1)) * WIDTH;
          const y = HEIGHT - (count / maxCount) * HEIGHT;
          return (
            <g key={index}>
              <circle
                cx={x}
                cy={y}
                r={count > 0 ? "1.8" : "1"}
                fill={count > 0 ? strokeColor : "transparent"}
                stroke={strokeColor}
                strokeWidth="0.8"
                className={count > 0 ? "opacity-100" : "opacity-40"}
                filter={count > 0 ? "drop-shadow(0px 1px 1px rgba(0, 0, 0, 0.15))" : "none"}
              />
              {/* Glow effect for dots with data */}
              {count > 0 && (
                <circle
                  cx={x}
                  cy={y}
                  r="3"
                  fill={`rgba(${primaryColor}, 0.2)`}
                  className="animate-pulse"
                  style={{ animationDuration: '2s' }}
                />
              )}
              {/* Larger invisible circle for better hover target */}
              <circle
                cx={x}
                cy={y}
                r="5"
                fill="transparent"
                stroke="transparent"
                onMouseOver={() => handleMouseOver(hourlyCounts[index], index, x, y)}
                onMouseOut={handleMouseOut}
                style={{ cursor: 'pointer' }}
              />
            </g>
          );
        })}
      </svg>
      
      {/* Enhanced tooltip */}
      {tooltip.visible && (
        <div 
          className="absolute bg-gray-800 text-white px-2 py-1 rounded text-xs whitespace-nowrap z-10 transform -translate-x-1/2 -translate-y-full pointer-events-none shadow-lg"
          style={{ 
            left: `${(tooltip.x / WIDTH) * 100}%`, 
            top: `0px`,
            marginTop: '-5px',
            backdropFilter: 'blur(8px)',
            background: 'rgba(30, 41, 59, 0.9)',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}
        >
          <div className="flex flex-col items-center">
            <div>{tooltip.hour}</div>
            <div className="font-semibold">
              {tooltip.count} {tooltip.count === 1 ? 'task' : 'tasks'} completed
            </div>
          </div>
          <div className="absolute left-1/2 bottom-0 -mb-1 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
        </div>
      )}
    </div>
  );
};

export default TaskActivityGraph;