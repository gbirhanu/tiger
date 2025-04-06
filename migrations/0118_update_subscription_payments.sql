-- First, create a temporary table to hold the original subscription_payments data
CREATE TABLE "temp_subscription_payments" AS SELECT * FROM "subscription_payments";

-- Add the subscription_id column to subscription_payments and remove subscription-specific columns
CREATE TABLE "new_subscription_payments" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "subscription_id" INTEGER REFERENCES "subscriptions"("id") ON DELETE SET NULL,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "amount" REAL NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "transaction_id" TEXT,
  "deposited_by" TEXT NOT NULL,
  "deposited_date" INTEGER NOT NULL,
  "payment_method" TEXT NOT NULL DEFAULT 'bank_transfer',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "notes" TEXT,
  "created_at" INTEGER NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  "updated_at" INTEGER NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- Create indexes for the new table
CREATE INDEX IF NOT EXISTS "subscription_payments_user_id_idx" ON "new_subscription_payments" ("user_id");
CREATE INDEX IF NOT EXISTS "subscription_payments_subscription_id_idx" ON "new_subscription_payments" ("subscription_id");

-- Create the update trigger for the new table
CREATE TRIGGER IF NOT EXISTS "subscription_payments_updated_at"
AFTER UPDATE ON "new_subscription_payments"
FOR EACH ROW
BEGIN
  UPDATE "new_subscription_payments" SET "updated_at" = CURRENT_TIMESTAMP WHERE "id" = OLD."id";
END;

-- For each payment in the old table, create a new subscription record and update the payment
INSERT INTO "subscriptions" ("user_id", "plan", "status", "start_date", "end_date", "created_at", "updated_at")
SELECT 
  "user_id",
  "subscription_plan",
  CASE 
    WHEN (SELECT "subscription_plan" FROM "user_settings" WHERE "user_settings"."user_id" = "temp_subscription_payments"."user_id") = "subscription_plan" THEN 'active'
    ELSE 'inactive'
  END,
  "deposited_date",
  CASE 
    WHEN "duration_months" IS NOT NULL THEN "deposited_date" + ("duration_months" * 30 * 24 * 60 * 60)
    ELSE NULL
  END,
  "created_at",
  "updated_at"
FROM "temp_subscription_payments"
WHERE "status" = 'approved';

-- Insert data into the new payments table
INSERT INTO "new_subscription_payments" (
  "id", "subscription_id", "user_id", "amount", "currency", 
  "transaction_id", "deposited_by", "deposited_date", "payment_method", 
  "status", "notes", "created_at", "updated_at"
)
SELECT 
  "temp_sp"."id",
  (SELECT "s"."id" FROM "subscriptions" "s" 
   WHERE "s"."user_id" = "temp_sp"."user_id" 
   AND "s"."plan" = "temp_sp"."subscription_plan"
   AND "s"."start_date" = "temp_sp"."deposited_date"
   LIMIT 1),
  "temp_sp"."user_id",
  "temp_sp"."amount",
  "temp_sp"."currency",
  "temp_sp"."transaction_id",
  "temp_sp"."deposited_by",
  "temp_sp"."deposited_date",
  "temp_sp"."payment_method",
  "temp_sp"."status",
  "temp_sp"."notes",
  "temp_sp"."created_at",
  "temp_sp"."updated_at"
FROM "temp_subscription_payments" "temp_sp";

-- Drop the old table and rename the new one
DROP TABLE "subscription_payments";
ALTER TABLE "new_subscription_payments" RENAME TO "subscription_payments";

-- Clean up temporary table
DROP TABLE "temp_subscription_payments";

-- Update user_settings based on active subscriptions
UPDATE "user_settings"
SET "subscription_plan" = (
  SELECT "s"."plan" FROM "subscriptions" "s"
  WHERE "s"."user_id" = "user_settings"."user_id"
  AND "s"."status" = 'active'
  AND ("s"."end_date" IS NULL OR "s"."end_date" > CURRENT_TIMESTAMP)
  ORDER BY "s"."created_at" DESC
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM "subscriptions" "s"
  WHERE "s"."user_id" = "user_settings"."user_id"
  AND "s"."status" = 'active'
  AND ("s"."end_date" IS NULL OR "s"."end_date" > CURRENT_TIMESTAMP)
); 