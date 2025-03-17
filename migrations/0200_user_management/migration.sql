-- Add new columns to users table
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN last_login INTEGER;
ALTER TABLE users ADD COLUMN login_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN last_login_ip TEXT;
ALTER TABLE users ADD COLUMN last_login_device TEXT;
ALTER TABLE users ADD COLUMN is_online INTEGER NOT NULL DEFAULT 0;

-- Update existing users to have admin role for the first user
UPDATE users SET role = 'admin' WHERE id = 1; 