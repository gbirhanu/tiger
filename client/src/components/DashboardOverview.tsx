import React, { useState, useEffect } from 'react';
import { Bell, Calendar, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/use-notifications';

// Helper function to get greeting based on time of day
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

export function DashboardOverview() {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [userName, setUserName] = useState('User');
  const [todayTasks, setTodayTasks] = useState(5);
  const [completedTasks, setCompletedTasks] = useState(2);
  const [upcomingMeetings, setUpcomingMeetings] = useState(1);
  const [overdueTasks, setOverdueTasks] = useState(1);
  
  // Get user data on component mount
  useEffect(() => {
    // Try to get user data from localStorage if not available in context
    const storedUser = localStorage.getItem('user');
    const userData = user || (storedUser ? JSON.parse(storedUser) : null);
    
    if (userData) {
      // Set user name (fallback to "User" if not available)
      const name = userData.name || userData.username || 'User';
      setUserName(name);
    }
  }, [user]);
  
  // Function to create a demo notification
  const createDemoNotification = () => {
    addNotification({
      title: 'Welcome to Tiger',
      message: 'Thanks for trying out our notification system!',
      type: 'system',
    });
  };

  // Function to create a demo task reminder notification
  const createTaskReminderNotification = () => {
    // Create a task that's due soon (30 minutes from now)
    const demoTask = {
      id: 'demo-task-' + Date.now(),
      title: 'Demo Task',
      description: 'This is a demo task to test the reminder system',
      due_date: Math.floor(Date.now() / 1000) + 1800, // 30 minutes from now
      priority: 'high',
      completed: false
    };
    
    // Add a notification for the task
    addNotification({
      title: 'Task Due Soon',
      message: `"${demoTask.title}" is due in 30 minutes`,
      type: 'task',
      link: '/tasks'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{getGreeting()}, {userName}</h2>
          <p className="text-muted-foreground">
            Here's what's happening with your tasks today.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={createTaskReminderNotification} variant="outline" className="gap-2">
            <Clock className="h-4 w-4" />
            Task Reminder
          </Button>
          <Button onClick={createDemoNotification} variant="outline" className="gap-2">
            <Bell className="h-4 w-4" />
            Test Notification
          </Button>
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Tasks</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayTasks}</div>
            <p className="text-xs text-muted-foreground">
              {completedTasks} completed, {todayTasks - completedTasks} remaining
            </p>
            <Progress 
              value={(completedTasks / todayTasks) * 100} 
              className="mt-3 h-2" 
            />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Meetings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingMeetings}</div>
            <p className="text-xs text-muted-foreground">
              Next meeting in 45 minutes
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Tasks</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overdueTasks}</div>
            <p className="text-xs text-muted-foreground">
              {overdueTasks > 0 ? 'Requires attention' : 'All caught up!'}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Focus Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2h 15m</div>
            <p className="text-xs text-muted-foreground">
              Today's focus sessions
            </p>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Weekly Progress</CardTitle>
            <CardDescription>
              Your task completion rate over the past week
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              Chart placeholder
            </div>
          </CardContent>
        </Card>
        
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Upcoming Deadlines</CardTitle>
            <CardDescription>
              Tasks due in the next 7 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full bg-red-500 mr-2"></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Project Proposal</p>
                  <p className="text-xs text-muted-foreground">Due tomorrow</p>
                </div>
                <Button variant="ghost" size="sm">View</Button>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full bg-yellow-500 mr-2"></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Team Meeting Notes</p>
                  <p className="text-xs text-muted-foreground">Due in 3 days</p>
                </div>
                <Button variant="ghost" size="sm">View</Button>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Weekly Report</p>
                  <p className="text-xs text-muted-foreground">Due in 5 days</p>
                </div>
                <Button variant="ghost" size="sm">View</Button>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full">View All Tasks</Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
} 