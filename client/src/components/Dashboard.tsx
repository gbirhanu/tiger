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

interface NavItem {
  title: string;
  icon: React.ReactNode;
  component: React.ReactNode;
}

const DashboardOverview = () => {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Welcome to Your Productivity Suite</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <TaskManager />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <NotesBoard />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <PomodoroTimer />
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