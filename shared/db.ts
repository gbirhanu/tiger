import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Get the Turso DB URL and auth token from environment variables
const tursoUrl = process.env.TURSO_DATABASE_URL 
const tursoAuthToken = process.env.TURSO_AUTH_TOKEN 

console.log('📦 Connecting to Turso database with URL:', tursoUrl);

// Initialize Turso SQLite client
const client = createClient({
  url: tursoUrl || "libsql://tiger-gadeba.aws-eu-west-1.turso.io",
  authToken: tursoAuthToken,
});

// Create Drizzle database instance
export const db = drizzle(client, { schema });

// Export schema for use in other files
export { schema }; 