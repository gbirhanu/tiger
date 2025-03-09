import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TaskManager from "./TaskManager";
import NotesBoard from "./NotesBoard";
import PomodoroTimer from "./PomodoroTimer";
import Calendar from "./Calendar";

export default function Dashboard() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-4xl font-bold mb-8 text-primary">Productivity Suite</h1>
      
      <Tabs defaultValue="tasks" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="pomodoro">Pomodoro</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="space-y-4">
          <TaskManager />
        </TabsContent>

        <TabsContent value="notes" className="space-y-4">
          <NotesBoard />
        </TabsContent>

        <TabsContent value="pomodoro" className="space-y-4">
          <PomodoroTimer />
        </TabsContent>

        <TabsContent value="calendar" className="space-y-4">
          <Calendar />
        </TabsContent>
      </Tabs>
    </div>
  );
}
