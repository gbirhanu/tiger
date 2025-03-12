-- Create subtasks table
CREATE TABLE subtasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for subtasks
CREATE INDEX idx_subtasks_user_id ON subtasks(user_id);
CREATE INDEX idx_subtasks_task_id ON subtasks(task_id); 