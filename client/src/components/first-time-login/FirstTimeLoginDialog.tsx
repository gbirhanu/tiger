import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getUserSettings, updateUserSettings } from "@/lib/api";
import { timezones } from "./timezones";
import { createPortal } from "react-dom";
import { useToast } from "@/hooks/use-toast";

export function FirstTimeLoginDialog() {
  const [open, setOpen] = useState(false);
  const [timezone, setTimezone] = useState("");
  const [workStartHour, setWorkStartHour] = useState("9");
  const [workEndHour, setWorkEndHour] = useState("17");
  const [isLoading, setIsLoading] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Fetch user settings
    getUserSettings()
      .then(settings => {
        // If successful but timezone is empty, show dialog
        if (!settings?.timezone) {
          setOpen(true);
        }
        if (settings?.id === null) {
          setOpen(true);
        }
      })
      .catch(() => {
        // If fetch fails, show dialog
        setOpen(true);
      });
  }, []);

  // Set browser timezone
  useEffect(() => {
    if (open && !timezone) {
      try {
        const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        setTimezone(browserTimezone || "UTC");
      } catch (err) {
        setTimezone("UTC");
      }
    }
  }, [open, timezone]);

  // Generate time options
  const timeOptions = Array.from({ length: 24 }, (_, i) => {
    const hour = i;
    const period = hour < 12 ? "AM" : "PM";
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return {
      value: hour.toString(),
      label: `${displayHour}:00 ${period} (${hour}:00)`,
    };
  });

  const handleTimezoneSelect = (tz: string) => {
    setTimezone(tz);
    setPopoverOpen(false);
  };

  // Save settings
  const handleFinish = async () => {
    if (!timezone) {
      toast({ 
        variant: "destructive", 
        title: "Please select a timezone" 
      });
      return;
    }

    setIsLoading(true);
    
    try {
      await updateUserSettings({
        timezone,
        work_start_hour: parseInt(workStartHour),
        work_end_hour: parseInt(workEndHour),
      });
      
      toast({
        title: "Settings saved!",
        description: "Your preferences have been updated."
      });
      
      // Close the dialog
      setOpen(false);
      
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed to save settings",
        description: "Please try again later."
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForceClose = () => {
    setOpen(false);
  };

  // Don't render if not open
  if (!open) {
    return null;
  }
  
  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center z-[100] bg-black/50 backdrop-blur-sm">
      <div className="bg-background border rounded-lg p-6 max-w-md w-full shadow-2xl m-4">
        <h2 className="text-xl font-bold mb-2 text-center">Welcome to Tiger Task!</h2>
        <p className="text-muted-foreground mb-4 text-center text-sm">
          Please set up your timezone to get started.
        </p>
        
        <div className="space-y-4 mb-6">
          {/* Timezone */}
          <div>
            <Label htmlFor="timezone-button" className="block mb-1.5 font-medium text-sm">Your Timezone <span className="text-red-500">*</span></Label>
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="timezone-button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={popoverOpen}
                  className="w-full justify-between font-normal"
                >
                  {timezone
                    ? timezones.find((tz) => tz === timezone)
                    : "Select timezone..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[--radix-popover-trigger-width] max-h-[40vh] z-[101]">
                <Command>
                  <CommandInput placeholder="Search timezone..." />
                  <CommandList>
                    <CommandEmpty>No timezone found.</CommandEmpty>
                    <CommandGroup>
                      {timezones.map((tz) => (
                        <CommandItem
                          key={tz}
                          value={tz}
                          onSelect={() => handleTimezoneSelect(tz)}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              timezone === tz ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {tz}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          
          {/* Work hours */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="work-start" className="block mb-1.5 font-medium text-sm">Work Start Time</Label>
              <Select value={workStartHour} onValueChange={setWorkStartHour}>
                <SelectTrigger id="work-start" className="w-full font-normal">
                    <SelectValue placeholder="Select start time" />
                </SelectTrigger>
                <SelectContent>
                    {timeOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="work-end" className="block mb-1.5 font-medium text-sm">Work End Time</Label>
              <Select value={workEndHour} onValueChange={setWorkEndHour}>
                <SelectTrigger id="work-end" className="w-full font-normal">
                    <SelectValue placeholder="Select end time" />
                </SelectTrigger>
                <SelectContent>
                    {timeOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="flex gap-2">
          <Button 
            onClick={handleFinish}
            disabled={isLoading} 
            className="flex-1"
          >
            {isLoading ? "Saving..." : "Save Preferences"}
          </Button>
          
 
        </div>
      </div>
    </div>,
    document.body
  );
} 