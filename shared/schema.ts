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
  parent_task_id: integer("parent_task_id").references(() => tasks.id, { onDelete: "cascade" }),
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
  gemini_key: text("gemini_key"),
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
});

export const insertAppointmentSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable(),
  start_time: z.number(),
  end_time: z.number().refine((val, ctx) => {
    if (ctx.parent.start_time && val < ctx.parent.start_time) {
      return false;
    }
    return true;
  }, "End time must be after start time"),
  all_day: z.boolean().default(false),
});

export const insertMeetingSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable(),
  start_time: z.number(),
  end_time: z.number().refine((val, ctx) => {
    if (ctx.parent.start_time && val < ctx.parent.start_time) {
      return false;
    }
    return true;
  }, "End time must be after start time"),
  location: z.string().nullable(),
  attendees: z.string().nullable(),
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
  gemini_key: z.string().optional(),
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

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

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

export type TaskWithSubtasks = Task & {
  has_subtasks?: boolean;
  completed_subtasks?: number;
  total_subtasks?: number;
};

export type StudySession = typeof studySessions.$inferSelect;
export type NewStudySession = typeof studySessions.$inferInsert;

export type LongNote = typeof longNotes.$inferSelect;
export type NewLongNote = typeof longNotes.$inferInsert;