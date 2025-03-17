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

// Sort options
type SortOption = "newest" | "oldest" | "title" | "updated";
type FilterOption = "all" | "favorites" | "tag";
type ViewMode = "edit" | "preview" | "split";

export default function LongNotesBoard() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [filterBy, setFilterBy] = useState<FilterOption>("all");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<LongNote | null>(null);
  
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
        variant: "destructive",
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
        variant: "destructive",
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
      resetForm();
      setEditDialogOpen(false);
    },
    onError: (error) => {
      console.error("Error updating note:", error);
      toast({
        variant: "destructive",
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
        variant: "destructive",
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
        variant: "destructive",
        title: "Error",
        description: "Failed to update favorite status. Please try again.",
      });
    }
  });

  // Generate content with Gemini
  const generateContentMutation = useMutation({
    mutationFn: async ({ noteId, prompt }: { noteId?: number; prompt: string }) => {
      if (noteId) {
        // If we have a note ID, use the enhance endpoint
        return enhanceLongNoteApi(noteId, prompt);
      } else {
        // For new notes, use the generate-content endpoint
        return generateContentApi(prompt);
      }
    },
    onSuccess: (data) => {
      if (data.content) {
        setNoteContent(data.content);
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
        variant: "destructive",
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
        variant: "destructive",
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
        variant: "destructive",
        title: "Error",
        description: "Title is required.",
      });
      return;
    }

    updateLongNoteMutation.mutate({
      id: selectedNote.id,
      data: {
        title: noteTitle.trim(),
        content: noteContent.trim() || null,
        tags: noteTags.trim() || null,
        is_favorite: isFavorite
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
        variant: "destructive",
        title: "Error",
        description: "Please enter a title first.",
      });
      return;
    }

    setIsGenerating(true);
    const defaultPrompt = `Write a detailed note about "${noteTitle}"`;
    
    generateContentMutation.mutate({ 
      noteId: selectedNote?.id,
      prompt: generationPrompt || defaultPrompt
    });
  };

  // Toggle read mode
  const toggleReadMode = () => {
    setReadMode(!readMode);
  };

  // Open view dialog with note data
  const openViewDialog = (note: LongNote) => {
    setSelectedNote(note);
    setReadMode(true); // Default to read mode when opening a note
    setViewDialogOpen(true);
  };

  // Format tags for display
  const formatTags = (tags: string | null) => {
    if (!tags) return [];
    return tags.split(',').map(tag => tag.trim()).filter(tag => tag);
  };

  // Format date for display
  const formatDate = (timestamp: number) => {
    try {
      if (!timestamp) return "Unknown date";
      const date = new Date(timestamp * 1000);
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
    
    const prompt = window.prompt(
      "What type of content would you like to generate?",
      `Enhance the content about "${selectedNote.title}"`
    );
    
    if (!prompt) return;
    
    setIsGenerating(true);
    
    generateContentMutation.mutate(
      { 
        prompt, 
        noteId: selectedNote.id 
      },
      {
        onSuccess: () => {
          setIsGenerating(false);
        },
        onError: () => {
          setIsGenerating(false);
        }
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center space-y-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground font-medium animate-pulse">Loading your notes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="mb-4 text-red-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="text-lg font-semibold">Error loading notes</h3>
          <p className="text-sm mt-1">{error.message || "Please try again later."}</p>
        </div>
        <Button 
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LONG_NOTES] });
            toast({
              title: "Retrying",
              description: "Attempting to load notes again...",
            });
          }}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with title and actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-xl border border-indigo-100">
        <div className="flex items-center space-x-3">
          <BookOpen className="h-8 w-8 text-indigo-600" />
          <div>
            <h2 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-700">
              Long Notes
            </h2>
            <p className="text-sm text-gray-500">Capture detailed thoughts, ideas, and research</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white shadow-md hover:shadow-lg transition-all duration-300">
                <Plus className="h-4 w-4 mr-2" />
                New Note
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Note</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex items-center justify-between">
                  <Input
                    placeholder="Note title"
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    className="text-lg font-medium"
                  />
                  <div className="flex items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsFavorite(!isFavorite)}
                      className={cn(
                        "ml-2",
                        isFavorite ? "text-yellow-500 hover:text-yellow-600" : "text-gray-400 hover:text-gray-500"
                      )}
                    >
                      {isFavorite ? <Star className="h-5 w-5 fill-yellow-500" /> : <Star className="h-5 w-5" />}
                    </Button>
                    
                    {/* Generate content button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-2 gap-1"
                      onClick={() => {
                        if (noteTitle.trim()) {
                          const prompt = window.prompt(
                            "What kind of content would you like to generate?",
                            `Write a detailed note about "${noteTitle}"`
                          );
                          if (prompt) {
                            setGenerationPrompt(prompt);
                            handleGenerateContent();
                          }
                        } else {
                          toast({
                            variant: "destructive",
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
                          <Sparkles className="h-4 w-4" />
                          <span>Generate</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                
                {/* Markdown editor tabs */}
                <Tabs defaultValue="edit" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="edit" onClick={() => setViewMode("edit")}>
                      <Code className="h-4 w-4 mr-2" />
                      Edit
                    </TabsTrigger>
                    <TabsTrigger value="preview" onClick={() => setViewMode("preview")}>
                      <Eye className="h-4 w-4 mr-2" />
                      Preview
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="edit" className="mt-2">
                    <div data-color-mode="light">
                      <MDEditor
                        value={noteContent}
                        onChange={(value) => setNoteContent(value || "")}
                        preview="edit"
                        height={300}
                      />
                    </div>
                  </TabsContent>
                  <TabsContent value="preview" className="mt-2 border rounded-md p-4 min-h-[300px] max-h-[300px] overflow-auto">
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {noteContent}
                      </ReactMarkdown>
                    </div>
                  </TabsContent>
                </Tabs>
                
                <div className="flex items-center space-x-2">
                  <Tag className="h-4 w-4 text-gray-500" />
                  <Input
                    placeholder="Tags (comma separated)"
                    value={noteTags}
                    onChange={(e) => setNoteTags(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateNote}>
                  Create Note
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search, filter and sort controls */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="title">Title (A-Z)</SelectItem>
              <SelectItem value="updated">Recently Updated</SelectItem>
            </SelectContent>
          </Select>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                {filterBy === "all" ? "All Notes" : 
                 filterBy === "favorites" ? "Favorites" : 
                 filterBy === "tag" ? `Tag: ${selectedTag}` : "Filter"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px]">
              <DropdownMenuItem onClick={() => {
                setFilterBy("all");
                setSelectedTag(null);
              }}>
                All Notes
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterBy("favorites")}>
                Favorites
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {allTags.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-sm font-semibold">Tags</div>
                  {allTags.map(tag => (
                    <DropdownMenuItem key={tag} onClick={() => handleTagClick(tag)}>
                      {tag}
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
        <div className="flex flex-col items-center justify-center h-72 border border-dashed rounded-xl border-indigo-200 p-8 bg-gradient-to-b from-white to-indigo-50 dark:from-gray-900 dark:to-indigo-950 dark:border-indigo-800">
          <BookOpen className="h-16 w-16 text-indigo-200 dark:text-indigo-700 mb-6" />
          <h3 className="text-lg font-semibold text-indigo-700 dark:text-indigo-300 mb-2">No notes found</h3>
          <p className="text-gray-500 dark:text-gray-400 text-center mb-6">
            {searchQuery || filterBy !== "all" 
              ? "Try changing your search or filter criteria."
              : "Create your first note to start organizing your thoughts."}
          </p>
          <Button 
            onClick={() => setCreateDialogOpen(true)}
            className="bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New Note
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedNotes.map((note: LongNote) => (
            <Card key={note.id} className="overflow-hidden hover:shadow-md transition-shadow duration-300 flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <CardTitle 
                    className="text-lg font-semibold cursor-pointer hover:text-indigo-700 transition-colors duration-200"
                    onClick={() => openViewDialog(note)}
                  >
                    {note.title}
                  </CardTitle>
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
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
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500">
                            <path d="M3.625 7.5C3.625 8.12132 3.12132 8.625 2.5 8.625C1.87868 8.625 1.375 8.12132 1.375 7.5C1.375 6.87868 1.87868 6.375 2.5 6.375C3.12132 6.375 3.625 6.87868 3.625 7.5ZM8.625 7.5C8.625 8.12132 8.12132 8.625 7.5 8.625C6.87868 8.625 6.375 8.12132 6.375 7.5C6.375 6.87868 6.87868 6.375 7.5 6.375C8.12132 6.375 8.625 6.87868 8.625 7.5ZM13.625 7.5C13.625 8.12132 13.1213 8.625 12.5 8.625C11.8787 8.625 11.375 8.12132 11.375 7.5C11.375 6.87868 11.8787 6.375 12.5 6.375C13.1213 6.375 13.625 6.87868 13.625 7.5Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                          </svg>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openViewDialog(note)}>
                          <BookOpen className="h-4 w-4 mr-2" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEditDialog(note)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-red-600"
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
              <CardContent className="pb-2 flex-grow">
                <p className="text-gray-600 dark:text-gray-300 line-clamp-3 text-sm">
                  {note.content || "No content"}
                </p>
              </CardContent>
              <CardFooter className="flex flex-col items-start pt-0">
                <div className="flex flex-wrap gap-1.5 mt-2 mb-3">
                  {formatTags(note.tags).map((tag, index) => (
                    <Badge 
                      key={index} 
                      variant="outline" 
                      className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 cursor-pointer"
                      onClick={() => handleTagClick(tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center text-xs text-gray-500 mt-1">
                  <Clock className="h-3 w-3 mr-1" />
                  <span>Updated {formatDate(note.updated_at)}</span>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* View Note Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex justify-between items-start">
            <div className="flex items-center justify-between w-full">
              <DialogTitle className="text-xl font-bold">
                {selectedNote?.title}
              </DialogTitle>
              <div className="flex items-center space-x-2">
                {selectedNote?.is_favorite && (
                  <Star className="h-5 w-5 fill-yellow-500 text-yellow-500" />
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={toggleReadMode}
                >
                  {readMode ? (
                    <>
                      <Edit className="h-4 w-4" />
                      <span>Edit</span>
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4" />
                      <span>Read</span>
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={handleGenerateContentForCurrentNote}
                  disabled={isGenerating}
                >
                  <Sparkles className="h-4 w-4" />
                  <span>{isGenerating ? "Generating..." : "Enhance"}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setViewDialogOpen(false);
                    if (selectedNote && !readMode) {
                      openEditDialog(selectedNote);
                    }
                  }}
                >
                  {readMode ? <Edit className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setViewDialogOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="overflow-y-auto flex-grow py-4">
            {readMode ? (
              <div className="prose prose-sm md:prose max-w-none dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {selectedNote?.content || ""}
                </ReactMarkdown>
              </div>
            ) : (
              <div data-color-mode="light" className="mt-2">
                <MDEditor
                  value={selectedNote?.content || ""}
                  onChange={(value) => {
                    if (selectedNote) {
                      updateLongNoteMutation.mutate({
                        id: selectedNote.id,
                        data: {
                          content: value || null
                        }
                      });
                    }
                  }}
                  preview="edit"
                  height={500}
                />
              </div>
            )}
          </div>
          <div className="pt-4 border-t">
            <div className="flex flex-wrap gap-1.5 mb-3">
              {selectedNote?.tags && formatTags(selectedNote.tags).map((tag, index) => (
                <Badge 
                  key={index} 
                  variant="outline" 
                  className="bg-indigo-50 text-indigo-700"
                >
                  {tag}
                </Badge>
              ))}
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center">
                <Clock className="h-3 w-3 mr-1" />
                <span>Created {selectedNote && formatDate(selectedNote.created_at)}</span>
              </div>
              <div className="flex items-center">
                <Clock className="h-3 w-3 mr-1" />
                <span>Updated {selectedNote && formatDate(selectedNote.updated_at)}</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Note Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <Input
                placeholder="Note title"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                className="text-lg font-medium"
              />
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsFavorite(!isFavorite)}
                  className={cn(
                    "ml-2",
                    isFavorite ? "text-yellow-500 hover:text-yellow-600" : "text-gray-400 hover:text-gray-500"
                  )}
                >
                  {isFavorite ? <Star className="h-5 w-5 fill-yellow-500" /> : <Star className="h-5 w-5" />}
                </Button>
                
                {/* Generate content button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-2 gap-1"
                  onClick={() => {
                    if (selectedNote) {
                      const prompt = window.prompt(
                        "How would you like to enhance this note?",
                        "Improve the formatting and expand on the key points"
                      );
                      if (prompt) {
                        setGenerationPrompt(prompt);
                        handleGenerateContentForCurrentNote();
                      }
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
                      <Sparkles className="h-4 w-4" />
                      <span>Enhance</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
            
            {/* Markdown editor tabs */}
            <Tabs defaultValue="edit" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="edit" onClick={() => setViewMode("edit")}>
                  <Code className="h-4 w-4 mr-2" />
                  Edit
                </TabsTrigger>
                <TabsTrigger value="preview" onClick={() => setViewMode("preview")}>
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </TabsTrigger>
              </TabsList>
              <TabsContent value="edit" className="mt-2">
                <div data-color-mode="light">
                  <MDEditor
                    value={noteContent}
                    onChange={(value) => setNoteContent(value || "")}
                    preview="edit"
                    height={300}
                  />
                </div>
              </TabsContent>
              <TabsContent value="preview" className="mt-2 border rounded-md p-4 min-h-[300px] max-h-[300px] overflow-auto">
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {noteContent}
                  </ReactMarkdown>
                </div>
              </TabsContent>
            </Tabs>
            
            <div className="flex items-center space-x-2">
              <Tag className="h-4 w-4 text-gray-500" />
              <Input
                placeholder="Tags (comma separated)"
                value={noteTags}
                onChange={(e) => setNoteTags(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateNote}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 