
import React from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Clock, Heart, Star, Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";

export function NoteCard({ note, provided, onDelete }: any) {
  const randomIcon = React.useMemo(() => {
    const icons = [Heart, Star];
    const RandomIcon = icons[Math.floor(Math.random() * icons.length)];
    return <RandomIcon className="h-4 w-4 text-indigo-400 opacity-75" />;
  }, []);

  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      className="group h-full"
    >
      <Card
        style={{ backgroundColor: note.color }}
        className="h-full shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-opacity-10 rounded-xl overflow-hidden relative"
      >
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full bg-white bg-opacity-60 backdrop-blur-sm hover:bg-opacity-90 shadow-sm"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5 text-gray-700" />
          </Button>
        </div>
        <div 
          {...provided.dragHandleProps}
          className="cursor-grab active:cursor-grabbing h-1.5 w-10 mx-auto mt-3 rounded-full bg-gray-200 opacity-40 group-hover:opacity-80 transition-all duration-200"
        ></div>
        <CardContent className="p-5 pb-2">
          <div className="mt-2 mb-4 relative">
            <p className="whitespace-pre-wrap font-medium text-gray-800 leading-relaxed">{note.content}</p>
            <div className="absolute -left-1 -top-2 opacity-30">{randomIcon}</div>
          </div>
        </CardContent>
        <CardFooter className="px-5 py-3 border-t border-gray-100 border-opacity-50 bg-white bg-opacity-30 backdrop-blur-[2px] flex justify-between items-center">
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
    </div>
  );
}
