import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { insertTaskSchema, insertNoteSchema, insertAppointmentSchema, insertPomodoroSettingsSchema } from "@shared/schema";

export async function registerRoutes(app: Express) {
  const httpServer = createServer(app);

  // Tasks
  app.get("/api/tasks", async (_req, res) => {
    const tasks = await storage.getTasks();
    res.json(tasks);
  });

  app.post("/api/tasks", async (req, res) => {
    const task = insertTaskSchema.parse(req.body);
    const newTask = await storage.createTask(task);
    res.json(newTask);
  });

  app.patch("/api/tasks/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const task = insertTaskSchema.partial().parse(req.body);
    const updatedTask = await storage.updateTask(id, task);
    res.json(updatedTask);
  });

  app.delete("/api/tasks/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.deleteTask(id);
    res.status(204).end();
  });

  // Notes
  app.get("/api/notes", async (_req, res) => {
    const notes = await storage.getNotes();
    res.json(notes);
  });

  app.post("/api/notes", async (req, res) => {
    const note = insertNoteSchema.parse(req.body);
    const newNote = await storage.createNote(note);
    res.json(newNote);
  });

  app.patch("/api/notes/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const note = insertNoteSchema.partial().parse(req.body);
    const updatedNote = await storage.updateNote(id, note);
    res.json(updatedNote);
  });

  app.delete("/api/notes/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.deleteNote(id);
    res.status(204).end();
  });

  // Appointments
  app.get("/api/appointments", async (_req, res) => {
    const appointments = await storage.getAppointments();
    res.json(appointments);
  });

  app.post("/api/appointments", async (req, res) => {
    const appointment = insertAppointmentSchema.parse(req.body);
    const newAppointment = await storage.createAppointment(appointment);
    res.json(newAppointment);
  });

  app.patch("/api/appointments/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const appointment = insertAppointmentSchema.partial().parse(req.body);
    const updatedAppointment = await storage.updateAppointment(id, appointment);
    res.json(updatedAppointment);
  });

  app.delete("/api/appointments/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.deleteAppointment(id);
    res.status(204).end();
  });

  // Pomodoro Settings
  app.get("/api/pomodoro-settings", async (_req, res) => {
    const settings = await storage.getPomodoroSettings();
    res.json(settings);
  });

  app.patch("/api/pomodoro-settings", async (req, res) => {
    const settings = insertPomodoroSettingsSchema.parse(req.body);
    const updatedSettings = await storage.updatePomodoroSettings(settings);
    res.json(updatedSettings);
  });

  return httpServer;
}
