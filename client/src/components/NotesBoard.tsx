import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { type Note } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getNotes, createNote as createNoteApi, updateNote as updateNoteApi, deleteNote as deleteNoteApi } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Plus, X, GripVertical } from "lucide-react";

const COLORS = [
  "#FFD700", // Yellow
  "#FF9999", // Pink
  "#98FB98", // Green
  "#87CEEB", // Blue
  "#DDA0DD", // Purple
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
        user_id: 0, // This will be set by the server
        created_at: Date.now(),
        updated_at: Date.now()
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
    return <div>Loading notes...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Sticky Notes</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Note
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Note</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <Textarea
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                placeholder="Write your note here..."
                className="min-h-[150px]"
              />
              <Button
                className="w-full"
                onClick={() => createNoteMutation.mutate(newNoteContent)}
                disabled={!newNoteContent || createNoteMutation.isPending}
              >
                Save Note
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="notes">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            >
              {notes?.map((note, index) => (
                <Draggable
                  key={note.id}
                  draggableId={String(note.id)}
                  index={index}
                >
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className="group relative"
                    >
                      <Card
                        style={{ backgroundColor: note.color }}
                        className="transform transition-transform hover:-translate-y-1"
                      >
                        <CardContent className="p-4">
                          <div
                            {...provided.dragHandleProps}
                            className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <GripVertical className="h-4 w-4 text-gray-500" />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => deleteNoteMutation.mutate(note.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <p className="whitespace-pre-wrap pt-6">{note.content}</p>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}