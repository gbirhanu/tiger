
import React from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface ColorPickerProps {
  colors: string[];
  selectedColor: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ colors, selectedColor, onChange }: ColorPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map((color) => (
        <button
          key={color}
          className={cn(
            "w-8 h-8 rounded-full transition-all duration-200 flex items-center justify-center",
            selectedColor === color ? "ring-2 ring-offset-2 ring-indigo-500 scale-110" : "hover:scale-110"
          )}
          style={{ backgroundColor: color }}
          onClick={() => onChange(color)}
          type="button"
        >
          {selectedColor === color && (
            <Check className="h-4 w-4 text-gray-700" />
          )}
        </button>
      ))}
    </div>
  );
}