-- Change the default value of email_notifications_enabled to 0 (false) in user_settings table
-- This will affect new rows but won't change existing data
PRAGMA foreign_keys=OFF;

CREATE TABLE user_settings_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    timezone TEXT NOT NULL DEFAULT 'UTC',
    work_start_hour REAL NOT NULL DEFAULT 9.0,
    work_end_hour REAL NOT NULL DEFAULT 17.0,
    theme TEXT NOT NULL DEFAULT 'light',
    default_calendar_view TEXT NOT NULL DEFAULT 'month',
    show_notifications INTEGER NOT NULL DEFAULT 1,
    notifications_enabled INTEGER NOT NULL DEFAULT 1,
    email_notifications_enabled INTEGER NOT NULL DEFAULT 0,
    gemini_key TEXT,
    gemini_calls_count INTEGER DEFAULT 0,
    is_pro INTEGER DEFAULT 0,
    subscription_start_date INTEGER,
    subscription_end_date INTEGER,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Copy existing data from the old table to the new table
INSERT INTO user_settings_new SELECT * FROM user_settings;

-- Drop the old table
DROP TABLE user_settings;

-- Rename the new table to the original name
ALTER TABLE user_settings_new RENAME TO user_settings;

PRAGMA foreign_keys=ON; 