import React, { useState } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Heart, Star, Edit, Trash2, GripHorizontal } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ColorPicker } from "@/components/ColorPicker";
import { type Note } from "@shared/schema";
import { cn } from "@/lib/utils";

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

export function NoteCard({ note, provided, onDelete, onUpdate }: { 
  note: Note, 
  provided: any, 
  onDelete: () => void,
  onUpdate: (id: number, data: Partial<Note>) => void 
}) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editedContent, setEditedContent] = useState(note.content || "");
  const [selectedColor, setSelectedColor] = useState(note.color);

  const randomIcon = React.useMemo(() => {
    const icons = [Heart, Star];
    const RandomIcon = icons[Math.floor(Math.random() * icons.length)];
    return <RandomIcon className="h-4 w-4 text-indigo-400 opacity-75" />;
  }, []);

  const handleSaveEdit = () => {
    onUpdate(note.id, {
      content: editedContent,
      color: selectedColor,
      updated_at: Math.floor(Date.now() / 1000)
    });
    setEditDialogOpen(false);
  };

  return (
    <>
      <Card
        style={{ 
          backgroundColor: note.color,
          height: '100%', // Ensure consistent height
          display: 'flex',
          flexDirection: 'column'
        }}
        className="shadow-md border border-opacity-10 rounded-xl overflow-hidden relative group"
      >
        {/* Improved drag handle - positioned at the top of the card for easier access */}
        <div 
          {...provided.dragHandleProps}
          className="absolute top-0 left-0 right-0 h-8 cursor-grab active:cursor-grabbing z-10 flex items-center justify-center"
        >
          <GripHorizontal className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-70 transition-opacity duration-200" />
        </div>
        
        {/* Action buttons */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-1 z-20">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full bg-white bg-opacity-60 backdrop-blur-sm hover:bg-opacity-90 shadow-sm"
            onClick={() => setEditDialogOpen(true)}
          >
            <Edit className="h-3.5 w-3.5 text-gray-700" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full bg-white bg-opacity-60 backdrop-blur-sm hover:bg-opacity-90 shadow-sm"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5 text-gray-700" />
          </Button>
        </div>
        
        {/* Note content with flex-grow to fill available space */}
        <CardContent className="p-5 pb-2 flex-grow mt-2">
          <div className="mt-1 mb-4 relative">
            <p className="whitespace-pre-wrap font-medium text-gray-800 leading-relaxed">{note.content}</p>
            <div className="absolute -left-1 -top-2 opacity-30">{randomIcon}</div>
          </div>
        </CardContent>
        
        {/* Note footer */}
        <CardFooter className="px-5 py-3 border-t border-gray-100 border-opacity-50 bg-white bg-opacity-30 backdrop-blur-[2px] flex justify-between items-center mt-auto">
          <div className="flex items-center text-xs text-gray-600">
            <Clock className="h-3 w-3 mr-1 text-gray-500" />
            <span>
              {note.created_at
                ? (() => {
                    const date = typeof note.created_at === 'number' 
                      ? new Date(note.created_at * 1000) 
                      : new Date(note.created_at);
                    return isNaN(date.getTime())
                      ? "Invalid date"
                      : format(date, "MMM d, yyyy");
                  })()
                : "Date unknown"}
            </span>
          </div>
          <div className="h-5 w-5 rounded-full bg-white bg-opacity-70 flex items-center justify-center shadow-sm">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: note.color }}></div>
          </div>
        </CardFooter>
      </Card>

      {/* Edit Note Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-xl border border-indigo-100 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600">Edit Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              placeholder="Write your note here..."
              className="min-h-[150px] resize-none focus:ring-2 focus:ring-indigo-300 border-gray-200 rounded-xl shadow-inner bg-gray-50 transition-all duration-200 
              text-blue-800  italic  
              "
            />
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Choose a color</label>
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                <ColorPicker colors={COLORS} selectedColor={selectedColor} onChange={setSelectedColor} />
              </div>
            </div>
          </div>
          <DialogFooter className="sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              className="rounded-full border-indigo-200 text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              className="ml-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-full"
              onClick={handleSaveEdit}
              disabled={!editedContent}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
