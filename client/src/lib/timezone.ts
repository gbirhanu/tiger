import { format, formatInTimeZone } from 'date-fns-tz';
import { queryClient, QUERY_KEYS } from './queryClient';
import type { UserSettings } from '@shared/schema';
import { formatDistanceToNow, formatRelative } from 'date-fns';
/**
 * Gets the user's timezone from settings or falls back to default timezone
 */
export function getUserTimezone(): string {
  try {
    // First try to get from user settings
    const userSettings = queryClient.getQueryData<UserSettings>([QUERY_KEYS.USER_SETTINGS]);
    if (userSettings && userSettings.timezone) {
      return userSettings.timezone;
    }
    
    // Then try to get from localStorage
    const localStorageTimezone = localStorage.getItem('userTimezone');
    if (localStorageTimezone) {
      return localStorageTimezone;
    }
    
    // Finally try to get from browser
    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (browserTimezone) {
      return browserTimezone;
    }
  } catch (error) {
  }
  
  // Fallback to default timezone (Africa/Addis_Ababa - GMT+3)
  return "Africa/Addis_Ababa";
}

/**
 * Formats a date using the user's timezone settings
 * @param date The date to format
 * @param formatStr The format string to use
 * @returns The formatted date string
 */
export const formatDate = (date: Date | number, formatStr: string): string => {
  try {
    // Get the user's timezone from localStorage or use browser default
    const userTimezone = localStorage.getItem('userTimezone') || Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // Convert the date to a proper Date object
    let dateObj: Date;
    if (typeof date === 'number') {
      // If it's a Unix timestamp in seconds, convert to milliseconds
      dateObj = new Date(date * 1000);
    } else {
      dateObj = new Date(date);
    }

    // Check if the date is valid
    if (isNaN(dateObj.getTime())) {
      throw new Error('Invalid date');
    }
    
    // Format the date with timezone
    return formatInTimeZone(dateObj, userTimezone, formatStr);
  } catch (error) {
    // Fallback to regular format without timezone
    try {
      let dateObj: Date;
      if (typeof date === 'number') {
        dateObj = new Date(date * 1000);
      } else {
        dateObj = new Date(date);
      }
      return format(dateObj, formatStr);
    } catch (fallbackError) {
      // If all else fails, return a formatted current date
      return format(new Date(), formatStr);
    }
  }
};

/**
 * Creates a new Date object in the user's timezone
 * @returns A new Date object
 */
export function getNow(): Date {
  // The Date object is always created in the local timezone,
  // but we'll ensure our formatting functions use the user's timezone
  return new Date();
}

// Helper function to get greeting based on time of day
export const getGreeting = (): string => {
  const hour = new Date().getHours();
  
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  if (hour < 22) return 'Good evening';
  return 'Good night';
};

export const formatDateTime = (date: Date | number | string | null | undefined): { absoluteTime: string, relativeTime: string } => {
  if (!date) return { absoluteTime: 'Never', relativeTime: 'Never' };
  
  try {
    const dateObj = typeof date === 'number' 
      ? new Date(date < 10000000000 ? date * 1000 : date) 
      : new Date(date);
    
    const absoluteTime = formatDate(dateObj, 'PPp');
    const relativeTime = formatDistanceToNow(dateObj, { addSuffix: true });
    
    return {
      absoluteTime,
      relativeTime
    }
  } catch (error) {
    return {
      absoluteTime: 'Invalid date',
      relativeTime: 'Invalid date'
    };
  }
}; 
