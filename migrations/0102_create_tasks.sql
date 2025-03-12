-- Create tasks table
CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    due_date INTEGER,
    completed INTEGER NOT NULL DEFAULT 0,
    all_day INTEGER NOT NULL DEFAULT 0,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    parent_task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    is_recurring INTEGER NOT NULL DEFAULT 0,
    recurrence_pattern TEXT,
    recurrence_interval INTEGER,
    recurrence_end_date INTEGER,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK ((is_recurring = 0) OR (is_recurring = 1 AND recurrence_pattern IN ('daily', 'weekly', 'monthly', 'yearly')))
);

-- Create index for tasks
CREATE INDEX idx_tasks_user_id ON tasks(user_id); 