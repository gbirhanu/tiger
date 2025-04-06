-- Create admin settings table
CREATE TABLE IF NOT EXISTS admin_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gemini_max_free_calls INTEGER DEFAULT 5,
  enable_marketing INTEGER DEFAULT 0,
  bank_account TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Add a default admin settings record
INSERT INTO admin_settings (gemini_max_free_calls, enable_marketing, bank_account)
VALUES (5, 0, '');

-- Remove admin settings fields from user_settings table
ALTER TABLE user_settings DROP COLUMN gemini_max_free_calls;
ALTER TABLE user_settings DROP COLUMN enable_marketing;
ALTER TABLE user_settings DROP COLUMN bank_account; 