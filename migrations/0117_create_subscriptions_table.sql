-- Create new subscriptions table
CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "plan" TEXT NOT NULL DEFAULT 'free',
  "status" TEXT NOT NULL DEFAULT 'active',
  "start_date" INTEGER NOT NULL,
  "end_date" INTEGER,
  "auto_renew" INTEGER NOT NULL DEFAULT 0,
  "last_renewed" INTEGER,
  "next_billing_date" INTEGER,
  "created_at" INTEGER NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  "updated_at" INTEGER NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- Create index for faster lookups by user_id
CREATE INDEX IF NOT EXISTS "subscriptions_user_id_idx" ON "subscriptions" ("user_id");

-- Create a trigger to automatically update the updated_at timestamp
CREATE TRIGGER IF NOT EXISTS "subscriptions_updated_at"
AFTER UPDATE ON "subscriptions"
FOR EACH ROW
BEGIN
  UPDATE "subscriptions" SET "updated_at" = CURRENT_TIMESTAMP WHERE "id" = OLD."id";
END; 