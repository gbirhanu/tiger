-- Create user_settings table
CREATE TABLE user_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    timezone TEXT NOT NULL DEFAULT 'UTC',
    work_start_hour INTEGER NOT NULL DEFAULT 9,
    work_end_hour INTEGER NOT NULL DEFAULT 17,
    theme TEXT NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'system')),
    default_calendar_view TEXT NOT NULL DEFAULT 'month' CHECK (default_calendar_view IN ('day', 'week', 'month')),
    show_notifications INTEGER NOT NULL DEFAULT 1,
    notifications_enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (work_start_hour >= 0 AND work_start_hour < 24 AND work_end_hour > work_start_hour AND work_end_hour <= 24)
); 