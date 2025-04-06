import React, { useState, useEffect } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Heart, Star, Edit, Trash2, GripHorizontal, User, Pin } from "lucide-react";
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
  onUpdate: (id: number, data: Partial<Note>) => Promise<any> 
}) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editedContent, setEditedContent] = useState(note.content || "");
  const [selectedColor, setSelectedColor] = useState(note.color);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [isUserNote, setIsUserNote] = useState(true);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [isPinned, setIsPinned] = useState(note.pinned || false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Get current user ID from localStorage
  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (userId) {
      setCurrentUserId(parseInt(userId, 10));
      // Check if note belongs to current user
      if (note.user_id && parseInt(userId, 10) !== note.user_id) {
        setIsUserNote(false);
      }
    }
  }, [note.user_id]);

  // Track window resize for responsiveness
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const randomIcon = React.useMemo(() => {
    const icons = [Heart, Star];
    const RandomIcon = icons[Math.floor(Math.random() * icons.length)];
    return <RandomIcon className="h-4 w-4 text-indigo-400 opacity-75" />;
  }, []);

  const handleSaveEdit = () => {
    // Ensure we're updating with the current user ID
    setEditDialogOpen(false); // Close the dialog immediately for better UX
    
    onUpdate(note.id, {
      content: editedContent,
      color: selectedColor,
      updated_at: Math.floor(Date.now() / 1000),
      user_id: currentUserId || note.user_id,
      pinned: isPinned
    }).catch(error => {
      console.error("Error saving note:", error);
      setEditDialogOpen(true); // Reopen dialog if there's an error
    });
  };

  const handleTogglePin = (e: React.MouseEvent) => {
    // Stop propagation to prevent other events
    e.stopPropagation();
    
    // Show loading state
    setIsUpdating(true);
    
    // Update the local state
    const updatedPinned = !isPinned;
    setIsPinned(updatedPinned);
    
    // Ensure we have at least one property to update
    const updateData: Partial<Note> = {
      pinned: updatedPinned,
      updated_at: Math.floor(Date.now() / 1000)
    };
    
    // Call the update function (which now returns a Promise)
    onUpdate(note.id, updateData)
      .then(() => {
        // Success handled by the parent component
      })
      .catch(error => {
        // Revert state on error
        console.error("Error toggling pin:", error);
        setIsPinned(!updatedPinned);
      })
      .finally(() => {
        // Hide loading after a short delay for visual feedback
        setTimeout(() => {
          setIsUpdating(false);
        }, 300);
      });
  };

  // Determine font size based on content length and window width
  const getFontSize = () => {
    const contentLength = note.content?.length || 0;
    
    if (windowWidth <= 640) { // Small screens
      return contentLength > 100 ? "text-xs" : "text-sm";
    } else {
      return contentLength > 200 ? "text-sm" : "text-base";
    }
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
        className={cn(
          "shadow-md border border-opacity-10 rounded-xl overflow-hidden relative group transition-all duration-300",
          isUserNote ? "hover:shadow-lg" : "opacity-80",
          windowWidth <= 640 ? "p-2" : "", // Smaller padding on mobile
          isPinned ? "ring-2 ring-amber-400 ring-offset-2" : ""
        )}
      >
        {/* Show pinned indicator on top left */}
        {isPinned && (
          <div className="absolute top-1 left-1 z-20">
            <div className="h-6 w-6 rounded-full bg-amber-400 flex items-center justify-center shadow-md">
              <Pin className="h-3 w-3 text-white" />
            </div>
          </div>
        )}
        
        {/* Improved drag handle - positioned at the top of the card for easier access */}
        {isUserNote && (
          <div 
            {...provided.dragHandleProps}
            className="absolute top-0 left-0 right-0 h-8 cursor-grab active:cursor-grabbing z-10 flex items-center justify-center"
          >
            <GripHorizontal className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-70 transition-opacity duration-200" />
          </div>
        )}
        
        {/* Action buttons - only show if it's the user's note */}
        {isUserNote && (
          <div className={cn(
            "absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-1 z-20",
            windowWidth <= 640 ? "!opacity-100" : "" // Always visible on mobile
          )}>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 rounded-full bg-white bg-opacity-60 backdrop-blur-sm hover:bg-opacity-90 shadow-sm",
                isPinned ? "text-amber-500 border border-amber-400" : "",
                isUpdating ? "opacity-50 cursor-not-allowed" : ""
              )}
              onClick={handleTogglePin}
              title={isPinned ? "Unpin note" : "Pin note"}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-b-transparent"></div>
              ) : (
                <Pin className="h-3.5 w-3.5" />
              )}
            </Button>
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
        )}
        
        {/* Note content with flex-grow to fill available space */}
        <CardContent className={cn(
          "flex-grow mt-2",
          windowWidth <= 640 ? "p-3 pb-1" : "p-5 pb-2" // Adjust padding for mobile
        )}>
          <div className="mt-1 mb-4 relative">
            <p className={cn(
              "whitespace-pre-wrap font-medium text-gray-800 leading-relaxed break-words",
              getFontSize(),
              windowWidth <= 640 ? "line-clamp-6" : "" // Truncate on mobile
            )}>
              {note.content}
            </p>
            <div className="absolute -left-1 -top-2 opacity-30">{randomIcon}</div>
          </div>
        </CardContent>
        
        {/* Note footer */}
        <CardFooter className={cn(
          "border-t border-gray-100 border-opacity-50 bg-white bg-opacity-30 backdrop-blur-[2px] flex justify-between items-center mt-auto",
          windowWidth <= 640 ? "px-3 py-2 text-xs" : "px-5 py-3" // Smaller on mobile
        )}>
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
                      : format(date, windowWidth <= 640 ? "MMM d" : "MMM d, yyyy");
                  })()
                : "Date unknown"}
            </span>
          </div>
          <div className="flex items-center">
            {!isUserNote && (
              <div className="flex items-center mr-2 text-xs text-gray-500">
                <User className="h-3 w-3 mr-1" />
                <span>Shared</span>
              </div>
            )}
            {isPinned && (
              <div className="flex items-center mr-2 text-xs text-amber-500">
                <Pin className="h-3 w-3 mr-1" />
                <span>Pinned</span>
              </div>
            )}
            <div className="h-5 w-5 rounded-full bg-white bg-opacity-70 flex items-center justify-center shadow-sm">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: note.color }}></div>
            </div>
          </div>
        </CardFooter>
      </Card>

      {/* Edit Note Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className={cn(
          "bg-white rounded-xl border border-indigo-100 shadow-xl",
          windowWidth <= 640 ? "max-w-[95%] p-4" : "sm:max-w-md" // Adjust width and padding for mobile
        )}>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600">Edit Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              placeholder="Write your note here..."
              className={cn(
                "resize-none focus:ring-2 focus:ring-indigo-300 border-gray-200 rounded-xl shadow-inner bg-gray-50 transition-all duration-200 text-blue-800 italic",
                windowWidth <= 640 ? "min-h-[100px]" : "min-h-[150px]" // Smaller on mobile
              )}
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
          <DialogFooter className={cn(
            windowWidth <= 640 ? "flex-col space-y-2" : "sm:justify-end"
          )}>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              className={cn(
                "rounded-full border-indigo-200 text-gray-600 hover:bg-gray-50",
                windowWidth <= 640 ? "w-full" : ""
              )}
            >
              Cancel
            </Button>
            <Button
              className={cn(
                "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-full",
                windowWidth <= 640 ? "w-full" : "ml-2"
              )}
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
