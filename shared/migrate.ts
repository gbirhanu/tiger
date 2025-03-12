import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "./db";

// This will run migrations on the database, skipping the ones already applied
console.log("Running migrations...");
migrate(db, { migrationsFolder: "./migrations" });
console.log("Migrations completed!"); 