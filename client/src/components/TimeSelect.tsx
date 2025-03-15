import React, { useState } from "react";
import { Button } from "@/components/ui/button";

export const TimeSelect = ({ value, onChange, onComplete, compact = false, disabled = false }: { 
  value: Date; 
  onChange: (date: Date) => void; 
  onComplete?: () => void;
  compact?: boolean;
  disabled?: boolean;
}) => {
  const hours = Array.from({ length: 12 }, (_, i) => i === 0 ? 12 : i);
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5);
  const [period, setPeriod] = useState<"AM" | "PM">(value.getHours() >= 12 ? "PM" : "AM");
  
  // Convert 24h hour to 12h format
  const get12Hour = (hour24: number) => {
    if (hour24 === 0) return 12;
    if (hour24 > 12) return hour24 - 12;
    return hour24;
  };
  
  // Convert 12h hour to 24h format
  const get24Hour = (hour12: number, period: "AM" | "PM") => {
    if (period === "AM" && hour12 === 12) return 0;
    if (period === "PM" && hour12 !== 12) return hour12 + 12;
    return hour12;
  };
  
  const handleTimeChange = (hour12: number, minute: number, period: "AM" | "PM") => {
    if (disabled) return;
    const hour24 = get24Hour(hour12, period);
    const newDate = new Date(value);
    newDate.setHours(hour24, minute);
    onChange(newDate);
  };

  // Super compact layout for all cases to prevent overflow
  return (
    <div className="p-2 border-t border-border max-h-[200px]">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-xs font-medium text-foreground">Select Time</h3>
        <div className="flex items-center space-x-1">
          <Button
            type="button"
            variant={period === "AM" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setPeriod("AM");
              const hour12 = get12Hour(value.getHours());
              handleTimeChange(hour12, value.getMinutes(), "AM");
            }}
            className="h-5 rounded-full px-1.5 text-xs"
            disabled={disabled}
          >
            AM
          </Button>
          <Button
            type="button"
            variant={period === "PM" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setPeriod("PM");
              const hour12 = get12Hour(value.getHours());
              handleTimeChange(hour12, value.getMinutes(), "PM");
            }}
            className="h-5 rounded-full px-1.5 text-xs"
            disabled={disabled}
          >
            PM
          </Button>
        </div>
      </div>
      
      {/* Ultra compact layout */}
      <div>
        <div className="flex justify-between mb-1">
          <label className="text-xs text-muted-foreground">Hour</label>
          <label className="text-xs text-muted-foreground">Minute</label>
        </div>
        <div className="grid grid-cols-2 gap-1">
          <div className="grid grid-cols-4 gap-0.5">
            {hours.map((hour) => (
              <Button
                key={hour}
                type="button"
                variant={hour === get12Hour(value.getHours()) ? "default" : "outline"}
                size="sm"
                onClick={() => handleTimeChange(hour, value.getMinutes(), period)}
                className="h-5 w-5 p-0 min-w-0 text-xs"
                disabled={disabled}
              >
                {hour}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-0.5">
            {minutes.map((minute) => (
              <Button
                key={minute}
                type="button"
                variant={minute === value.getMinutes() ? "default" : "outline"}
                size="sm"
                onClick={() => handleTimeChange(get12Hour(value.getHours()), minute, period)}
                className="h-5 w-5 p-0 min-w-0 text-xs"
                disabled={disabled}
              >
                {minute.toString().padStart(2, '0')}
              </Button>
            ))}
          </div>
        </div>
      </div>
      
      <div className="mt-1 flex justify-between items-center">
        <div className="text-xs font-medium">
          {get12Hour(value.getHours())}:{value.getMinutes().toString().padStart(2, '0')} {period}
        </div>
        {onComplete && (
          <Button 
            type="button" 
            size="sm" 
            onClick={onComplete}
            className="h-5 px-2 text-xs"
            disabled={disabled}
          >
            Done
          </Button>
        )}
      </div>
    </div>
  );
}; 