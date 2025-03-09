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
import { LayoutGrid, CheckSquare, StickyNote, Timer, CalendarDays } from "lucide-react";
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
  const { data: tasks } = useQuery({ queryKey: ["/api/tasks"] });
  const { data: appointments } = useQuery({ queryKey: ["/api/appointments"] });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Dashboard Overview</h2>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Task Status Chart */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Task Status</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={taskData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label
                  >
                    {taskData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Pomodoro Sessions Chart */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Weekly Pomodoro Sessions</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pomodoroData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="sessions" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Note Activity Chart */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Note Activity</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={noteData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#82ca9d" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Appointments */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Upcoming Appointments</h3>
            <div className="space-y-4">
              {appointments?.slice(0, 3).map((appointment: any) => (
                <div key={appointment.id} className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{appointment.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(appointment.startTime), "PPP p")}
                    </p>
                  </div>
                </div>
              ))}
              {(!appointments || appointments.length === 0) && (
                <p className="text-muted-foreground">No upcoming appointments</p>
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
];

export default function Dashboard() {
  const [selectedNav, setSelectedNav] = React.useState<string>("Dashboard");

  return (
    <ResizablePanelGroup
      direction="horizontal"
      className="h-screen items-stretch"
    >
      <ResizablePanel defaultSize={20} minSize={15} maxSize={25}>
        <div className="flex h-full flex-col">
          <div className="px-3 py-2">
            <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
              Productivity Suite
            </h2>
          </div>
          <Separator />
          <ScrollArea className="flex-1">
            <div className="space-y-1 p-2">
              {navItems.map((item) => (
                <Button
                  key={item.title}
                  variant={selectedNav === item.title ? "secondary" : "ghost"}
                  size="sm"
                  className={cn("w-full justify-start gap-2", {
                    "bg-secondary": selectedNav === item.title,
                  })}
                  onClick={() => setSelectedNav(item.title)}
                >
                  {item.icon}
                  {item.title}
                </Button>
              ))}
            </div>
          </ScrollArea>
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={80}>
        <ScrollArea className="h-full">
          <div className="p-8">
            {navItems.find((item) => item.title === selectedNav)?.component}
          </div>
        </ScrollArea>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}