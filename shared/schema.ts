import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from "zod";

// Auth Tables
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name"),
  role: text("role").notNull().default("user"),
  status: text("status").notNull().default("active"),
  last_login: integer("last_login"),
  login_count: integer("login_count").notNull().default(0),
  last_login_ip: text("last_login_ip"),
  last_login_device: text("last_login_device"),
  user_location: text("user_location"),
  is_online: integer("is_online", { mode: "boolean" }).notNull().default(false),
  created_at: integer("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: integer("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  user_id: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires_at: integer("expires_at").notNull()
});

// Password reset tokens
export const resetTokens = sqliteTable("reset_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  user_id: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expires_at: integer("expires_at").notNull(),
  created_at: integer("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
});

// Task Tables
export const tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  user_id: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  due_date: integer("due_date"),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  all_day: integer("all_day", { mode: "boolean" }).notNull().default(false),
  priority: text("priority").notNull().default("medium"),
  parent_task_id: integer("parent_task_id").references((): any => tasks.id, { onDelete: "cascade" }),
  is_recurring: integer("is_recurring", { mode: "boolean" }).notNull().default(false),
  recurrence_pattern: text("recurrence_pattern"),
  recurrence_interval: integer("recurrence_interval"),
  recurrence_end_date: integer("recurrence_end_date"),
  created_at: integer("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: integer("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
});

export const subtasks = sqliteTable("subtasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  user_id: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  task_id: integer("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  position: integer("position").notNull(),
  created_at: integer("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: integer("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
});

// Other Tables
export const notes = sqliteTable("notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  user_id: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content"),
  color: text("color").notNull().default("#ffffff"),
  position: integer("position").notNull(),
  pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
  created_at: integer("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: integer("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
});

export const appointments = sqliteTable("appointments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  user_id: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  start_time: integer("start_time").notNull(),
  end_time: integer("end_time").notNull(),
  all_day: integer("all_day", { mode: "boolean" }).notNull().default(false),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  is_recurring: integer("is_recurring", { mode: "boolean" }).notNull().default(false),
  recurrence_pattern: text("recurrence_pattern"),
  recurrence_interval: integer("recurrence_interval"),
  recurrence_end_date: integer("recurrence_end_date"),
  parent_appointment_id: integer("parent_appointment_id").references((): any => appointments.id, { onDelete: "cascade" }),
  created_at: integer("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: integer("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
});

export const meetings = sqliteTable("meetings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  user_id: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  start_time: integer("start_time").notNull(),
  end_time: integer("end_time").notNull(),
  location: text("location"),
  attendees: text("attendees"),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  is_recurring: integer("is_recurring", { mode: "boolean" }).notNull().default(false),
  recurrence_pattern: text("recurrence_pattern"),
  recurrence_interval: integer("recurrence_interval"),
  recurrence_end_date: integer("recurrence_end_date"),
  parent_meeting_id: integer("parent_meeting_id").references((): any => meetings.id, { onDelete: "cascade" }),
  created_at: integer("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: integer("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
});

export const pomodoroSettings = sqliteTable("pomodoro_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  user_id: integer("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  work_duration: integer("work_duration").notNull().default(25),
  break_duration: integer("break_duration").notNull().default(5),
  long_break_duration: integer("long_break_duration").notNull().default(15),
  sessions_before_long_break: integer("sessions_before_long_break").notNull().default(4),
  created_at: integer("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: integer("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
});

export const userSettings = sqliteTable("user_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  user_id: integer("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  timezone: text("timezone").notNull().default("UTC"),
  work_start_hour: real("work_start_hour").notNull().default(9),
  work_end_hour: real("work_end_hour").notNull().default(17),
  theme: text("theme").notNull().default("light"),
  default_calendar_view: text("default_calendar_view").notNull().default("month"),
  show_notifications: integer("show_notifications", { mode: "boolean" }).notNull().default(true),
  notifications_enabled: integer("notifications_enabled", { mode: "boolean" }).notNull().default(true),
  email_notifications_enabled: integer("email_notifications_enabled", { mode: "boolean" }).notNull().default(false),
  gemini_key: text("gemini_key"),
  gemini_calls_count: integer("gemini_calls_count").default(0),
  is_pro: integer("is_pro", { mode: "boolean" }).default(false),
  subscription_start_date: integer("subscription_start_date"),
  subscription_end_date: integer("subscription_end_date"),
  created_at: integer("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: integer("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
});

// New admin settings table
export const adminSettings = sqliteTable("admin_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gemini_max_free_calls: integer("gemini_max_free_calls").notNull().default(5),
  enable_marketing: integer("enable_marketing", { mode: "boolean" }).notNull().default(false),
  bank_account: text("bank_account"),
  bank_owner: text("bank_owner"),
  subscription_amount: real("subscription_amount").notNull().default(19.99),
  default_currency: text("default_currency").notNull().default("ETB"),
  created_at: integer("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: integer("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
});

export const studySessions = sqliteTable("study_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  user_id: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  subject: text("subject"),
  goal: text("goal"),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  total_focus_time: integer("total_focus_time").notNull().default(0),
  total_breaks: integer("total_breaks").notNull().default(0),
  created_at: integer("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: integer("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
});

export const longNotes = sqliteTable("long_notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  user_id: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content"),
  tags: text("tags"),
  is_favorite: integer("is_favorite", { mode: "boolean" }).notNull().default(false),
  created_at: integer("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: integer("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
});

// New subscription plans table
export const subscriptionPlans = sqliteTable("subscription_plans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  price: real("price").notNull(),
  duration_months: integer("duration_months").notNull(),
  description: text("description"),
  features: text("features"),
  is_active: integer("is_active", { mode: "boolean" }).notNull().default(true),
  created_at: integer("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: integer("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
});

// New subscriptions table
export const subscriptions = sqliteTable("subscriptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  user_id: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  plan_id: integer("plan_id").references(() => subscriptionPlans.id),
  plan: text("plan").notNull().default("free"),
  status: text("status").notNull().default("pending"),
  start_date: integer("start_date").notNull(),
  end_date: integer("end_date"),
  auto_renew: integer("auto_renew", { mode: "boolean" }).notNull().default(false),
  last_renewed: integer("last_renewed"),
  next_billing_date: integer("next_billing_date"),
  created_at: integer("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: integer("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
});

// Updated subscription_payments table to reference subscriptions
export const subscriptionPayments = sqliteTable("subscription_payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  user_id: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("USD"),
  transaction_id: text("transaction_id"),
  deposited_by: text("deposited_by").notNull(),
  deposited_date: integer("deposited_date").notNull(),
  payment_method: text("payment_method").notNull().default("bank_transfer"),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  created_at: integer("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: integer("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
});

// Zod Schemas
export const insertUserSchema = createInsertSchema(users, {
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).nullable(),
  role: z.enum(["admin", "user"]).default("user"),
  status: z.enum(["active", "inactive", "suspended"]).default("active"),
  last_login: z.number().nullable(),
  login_count: z.number().default(0),
  last_login_ip: z.string().nullable(),
  last_login_device: z.string().nullable(),
  is_online: z.boolean().default(false),
});

export const insertTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  completed: z.boolean().default(false),
  due_date: z.number().nullable(),
  all_day: z.boolean().default(false),
  parent_task_id: z.number().nullable(),
  is_recurring: z.boolean().default(false),
  recurrence_pattern: z.enum(["daily", "weekly", "monthly", "yearly"]).nullable(),
  recurrence_interval: z.number().nullable(),
  recurrence_end_date: z.number().nullable(),
});

export const insertSubtaskSchema = z.object({
  task_id: z.number(),
  title: z.string().min(1),
  completed: z.boolean().default(false),
  position: z.number(),
});

export const insertNoteSchema = z.object({
  title: z.string().min(1),
  content: z.string().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#ffffff"),
  position: z.number(),
  pinned: z.boolean().default(false),
});

export const insertAppointmentSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable(),
  start_time: z.number(),
  end_time: z.number(),
  all_day: z.boolean().default(false),
  completed: z.boolean().default(false),
  is_recurring: z.boolean().default(false),
  recurrence_pattern: z.enum(["daily", "weekly", "monthly", "yearly"]).nullable(),
  recurrence_interval: z.number().nullable(),
  recurrence_end_date: z.number().nullable(),
  parent_appointment_id: z.number().nullable(),
}).refine(data => !data.start_time || data.end_time >= data.start_time, {
  message: "End time must be after start time",
  path: ["end_time"]
});

export const insertMeetingSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable(),
  start_time: z.number(),
  end_time: z.number(),
  location: z.string().nullable(),
  attendees: z.string().nullable(),
  completed: z.boolean().default(false),
  is_recurring: z.boolean().default(false),
  recurrence_pattern: z.enum(["daily", "weekly", "monthly", "yearly"]).nullable(),
  recurrence_interval: z.number().nullable(),
  recurrence_end_date: z.number().nullable(),
  parent_meeting_id: z.number().nullable(),
}).refine(data => !data.start_time || data.end_time >= data.start_time, {
  message: "End time must be after start time",
  path: ["end_time"]
});

export const insertPomodoroSettingsSchema = z.object({
  work_duration: z.number().min(1).default(25),
  break_duration: z.number().min(1).default(5),
  long_break_duration: z.number().min(1).default(15),
  sessions_before_long_break: z.number().min(1).default(4),
});

export const insertUserSettingsSchema = z.object({
  timezone: z.string().default("UTC"),
  work_start_hour: z.union([
    z.number().min(0).max(23.99).default(9),
    z.object({
      hour: z.number().min(0).max(23),
      minute: z.number().min(0).max(59)
    })
  ]).default(9),
  work_end_hour: z.union([
    z.number().min(0).max(24).default(17),
    z.object({
      hour: z.number().min(0).max(23),
      minute: z.number().min(0).max(59)
    })
  ]).default(17),
  theme: z.enum(["light", "dark", "system"]).default("light"),
  default_calendar_view: z.enum(["day", "week", "month"]).default("month"),
  show_notifications: z.boolean().default(true),
  notifications_enabled: z.boolean().default(true),
  email_notifications_enabled: z.boolean().default(false),
  gemini_key: z.string().optional(),
  gemini_calls_count: z.number().default(0),
  is_pro: z.boolean().default(false),
  subscription_start_date: z.number().optional(),
  subscription_end_date: z.number().optional(),
});

// New admin settings schema
export const insertAdminSettingsSchema = z.object({
  gemini_max_free_calls: z.number().min(0).default(5),
  enable_marketing: z.boolean().default(false),
  bank_account: z.string().nullable(),
  bank_owner: z.string().nullable(),
  subscription_amount: z.number().positive().default(19.99),
  default_currency: z.string().default("ETB"),
});

export const insertStudySessionSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable(),
  subject: z.string().nullable(),
  goal: z.string().nullable(),
  completed: z.boolean().default(false),
  total_focus_time: z.number().default(0),
  total_breaks: z.number().default(0),
});

export const insertLongNoteSchema = z.object({
  title: z.string().min(1),
  content: z.string().nullable(),
  tags: z.string().nullable(),
  is_favorite: z.boolean().default(false),
});

export const insertSubscriptionPlanSchema = z.object({
  name: z.string().min(1),
  price: z.number().positive(),
  duration_months: z.number().positive(),
  description: z.string().nullable(),
  features: z.string().nullable(),
  is_active: z.boolean().default(true),
});

export const insertSubscriptionSchema = z.object({
  user_id: z.number(),
  plan_id: z.number().optional(),
  plan: z.enum(["free", "pro", "enterprise"]).default("free"),
  status: z.enum(["pending", "active", "inactive", "expired", "cancelled"]).default("pending"),
  start_date: z.number(),
  end_date: z.number().nullable(),
  auto_renew: z.boolean().default(false),
  last_renewed: z.number().nullable(),
  next_billing_date: z.number().nullable(),
});

export const insertSubscriptionPaymentSchema = z.object({
  user_id: z.number(),
  amount: z.number().positive(),
  currency: z.string().default("USD"),
  transaction_id: z.string().nullable(),
  deposited_by: z.string().min(1),
  deposited_date: z.number(),
  payment_method: z.string().default("bank_transfer"),
  status: z.enum(["pending", "approved", "rejected"]).default("pending"),
  notes: z.string().nullable(),
});

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type ResetToken = typeof resetTokens.$inferSelect;
export type NewResetToken = typeof resetTokens.$inferInsert;

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;

export type Subtask = typeof subtasks.$inferSelect;
export type NewSubtask = typeof subtasks.$inferInsert;

export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;

export type Appointment = typeof appointments.$inferSelect;
export type NewAppointment = typeof appointments.$inferInsert;

export type Meeting = typeof meetings.$inferSelect;
export type NewMeeting = typeof meetings.$inferInsert;

export type PomodoroSettings = typeof pomodoroSettings.$inferSelect;
export type NewPomodoroSettings = typeof pomodoroSettings.$inferInsert;

export type UserSettings = typeof userSettings.$inferSelect;
export type NewUserSettings = typeof userSettings.$inferInsert;

// New admin settings types
export type AdminSettings = typeof adminSettings.$inferSelect;
export type NewAdminSettings = typeof adminSettings.$inferInsert;

export type TaskWithSubtasks = Task & {
  has_subtasks?: boolean;
  completed_subtasks?: number;
  total_subtasks?: number;
};

export type StudySession = typeof studySessions.$inferSelect;
export type NewStudySession = typeof studySessions.$inferInsert;

export type LongNote = typeof longNotes.$inferSelect;
export type NewLongNote = typeof longNotes.$inferInsert;

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;

export type SubscriptionPayment = typeof subscriptionPayments.$inferSelect;
export type NewSubscriptionPayment = typeof subscriptionPayments.$inferInsert;

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type NewSubscriptionPlan = typeof subscriptionPlans.$inferInsert;