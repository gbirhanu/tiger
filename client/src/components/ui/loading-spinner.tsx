import React from 'react';
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface LoadingSpinnerProps {
  message?: string;
  submessage?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  showProgress?: boolean;
}

export function LoadingSpinner({
  message = "Loading...",
  submessage,
  size = "md",
  className,
  iconClassName,
  textClassName,
  showProgress = false,
}: LoadingSpinnerProps) {
  // Map size to dimensions
  const sizeMap = {
    sm: {
      container: "h-32",
      spinner: "h-8 w-8",
      textSize: "text-sm",
      submessageSize: "text-xs",
    },
    md: {
      container: "h-48",
      spinner: "h-12 w-12",
      textSize: "text-base",
      submessageSize: "text-sm",
    },
    lg: {
      container: "h-64",
      spinner: "h-16 w-16",
      textSize: "text-lg",
      submessageSize: "text-sm",
    },
  };

  return (
    <div
      className={cn(
        "flex items-center justify-center",
        sizeMap[size].container,
        className
      )}
    >
      <div className="flex flex-col items-center space-y-4">
        <div className="relative">
          <Loader2
            className={cn(
              "animate-spin text-primary",
              sizeMap[size].spinner,
              iconClassName
            )}
          />
        </div>
        <div className="flex flex-col items-center space-y-1">
          <p
            className={cn(
              "font-medium text-center animate-pulse",
              sizeMap[size].textSize,
              textClassName
            )}
          >
            {message}
          </p>
          {submessage && (
            <p
              className={cn(
                "text-muted-foreground text-center",
                sizeMap[size].submessageSize
              )}
            >
              {submessage}
            </p>
          )}
        </div>
        {showProgress && (
          <div className="w-full max-w-xs bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-2 overflow-hidden">
            <div className="bg-primary h-1.5 rounded-full animate-progress"></div>
          </div>
        )}
      </div>
    </div>
  );
} 