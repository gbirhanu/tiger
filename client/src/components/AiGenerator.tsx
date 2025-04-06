import React, { useState } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Sparkles, SendHorizonal, Loader2 } from 'lucide-react';
import { generateContent } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import useUsageLimitDialog from '@/hooks/use-usage-limit-dialog';
import { UsageLimitDialog } from './UsageLimitDialog';

interface AiGeneratorProps {
  onGeneratedContent?: (content: string) => void;
  placeholder?: string;
  title?: string;
  initialPrompt?: string;
  buttonText?: string;
  className?: string;
}

const AiGenerator: React.FC<AiGeneratorProps> = ({
  onGeneratedContent,
  placeholder = "Enter your prompt here...",
  title = "AI Content Generator",
  initialPrompt = "",
  buttonText = "Generate",
  className = ""
}) => {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  
  // Use the custom hook for usage limit handling
  const { 
    showLimitDialog, 
    setShowLimitDialog,
    limitErrorMessage,
    handleApiError
  } = useUsageLimitDialog();
  
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Please enter a prompt",
        description: "You need to provide some instructions for the AI.",
        variant: "destructive"
      });
      return;
    }
    
    setIsGenerating(true);
    
    try {
      const generatedText = await generateContent(prompt);
      
      if (onGeneratedContent) {
        onGeneratedContent(generatedText);
      }
      
      toast({
        title: "Content generated",
        description: "AI has successfully generated the content."
      });
      
    } catch (error) {
      // Use the custom hook to handle usage limit errors
      const wasHandled = handleApiError(error);
      
      // If not a usage limit error, show a generic error message
      if (!wasHandled) {
        toast({
          title: "Failed to generate content",
          description: error instanceof Error ? error.message : "An unexpected error occurred",
          variant: "destructive"
        });
      }
    } finally {
      setIsGenerating(false);
    }
  };
  
  return (
    <>
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder={placeholder}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-32 mb-2"
            disabled={isGenerating}
          />
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button 
            onClick={handleGenerate} 
            disabled={isGenerating || !prompt.trim()}
            className="gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <SendHorizonal className="h-4 w-4" />
                {buttonText}
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
      
      {/* Include the usage limit dialog */}
      <UsageLimitDialog
        open={showLimitDialog}
        onOpenChange={setShowLimitDialog}
        message={limitErrorMessage}
      />
    </>
  );
};

export default AiGenerator; 