-- Add subscription columns to user_settings
ALTER TABLE user_settings ADD COLUMN subscription_plan TEXT NOT NULL DEFAULT 'free';
ALTER TABLE user_settings ADD COLUMN subscription_expiry INTEGER; 