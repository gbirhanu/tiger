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
import { LayoutGrid, CheckSquare, StickyNote, Timer, CalendarDays, Video, Settings as SettingsIcon, Flame, LogOut, Moon, Sun, ChevronRight, Home } from "lucide-react";
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";
import Meetings from "./Meetings";
import Settings from "./Settings";
import { useAuth } from "@/contexts/AuthContext";
import { getAppointments, getNotes, getPomodoroSettings, getTasks } from "@/lib/api";
import { ThemeToggle } from "./ui/theme-toggle";
import { ProfileDropdown } from "./ui/ProfileDropdown";

interface NavItem {
  title: string;
  icon: React.ReactNode;
  component: React.ReactNode;
}

// Sample data for charts
const taskData = [
  { name: "Completed", value: 15 },
  { name: "In Progress", value: 8 },
  { name: "Not Started", value: 5 },
];

const pomodoroData = [
  { name: "Mon", sessions: 4 },
  { name: "Tue", sessions: 6 },
  { name: "Wed", sessions: 3 },
  { name: "Thu", sessions: 7 },
  { name: "Fri", sessions: 5 },
];

const noteData = [
  { date: "Mar 1", count: 3 },
  { date: "Mar 2", count: 5 },
  { date: "Mar 3", count: 4 },
  { date: "Mar 4", count: 7 },
  { date: "Mar 5", count: 6 },
];

const COLORS = ["#0088FE", "#00C49F", "#FFBB28"];

const DashboardOverview = () => {
  // Fetch data using React Query with error handling
  const { data: tasks = [], error: tasksError, isLoading: tasksLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const response = await getTasks();
      console.log("tasks", response);
      
      return response;
    },
  });

  const { data: notes = [], error: notesError, isLoading: notesLoading } = useQuery({
    queryKey: ["notes"],
    queryFn: async () => {
      const response = await getNotes();
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

  const { data: pomodoroSettings } = useQuery({
    queryKey: ["pomodoro-settings"],
    queryFn: async () => {
      const response = await getPomodoroSettings();
      return response;
    },
  });

  // Calculate task statistics safely
  const taskStats = {
    completed: Array.isArray(tasks) ? tasks.filter((task: any) => task.completed).length : 0,
    inProgress: Array.isArray(tasks) ? tasks.filter((task: any) => !task.completed && task.due_date).length : 0,
    notStarted: Array.isArray(tasks) ? tasks.filter((task: any) => !task.completed && !task.due_date).length : 0,
  };

  const taskChartData = [
    { name: "Completed", value: taskStats.completed },
    { name: "In Progress", value: taskStats.inProgress },
    { name: "Not Started", value: taskStats.notStarted },
  ];

  // Calculate notes by date safely
  const last5Days = Array.from({ length: 5 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return format(date, "MMM d");
  }).reverse();

  const notesByDate = last5Days.map(date => ({
    date,
    count: Array.isArray(notes) ? notes.filter((note: any) => 
      note.createdAt && format(new Date(note.createdAt), "MMM d") === date
    ).length : 0
  }));

  // Get upcoming appointments safely
  const upcomingAppointments = Array.isArray(appointments) ? appointments
    .filter((apt: any) => apt.startTime && new Date(apt.startTime) > new Date())
    .sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, 3) : [];

  if (tasksError || notesError || appointmentsError) {
    return (
      <div className="p-4 text-red-500">
        Error loading dashboard data. Please try again later.
      </div>
    );
  }

  if (tasksLoading || notesLoading || appointmentsLoading) {
    return (
      <div className="p-4">
        Loading dashboard data...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Dashboard Overview</h2>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Task Status Chart */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Task Status</h3>
            <div className="h-[300px]">
              {taskChartData.every(item => item.value === 0) ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No tasks available
                </div>
              ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                      data={taskChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label
                  >
                      {taskChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Note Activity Chart */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Note Activity (Last 5 Days)</h3>
            <div className="h-[300px]">
              {notesByDate.every(item => item.count === 0) ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No notes created in the last 5 days
                </div>
              ) : (
              <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={notesByDate}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#82ca9d" />
                </LineChart>
              </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Appointments */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Upcoming Appointments</h3>
            <div className="space-y-4">
              {upcomingAppointments.length > 0 ? (
                upcomingAppointments.map((appointment: any) => (
                <div key={appointment.id} className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{appointment.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(appointment.startTime), "PPP p")}
                    </p>
                  </div>
                </div>
                ))
              ) : (
                <p className="text-muted-foreground">No upcoming appointments</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Task Summary */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Task Summary</h3>
            {Array.isArray(tasks) && tasks.length > 0 ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>Total Tasks</span>
                  <span className="font-medium">{tasks.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Completed</span>
                  <span className="text-green-600 font-medium">{taskStats.completed}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>In Progress</span>
                  <span className="text-yellow-600 font-medium">{taskStats.inProgress}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Not Started</span>
                  <span className="text-red-600 font-medium">{taskStats.notStarted}</span>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">No tasks available</p>
            )}
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
    component: <TaskManager />,
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
  const [selectedNav, setSelectedNav] = React.useState<string>("Dashboard");
  const { logout } = useAuth();

  return (
    <ResizablePanelGroup
      direction="horizontal"
      className="h-screen items-stretch"
    >
      {/* Resizable sidebar with slightly larger initial width */}
      <ResizablePanel defaultSize={22} minSize={15} maxSize={30} className="bg-[hsl(var(--background))] border-r flex flex-col h-screen">
        {/* App branding */}
        <div className="px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-yellow-500" />
              <h2 className="text-lg font-semibold">Tiger</h2>
            </div>
            <ThemeToggle />
          </div>
        </div>

        {/* User Profile Section */}
        <div className="border-b px-4 py-3">
          <ProfileDropdown />
        </div>
        
        {/* Navigation - independently scrollable */}
        <ScrollArea className="flex-1 thin-scrollbar">
          <div className="space-y-1 p-3">
            {navItems.map((item) => (
              <Button
                key={item.title}
                variant={selectedNav === item.title ? "default" : "ghost"}
                size="sm"
                className={cn("w-full justify-start gap-3 mb-1 px-3 py-4 font-medium transition-colors", {
                  "bg-primary text-primary-foreground": selectedNav === item.title,
                  "hover:bg-[hsl(var(--primary)/0.1)] hover:text-primary": selectedNav !== item.title,
                })}
                onClick={() => setSelectedNav(item.title)}
              >
                <div className={cn(
                  "w-8 h-8 flex items-center justify-center rounded-md",
                  selectedNav === item.title ? "bg-[hsl(var(--primary-foreground)/0.2)]" : "bg-[hsl(var(--muted)/0.5)]"
                )}>
                  {item.icon}
                </div>
                <span className="truncate">{item.title}</span>
              </Button>
            ))}
          </div>
        </ScrollArea>
        
        {/* Fixed logout button at bottom */}
        <div className="p-3 border-t">
          <Button
            variant="destructive"
            size="sm"
            className="w-full justify-start gap-3 px-3 py-4 font-medium transition-colors hover:bg-opacity-90"
            onClick={() => logout()}
          >
            <div className="w-8 h-8 flex items-center justify-center rounded-md bg-[hsl(var(--destructive-foreground)/0.2)]">
              <LogOut className="h-4 w-4" />
            </div>
            Logout
          </Button>
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle className="w-2 bg-[hsl(var(--border))]" />

      {/* Main content - independently scrollable */}
      <ResizablePanel defaultSize={82}>
        <ScrollArea className="h-screen thin-scrollbar">
          <div className="p-8">
            {navItems.find((item) => item.title === selectedNav)?.component}
          </div>
        </ScrollArea>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}