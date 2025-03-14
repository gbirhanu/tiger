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
import { Plus, X, GripVertical, Clipboard, Clock } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// Enhanced color palette with softer, more appealing colors
const COLORS = [
  "#FCE7F3", // Pink
  "#DBEAFE", // Light Blue
  "#ECFDF5", // Light Green
  "#FEF3C7", // Light Yellow
  "#F3E8FF", // Lavender
  "#FFEDD5", // Light Orange
];

export default function NotesBoard() {
  const { toast } = useToast();
  const [newNoteContent, setNewNoteContent] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

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
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
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
        <div className="flex flex-col items-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Loading notes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Clipboard className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold tracking-tight">Notes Board</h2>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Plus className="h-4 w-4 mr-2" />
              Add Note
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Note</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <Textarea
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                placeholder="Write your note here..."
                className="min-h-[150px] resize-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <DialogFooter className="sm:justify-end">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="ml-2"
                onClick={() => createNoteMutation.mutate(newNoteContent)}
                disabled={!newNoteContent || createNoteMutation.isPending}
              >
                {createNoteMutation.isPending ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-b-transparent"></div>
                    Saving...
                  </>
                ) : (
                  "Save Note"
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
                <div className="col-span-full flex flex-col items-center justify-center h-64 border border-dashed rounded-lg border-muted p-8">
                  <Clipboard className="h-10 w-10 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center">You don't have any notes yet. Click "Add Note" to create one.</p>
                </div>
              ) : (
                notes?.map((note, index) => (
                  <Draggable
                    key={note.id}
                    draggableId={String(note.id)}
                    index={index}
                  >
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className="group h-full"
                      >
                        <Card
                          style={{ backgroundColor: note.color }}
                          className="h-full shadow-md hover:shadow-lg transition-all duration-200 transform hover:-translate-y-1 border border-opacity-10"
                        >
                          <div 
                            {...provided.dragHandleProps}
                            className="h-2 w-12 mx-auto mt-2 rounded-full bg-gray-200 opacity-50 cursor-grab"
                          ></div>
                          <CardContent className="p-5 relative">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute top-1 right-1 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => deleteNoteMutation.mutate(note.id)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                            <div className="mt-1 mb-6">
                              <p className="whitespace-pre-wrap font-medium text-gray-800">{note.content}</p>
                            </div>
                          </CardContent>
                          <CardFooter className="px-5 py-2 border-t border-gray-100 bg-white bg-opacity-20">
                            <div className="w-full flex items-center text-xs text-gray-500">
                              <Clock className="h-3 w-3 mr-1" />
                              <span>
  {note.created_at
    ? (() => {
        const date = new Date(note.created_at);
        return isNaN(date.getTime())
          ? "Invalid date"
          : format(date, "MMM d, yyyy");
      })()
    : "Date unknown"}
</span>
                            </div>
                          </CardFooter>
                        </Card>
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