import { db } from "../../shared/db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";

/**
 * Get a user by their email address
 * @param email The email address to look up
 * @returns The user if found, null otherwise
 */
export async function getUserByEmail(email: string) {
  try {
    const user = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return user.length > 0 ? user[0] : null;
  } catch (error) {
    console.error("Error fetching user by email:", error);
    return null;
  }
}

/**
 * Get a user by their ID
 * @param userId The user ID to look up
 * @returns The user if found, null otherwise
 */
export async function getUserById(userId: number) {
  try {
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    return user.length > 0 ? user[0] : null;
  } catch (error) {
    console.error("Error fetching user by ID:", error);
    return null;
  }
}

/**
 * Check if a user has notification preferences enabled
 * @param userId The user ID to check
 * @returns Whether the user has email notifications enabled
 */
export async function hasEmailNotificationsEnabled(userId: number) {
  try {
    // Get the user's notification preferences from local storage or user settings
    // This is a placeholder implementation
    return true;
  } catch (error) {
    console.error("Error checking notification preferences:", error);
    return false;
  }
} 