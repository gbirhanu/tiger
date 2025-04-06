import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import React from "react";

interface DateRangePickerProps {
  dateRange: { from: Date; to: Date };
  onDateRangeChange: (range: { from: Date; to: Date }) => void;
}

export function DateRangePicker({ dateRange, onDateRangeChange }: DateRangePickerProps) {
  // Format date as a nice string
  const formatDateDisplay = (date: Date) => {
    return format(date, "MMM d, yyyy");
  };

  return (
    <div className="flex flex-col sm:flex-row gap-2 mt-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full sm:w-auto justify-start text-left font-normal"
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {formatDateDisplay(dateRange.from)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={dateRange.from}
            onSelect={(date) => 
              onDateRangeChange({ ...dateRange, from: date || dateRange.from })
            }
            initialFocus
          />
        </PopoverContent>
      </Popover>
      <div className="flex items-center justify-center text-sm">to</div>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full sm:w-auto justify-start text-left font-normal"
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {formatDateDisplay(dateRange.to)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={dateRange.to}
            onSelect={(date) => 
              onDateRangeChange({ ...dateRange, to: date || dateRange.to })
            }
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
} 