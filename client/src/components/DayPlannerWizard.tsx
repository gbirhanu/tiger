// Day Planner Wizard Component
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createTask, createMeeting, createAppointment, createSubtasks } from "@/lib/api";
import { CalendarDays, CheckSquare, Clock, Loader2, Plus, Sparkles, Trash2, Video } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TimeSelect } from "@/components/TimeSelect";
import { useToast } from "@/hooks/use-toast";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { QUERY_KEYS } from "@/lib/queryClient";
import { Task, Subtask } from "../../../shared/schema";
import { generateSubtasks as generatedSubtasksApi } from "@/lib/api";
import { formatDate } from "@/lib/timezone";
import { useAuth } from "@/contexts/AuthContext";
import { UsageLimitDialog } from './UsageLimitDialog';

interface TaskWithSubtaskCounts extends Task {
  completed_subtasks?: number;
  total_subtasks?: number;
  subtasks?: Subtask[];
  has_subtasks?: boolean;
}
interface DayPlannerWizardProps {
  onClose: () => void;
  existingTasks: TaskWithSubtaskCounts[];
  existingMeetings: any[];
  existingAppointments: any[];
}

export const DayPlannerWizard = ({ onClose, existingTasks, existingMeetings, existingAppointments }: DayPlannerWizardProps) => {
  const [step, setStep] = useState(1);
  const [hasMeetings, setHasMeetings] = useState<boolean | null>(null);
  const [hasAppointments, setHasAppointments] = useState<boolean | null>(null);
  const [hasTasks, setHasTasks] = useState<boolean | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast(); // Add toast hook
  const { user } = useAuth(); // Get authenticated user
  
  const [meetings, setMeetings] = useState<Array<{
    title: string;
    description: string | null;
    start_time: string;
    end_time: string;
    location: string | null;
    attendees: string | null;
  }>>([]);
  
  const [appointments, setAppointments] = useState<Array<{
    title: string;
    description: string | null;
    start_time: string;
    end_time: string;
    all_day: boolean;
  }>>([]);
  
  const [tasks, setTasks] = useState<Array<{
    title: string;
    description: string | null;
    priority: 'low' | 'medium' | 'high';
    subtasks: string[];
  }>>([]);

  const queryClient = useQueryClient();
  
  // Mutations for creating tasks, meetings, and appointments
  const createTaskMutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TASKS] });
    },
  });
  
  // Separate mutation for creating subtasks in the subtasks table
  const createSubtasksMutation = useMutation({
    mutationFn: ({ taskId, subtasks }: { taskId: number, subtasks: Array<{ title: string; completed: boolean }> }) => 
      createSubtasks(taskId, subtasks),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TASKS] });
    },
  });
  
  const createMeetingMutation = useMutation({
    mutationFn: createMeeting,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MEETINGS] });
    },
  });
  
  const createAppointmentMutation = useMutation({
    mutationFn: createAppointment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.APPOINTMENTS] });
    },
  });

  // Add state for loading indicators
  const [generatingForTaskIndex, setGeneratingForTaskIndex] = useState<number | null>(null);

  // Add a new meeting form
  const addMeeting = () => {
    setMeetings([...meetings, {
      title: '',
      description: null,
      start_time: format(new Date().setHours(9, 0, 0, 0), "yyyy-MM-dd'T'HH:mm"),
      end_time: format(new Date().setHours(10, 0, 0, 0), "yyyy-MM-dd'T'HH:mm"),
      location: null,
      attendees: null
    }]);
  };

  // Remove a meeting
  const removeMeeting = (index: number) => {
    setMeetings(meetings.filter((_, i) => i !== index));
  };

  // Add a new appointment form
  const addAppointment = () => {
    setAppointments([...appointments, {
      title: '',
      description: null,
      start_time: format(new Date().setHours(12, 0, 0, 0), "yyyy-MM-dd'T'HH:mm"),
      end_time: format(new Date().setHours(13, 0, 0, 0), "yyyy-MM-dd'T'HH:mm"),
      all_day: false
    }]);
  };

  // Remove an appointment
  const removeAppointment = (index: number) => {
    setAppointments(appointments.filter((_, i) => i !== index));
  };

  // Add a new task form
  const addTask = () => {
    setTasks([...tasks, {
      title: '',
      description: null,
      priority: 'medium',
      subtasks: []
    }]);
  };

  // Remove a task
  const removeTask = (index: number) => {
    setTasks(tasks.filter((_, i) => i !== index));
  };

  // Add a subtask to a task
  const addSubtask = (taskIndex: number) => {
    const updatedTasks = [...tasks];
    updatedTasks[taskIndex].subtasks.push('');
    setTasks(updatedTasks);
  };

  // Remove a subtask from a task
  const removeSubtask = (taskIndex: number, subtaskIndex: number) => {
    const updatedTasks = [...tasks];
    updatedTasks[taskIndex].subtasks = updatedTasks[taskIndex].subtasks.filter((_, i) => i !== subtaskIndex);
    setTasks(updatedTasks);
  };

  // Update a meeting field
  const updateMeeting = (index: number, field: string, value: string) => {
    const updatedMeetings = [...meetings];
    updatedMeetings[index] = { ...updatedMeetings[index], [field]: value };
    setMeetings(updatedMeetings);
  };

  // Update an appointment field
  const updateAppointment = (index: number, field: string, value: string | boolean) => {
    const updatedAppointments = [...appointments];
    updatedAppointments[index] = { ...updatedAppointments[index], [field]: value };
    setAppointments(updatedAppointments);
  };

  // Update a task field
  const updateTask = (index: number, field: string, value: string) => {
    const updatedTasks = [...tasks];
    updatedTasks[index] = { ...updatedTasks[index], [field]: value };
    setTasks(updatedTasks);
  };

  // Update a subtask
  const updateSubtask = (taskIndex: number, subtaskIndex: number, value: string) => {
    const updatedTasks = [...tasks];
    updatedTasks[taskIndex].subtasks[subtaskIndex] = value;
    setTasks(updatedTasks);
  };

  // Final submission of all data
  const handleSubmit = async () => {
    setIsGenerating(true);
    
    try {
      // Check if user is authenticated
      if (!user || !user.id) {
        toast({
          title: "Authentication error",
          description: "You must be logged in to create a day plan",
          variant: "destructive"
        });
        return;
      }
      
      // Process meetings
      for (const meeting of meetings) {
        if (meeting.title) {
          const meetingData: any = {
            title: meeting.title,
            description: meeting.description || "",
            start_time: Math.floor(new Date(meeting.start_time).getTime() / 1000),
            end_time: Math.floor(new Date(meeting.end_time).getTime() / 1000),
            location: meeting.location || "",
            attendees: meeting.attendees || "",
            user_id: user.id,
            created_at: Math.floor(Date.now() / 1000),
            updated_at: Math.floor(Date.now() / 1000)
          };
          await createMeetingMutation.mutateAsync(meetingData);
        }
      }
      
      // Process appointments
      for (const appointment of appointments) {
        if (appointment.title) {
          const appointmentData: any = {
            title: appointment.title,
            description: appointment.description || "",
            start_time: Math.floor(new Date(appointment.start_time).getTime() / 1000),
            end_time: Math.floor(new Date(appointment.end_time).getTime() / 1000),
            all_day: appointment.all_day,
            user_id: user.id,
            created_at: Math.floor(Date.now() / 1000),
            updated_at: Math.floor(Date.now() / 1000)
          };
          await createAppointmentMutation.mutateAsync(appointmentData);
        }
      }
      
      // Process tasks and subtasks
      for (const task of tasks) {
        if (task.title) {
          const taskData: any = {
            title: task.title,
            description: task.description || "",
            priority: task.priority,
            completed: false,
            due_date: Math.floor(new Date().setHours(23, 59, 59, 999) / 1000),
            all_day: true,
            user_id: user.id,
            is_recurring: false,
            parent_task_id: null,
            recurrence_pattern: null,
            recurrence_interval: null,
            recurrence_end_date: null,
            created_at: Math.floor(Date.now() / 1000),
            updated_at: Math.floor(Date.now() / 1000)
          };
          
          // Create the parent task first
          const newTask = await createTaskMutation.mutateAsync(taskData);
          
          // Add subtasks to the subtasks table if there are any
          if (Array.isArray(task.subtasks) && task.subtasks.length > 0 && newTask && newTask.id) {
            // Filter out empty subtasks and format them for the API
            const validSubtasks = task.subtasks
              .filter(subtask => typeof subtask === 'string' && subtask.trim() !== '')
              .map((subtask, index) => ({
                title: subtask.trim(),
                completed: false
              }));
            
            // Only call the API if we have valid subtasks
            if (validSubtasks.length > 0) {
              // Use the dedicated subtasks endpoint
              await createSubtasksMutation.mutateAsync({
                taskId: newTask.id,
                subtasks: validSubtasks
              });
            }
          }
        }
      }
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TASKS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MEETINGS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.APPOINTMENTS] });
      
      toast({
        title: "Day plan created successfully",
        description: "All items have been saved",
        variant: "default"
      });
      
      onClose();
    } catch (error) {
      toast({
        title: "Error saving day plan",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle moving to next step based on user selection
  const handleNextStep = () => {
    if (step === 1) {
      if (hasMeetings === true) {
        addMeeting();
      }
      setStep(2);
    } else if (step === 2) {
      if (hasAppointments === true) {
        addAppointment();
      }
      setStep(3);
    } else if (step === 3) {
      if (hasTasks === true) {
        addTask();
      }
      setStep(4);
    } else {
      handleSubmit();
    }
  };

  // Handle back button
  const handleBackStep = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  // Check if can proceed to next step
  const canProceedToNextStep = () => {
    if (step === 1) return hasMeetings !== null;
    if (step === 2) return hasAppointments !== null;
    if (step === 3) return hasTasks !== null;
    if (step === 4) {
      // Check if all required fields are filled
      const meetingsValid = meetings.every(m => !m.title || (m.title && m.start_time && m.end_time));
      const appointmentsValid = appointments.every(a => !a.title || (a.title && a.start_time && a.end_time));
      const tasksValid = tasks.every(t => !t.title || t.title);
      return meetingsValid && appointmentsValid && tasksValid;
    }
    return false;
  };

  // Add AI-generated subtasks to a task
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  const [limitErrorMessage, setLimitErrorMessage] = useState('');

  const generateSubtasksForTask = async (taskIndex: number) => {
    if (!tasks[taskIndex].title) {
      toast({
        title: "Task title required",
        description: "Please provide a task title before generating subtasks",
        variant: "destructive"
      });
      return;
    }
    
    try {
      // Set loading state for this specific task
      setGeneratingForTaskIndex(taskIndex);
      
      // Show loading state
      toast({
        title: "Generating subtasks",
        description: "Please wait while AI generates subtasks...",
      });
      
      const task = tasks[taskIndex];
      const prompt = `
        Generate 5 clear and simple subtasks for this task. Each subtask should be a single, actionable item.
        
        Task: ${task.title}
        ${task.description ? `Description: ${task.description}` : ''}
        
        Return the subtasks as a simple list, one per line. Do not include any JSON formatting, quotes, brackets, or numbers.
      `;
      
      // Call the API
      const response = await generatedSubtasksApi(prompt);
      
      // Process the response text
      let subtasksText = response.subtasks;
      
      // Clean up the response if it's a string
      if (typeof subtasksText === 'string') {
        // Remove any JSON formatting characters
        subtasksText = subtasksText
          .replace(/^\s*\[|\]\s*$/g, '') // Remove opening/closing brackets
          .replace(/"/g, '') // Remove quotes
          .replace(/,\s*/g, '\n') // Replace commas with newlines
          .replace(/\\n/g, '\n'); // Replace escaped newlines
      }
      
      // Split by newlines and clean up each line
      const generatedSubtasks = (Array.isArray(subtasksText) ? subtasksText : subtasksText.split('\n'))
        .filter((line: string) => line.trim().length > 0)
        .map((line: string) => line.replace(/^[-*•\d.]+\s*/, '').trim()); // Remove list markers
      
      // Update the task's subtasks
      const updatedTasks = [...tasks];
      updatedTasks[taskIndex].subtasks = generatedSubtasks;
      setTasks(updatedTasks);
      
      toast({
        title: "Subtasks generated",
        description: `Added ${generatedSubtasks.length} subtasks to "${task.title}"`,
      });
    } catch (error) {
      // Check if this is a usage limit error
      if (error && typeof error === 'object' && 'limitReached' in error) {
        const limitError = error as { 
          message: string; 
          code: string;
          limitReached: boolean;
          showUpgrade?: boolean;
        };
        
        // Show dialog instead of toast
        setLimitErrorMessage(limitError.message || "You've reached your Gemini API usage limit.");
        setShowLimitDialog(true);
      } else {
        toast({
          title: "Failed to generate subtasks",
          description: error instanceof Error ? error.message : "An unknown error occurred",
          variant: "destructive"
        });
      }
    } finally {
      // Clear loading state
      setGeneratingForTaskIndex(null);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center mb-4">
            {step === 1 && "Do you have any online meetings today?"}
            {step === 2 && "Do you have any appointments today?"}
            {step === 3 && "What tasks do you want to accomplish today?"}
            {step === 4 && "Review and Save Your Day Plan"}
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Meetings */}
        {step === 1 && (
          <div className="space-y-6 py-4">
            <div className="flex justify-center gap-4">
              <Button 
                onClick={() => setHasMeetings(true)} 
                variant={hasMeetings === true ? "default" : "outline"}
                className={hasMeetings === true ? "bg-blue-600 hover:bg-blue-700" : ""}
              >
                Yes, I have meetings
              </Button>
              <Button 
                onClick={() => setHasMeetings(false)} 
                variant={hasMeetings === false ? "default" : "outline"}
                className={hasMeetings === false ? "bg-blue-600 hover:bg-blue-700" : ""}
              >
                No meetings today
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Appointments */}
        {step === 2 && (
          <div className="space-y-6 py-4">
            <div className="flex justify-center gap-4">
              <Button 
                onClick={() => setHasAppointments(true)} 
                variant={hasAppointments === true ? "default" : "outline"}
                className={hasAppointments === true ? "bg-blue-600 hover:bg-blue-700" : ""}
              >
                Yes, I have appointments
              </Button>
              <Button 
                onClick={() => setHasAppointments(false)} 
                variant={hasAppointments === false ? "default" : "outline"}
                className={hasAppointments === false ? "bg-blue-600 hover:bg-blue-700" : ""}
              >
                No appointments today
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Tasks */}
        {step === 3 && (
          <div className="space-y-6 py-4">
            <div className="flex justify-center gap-4">
              <Button 
                onClick={() => setHasTasks(true)} 
                variant={hasTasks === true ? "default" : "outline"}
                className={hasTasks === true ? "bg-blue-600 hover:bg-blue-700" : ""}
              >
                Yes, I have tasks to do
              </Button>
              <Button 
                onClick={() => setHasTasks(false)} 
                variant={hasTasks === false ? "default" : "outline"}
                className={hasTasks === false ? "bg-blue-600 hover:bg-blue-700" : ""}
              >
                No tasks today
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Form with all items */}
        {step === 4 && (
          <div className="space-y-8 py-4">
            {/* Meetings Section */}
            {hasMeetings && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Meetings</h3>
                  <Button onClick={addMeeting} variant="outline" size="sm" className="gap-1">
                    <Plus className="h-4 w-4" /> Add Meeting
                  </Button>
                </div>
                
                {meetings.map((meeting, index) => (
                  <div key={`meeting-${index}`} className="space-y-4 p-4 border rounded-lg relative bg-card shadow-sm">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="absolute right-2 top-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => removeMeeting(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor={`meeting-title-${index}`}>Title*</Label>
                        <Input 
                          id={`meeting-title-${index}`}
                          value={meeting.title}
                          onChange={(e) => updateMeeting(index, 'title', e.target.value)}
                          placeholder="Meeting Title"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`meeting-location-${index}`}>Meeting Link/Location</Label>
                        <Input 
                          id={`meeting-location-${index}`}
                          value={meeting.location || ''}
                          onChange={(e) => updateMeeting(index, 'location', e.target.value)}
                          placeholder="Zoom/Teams link or physical location"
                          className="mt-1"
                        />
                      </div>
                    </div>
                    
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor={`meeting-start-${index}`}>Start Time*</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button 
                              variant="outline" 
                              className="w-full justify-start mt-1 font-normal"
                              id={`meeting-start-${index}`}
                            >
                              <CalendarDays className="mr-2 h-4 w-4 text-indigo-500" />
                              {formatDate(new Date(meeting.start_time), "PPP p")}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 flex" align="start">
                            <div>
                              <CalendarComponent
                                mode="single"
                                selected={new Date(meeting.start_time)}
                                onSelect={(date) => {
                                  if (date) {
                                    const newDate = new Date(meeting.start_time);
                                    newDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                                    updateMeeting(index, 'start_time', format(newDate, "yyyy-MM-dd'T'HH:mm"));
                                  }
                                }}
                                initialFocus
                              />
                            </div>
                            <div className="border-l">
                              <TimeSelect
                                value={new Date(meeting.start_time)}
                                onChange={(date) => {
                                  const formattedDate = format(date, "yyyy-MM-dd'T'HH:mm");
                                  updateMeeting(index, 'start_time', formattedDate);
                                }}
                                compact={true}
                              />
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div>
                        <Label htmlFor={`meeting-end-${index}`}>End Time*</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button 
                              variant="outline" 
                              className="w-full justify-start mt-1 font-normal"
                              id={`meeting-end-${index}`}
                            >
                              <CalendarDays className="mr-2 h-4 w-4 text-indigo-500" />
                              {formatDate(new Date(meeting.end_time), "PPP p")}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 flex" align="start">
                            <div>
                              <CalendarComponent
                                mode="single"
                                selected={new Date(meeting.end_time)}
                                onSelect={(date) => {
                                  if (date) {
                                    const newDate = new Date(meeting.end_time);
                                    newDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                                    updateMeeting(index, 'end_time', format(newDate, "yyyy-MM-dd'T'HH:mm"));
                                  }
                                }}
                                initialFocus
                              />
                            </div>
                            <div className="border-l">
                              <TimeSelect
                                value={new Date(meeting.end_time)}
                                onChange={(date) => {
                                  const formattedDate = format(date, "yyyy-MM-dd'T'HH:mm");
                                  updateMeeting(index, 'end_time', formattedDate);
                                }}
                                compact={true}
                              />
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor={`meeting-attendees-${index}`}>Attendees</Label>
                      <Input 
                        id={`meeting-attendees-${index}`}
                        value={meeting.attendees || ''}
                        onChange={(e) => updateMeeting(index, 'attendees', e.target.value)}
                        placeholder="Names or emails of attendees, comma separated"
                        className="mt-1"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor={`meeting-description-${index}`}>Description</Label>
                      <Textarea 
                        id={`meeting-description-${index}`}
                        value={meeting.description || ''}
                        onChange={(e) => updateMeeting(index, 'description', e.target.value)}
                        placeholder="Meeting agenda or details"
                        rows={3}
                        className="mt-1"
                      />
                    </div>
                  </div>
                ))}
                
                {meetings.length === 0 && (
                  <div className="text-center p-6 border rounded-lg border-dashed bg-muted/20">
                    <Video className="h-10 w-10 text-muted-foreground/50 mb-3 mx-auto" />
                    <p className="text-muted-foreground font-medium">No meetings added yet</p>
                    <p className="text-xs text-muted-foreground/70 mt-1 mb-3">Schedule meetings to organize your calls</p>
                    <Button onClick={addMeeting} variant="outline" size="sm" className="mt-2 gap-1">
                      <Plus className="h-4 w-4" /> Add Meeting
                    </Button>
                  </div>
                )}
              </div>
            )}
            
            {/* Appointments Section */}
            {hasAppointments && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Appointments</h3>
                  <Button onClick={addAppointment} variant="outline" size="sm" className="gap-1">
                    <Plus className="h-4 w-4" /> Add Appointment
                  </Button>
                </div>
                
                {appointments.map((appointment, index) => (
                  <div key={`appointment-${index}`} className="space-y-4 p-4 border rounded-lg relative bg-card shadow-sm">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="absolute right-2 top-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => removeAppointment(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor={`appointment-title-${index}`}>Title*</Label>
                        <Input 
                          id={`appointment-title-${index}`}
                          value={appointment.title}
                          onChange={(e) => updateAppointment(index, 'title', e.target.value)}
                          placeholder="Appointment Title"
                          className="mt-1"
                        />
                      </div>
                      <div className="flex items-center space-x-2 h-full pt-8">
                        <input
                          type="checkbox"
                          id={`appointment-allday-${index}`}
                          checked={appointment.all_day}
                          onChange={(e) => updateAppointment(index, 'all_day', e.target.checked)}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <Label htmlFor={`appointment-allday-${index}`}>All Day</Label>
                      </div>
                    </div>
                    
                    {!appointment.all_day && (
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <Label htmlFor={`appointment-start-${index}`}>Start Time*</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button 
                                variant="outline" 
                                className="w-full justify-start mt-1 font-normal"
                                id={`appointment-start-${index}`}
                              >
                                <CalendarDays className="mr-2 h-4 w-4 text-purple-500" />
                                {formatDate(new Date(appointment.start_time), "PPP p")}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 flex" align="start">
                              <div>
                                <CalendarComponent
                                  mode="single"
                                  selected={new Date(appointment.start_time)}
                                  onSelect={(date) => {
                                    if (date) {
                                      const newDate = new Date(appointment.start_time);
                                      newDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                                      updateAppointment(index, 'start_time', format(newDate, "yyyy-MM-dd'T'HH:mm"));
                                    }
                                  }}
                                  initialFocus
                                />
                              </div>
                              <div className="border-l">
                                <TimeSelect
                                  value={new Date(appointment.start_time)}
                                  onChange={(date) => {
                                    const formattedDate = format(date, "yyyy-MM-dd'T'HH:mm");
                                    updateAppointment(index, 'start_time', formattedDate);
                                  }}
                                  compact={true}
                                />
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div>
                          <Label htmlFor={`appointment-end-${index}`}>End Time*</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button 
                                variant="outline" 
                                className="w-full justify-start mt-1 font-normal"
                                id={`appointment-end-${index}`}
                              >
                                <CalendarDays className="mr-2 h-4 w-4 text-purple-500" />
                                {formatDate(new Date(appointment.end_time), "PPP p")}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 flex" align="start">
                              <div>
                                <CalendarComponent
                                  mode="single"
                                  selected={new Date(appointment.end_time)}
                                  onSelect={(date) => {
                                    if (date) {
                                      const newDate = new Date(appointment.end_time);
                                      newDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                                      updateAppointment(index, 'end_time', format(newDate, "yyyy-MM-dd'T'HH:mm"));
                                    }
                                  }}
                                  initialFocus
                                />
                              </div>
                              <div className="border-l">
                                <TimeSelect
                                  value={new Date(appointment.end_time)}
                                  onChange={(date) => {
                                    const formattedDate = format(date, "yyyy-MM-dd'T'HH:mm");
                                    updateAppointment(index, 'end_time', formattedDate);
                                  }}
                                  compact={true}
                                />
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    )}
                    
                    <div>
                      <Label htmlFor={`appointment-description-${index}`}>Description</Label>
                      <Textarea 
                        id={`appointment-description-${index}`}
                        value={appointment.description || ''}
                        onChange={(e) => updateAppointment(index, 'description', e.target.value)}
                        placeholder="Appointment details"
                        rows={3}
                        className="mt-1"
                      />
                    </div>
                  </div>
                ))}
                
                {appointments.length === 0 && (
                  <div className="text-center p-6 border rounded-lg border-dashed bg-muted/20">
                    <Clock className="h-10 w-10 text-muted-foreground/50 mb-3 mx-auto" />
                    <p className="text-muted-foreground font-medium">No appointments added yet</p>
                    <p className="text-xs text-muted-foreground/70 mt-1 mb-3">Schedule appointments to organize your day</p>
                    <Button onClick={addAppointment} variant="outline" size="sm" className="mt-2 gap-1">
                      <Plus className="h-4 w-4" /> Add Appointment
                    </Button>
                  </div>
                )}
              </div>
            )}
            
            {/* Tasks Section */}
            {hasTasks && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Tasks</h3>
                  <Button onClick={addTask} variant="outline" size="sm" className="gap-1">
                    <Plus className="h-4 w-4" /> Add Task
                  </Button>
                </div>
                
                {tasks.map((task, taskIndex) => (
                  <div key={`task-${taskIndex}`} className="space-y-4 p-4 border rounded-lg relative bg-card shadow-sm">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="absolute right-2 top-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => removeTask(taskIndex)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor={`task-title-${taskIndex}`}>Task Title*</Label>
                        <Input 
                          id={`task-title-${taskIndex}`}
                          value={task.title}
                          onChange={(e) => updateTask(taskIndex, 'title', e.target.value)}
                          placeholder="What do you need to do?"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`task-priority-${taskIndex}`}>Priority</Label>
                        <Select 
                          value={task.priority} 
                          onValueChange={(value) => updateTask(taskIndex, 'priority', value)}
                        >
                          <SelectTrigger id={`task-priority-${taskIndex}`} className="mt-1">
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">
                              <div className="flex items-center">
                                <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                                Low
                              </div>
                            </SelectItem>
                            <SelectItem value="medium">
                              <div className="flex items-center">
                                <div className="w-2 h-2 rounded-full bg-yellow-500 mr-2"></div>
                                Medium
                              </div>
                            </SelectItem>
                            <SelectItem value="high">
                              <div className="flex items-center">
                                <div className="w-2 h-2 rounded-full bg-red-500 mr-2"></div>
                                High
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor={`task-description-${taskIndex}`}>Description</Label>
                      <Textarea 
                        id={`task-description-${taskIndex}`}
                        value={task.description || ''}
                        onChange={(e) => updateTask(taskIndex, 'description', e.target.value)}
                        placeholder="Additional details about the task"
                        rows={2}
                        className="mt-1"
                      />
                    </div>
                    
                    {/* Subtasks */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Subtasks</Label>
                        <div className="flex space-x-2">
                          <Button 
                            onClick={() => generateSubtasksForTask(taskIndex)} 
                            variant="outline" 
                            size="sm" 
                            disabled={generatingForTaskIndex === taskIndex}
                            className="h-7 px-2 text-xs gap-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                          >
                            {generatingForTaskIndex === taskIndex ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin" /> Generating...
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-3 w-3" /> AI Generate
                              </>
                            )}
                          </Button>
                          <Button 
                            onClick={() => addSubtask(taskIndex)} 
                            variant="outline" 
                            size="sm" 
                            className="h-7 px-2 text-xs gap-1"
                          >
                            <Plus className="h-3 w-3" /> Add Step
                          </Button>
                        </div>
                      </div>
                      
                      {task.subtasks.length > 0 ? (
                        <div className="space-y-2 mt-2">
                          {task.subtasks.map((subtask, subtaskIndex) => (
                            <div key={`subtask-${taskIndex}-${subtaskIndex}`} className="flex items-center gap-2 bg-muted/50 p-2 rounded-md">
                              <Input 
                                value={subtask}
                                onChange={(e) => updateSubtask(taskIndex, subtaskIndex, e.target.value)}
                                placeholder="Step to complete"
                                className="flex-1 bg-transparent border-0 focus-visible:ring-1"
                              />
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => removeSubtask(taskIndex, subtaskIndex)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic px-2 py-1">No steps added yet</p>
                      )}
                    </div>
                  </div>
                ))}
                
                {tasks.length === 0 && (
                  <div className="text-center p-6 border rounded-lg border-dashed bg-muted/20">
                    <CheckSquare className="h-10 w-10 text-muted-foreground/50 mb-3 mx-auto" />
                    <p className="text-muted-foreground font-medium">No tasks added yet</p>
                    <p className="text-xs text-muted-foreground/70 mt-1 mb-3">Add tasks to organize your day</p>
                    <Button onClick={addTask} variant="outline" size="sm" className="mt-2 gap-1">
                      <Plus className="h-4 w-4" /> Add Task
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex justify-between">
          {step > 1 ? (
            <Button variant="outline" onClick={handleBackStep} disabled={isGenerating}>
              Back
            </Button>
          ) : (
            <div></div>
          )}
          
          <Button 
            onClick={handleNextStep} 
            disabled={!canProceedToNextStep() || isGenerating}
            className={step === 4 ? "bg-green-600 hover:bg-green-700" : ""}
          >
            {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {step < 4 ? "Next" : "Save Day Plan"}
          </Button>
        </DialogFooter>

        {/* Usage Limit Dialog */}
        <UsageLimitDialog 
          open={showLimitDialog} 
          onOpenChange={setShowLimitDialog}
          message={limitErrorMessage}
        />
      </DialogContent>
    </Dialog>
  );
};