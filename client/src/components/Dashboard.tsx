import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    icon: <LayoutGrid className="h-4 w-4" />,
    component: <TaskManager />,
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
    <ResizablePanelGroup className="h-screen">
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
      <ResizableHandle />
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