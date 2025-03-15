-- Update work_start_hour and work_end_hour columns to REAL type
PRAGMA foreign_keys=OFF;

-- Create a temporary table with the new schema
CREATE TABLE user_settings_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    timezone TEXT NOT NULL DEFAULT 'UTC',
    work_start_hour REAL NOT NULL DEFAULT 9.0,
    work_end_hour REAL NOT NULL DEFAULT 17.0,
    theme TEXT NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'system')),
    default_calendar_view TEXT NOT NULL DEFAULT 'month' CHECK (default_calendar_view IN ('day', 'week', 'month')),
    show_notifications INTEGER NOT NULL DEFAULT 1,
    notifications_enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (work_start_hour >= 0 AND work_start_hour < 24 AND work_end_hour > work_start_hour AND work_end_hour <= 24)
);

-- Copy data from the old table to the new table
INSERT INTO user_settings_new 
SELECT id, user_id, timezone, work_start_hour, work_end_hour, theme, default_calendar_view, 
       show_notifications, notifications_enabled, created_at, updated_at
FROM user_settings;

-- Drop the old table
DROP TABLE user_settings;

-- Rename the new table to the original name
ALTER TABLE user_settings_new RENAME TO user_settings;

PRAGMA foreign_keys=ON; 