import * as React from "react"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"

import { cn } from "@/lib/utils"

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> & {
    type?: "auto" | "always" | "hover" | "scroll";
    viewportRef?: React.RefObject<HTMLDivElement>;
  }
>(({ className, children, type = "auto", viewportRef, ...props }, ref) => {
  const scrollVisibility = React.useMemo(() => {
    switch (type) {
      case "always":
        return "always";
      case "hover":
        return "hover";
      case "scroll":
        return "scroll";
      case "auto":
      default:
        return "auto";
    }
  }, [type]);

  return (
    <ScrollAreaPrimitive.Root
      ref={ref}
      className={cn("relative overflow-hidden", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport 
        ref={viewportRef}
        className="h-full w-full rounded-[inherit]"
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar visibility={scrollVisibility} />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
})
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar> & {
    visibility?: "auto" | "always" | "hover" | "scroll";
  }
>(({ className, orientation = "vertical", visibility = "auto", ...props }, ref) => {
  const getVisibilityClasses = () => {
    switch (visibility) {
      case "always":
        return "opacity-100";
      case "hover":
        return "opacity-0 group-hover:opacity-100 transition-opacity duration-200";
      case "scroll":
        return "opacity-0 data-[state=visible]:opacity-100 transition-opacity duration-200";
      case "auto":
      default:
        return "";
    }
  };

  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      ref={ref}
      orientation={orientation}
      className={cn(
        "flex touch-none select-none transition-colors",
        orientation === "vertical" &&
          "h-full w-2.5 border-l border-l-transparent p-[1px]",
        orientation === "horizontal" &&
          "h-2.5 flex-col border-t border-t-transparent p-[1px]",
        getVisibilityClasses(),
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border hover:bg-muted-foreground/50" />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  );
})
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName

export { ScrollArea, ScrollBar }
