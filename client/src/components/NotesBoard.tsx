import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { type Note } from "@shared/schema";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getNotes, createNote as createNoteApi, updateNote as updateNoteApi, deleteNote as deleteNoteApi } from "@/lib/api";
import { queryClient, QUERY_KEYS } from "@/lib/queryClient";
import { Plus, X, GripVertical, StickyNote, Clock, Sparkles, Star, Heart, Pencil, Trash2, Pin } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { NoteCard } from "@/components/NoteCard";
import { ColorPicker } from "@/components/ColorPicker";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

// Enhanced color palette with vibrant, pleasing colors
const COLORS = [
  "#FCE7F3", // Pink
  "#DBEAFE", // Light Blue
  "#ECFDF5", // Light Green
  "#FEF3C7", // Light Yellow
  "#F3E8FF", // Lavender
  "#FFEDD5", // Light Orange
  "#E0F2FE", // Sky Blue
  "#FEE2E2", // Light Red
];

export default function NotesBoard() {
  const { toast } = useToast();
  const [newNoteContent, setNewNoteContent] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [isDragging, setIsDragging] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  const { data: notes, isLoading, error } = useQuery({
    queryKey: [QUERY_KEYS.NOTES],
    queryFn: getNotes,
  });

  // Sort notes by pinned status first, then by position
  const sortedNotes = React.useMemo(() => {
    if (!notes) return [];
    
    // First sort by position
    const positionSorted = [...notes].sort((a, b) => a.position - b.position);
    
    // Then re-sort with pinned notes at the top
    return positionSorted.sort((a, b) => {
      // If both notes have the same pinned status, maintain their position sorting
      if ((a.pinned && b.pinned) || (!a.pinned && !b.pinned)) {
        return 0;
      }
      // Otherwise, pinned notes come first
      return a.pinned ? -1 : 1;
    });
  }, [notes]);

  // Log error if there is one
  useEffect(() => {
    if (error) {
      console.error("Error fetching notes:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to fetch notes: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }, [error, toast]);

  const createNoteMutation = useMutation({
    mutationFn: (content: string) => {
      // Find the highest position value to ensure new note is added at the end
      const highestPosition = notes?.length 
        ? Math.max(...notes.map(note => note.position))
        : 0;
        
      const note = {
        title: "Note", // Add required fields
        content,
        color: selectedColor,
        position: highestPosition + 1, // Use highest position + 1 instead of length
        pinned: isPinned, // Add pinned status
        // Convert timestamps to seconds (integer) for SQLite storage
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000)
      };
      return createNoteApi(note);
    },
    onMutate: async (content) => {
      
      
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.NOTES] });
      
      // Get a snapshot of the current notes
      const previousNotes = queryClient.getQueryData<Note[]>([QUERY_KEYS.NOTES]) || [];
      
      // Find the highest position value
      const highestPosition = previousNotes.length 
        ? Math.max(...previousNotes.map(note => note.position))
        : 0;
      
      // Create an optimistic note with a temporary ID
      const optimisticNote = {
        id: Date.now(), // Temporary ID
        user_id: 1, // Temporary user ID
        title: "Note",
        content,
        color: selectedColor,
        position: highestPosition + 1, // Use highest position + 1
        pinned: isPinned, // Add pinned status
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000)
      };
      
      // Create a proper deep copy to avoid reference issues
      const updatedNotes = JSON.parse(JSON.stringify(previousNotes));
      updatedNotes.push(optimisticNote);
      
      
      
      // Update the cache with the new array that includes all previous notes plus the new one
      queryClient.setQueryData<Note[]>([QUERY_KEYS.NOTES], updatedNotes);
      
      return { previousNotes };
    },
    onError: (error: Error, _variables, context) => {
      console.error("Error creating note:", error);
      
      // Rollback to previous state if available
      if (context?.previousNotes) {
        queryClient.setQueryData<Note[]>([QUERY_KEYS.NOTES], context.previousNotes);
      }
      
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to create note: ${error.message}`,
      });
    },
    onSuccess: (newNote) => {
      
      
      // Simply fetch the notes again from the server
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.NOTES] });
      
      setNewNoteContent("");
      setIsPinned(false); // Reset pinned status after creating a note
      setDialogOpen(false);
      toast({
        title: "Note created",
        description: "Your note has been created successfully.",
      });
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: ({ id, ...data }: Partial<Note> & { id: number }) => 
      updateNoteApi(id, data),
    onMutate: async ({ id, ...updatedData }) => {
      
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.NOTES] });
      
      // Snapshot the previous value
      const previousNotes = queryClient.getQueryData<Note[]>([QUERY_KEYS.NOTES]) || [];
      
      // Create a proper deep copy to avoid reference issues
      const updatedNotes = JSON.parse(JSON.stringify(previousNotes));
      
      // Find the note to update
      const noteIndex = updatedNotes.findIndex((note: Note) => note.id === id);
      
      if (noteIndex !== -1) {
        // Create updated note by merging objects
        updatedNotes[noteIndex] = {
          ...updatedNotes[noteIndex],  // Keep ALL existing fields
          ...updatedData,              // Apply updates
          updated_at: Math.floor(Date.now() / 1000) // Update the timestamp
        };
        
        // Log what we're updating for debugging
        
        // Update the cache with the new array
        queryClient.setQueryData<Note[]>([QUERY_KEYS.NOTES], updatedNotes);
      } else {
        console.warn(`Note with id ${id} not found in cache`);
      }
      
      // Return the snapshot
      return { previousNotes };
    },
    onError: (error: Error, variables, context) => {
      console.error("Error updating note:", error);
      
      // Show more detailed error message
      toast({
        variant: "destructive",
        title: "Error updating note",
        description: `${error.message}. Please try again.`,
      });
      
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousNotes) {
        queryClient.setQueryData<Note[]>([QUERY_KEYS.NOTES], context.previousNotes);
      }
    },
    onSuccess: (updatedNote, { id }) => {
      // Invalidate the notes query to refetch fresh data
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.NOTES] });
      
      // When toggling pinned status, provide specific feedback
      if ('pinned' in updatedNote) {
        toast({
          title: updatedNote.pinned ? "Note pinned" : "Note unpinned",
          description: updatedNote.pinned 
            ? "Your note has been pinned to the top." 
            : "Your note has been unpinned.",
        });
      } else {
        toast({
          title: "Note updated",
          description: "Your note has been updated successfully.",
        });
      }
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: deleteNoteApi,
    onMutate: async (noteId) => {
      
      
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.NOTES] });
      
      // Snapshot the previous value
      const previousNotes = queryClient.getQueryData<Note[]>([QUERY_KEYS.NOTES]) || [];
      
      // Create a proper deep copy to avoid reference issues
      const updatedNotes = JSON.parse(JSON.stringify(previousNotes))
        .filter((note: Note) => note.id !== noteId);
      
      
      
      // Update the cache with the filtered array
      queryClient.setQueryData<Note[]>([QUERY_KEYS.NOTES], updatedNotes);
      
      // Return the snapshot
      return { previousNotes };
    },
    onError: (error: Error, _variables, context) => {
      console.error("Error deleting note:", error);
      
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousNotes) {
        queryClient.setQueryData<Note[]>([QUERY_KEYS.NOTES], context.previousNotes);
      }
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to delete note: ${error.message}`,
      });
    },
    onSuccess: (_, deletedNoteId) => {
      
      
      // Simply fetch the notes again from the server
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.NOTES] });
      
      toast({
        title: "Note deleted",
        description: "Your note has been deleted successfully.",
      });
    },
  });

  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDragEnd = (result: DropResult) => {
    setIsDragging(false);
    
    if (!result.destination || !sortedNotes.length) return;
    
    try {
      // If position didn't change
      if (result.destination.index === result.source.index) {
        return;
      }

      // Create a copy of the current notes
      const reorderedNotes = [...sortedNotes];
      
      // Remove the dragged item and insert it at the new position
      const [movedNote] = reorderedNotes.splice(result.source.index, 1);
      reorderedNotes.splice(result.destination.index, 0, movedNote);

      // Keep track of original positions
      const originalPositions = sortedNotes.reduce((acc, note) => {
        acc[note.id] = note.position;
        return acc;
      }, {} as Record<number, number>);

      // Update positions for all notes based on their new index,
      // but maintain the pinned status segregation by tracking pinned count
      let pinnedPosition = 1;
      let unpinnedPosition = reorderedNotes.filter(note => note.pinned).length + 1;
      
      const updatedNotes = reorderedNotes.map(note => {
        const position = note.pinned ? pinnedPosition++ : unpinnedPosition++;
        return {
          ...note,
          position
        };
      });

      // Immediately update the UI with the new order
      queryClient.setQueryData([QUERY_KEYS.NOTES], updatedNotes);

      // Only update the notes that actually changed position
      const changedNotes = updatedNotes.filter(note => 
        originalPositions[note.id] !== note.position
      );

      // Use updateNoteMutation for each changed note instead of direct API calls
      changedNotes.forEach(note => {
        updateNoteMutation.mutate({ 
          id: note.id, 
          position: note.position 
        });
      });
      
      // Only show toast if multiple notes were changed
      if (changedNotes.length > 1) {
        toast({
          title: "Notes reordered",
          description: "Your notes have been reordered successfully.",
        });
      }
    } catch (error) {
      console.error("Error during drag and drop:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update note positions. Please try again."
      });
    }
  };

  const handleUpdateNote = (id: number, data: Partial<Note>): Promise<Note> => {
    return new Promise((resolve, reject) => {
      updateNoteMutation.mutate(
        { id, ...data },
        {
          onSuccess: (data) => resolve(data),
          onError: (error) => reject(error)
        }
      );
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner 
          message="Loading your notes..." 
          size="md"
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-center md:items-center bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg shadow-sm border border-indigo-100" >
        <div className="flex items-center space-x-3">
          <StickyNote className="h-8 w-8 text-indigo-500" />
          <div>
            <h2 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600">
              Your Notes Board
            </h2>
            <p className="text-sm text-gray-500">Organize your thoughts with drag-and-drop simplicity</p>
          </div>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-md hover:shadow-lg transition-all duration-300 rounded-full px-5 mt-4 md:mt-0">
              <Plus className="h-4 w-4 mr-2" />
              Add Note
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md bg-white rounded-xl border border-indigo-100 shadow-xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600">Create New Note</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <Textarea
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                placeholder="Write your note here..."
                className="min-h-[150px] text-blue-800  italic  resize-none focus:ring-2 focus:ring-indigo-300 border-gray-200 rounded-xl shadow-inner bg-gray-50 transition-all duration-200"
              />
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Choose a color</label>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <ColorPicker colors={COLORS} selectedColor={selectedColor} onChange={setSelectedColor} />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "rounded-full border flex items-center gap-2",
                    isPinned ? "bg-amber-50 text-amber-700 border-amber-300" : "border-gray-200"
                  )}
                  onClick={() => setIsPinned(!isPinned)}
                >
                  <Pin className="h-3.5 w-3.5" />
                  {isPinned ? "Pinned" : "Pin note"}
                </Button>
                <span className="text-xs text-gray-500">Pinned notes appear at the top of your board</span>
              </div>
            </div>
            <DialogFooter className="sm:justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  setIsPinned(false);
                }}
                className="rounded-full border-indigo-200 text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </Button>
              <Button
                className="ml-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-full"
                onClick={() => createNoteMutation.mutate(newNoteContent)}
                disabled={!newNoteContent || createNoteMutation.isPending}
              >
                {createNoteMutation.isPending ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-b-transparent"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Save Note
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Display pinned note count if there are any */}
      {sortedNotes.some(note => note.pinned) && (
        <div className="flex items-center gap-2 text-sm text-amber-600 pl-2">
          <Pin className="h-4 w-4" />
          <span className="font-medium">{sortedNotes.filter(note => note.pinned).length} pinned notes</span>
        </div>
      )}

      <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <Droppable 
          droppableId="notes" 
          type="NOTES"
          direction="horizontal"
          ignoreContainerClipping={true}
        >
          {(provided, snapshot) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className={cn(
                "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6",
                isDragging && "cursor-grabbing"
              )}
            >
              {sortedNotes.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center h-72 border border-dashed rounded-xl border-indigo-200 p-8 bg-gradient-to-b from-white to-indigo-50">
                  <div className="relative mb-6">
                    <StickyNote className="h-16 w-16 text-indigo-200" />
                    <Plus className="h-6 w-6 text-indigo-500 absolute -right-1 -top-1 bg-white rounded-full p-1 shadow-sm" />
                  </div>
                  <h3 className="text-lg font-semibold text-indigo-700 mb-2">No notes yet</h3>
                  <p className="text-gray-500 text-center mb-6">Click "Add Note" to create your first note and start organizing your thoughts.</p>
                  <Button 
                    onClick={() => setDialogOpen(true)}
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-md hover:shadow-lg transition-all duration-300 rounded-full px-5"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Note
                  </Button>
                </div>
              ) : (
                sortedNotes.map((note, index) => (
                  <Draggable
                    key={note.id}
                    draggableId={String(note.id)}
                    index={index}
                    disableInteractiveElementBlocking={true}
                  >
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        style={provided.draggableProps.style}
                        className="h-full"
                      >
                        <NoteCard
                          note={note}
                          provided={{
                            ...provided,
                            draggableProps: {}, // We've already applied these to the parent div
                            innerRef: () => {}, // We've already applied this to the parent div
                          }}
                          onDelete={() => deleteNoteMutation.mutate(note.id)}
                          onUpdate={handleUpdateNote}
                        />
                      </div>
                    )}
                  </Draggable>
                ))
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}