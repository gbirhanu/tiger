-- Complete Tiger App Schema Setup
-- This migration consolidates all table definitions in one file for easy setup

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  status TEXT NOT NULL DEFAULT 'active',
  last_login INTEGER,
  login_count INTEGER NOT NULL DEFAULT 0,
  last_login_ip TEXT,
  last_login_device TEXT,
  user_location TEXT,
  is_online INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Sessions Table
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

-- Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date INTEGER,
  completed INTEGER NOT NULL DEFAULT 0,
  all_day INTEGER NOT NULL DEFAULT 0,
  priority TEXT NOT NULL DEFAULT 'medium',
  parent_task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  is_recurring INTEGER NOT NULL DEFAULT 0,
  recurrence_pattern TEXT,
  recurrence_interval INTEGER,
  recurrence_end_date INTEGER,
  created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Subtasks Table
CREATE TABLE IF NOT EXISTS subtasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Notes Table
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  color TEXT NOT NULL DEFAULT '#ffffff',
  position INTEGER NOT NULL,
  pinned INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Appointments Table
CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time INTEGER NOT NULL,
  end_time INTEGER NOT NULL,
  all_day INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  is_recurring INTEGER NOT NULL DEFAULT 0,
  recurrence_pattern TEXT,
  recurrence_interval INTEGER,
  recurrence_end_date INTEGER,
  parent_appointment_id INTEGER REFERENCES appointments(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Meetings Table
CREATE TABLE IF NOT EXISTS meetings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time INTEGER NOT NULL,
  end_time INTEGER NOT NULL,
  location TEXT,
  attendees TEXT,
  completed INTEGER NOT NULL DEFAULT 0,
  is_recurring INTEGER NOT NULL DEFAULT 0,
  recurrence_pattern TEXT,
  recurrence_interval INTEGER,
  recurrence_end_date INTEGER,
  parent_meeting_id INTEGER REFERENCES meetings(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Pomodoro Settings Table
CREATE TABLE IF NOT EXISTS pomodoro_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  work_duration INTEGER NOT NULL DEFAULT 25,
  break_duration INTEGER NOT NULL DEFAULT 5,
  long_break_duration INTEGER NOT NULL DEFAULT 15,
  sessions_before_long_break INTEGER NOT NULL DEFAULT 4,
  created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- User Settings Table
CREATE TABLE IF NOT EXISTS user_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  work_start_hour REAL NOT NULL DEFAULT 9,
  work_end_hour REAL NOT NULL DEFAULT 17,
  theme TEXT NOT NULL DEFAULT 'light',
  default_calendar_view TEXT NOT NULL DEFAULT 'month',
  show_notifications INTEGER NOT NULL DEFAULT 1,
  notifications_enabled INTEGER NOT NULL DEFAULT 1,
  gemini_key TEXT,
  gemini_calls_count INTEGER DEFAULT 0,
  is_pro INTEGER DEFAULT 0,
  subscription_start_date INTEGER,
  subscription_end_date INTEGER,
  created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Admin Settings Table
CREATE TABLE IF NOT EXISTS admin_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gemini_max_free_calls INTEGER NOT NULL DEFAULT 5,
  enable_marketing INTEGER NOT NULL DEFAULT 0,
  bank_account TEXT,
  bank_owner TEXT,
  subscription_amount REAL NOT NULL DEFAULT 19.99,
  default_currency TEXT NOT NULL DEFAULT 'ETB',
  created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Study Sessions Table
CREATE TABLE IF NOT EXISTS study_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  subject TEXT,
  goal TEXT,
  completed INTEGER NOT NULL DEFAULT 0,
  total_focus_time INTEGER NOT NULL DEFAULT 0,
  total_breaks INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Long Notes Table
CREATE TABLE IF NOT EXISTS long_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  tags TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Subscription Plans Table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  duration_months INTEGER NOT NULL,
  description TEXT,
  features TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Subscriptions Table
CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id INTEGER REFERENCES subscription_plans(id),
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'pending',
  start_date INTEGER NOT NULL,
  end_date INTEGER,
  auto_renew INTEGER NOT NULL DEFAULT 0,
  last_renewed INTEGER,
  next_billing_date INTEGER,
  created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Subscription Payments Table
CREATE TABLE IF NOT EXISTS subscription_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  transaction_id TEXT,
  deposited_by TEXT NOT NULL,
  deposited_date INTEGER NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'bank_transfer',
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Insert default admin settings
INSERT INTO admin_settings (gemini_max_free_calls, enable_marketing, subscription_amount, default_currency)
VALUES (5, 0, 19.99, 'ETB');

-- Insert default subscription plans
INSERT INTO subscription_plans (name, price, duration_months, description, features, is_active)
VALUES 
('Monthly Pro', 19.99, 1, 'Monthly premium subscription', 'Unlimited AI usage, Priority support, Advanced features', 1),
('Yearly Pro', 199.99, 12, 'Yearly premium subscription with 16% discount', 'Unlimited AI usage, Priority support, Advanced features, Annual billing', 1),
('Enterprise', 49.99, 1, 'For teams and businesses', 'All Pro features, Team management, API access, Dedicated support', 1); 