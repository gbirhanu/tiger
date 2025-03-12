-- Create meetings table
CREATE TABLE meetings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    start_time INTEGER NOT NULL,
    end_time INTEGER NOT NULL CHECK (end_time >= start_time),
    location TEXT,
    attendees TEXT,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create index for meetings
CREATE INDEX idx_meetings_user_id ON meetings(user_id); 