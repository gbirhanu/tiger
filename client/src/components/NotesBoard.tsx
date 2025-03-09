import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { type Note } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Plus, X } from "lucide-react";

export default function NotesBoard() {
  const { toast } = useToast();
  const [newNoteContent, setNewNoteContent] = useState("");

  const { data: notes, isLoading } = useQuery<Note[]>({
    queryKey: ["/api/notes"],
  });

  const createNote = useMutation({
    mutationFn: async (content: string) => {
      const note = {
        content,
        color: "#" + Math.floor(Math.random()*16777215).toString(16),
        position: (notes?.length || 0) + 1,
      };
      const res = await apiRequest("POST", "/api/notes", note);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      setNewNoteContent("");
      toast({
        title: "Note created",
        description: "Your note has been created successfully.",
      });
    },
  });

  const updateNote = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Note> & { id: number }) => {
      const res = await apiRequest("PATCH", `/api/notes/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
    },
  });

  const deleteNote = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/notes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      toast({
        title: "Note deleted",
        description: "Your note has been deleted successfully.",
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
      updateNote.mutate({ id: note.id, position: index + 1 });
    });
  };

  if (isLoading) {
    return <div>Loading notes...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={newNoteContent}
          onChange={(e) => setNewNoteContent(e.target.value)}
          placeholder="Enter note content"
        />
        <Button
          onClick={() => createNote.mutate(newNoteContent)}
          disabled={!newNoteContent || createNote.isPending}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Note
        </Button>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="notes">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
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
                      {...provided.dragHandleProps}
                    >
                      <Card style={{ backgroundColor: note.color }}>
                        <CardContent className="p-4 relative">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2"
                            onClick={() => deleteNote.mutate(note.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <p className="whitespace-pre-wrap">{note.content}</p>
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
