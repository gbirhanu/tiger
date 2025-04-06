import React, { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import useUsageLimitDialog from "@/hooks/use-usage-limit-dialog";
import { UsageLimitDialog } from "./UsageLimitDialog";
import { generateSubtasks } from "@/lib/api";

// Form validation schema
const formSchema = z.object({
  taskId: z.string().min(1, { message: "Please select a task" }),
  prompt: z.string().min(10, { message: "Prompt should be at least 10 characters" }).max(1000),
});

export function TaskGeneratorForm() {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  const { showLimitDialog, setShowLimitDialog, limitErrorMessage, handleApiError } = useUsageLimitDialog();
  
  // Form setup
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      taskId: "",
      prompt: "Generate 5 actionable subtasks that can help me complete this task. Each subtask should be specific, measurable, and achievable.",
    },
  });
  
  async function handleFormSubmit(values: z.infer<typeof formSchema>) {
    try {
      setIsGenerating(true);
      
      const prompt = `
        Generate 5 clear and simple subtasks for task ID: ${values.taskId}
        
        Instructions: ${values.prompt}
        
        Return the subtasks as a simple list, one per line. Do not include any JSON formatting, quotes, brackets, or numbers.
      `;
      
      await generateSubtasks(prompt);
      
      toast({
        title: "Success",
        description: "Tasks generated successfully",
      });
    } catch (error) {
      // Handle usage limit errors with the hook
      const wasHandled = handleApiError(error);
      
      // Only show general error if not a usage limit error
      if (!wasHandled) {
        toast({
          title: "Error",
          description: "Failed to generate tasks. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsGenerating(false);
    }
  }
  
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Generate Subtasks with AI
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="taskId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select Task</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                      disabled={isGenerating}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a task" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {/* This would be populated with actual tasks from your database */}
                        <SelectItem value="task1">Task 1</SelectItem>
                        <SelectItem value="task2">Task 2</SelectItem>
                        <SelectItem value="task3">Task 3</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="prompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>AI Instructions</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Instructions for the AI..."
                        className="min-h-32"
                        disabled={isGenerating}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Button 
                type="submit" 
                className="w-full gap-2" 
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating Tasks...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate Subtasks
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      {/* Add the UsageLimitDialog */}
      <UsageLimitDialog
        open={showLimitDialog}
        onOpenChange={setShowLimitDialog}
        message={limitErrorMessage}
      />
    </>
  );
} 