import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles } from "lucide-react";

interface GenerateContentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  defaultPrompt: string;
  onGenerate: (prompt: string) => void;
  isGenerating: boolean;
}

export function GenerateContentDialog({
  open,
  onOpenChange,
  title,
  defaultPrompt,
  onGenerate,
  isGenerating
}: GenerateContentDialogProps) {
  const [prompt, setPrompt] = useState(defaultPrompt);

  // Reset prompt when dialog opens
  React.useEffect(() => {
    if (open) {
      setPrompt(defaultPrompt);
    }
  }, [open, defaultPrompt]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Generate Content</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Describe what kind of content you would like to generate for <span className="font-medium text-primary">{title}</span>.
          </p>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the content you want to generate..."
            className="min-h-[120px] resize-none"
          />
          <div className="text-xs text-muted-foreground">
            <p>Tips:</p>
            <ul className="list-disc pl-4 space-y-1 mt-1">
              <li>Request specific formatting like headings, lists, and tables</li>
              <li>Specify the tone (formal, casual, technical)</li>
              <li>Mention key points you want included</li>
            </ul>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={() => {
              onGenerate(prompt);
              onOpenChange(false);
            }}
            disabled={isGenerating || !prompt.trim()}
            className="gap-2 bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800"
          >
            {isGenerating ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Generate</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 