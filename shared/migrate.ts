import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "./db";

// This will run migrations on the database, skipping the ones already applied
console.log("Running migrations...");
migrate(db, { migrationsFolder: "./migrations" })
  .then(() => {
    console.log("Migrations completed successfully");
    process.exit(0);
  })
  .catch(err => {
    console.error("Error running migrations:", err);
    process.exit(1);
  });
