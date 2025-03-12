-- Create pomodoro_settings table
CREATE TABLE pomodoro_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    work_duration INTEGER NOT NULL DEFAULT 25,
    break_duration INTEGER NOT NULL DEFAULT 5,
    long_break_duration INTEGER NOT NULL DEFAULT 15,
    sessions_before_long_break INTEGER NOT NULL DEFAULT 4,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (work_duration > 0 AND break_duration > 0 AND long_break_duration > 0 AND sessions_before_long_break > 0)
); 