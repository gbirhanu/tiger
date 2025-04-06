-- Add gemini_key and gemini_calls_count column to user_settings
ALTER TABLE user_settings ADD COLUMN gemini_key TEXT;
ALTER TABLE user_settings ADD COLUMN gemini_calls_count INTEGER DEFAULT 0; 