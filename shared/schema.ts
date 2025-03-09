import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  completed: boolean("completed").default(false).notNull(),
  dueDate: timestamp("due_date"),
  priority: text("priority").notNull().default("medium"),
});

export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  color: text("color").notNull().default("#ffffff"),
  position: integer("position").notNull(),
});

export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
});

export const pomodoroSettings = pgTable("pomodoro_settings", {
  id: serial("id").primaryKey(),
  workDuration: integer("work_duration").notNull().default(25),
  breakDuration: integer("break_duration").notNull().default(5),
  longBreakDuration: integer("long_break_duration").notNull().default(15),
  sessionsBeforeLongBreak: integer("sessions_before_long_break").notNull().default(4),
});

export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true });
export const insertNoteSchema = createInsertSchema(notes).omit({ id: true });
export const insertAppointmentSchema = createInsertSchema(appointments).omit({ id: true });
export const insertPomodoroSettingsSchema = createInsertSchema(pomodoroSettings).omit({ id: true });

export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Note = typeof notes.$inferSelect;
export type InsertNote = z.infer<typeof insertNoteSchema>;
export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type PomodoroSettings = typeof pomodoroSettings.$inferSelect;
export type InsertPomodoroSettings = z.infer<typeof insertPomodoroSettingsSchema>;
