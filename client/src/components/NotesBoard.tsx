
import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
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
import { queryClient } from "@/lib/queryClient";
import { Plus, X, GripVertical, StickyNote, Clock, Sparkles, Star, Heart, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { NoteCard } from "@/components/NoteCard";
import { ColorPicker } from "@/components/ColorPicker";

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

  const { data: notes, isLoading, error } = useQuery({
    queryKey: ["notes"],
    queryFn: getNotes,
  });

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
      const note = {
        title: "Note", // Add required fields
        content,
        color: selectedColor,
        position: (notes?.length || 0) + 1,
        // Convert timestamps to seconds (integer) for SQLite storage
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000)
      };
      return createNoteApi(note);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      setNewNoteContent("");
      setDialogOpen(false);
      toast({
        title: "Note created",
        description: "Your note has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to create note: ${error.message}`,
      });
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: ({ id, ...data }: Partial<Note> & { id: number }) => 
      updateNoteApi(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to update note: ${error.message}`,
      });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: deleteNoteApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      toast({
        title: "Note deleted",
        description: "Your note has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to delete note: ${error.message}`,
      });
    },
  });

  const handleDragEnd = (result: any) => {
    if (!result.destination || !notes) return;

    const items = Array.from(notes);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update positions
    items.forEach((note, index) => {
      updateNoteMutation.mutate({ id: note.id, position: index + 1 });
    });
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

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg shadow-sm border border-indigo-100">
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
            <Button className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-md hover:shadow-lg transition-all duration-300 rounded-full px-5">
              <Plus className="h-4 w-4 mr-2" />
              Add Note
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md bg-white backdrop-blur-sm bg-opacity-90 rounded-xl border border-indigo-100 shadow-xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600">Create New Note</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <Textarea
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                placeholder="Write your note here..."
                className="min-h-[150px] resize-none focus:ring-2 focus:ring-indigo-300 border-indigo-100 rounded-xl shadow-inner bg-white transition-all duration-200"
              />
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Choose a color</label>
                <ColorPicker colors={COLORS} selectedColor={selectedColor} onChange={setSelectedColor} />
              </div>
            </div>
            <DialogFooter className="sm:justify-end">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
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

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="notes">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            >
              {notes?.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center h-72 border border-dashed rounded-xl border-indigo-200 p-8 bg-gradient-to-b from-white to-indigo-50">
                  <div className="relative mb-6">
                    <StickyNote className="h-16 w-16 text-indigo-200" />
                    <Plus className="h-6 w-6 text-indigo-500 absolute -right-1 -top-1 bg-white rounded-full p-1 shadow-sm" />
                  </div>
                  <h3 className="text-lg font-semibold text-indigo-700 mb-2">No notes yet</h3>
                  <p className="text-gray-500 text-center mb-6">Click "Add Note" to create your first note and start organizing your thoughts.</p>
                  <Button 
                    onClick={() => setDialogOpen(true)}
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-md hover:shadow-lg transition-all duration-300 rounded-full px-5 animate-pulse"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Note
                  </Button>
                </div>
              ) : (
                notes?.map((note, index) => (
                  <Draggable
                    key={note.id}
                    draggableId={String(note.id)}
                    index={index}
                  >
                    {(provided) => (
                      <NoteCard
                        note={note}
                        provided={provided}
                        onDelete={() => deleteNoteMutation.mutate(note.id)}
                      />
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