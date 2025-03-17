-- Create long_notes table for more extensive note-taking
CREATE TABLE long_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  tags TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at INTEGER NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- Add index for faster user-based queries
CREATE INDEX idx_long_notes_user_id ON long_notes(user_id); 