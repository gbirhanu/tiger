import { format, formatInTimeZone } from 'date-fns-tz';
import { queryClient, QUERY_KEYS } from './queryClient';
import type { UserSettings } from '@shared/schema';

/**
 * Gets the user's timezone from settings or falls back to default timezone
 */
export function getUserTimezone(): string {
  try {
    const userSettings = queryClient.getQueryData<UserSettings>([QUERY_KEYS.USER_SETTINGS]);
    if (userSettings && userSettings.timezone) {
      return userSettings.timezone;
    }
  } catch (error) {
    console.error('Error getting user timezone:', error);
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
export function formatDate(date: Date | number, formatStr: string): string {
  const timezone = getUserTimezone();
  
  try {
    if (typeof date === 'number') {
      // If it's a Unix timestamp in seconds, convert to milliseconds
      if (date < 10000000000) {
        date = date * 1000;
      }
      date = new Date(date);
    }
    
    return formatInTimeZone(date, timezone, formatStr);
  } catch (error) {
    console.error('Error formatting date with timezone:', error);
    // Fallback to regular format without timezone
    return format(new Date(date), formatStr);
  }
}

/**
 * Creates a new Date object in the user's timezone
 * @returns A new Date object
 */
export function getNow(): Date {
  // The Date object is always created in the local timezone,
  // but we'll ensure our formatting functions use the user's timezone
  return new Date();
} 