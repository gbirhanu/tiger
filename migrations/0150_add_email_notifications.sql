-- Add email_notifications_enabled column to user_settings table
ALTER TABLE user_settings ADD COLUMN email_notifications_enabled INTEGER NOT NULL DEFAULT 1; 