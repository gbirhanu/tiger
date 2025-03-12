-- Create notes table
CREATE TABLE notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT,
    color TEXT NOT NULL DEFAULT '#ffffff',
    position INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create index for notes
CREATE INDEX idx_notes_user_id ON notes(user_id); 