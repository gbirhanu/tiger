import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type PomodoroSettings, insertPomodoroSettingsSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Play, Pause, RotateCcw, Settings } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type TimerState = "work" | "break" | "longBreak";

export default function PomodoroTimer() {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [timerState, setTimerState] = useState<TimerState>("work");
  const [sessionsCompleted, setSessionsCompleted] = useState(0);

  const { data: settings } = useQuery<PomodoroSettings>({
    queryKey: ["/api/pomodoro-settings"],
  });

  const form = useForm({
    resolver: zodResolver(insertPomodoroSettingsSchema),
    defaultValues: settings || {
      workDuration: 25,
      breakDuration: 5,
      longBreakDuration: 15,
      sessionsBeforeLongBreak: 4,
    },
  });

  const updateSettings = useMutation({
    mutationFn: async (data: PomodoroSettings) => {
      const res = await apiRequest("PATCH", "/api/pomodoro-settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pomodoro-settings"] });
      toast({
        title: "Settings updated",
        description: "Your pomodoro settings have been updated successfully.",
      });
    },
  });

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => time - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsRunning(false);
      if (timerState === "work") {
        const newSessionsCompleted = sessionsCompleted + 1;
        setSessionsCompleted(newSessionsCompleted);
        
        if (settings && newSessionsCompleted % settings.sessionsBeforeLongBreak === 0) {
          setTimerState("longBreak");
          setTimeLeft(settings.longBreakDuration * 60);
        } else {
          setTimerState("break");
          setTimeLeft((settings?.breakDuration || 5) * 60);
        }
      } else {
        setTimerState("work");
        setTimeLeft((settings?.workDuration || 25) * 60);
      }
      
      toast({
        title: `${timerState === "work" ? "Break" : "Work"} time!`,
        description: `Time to ${timerState === "work" ? "take a break" : "focus"}!`,
      });
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, timeLeft, timerState, settings, sessionsCompleted]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getMaxTime = () => {
    if (!settings) return 25 * 60;
    switch (timerState) {
      case "work":
        return settings.workDuration * 60;
      case "break":
        return settings.breakDuration * 60;
      case "longBreak":
        return settings.longBreakDuration * 60;
    }
  };

  const progress = (timeLeft / getMaxTime()) * 100;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 flex flex-col items-center">
          <div className="text-4xl font-bold mb-4">{formatTime(timeLeft)}</div>
          <Progress value={progress} className="w-full mb-4" />
          
          <div className="space-x-2">
            <Button
              onClick={() => setIsRunning(!isRunning)}
              size="icon"
              variant="outline"
            >
              {isRunning ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
            <Button
              onClick={() => {
                setIsRunning(false);
                setTimeLeft(getMaxTime());
              }}
              size="icon"
              variant="outline"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button size="icon" variant="outline">
                  <Settings className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Pomodoro Settings</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit((data) => updateSettings.mutate(data))}
                    className="space-y-4"
                  >
                    <FormField
                      control={form.control}
                      name="workDuration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Work Duration (minutes)</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="breakDuration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Break Duration (minutes)</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="longBreakDuration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Long Break Duration (minutes)</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="sessionsBeforeLongBreak"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sessions Before Long Break</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <Button type="submit" disabled={updateSettings.isPending}>
                      Save Settings
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
          
          <div className="mt-4 text-sm text-muted-foreground">
            Session {sessionsCompleted + 1} - {timerState === "work" ? "Work" : timerState === "break" ? "Break" : "Long Break"}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
