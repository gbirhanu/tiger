import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type LongNote } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  getLongNotes, 
  createLongNote as createLongNoteApi, 
  updateLongNote as updateLongNoteApi, 
  deleteLongNote as deleteLongNoteApi,
  enhanceLongNote as enhanceLongNoteApi,
  generateContent as generateContentApi
} from "@/lib/api";
import { queryClient, QUERY_KEYS } from "@/lib/queryClient";
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Star, 
  Clock, 
  Tag, 
  SortAsc, 
  SortDesc, 
  Filter, 
  BookOpen, 
  X,
  StarOff,
  Sparkles,
  Eye,
  Code,
  FileText
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import MDEditor from "@uiw/react-md-editor";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";
import { useTheme } from "@/contexts/ThemeContext";
import MarkdownEditor from 'react-markdown-editor-lite';
import 'react-markdown-editor-lite/lib/index.css';
import htmlParser from 'html-react-parser';
import { MarkdownPreview } from "@/components/ui/markdown-preview";

// Define a custom renderer for markdown
const renderMarkdown = (text: string) => {
  return <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]}>{text}</ReactMarkdown>;
};

// Sort options
type SortOption = "newest" | "oldest" | "title" | "updated";
type FilterOption = "all" | "favorites" | "tag";
type ViewMode = "edit" | "preview" | "split";

// Custom dialog for content generation
interface GenerateContentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  defaultPrompt: string;
  onGenerate: (prompt: string) => void;
  isGenerating: boolean;
}

function GenerateContentDialog({
  open,
  onOpenChange,
  title,
  defaultPrompt,
  onGenerate,
  isGenerating
}: GenerateContentDialogProps) {
  const { toast } = useToast();
  const { theme, resolvedTheme } = useTheme();
  const [prompt, setPrompt] = useState(defaultPrompt);

  // Reset prompt when dialog opens with a new default prompt
  useEffect(() => {
    if (open) {
      setPrompt(defaultPrompt);
    }
  }, [open, defaultPrompt]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-xl border-indigo-200 dark:border-indigo-800 shadow-lg" hideCloseButton>
        <DialogHeader>
          <div className="flex items-center justify-between w-full">
            <DialogTitle className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-700 dark:from-indigo-400 dark:to-purple-400">
              Generate Content
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-900/50"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Describe what kind of content you would like to generate for <span className="font-medium text-indigo-600 dark:text-indigo-400">{title}</span>.
          </p>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the content you want to generate..."
            className="min-h-[150px] resize-none focus:ring-2 focus:ring-indigo-300 border-indigo-100 dark:border-indigo-800 rounded-xl shadow-inner bg-white dark:bg-gray-900 transition-all duration-200"
          />
          <div className="text-xs text-muted-foreground bg-indigo-50 dark:bg-indigo-950/30 p-3 rounded-lg border border-indigo-100 dark:border-indigo-900">
            <p className="font-medium text-indigo-700 dark:text-indigo-400">Tips:</p>
            <ul className="list-disc pl-4 space-y-1 mt-1">
              <li>Be specific about the tone, style, and structure you want</li>
              <li>Mention any key points that should be included</li>
              <li>Specify if you need headings, lists, or other formatting</li>
            </ul>
          </div>
        </div>
        <DialogFooter className="border-t border-indigo-100 dark:border-indigo-800 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 rounded-lg">
            Cancel
          </Button>
          <Button 
            onClick={() => {
              onGenerate(prompt);
              onOpenChange(false);
            }}
            disabled={isGenerating || !prompt.trim()}
            className="gap-2 bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white rounded-lg"
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

export default function LongNotesBoard() {
  const { toast } = useToast();
  const { theme, resolvedTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [filterBy, setFilterBy] = useState<FilterOption>("all");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<LongNote | null>(null);
  
  // Generate dialog state
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [generateDialogTitle, setGenerateDialogTitle] = useState("");
  const [generateDialogDefaultPrompt, setGenerateDialogDefaultPrompt] = useState("");
  const [generateDialogCallback, setGenerateDialogCallback] = useState<(prompt: string) => void>(() => () => {});
  
  // Form state for creating/editing notes
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteTags, setNoteTags] = useState("");
  const [isFavorite, setIsFavorite] = useState(false);
  
  // Markdown editor state
  const [viewMode, setViewMode] = useState<ViewMode>("edit");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationPrompt, setGenerationPrompt] = useState("");
  const [readMode, setReadMode] = useState(false);

  // Fetch long notes
  const { data: longNotes = [], isLoading, error } = useQuery<LongNote[], Error>({
    queryKey: [QUERY_KEYS.LONG_NOTES],
    queryFn: getLongNotes,
    retry: 3,
    retryDelay: 1000
  });

  // Log data for debugging
  React.useEffect(() => {
    if (error) {
      console.error("Long notes query error:", error);
      toast({
        title: "Error loading notes",
        description: error.message || "Failed to load notes. Please try again.",
      });
    }
  }, [error, toast]);

  // Extract all unique tags from notes
  const allTags = React.useMemo(() => {
    const tagSet = new Set<string>();
    
    // Ensure longNotes is an array before calling forEach
    if (Array.isArray(longNotes)) {
      longNotes.forEach((note: LongNote) => {
        if (note.tags) {
          note.tags.split(',').forEach(tag => {
            const trimmedTag = tag.trim();
            if (trimmedTag) tagSet.add(trimmedTag);
          });
        }
      });
    }
    
    return Array.from(tagSet).sort();
  }, [longNotes]);

  // Filter and sort notes
  const filteredAndSortedNotes = React.useMemo(() => {
    if (!longNotes || !Array.isArray(longNotes)) return [];
    
    // First apply search filter
    let filtered = [...longNotes];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((note: LongNote) => 
        note.title.toLowerCase().includes(query) || 
        (note.content && note.content.toLowerCase().includes(query)) ||
        (note.tags && note.tags.toLowerCase().includes(query))
      );
    }
    
    // Then apply category filter
    if (filterBy === "favorites") {
      filtered = filtered.filter((note: LongNote) => note.is_favorite);
    } else if (filterBy === "tag" && selectedTag) {
      filtered = filtered.filter((note: LongNote) => 
        note.tags && note.tags.split(',').map(t => t.trim()).includes(selectedTag)
      );
    }
    
    // Finally sort
    return filtered.sort((a: LongNote, b: LongNote) => {
      switch (sortBy) {
        case "newest":
          return b.created_at - a.created_at;
        case "oldest":
          return a.created_at - b.created_at;
        case "title":
          return a.title.localeCompare(b.title);
        case "updated":
          return b.updated_at - a.updated_at;
        default:
          return 0;
      }
    });
  }, [longNotes, searchQuery, sortBy, filterBy, selectedTag]);

  // Create mutation
  const createLongNoteMutation = useMutation({
    mutationFn: (noteData: { 
      title: string; 
      content: string | null; 
      tags: string | null;
      is_favorite: boolean;
    }) => {
      return createLongNoteApi(noteData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LONG_NOTES] });
      toast({
        title: "Note created",
        description: "Your note has been created successfully.",
      });
      resetForm();
      setCreateDialogOpen(false);
    },
    onError: (error) => {
      console.error("Error creating note:", error);
      toast({
        title: "Error",
        description: "Failed to create note. Please try again.",
      });
    }
  });

  // Update mutation
  const updateLongNoteMutation = useMutation({
    mutationFn: ({ id, data }: { 
      id: number; 
      data: Partial<LongNote>;
    }) => {
      return updateLongNoteApi(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LONG_NOTES] });
      toast({
        title: "Note updated",
        description: "Your note has been updated successfully.",
      });
      
      // Only reset form and close dialog if we're in the edit dialog
      if (editDialogOpen) {
        resetForm();
        setEditDialogOpen(false);
      }
    },
    onError: (error) => {
      console.error("Error updating note:", error);
      toast({
        title: "Error",
        description: "Failed to update note. Please try again.",
      });
    }
  });

  // Delete mutation
  const deleteLongNoteMutation = useMutation({
    mutationFn: (id: number) => {
      return deleteLongNoteApi(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LONG_NOTES] });
      toast({
        title: "Note deleted",
        description: "Your note has been deleted successfully.",
      });
    },
    onError: (error) => {
      console.error("Error deleting note:", error);
      toast({
        title: "Error",
        description: "Failed to delete note. Please try again.",
      });
    }
  });

  // Toggle favorite status
  const toggleFavoriteMutation = useMutation({
    mutationFn: ({ id, isFavorite }: { id: number; isFavorite: boolean }) => {
      return updateLongNoteApi(id, { is_favorite: isFavorite });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LONG_NOTES] });
    },
    onError: (error) => {
      console.error("Error toggling favorite status:", error);
      toast({
        title: "Error",
        description: "Failed to update favorite status. Please try again.",
      });
    }
  });

  // Generate content with Gemini
  const generateContentMutation = useMutation({
    mutationFn: async ({ noteId, prompt }: { noteId?: number; prompt: string }) => {
      // Add instruction to return markdown format
      const enhancedPrompt = `${prompt}\n\nIMPORTANT: Please format your response as proper Markdown with clear headings (using # for main heading, ## for subheadings), bullet points, numbered lists, and other formatting as appropriate. Use **bold** for emphasis, create proper tables with | if needed, and format code with backticks. Make sure all markdown syntax is correctly applied.`;
      
      if (noteId) {
        // If we have a note ID, use the enhance endpoint
        return enhanceLongNoteApi(noteId, enhancedPrompt);
      } else {
        // For new notes, use the generate-content endpoint
        return generateContentApi(enhancedPrompt);
      }
    },
    onSuccess: (data) => {
      if (data.content) {
        // Ensure content is properly formatted as markdown
        let formattedContent = data.content;
        
        // Remove ```markdown from the beginning if present
        formattedContent = formattedContent.replace(/^```markdown\s*/i, '');
        // Remove trailing ``` if present
        formattedContent = formattedContent.replace(/\s*```\s*$/, '');
        
        // If content doesn't start with a heading, add one
        if (!formattedContent.startsWith('#')) {
          formattedContent = `# ${noteTitle || 'Generated Content'}\n\n${formattedContent}`;
        }
        
        setNoteContent(formattedContent);
        toast({
          title: "Content generated",
          description: "Content has been generated successfully.",
        });
      }
      setIsGenerating(false);
    },
    onError: (error) => {
      console.error("Error generating content:", error);
      toast({
        title: "Error",
        description: "Failed to generate content. Please try again.",
      });
      setIsGenerating(false);
    }
  });

  // Reset form fields
  const resetForm = () => {
    setNoteTitle("");
    setNoteContent("");
    setNoteTags("");
    setIsFavorite(false);
    setSelectedNote(null);
  };

  // Handle create note
  const handleCreateNote = () => {
    if (!noteTitle.trim()) {
      toast({
        title: "Error",
        description: "Title is required.",
      });
      return;
    }

    createLongNoteMutation.mutate({
      title: noteTitle.trim(),
      content: noteContent.trim() || null,
      tags: noteTags.trim() || null,
      is_favorite: isFavorite
    });
  };

  // Handle update note
  const handleUpdateNote = () => {
    if (!selectedNote) return;
    
    if (!noteTitle.trim()) {
      toast({
        title: "Error",
        description: "Title is required.",
      });
      return;
    }

    const updatedData = {
      title: noteTitle.trim(),
      content: noteContent.trim() || null,
      tags: noteTags.trim() || null,
      is_favorite: isFavorite
    };

    updateLongNoteMutation.mutate({
      id: selectedNote.id,
      data: updatedData
    }, {
      onSuccess: () => {
        // If we're in the view dialog, update the selected note with the new data
        if (viewDialogOpen && !editDialogOpen) {
          setSelectedNote({
            ...selectedNote,
            ...updatedData,
            updated_at: Date.now() / 1000 // Approximate timestamp update
          });
        }
      }
    });
  };

  // Open edit dialog with note data
  const openEditDialog = (note: LongNote) => {
    setSelectedNote(note);
    setNoteTitle(note.title);
    setNoteContent(note.content || "");
    setNoteTags(note.tags || "");
    setIsFavorite(note.is_favorite);
    setEditDialogOpen(true);
  };

  // Handle content generation
  const handleGenerateContent = () => {
    if (!noteTitle.trim()) {
      toast({
        title: "Error",
        description: "Please enter a title first.",
      });
      return;
    }

    const defaultPrompt = `Write a detailed note about "${noteTitle}" in markdown format. Please include:
- A main heading (# Title)
- Subheadings (## Subheading) for different sections
- Bullet points for key information
- **Bold text** for emphasis
- Code blocks with backticks where relevant
- Tables if appropriate

Structure the content in a clear, organized way with proper markdown syntax.`;
    
    // Set up the generate dialog
    setGenerateDialogTitle(noteTitle);
    setGenerateDialogDefaultPrompt(defaultPrompt);
    setGenerateDialogCallback(() => (prompt: string) => {
      setIsGenerating(true);
      setGenerationPrompt(prompt);
      
      generateContentMutation.mutate({ 
        noteId: selectedNote?.id,
        prompt
      });
    });
    
    // Open the dialog
    setGenerateDialogOpen(true);
  };

  // Toggle read mode
  const toggleReadMode = () => {
    setReadMode(!readMode);
    // Make sure we have the latest note data when switching to edit mode
    if (readMode && selectedNote) {
      setNoteTitle(selectedNote.title);
      setNoteContent(selectedNote.content || "");
      setNoteTags(selectedNote.tags || "");
      setIsFavorite(selectedNote.is_favorite);
    }
  };

  // Open view dialog with note data
  const openViewDialog = (note: LongNote) => {
    setSelectedNote(note);
    setNoteTitle(note.title);
    setNoteContent(note.content || "");
    setNoteTags(note.tags || "");
    setIsFavorite(note.is_favorite);
    setReadMode(true);
    setViewDialogOpen(true);
  };

  // Format tags for display
  const formatTags = (tags: string | null) => {
    if (!tags) return [];
    return tags.split(',').map(tag => tag.trim()).filter(tag => tag);
  };

  // Format date for display
  const formatDate = (timestamp: number | string) => {
    try {
      if (!timestamp) return "Unknown date";
      
      let date;
      // Handle string date format (e.g. "2025-03-17 08:54:26")
      if (typeof timestamp === 'string') {
        date = new Date(timestamp);
      } 
      // Handle numeric timestamp (e.g. 1742202103)
      else {
        date = new Date(timestamp * 1000);
      }
      
      // Check if date is valid
      if (isNaN(date.getTime())) return "Invalid date";
      return format(date, 'MMM d, yyyy h:mm a');
    } catch (error) {
      console.error("Error formatting date:", error, "Timestamp:", timestamp);
      return "Invalid date";
    }
  };

  // Handle tag click for filtering
  const handleTagClick = (tag: string) => {
    setSelectedTag(tag);
    setFilterBy("tag");
  };

  // Function to handle content generation for the current note
  const handleGenerateContentForCurrentNote = () => {
    if (!selectedNote) return;
    
    const defaultPrompt = `Enhance the content about "${selectedNote.title}" using proper markdown formatting. Please ensure:
- Clear heading hierarchy (# for main heading, ## for subheadings)
- Well-structured bullet points and numbered lists
- **Bold text** for emphasis on important points
- Proper code formatting with backticks
- Tables with | if data needs to be presented
- Consistent spacing between sections

Maintain the existing content but improve its structure and formatting.`;
    
    // Set up the generate dialog
    setGenerateDialogTitle(selectedNote.title);
    setGenerateDialogDefaultPrompt(defaultPrompt);
    setGenerateDialogCallback(() => (prompt: string) => {
      setIsGenerating(true);
      
      generateContentMutation.mutate({ 
        prompt, 
        noteId: selectedNote.id 
      });
    });
    
    // Open the dialog
    setGenerateDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-t-2 border-indigo-500 animate-spin"></div>
            <div className="absolute inset-1 rounded-full border-r-2 border-purple-500 animate-spin animation-delay-150"></div>
            <div className="absolute inset-2 rounded-full border-b-2 border-indigo-300 animate-spin animation-delay-300"></div>
            <div className="absolute inset-3 rounded-full border-l-2 border-purple-300 animate-spin animation-delay-500"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-indigo-600" />
            </div>
          </div>
          <p className="text-sm text-indigo-700 dark:text-indigo-400 font-medium animate-pulse">Loading your notes...</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Please wait while we prepare your workspace</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="mb-6 flex flex-col items-center">
          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-full mb-4 border border-red-200 dark:border-red-800">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">Error Loading Notes</h3>
          <p className="text-gray-600 dark:text-gray-400 max-w-md mb-6">{error.message || "We encountered a problem while loading your notes. Please try again later."}</p>
        </div>
        <Button 
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LONG_NOTES] });
            toast({
              title: "Retrying",
              description: "Attempting to load notes again...",
            });
          }}
          className="bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white shadow-md hover:shadow-lg transition-all duration-300 rounded-xl px-6 py-2"
        >
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with title and actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-indigo-100 to-purple-100 dark:from-indigo-950/50 dark:to-purple-950/50 p-8 rounded-2xl border border-indigo-200 dark:border-indigo-800 shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-md">
            <BookOpen className="h-8 w-8 text-yellow-500 font-bold bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-700 dark:from-indigo-400 dark:to-purple-400">
              Long Notes
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Capture detailed thoughts, ideas, and research</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {setSelectedNote(null); setNoteTitle(""); setNoteContent(""); setNoteTags(""); setIsFavorite(false);}} className="bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white shadow-md hover:shadow-lg transition-all duration-300 rounded-xl">
                <Plus className="h-4 w-4 mr-2" />
                New Note
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[98vh] overflow-hidden rounded-xl border-indigo-200 dark:border-indigo-800 shadow-lg" hideCloseButton>
              <DialogHeader>
                <div className="flex items-center justify-between w-full">
                  <DialogTitle className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-700 dark:from-indigo-400 dark:to-purple-400">Create New Note</DialogTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCreateDialogOpen(false)}
                    className="rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-900/50"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </DialogHeader>
              <div className="space-y-4 py-2 overflow-y-auto">
                <div className="flex items-center justify-between">
                  <Input
                    placeholder="Note title"
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    className="text-lg font-medium border-indigo-100 dark:border-indigo-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 rounded-lg"
                  />
                  <div className="flex items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsFavorite(!isFavorite)}
                      className={cn(
                        "ml-2 rounded-full",
                        isFavorite ? "text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20" : "text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                      )}
                    >
                      {isFavorite ? <Star className="h-5 w-5 fill-yellow-500" /> : <Star className="h-5 w-5" />}
                    </Button>
                    
                    {/* Generate content button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-2 gap-1 border-indigo-200 hover:bg-indigo-50 dark:border-indigo-800 dark:hover:bg-indigo-900/50 rounded-lg"
                      onClick={() => {
                        if (noteTitle.trim()) {
                          handleGenerateContent();
                        } else {
                          toast({
                            title: "Error",
                            description: "Please enter a title first.",
                          });
                        }
                      }}
                      disabled={isGenerating}
                    >
                      {isGenerating ? (
                        <>
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          <span>Generating...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                          <span>Generate</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                
                {/* Markdown editor tabs */}
                <Tabs defaultValue="edit" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 p-1 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg">
                    <TabsTrigger value="edit" onClick={() => {setViewMode("edit"); setSelectedNote(
                      selectedNote
                    );}} className="rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-gray-900 data-[state=active]:text-indigo-700 dark:data-[state=active]:text-indigo-400">
                      <Code className="h-4 w-4 mr-2" />
                      Edit
                    </TabsTrigger>
                    <TabsTrigger value="preview" onClick={() => setViewMode("preview")} className="rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-gray-900 data-[state=active]:text-indigo-700 dark:data-[state=active]:text-indigo-400">
                      <Eye className="h-4 w-4 mr-2" />
                      Preview
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="edit" className="mt-2">
                    <div data-color-mode={resolvedTheme === 'dark' ? 'dark' : 'light'}>
                      <MDEditor
                        value={noteContent}
                        onChange={(value) => value !== undefined && setNoteContent(value)}
                        preview="edit"
                        height={280}
                        previewOptions={{
                          rehypePlugins: [[rehypeRaw, rehypeSanitize]]
                        }}
                        className="border border-indigo-100 dark:border-indigo-800 rounded-lg"
                      />
                    </div>
                  </TabsContent>
                  <TabsContent value="preview" className="mt-2 border rounded-xl p-6 min-h-[300px] max-h-[300px] overflow-auto bg-white dark:bg-gray-900 border-indigo-100 dark:border-indigo-800">
                    <MarkdownPreview 
                      content={noteContent || "No content"} 
                    />
                  </TabsContent>
                </Tabs>
                
                <div className="flex items-center space-x-2">
                  <Tag className="h-4 w-4 text-indigo-500" />
                  <Input
                    placeholder="Tags (comma separated)"
                    value={noteTags}
                    onChange={(e) => setNoteTags(e.target.value)}
                    className="border-indigo-100 dark:border-indigo-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 rounded-lg"
                  />
                </div>
             
              </div>
              <DialogFooter className="border-t border-indigo-100 dark:border-indigo-800 ">
              { viewMode === "edit" && (
                <div className="flex justify-end w-full gap-2 ">
                <Button 
                  onClick={handleCreateNote} 
                  className="bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white rounded-lg py-2"
                >
                <Plus className="h-4 w-4 mr-2" />
                  Create New Note
                </Button>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)} className="border-indigo-200 hover:bg-indigo-50 dark:border-indigo-800 dark:hover:bg-indigo-900/50 rounded-lg">
                  Cancel
                </Button>
                </div>
              )  }  
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search, filter and sort controls */}
      <div className="flex flex-col md:flex-row gap-4 bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="relative flex-grow">
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-indigo-500">
            <Search className="h-5 w-5" />
          </div>
          <Input
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 border-indigo-100 dark:border-indigo-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 rounded-lg shadow-sm"
          />
        </div>
        <div className="flex gap-2">
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
            <SelectTrigger className="w-[180px] border-indigo-100 dark:border-indigo-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 rounded-lg shadow-sm">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent className="rounded-lg border-indigo-100 dark:border-indigo-800">
              <SelectItem value="newest">
                <div className="flex items-center">
                  <SortDesc className="h-4 w-4 mr-2 text-indigo-500" />
                  <span>Newest First</span>
                </div>
              </SelectItem>
              <SelectItem value="oldest">
                <div className="flex items-center">
                  <SortAsc className="h-4 w-4 mr-2 text-indigo-500" />
                  <span>Oldest First</span>
                </div>
              </SelectItem>
              <SelectItem value="title">
                <div className="flex items-center">
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-indigo-500">
                    <path d="M4.93179 5.43179C4.75605 5.60753 4.75605 5.89245 4.93179 6.06819C5.10753 6.24392 5.39245 6.24392 5.56819 6.06819L7.49999 4.13638L9.43179 6.06819C9.60753 6.24392 9.89245 6.24392 10.0682 6.06819C10.2439 5.89245 10.2439 5.60753 10.0682 5.43179L7.81819 3.18179C7.73379 3.0974 7.61933 3.04999 7.49999 3.04999C7.38064 3.04999 7.26618 3.0974 7.18179 3.18179L4.93179 5.43179ZM10.0682 9.56819C10.2439 9.39245 10.2439 9.10753 10.0682 8.93179C9.89245 8.75606 9.60753 8.75606 9.43179 8.93179L7.49999 10.8636L5.56819 8.93179C5.39245 8.75606 5.10753 8.75606 4.93179 8.93179C4.75605 9.10753 4.75605 9.39245 4.93179 9.56819L7.18179 11.8182C7.26618 11.9026 7.38064 11.95 7.49999 11.95C7.61933 11.95 7.73379 11.9026 7.81819 11.8182L10.0682 9.56819Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                  </svg>
                  <span>Title (A-Z)</span>
                </div>
              </SelectItem>
              <SelectItem value="updated">
                <div className="flex items-center">
                  <Clock className="h-4 w-4 mr-2 text-indigo-500" />
                  <span>Recently Updated</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 border-indigo-100 dark:border-indigo-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 rounded-lg shadow-sm">
                <Filter className="h-4 w-4 text-indigo-500" />
                <span>
                  {filterBy === "all" ? "All Notes" : 
                  filterBy === "favorites" ? "Favorites" : 
                  filterBy === "tag" ? `Tag: ${selectedTag}` : "Filter"}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px] rounded-xl border-indigo-100 dark:border-indigo-800 shadow-lg">
              <DropdownMenuItem onClick={() => {
                setFilterBy("all");
                setSelectedTag(null);
              }} className="cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/50">
                <div className="flex items-center w-full">
                  <FileText className="h-4 w-4 mr-2 text-indigo-500" />
                  <span>All Notes</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterBy("favorites")} className="cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/50">
                <div className="flex items-center w-full">
                  <Star className="h-4 w-4 mr-2 text-yellow-500" />
                  <span>Favorites</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-indigo-100 dark:bg-indigo-800" />
              {allTags.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-sm font-semibold text-indigo-700 dark:text-indigo-400">Tags</div>
                  {allTags.map(tag => (
                    <DropdownMenuItem key={tag} onClick={() => handleTagClick(tag)} className="cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/50">
                      <div className="flex items-center w-full">
                        <Tag className="h-4 w-4 mr-2 text-indigo-500" />
                        <span>{tag}</span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Notes grid */}
      {filteredAndSortedNotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-72 border border-dashed rounded-xl border-indigo-200 p-8 bg-gradient-to-b from-white to-indigo-50 dark:from-gray-900 dark:to-indigo-950/30 dark:border-indigo-800 shadow-inner">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-full shadow-md mb-6">
            <BookOpen className="h-16 w-16 text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-700 dark:from-indigo-400 dark:to-purple-400" />
          </div>
          <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-700 dark:from-indigo-400 dark:to-purple-400 mb-2">No notes found</h3>
          <p className="text-gray-600 dark:text-gray-400 text-center mb-6 max-w-md">
            {searchQuery || filterBy !== "all" 
              ? "Try changing your search or filter criteria to find what you're looking for."
              : "Create your first note to start organizing your thoughts and ideas in a beautiful way."}
          </p>
          <Button 
            onClick={() => setCreateDialogOpen(true)}
            className="bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white shadow-md hover:shadow-lg transition-all duration-300 rounded-xl px-6 py-2"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New Note
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedNotes.map((note: LongNote) => (
            <Card key={note.id} className="overflow-hidden hover:shadow-md transition-shadow duration-300 flex flex-col border border-indigo-100 dark:border-indigo-900 bg-gradient-to-br from-white to-indigo-50 dark:from-gray-900 dark:to-indigo-950 rounded-xl">
              <CardHeader className="pb-3 border-b border-indigo-50 dark:border-indigo-900">
                <div className="flex justify-between items-start">
                  <CardTitle 
                    className="text-lg font-semibold cursor-pointer hover:text-indigo-700 transition-colors duration-200 bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-purple-700 dark:from-indigo-400 dark:to-purple-400"
                    onClick={() => openViewDialog(note)}
                  >
                    {note.title}
                  </CardTitle>
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:bg-indigo-100 dark:hover:bg-indigo-900 rounded-full"
                      onClick={() => toggleFavoriteMutation.mutate({ 
                        id: note.id, 
                        isFavorite: !note.is_favorite 
                      })}
                    >
                      {note.is_favorite ? (
                        <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                      ) : (
                        <Star className="h-4 w-4 text-gray-400" />
                      )}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-indigo-100 dark:hover:bg-indigo-900 rounded-full">
                          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500">
                            <path d="M3.625 7.5C3.625 8.12132 3.12132 8.625 2.5 8.625C1.87868 8.625 1.375 8.12132 1.375 7.5C1.375 6.87868 1.87868 6.375 2.5 6.375C3.12132 6.375 3.625 6.87868 3.625 7.5ZM8.625 7.5C8.625 8.12132 8.12132 8.625 7.5 8.625C6.87868 8.625 6.375 8.12132 6.375 7.5C6.375 6.87868 6.87868 6.375 7.5 6.375C8.12132 6.375 8.625 6.87868 8.625 7.5ZM13.625 7.5C13.625 8.12132 13.1213 8.625 12.5 8.625C11.8787 8.625 11.375 8.12132 11.375 7.5C11.375 6.87868 11.8787 6.375 12.5 6.375C13.1213 6.375 13.625 6.87868 13.625 7.5Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                          </svg>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl shadow-lg border-indigo-100 dark:border-indigo-800">
                        <DropdownMenuItem onClick={() => openViewDialog(note)} className="cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900">
                          <BookOpen className="h-4 w-4 mr-2 text-indigo-600 dark:text-indigo-400" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEditDialog(note)} className="cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900">
                          <Edit className="h-4 w-4 mr-2 text-indigo-600 dark:text-indigo-400" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-indigo-100 dark:bg-indigo-800" />
                        <DropdownMenuItem 
                          className="text-red-600 dark:text-red-400 cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/30"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this note?")) {
                              deleteLongNoteMutation.mutate(note.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pb-2 flex-grow pt-4">
                <div 
                  className="text-gray-600 dark:text-gray-300 line-clamp-3 text-sm cursor-pointer"
                  onClick={() => openViewDialog(note)}
                >
                  {note.content ? (
                    // Strip markdown syntax for a cleaner preview
                    note.content
                      .replace(/^#+\s+.*$/gm, '') // Remove headings
                      .replace(/\*\*|__|\*|_|~~|`|#|\[.*\]\(.*\)/g, '') // Remove formatting
                      .replace(/\n\n/g, ' ') // Replace double newlines with space
                      .trim()
                  ) : (
                    <span className="text-gray-400 italic">No content</span>
                  )}
                </div>
              </CardContent>
              <CardFooter className="flex flex-col items-start pt-0 mt-2 border-t border-indigo-50 dark:border-indigo-900 pt-3">
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {formatTags(note.tags).map((tag, index) => (
                    <Badge 
                      key={index} 
                      variant="outline" 
                      className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 cursor-pointer dark:bg-indigo-900/50 dark:text-indigo-300 dark:hover:bg-indigo-800 text-xs px-2 py-0.5 rounded-full"
                      onClick={() => handleTagClick(tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center text-xs text-gray-500 mt-1">
                  <Clock className="h-3 w-3 mr-1 text-indigo-400" />
                  <span>Updated {formatDate(note.updated_at)}</span>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* View Note Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col rounded-xl border-indigo-200 dark:border-indigo-800 shadow-lg" hideCloseButton>
          <DialogHeader className="flex justify-between items-start border-b border-indigo-100 dark:border-indigo-800 pb-4">
            <div className="flex items-center justify-between w-full">
              <DialogTitle className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-700 dark:from-indigo-400 dark:to-purple-400">
                {selectedNote?.title}
              </DialogTitle>
              <div className="flex items-center space-x-2">
                {selectedNote?.is_favorite && (
                  <Star className="h-5 w-5 fill-yellow-500 text-yellow-500" />
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 border-indigo-200 hover:bg-indigo-50 dark:border-indigo-800 dark:hover:bg-indigo-900/50 rounded-lg"
                  onClick={toggleReadMode}
                >
                  {readMode ? (
                    <>
                      <Edit className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      <span>Edit</span>
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      <span>Read</span>
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 border-indigo-200 hover:bg-indigo-50 dark:border-indigo-800 dark:hover:bg-indigo-900/50 rounded-lg"
                  onClick={() => {
                    if (selectedNote) {
                      handleGenerateContentForCurrentNote();
                    }
                  }}
                  disabled={isGenerating}
                >
                  <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <span>{isGenerating ? "Generating..." : "Enhance"}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setViewDialogOpen(false)}
                  className="rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-900/50"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="overflow-y-auto flex-grow py-4">
            {readMode ? (
              <div className="px-6 py-4 bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-indigo-50 dark:border-indigo-900">
                <MarkdownPreview 
                  content={selectedNote?.content || "No content"} 
                  className="prose-lg"
                />
              </div>
            ) : (
              <div data-color-mode={resolvedTheme === 'dark' ? 'dark' : 'light'} className="mt-2">
                <MDEditor
                  value={noteContent}
                  onChange={(value) => {
                    if (value !== undefined) {
                      // Store the content locally instead of immediately saving
                      setNoteContent(value);
                    }
                  }}
                  preview="edit"
                  height={500}
                  previewOptions={{
                    rehypePlugins: [[rehypeRaw, rehypeSanitize]]
                  }}
                  className="border border-indigo-100 dark:border-indigo-800 rounded-lg"
                />
              </div>
            )}
          </div>
          <div className="pt-4 border-t border-indigo-100 dark:border-indigo-800">
            <div className="flex flex-wrap gap-1.5 mb-3">
              {selectedNote?.tags && formatTags(selectedNote.tags).map((tag, index) => (
                <Badge 
                  key={index} 
                  variant="outline" 
                  className="bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 rounded-full text-xs px-2.5 py-0.5"
                >
                  {tag}
                </Badge>
              ))}
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <div className="flex items-center">
                <Clock className="h-3 w-3 mr-1 text-indigo-400" />
                <span>Created {selectedNote && formatDate(selectedNote.created_at)}</span>
              </div>
              <div className="flex items-center">
                {!readMode && (
                  <Button 
                    onClick={handleUpdateNote}
                    className="mr-4 bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white rounded-lg text-xs px-3 py-1"
                  >
                    Save Changes
                  </Button>
                )}
                <Clock className="h-3 w-3 mr-1 text-indigo-400" />
                <span>Updated {selectedNote && formatDate(selectedNote.updated_at)}</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Note Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[95vh] overflow-hidden rounded-xl border-indigo-200 dark:border-indigo-800 shadow-lg" hideCloseButton>
          <DialogHeader>
            <div className="flex items-center justify-between w-full">
              <DialogTitle className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-700 dark:from-indigo-400 dark:to-purple-400">Edit Note</DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setEditDialogOpen(false)}
                className="rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-900/50"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          <div className="space-y-2 py-2 overflow-y-auto">
            <div className="flex items-center justify-between">
              <Input
                placeholder="Note title"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                className="text-lg font-medium border-indigo-100 dark:border-indigo-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 rounded-lg"
              />
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsFavorite(!isFavorite)}
                  className={cn(
                    "ml-2 rounded-full",
                    isFavorite ? "text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20" : "text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                  )}
                >
                  {isFavorite ? <Star className="h-5 w-5 fill-yellow-500" /> : <Star className="h-5 w-5" />}
                </Button>
                
                {/* Generate content button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-2 gap-1 border-indigo-200 hover:bg-indigo-50 dark:border-indigo-800 dark:hover:bg-indigo-900/50 rounded-lg"
                  onClick={() => {
                    if (selectedNote) {
                      handleGenerateContentForCurrentNote();
                    }
                  }}
                  disabled={isGenerating || !selectedNote}
                >
                  {isGenerating ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      <span>Enhancing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      <span>Enhance</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
            
            {/* Markdown editor tabs */}
            <Tabs defaultValue="edit" className="w-full">
              <TabsList className="grid w-full grid-cols-2 p-1 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg">
                <TabsTrigger value="edit" onClick={() => setViewMode("edit")} className="rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-gray-900 data-[state=active]:text-indigo-700 dark:data-[state=active]:text-indigo-400">
                  <Code className="h-4 w-4 mr-2" />
                  Edit
                </TabsTrigger>
                <TabsTrigger value="preview" onClick={() => setViewMode("preview")} className="rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-gray-900 data-[state=active]:text-indigo-700 dark:data-[state=active]:text-indigo-400">
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </TabsTrigger>
              </TabsList>
              <TabsContent value="edit" className="mt-2">
                <div data-color-mode={resolvedTheme === 'dark' ? 'dark' : 'light'}>
                  <MDEditor
                    value={noteContent}
                    onChange={(value) => value !== undefined && setNoteContent(value)}
                    preview="edit"
                    height={280}
                    previewOptions={{
                      rehypePlugins: [[rehypeRaw, rehypeSanitize]]
                    }}
                    className="border border-indigo-100 dark:border-indigo-800 rounded-lg"
                  />
                </div>
              </TabsContent>
              <TabsContent value="preview" className="mt-2 border rounded-xl p-6 min-h-[300px] max-h-[300px] overflow-auto bg-white dark:bg-gray-900 border-indigo-100 dark:border-indigo-800">
                <MarkdownPreview 
                  content={noteContent || "No content"} 
                />
              </TabsContent>
            </Tabs>
            
            <div className="flex items-center space-x-2">
              <Tag className="h-4 w-4 text-indigo-500" />
              <Input
                placeholder="Tags (comma separated)"
                value={noteTags}
                onChange={(e) => setNoteTags(e.target.value)}
                className="border-indigo-100 dark:border-indigo-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 rounded-lg"
              />
            </div>
          </div>
          <DialogFooter className="border-t border-indigo-100 dark:border-indigo-800 pt-4">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="border-indigo-200 hover:bg-indigo-50 dark:border-indigo-800 dark:hover:bg-indigo-900/50 rounded-lg">
              Cancel
            </Button>
            <Button onClick={handleUpdateNote} className="bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white rounded-lg">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Content Dialog */}
      <GenerateContentDialog
        open={generateDialogOpen}
        onOpenChange={setGenerateDialogOpen}
        title={generateDialogTitle}
        defaultPrompt={generateDialogDefaultPrompt}
        onGenerate={generateDialogCallback}
        isGenerating={isGenerating}
      />
    </div>
  );
} 