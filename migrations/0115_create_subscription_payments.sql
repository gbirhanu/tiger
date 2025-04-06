-- Create subscription_payments table
CREATE TABLE IF NOT EXISTS subscription_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  transaction_id TEXT,
  deposited_by TEXT NOT NULL,
  deposited_date INTEGER NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'bank_transfer',
  status TEXT NOT NULL DEFAULT 'pending',
  subscription_plan TEXT NOT NULL DEFAULT 'pro',
  duration_months INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Add index for user_id to speed up lookups
CREATE INDEX IF NOT EXISTS idx_subscription_payments_user_id ON subscription_payments(user_id);

-- Add index for status to quickly find pending payments
CREATE INDEX IF NOT EXISTS idx_subscription_payments_status ON subscription_payments(status); 