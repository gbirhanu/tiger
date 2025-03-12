-- Create appointments table
CREATE TABLE appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    start_time INTEGER NOT NULL,
    end_time INTEGER NOT NULL CHECK (end_time >= start_time),
    all_day INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create index for appointments
CREATE INDEX idx_appointments_user_id ON appointments(user_id); 