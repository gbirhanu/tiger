import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Add a global safeDOM utility to handle DOM operations safely
export const safeDOM = {
  /**
   * Safely remove a child element from a parent
   * @param parent The parent element
   * @param child The child element to remove
   * @returns boolean indicating success
   */
  removeChild: (parent: Node | null | undefined, child: Node | null | undefined): boolean => {
    try {
      if (!parent || !child) return false;
      
      // Only try to remove if the child is actually a child of the parent
      if (parent.contains(child)) {
        parent.removeChild(child);
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  },
  
  /**
   * Safely clear all children from an element
   * @param element The element to clear
   * @returns boolean indicating success
   */
  clearChildren: (element: HTMLElement | null | undefined): boolean => {
    try {
      if (!element) return false;
      
      // Remove children one by one
      while (element.firstChild) {
        element.removeChild(element.firstChild);
      }
      return true;
    } catch (e) {
      // Fallback to innerHTML if the above fails
      try {
        if (element) {
          element.innerHTML = '';
          return true;
        }
      } catch (innerError) {
      }
      return false;
    }
  },
  
  /**
   * Safely append a child to a parent
   * @param parent The parent element
   * @param child The child element to append
   * @returns boolean indicating success
   */
  appendChild: (parent: Node | null | undefined, child: Node | null | undefined): boolean => {
    try {
      if (!parent || !child) return false;
      parent.appendChild(child);
      return true;
    } catch (e) {
      return false;
    }
  }
};
