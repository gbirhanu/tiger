import {
  type Task,
  type InsertTask,
  type Note,
  type InsertNote,
  type Appointment,
  type InsertAppointment,
  type Meeting,
  type InsertMeeting,
  type PomodoroSettings,
  type InsertPomodoroSettings,
  type UserSettings,
  type InsertUserSettings,
} from "@shared/schema";

export interface IStorage {
  // Tasks
  getTasks(): Promise<Task[]>;
  getTask(id: number): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, task: Partial<InsertTask>): Promise<Task>;
  deleteTask(id: number): Promise<void>;

  // Notes
  getNotes(): Promise<Note[]>;
  createNote(note: InsertNote): Promise<Note>;
  updateNote(id: number, note: Partial<InsertNote>): Promise<Note>;
  deleteNote(id: number): Promise<void>;

  // Appointments
  getAppointments(): Promise<Appointment[]>;
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  updateAppointment(id: number, appointment: Partial<InsertAppointment>): Promise<Appointment>;
  deleteAppointment(id: number): Promise<void>;

  // Meetings
  getMeetings(): Promise<Meeting[]>;
  createMeeting(meeting: InsertMeeting): Promise<Meeting>;
  updateMeeting(id: number, meeting: Partial<InsertMeeting>): Promise<Meeting>;
  deleteMeeting(id: number): Promise<void>;

  // Pomodoro Settings
  getPomodoroSettings(): Promise<PomodoroSettings>;
  updatePomodoroSettings(settings: InsertPomodoroSettings): Promise<PomodoroSettings>;

  // User Settings
  getUserSettings(): Promise<UserSettings>;
  updateUserSettings(settings: InsertUserSettings): Promise<UserSettings>;
}

export class MemStorage implements IStorage {
  private tasks: Map<number, Task>;
  private notes: Map<number, Note>;
  private appointments: Map<number, Appointment>;
  private meetings: Map<number, Meeting>;
  private pomodoroSettings: PomodoroSettings;
  private currentId: { [key: string]: number };
  private userSettings: UserSettings;

  constructor() {
    this.tasks = new Map();
    this.notes = new Map();
    this.appointments = new Map();
    this.meetings = new Map();
    this.currentId = { tasks: 1, notes: 1, appointments: 1, meetings: 1 };
    this.pomodoroSettings = {
      id: 1,
      workDuration: 25,
      breakDuration: 5,
      longBreakDuration: 15,
      sessionsBeforeLongBreak: 4,
    };
    this.userSettings = {
      id: 1,
      timezone: "UTC",
      workStartHour: 9,
      workEndHour: 17,
      theme: "system",
      defaultCalendarView: "month",
      showNotifications: true,
    };
  }

  // Tasks
  async getTasks(): Promise<Task[]> {
    return Array.from(this.tasks.values());
  }

  async getTask(id: number): Promise<Task | undefined> {
    return this.tasks.get(id);
  }

  async createTask(task: InsertTask): Promise<Task> {
    const id = this.currentId.tasks++;
    const newTask = { ...task, id };
    this.tasks.set(id, newTask);
    return newTask;
  }

  async updateTask(id: number, task: Partial<InsertTask>): Promise<Task> {
    const existingTask = this.tasks.get(id);
    if (!existingTask) throw new Error("Task not found");
    const updatedTask = { ...existingTask, ...task };
    this.tasks.set(id, updatedTask);
    return updatedTask;
  }

  async deleteTask(id: number): Promise<void> {
    this.tasks.delete(id);
  }

  // Notes
  async getNotes(): Promise<Note[]> {
    return Array.from(this.notes.values());
  }

  async createNote(note: InsertNote): Promise<Note> {
    const id = this.currentId.notes++;
    const newNote = { ...note, id };
    this.notes.set(id, newNote);
    return newNote;
  }

  async updateNote(id: number, note: Partial<InsertNote>): Promise<Note> {
    const existingNote = this.notes.get(id);
    if (!existingNote) throw new Error("Note not found");
    const updatedNote = { ...existingNote, ...note };
    this.notes.set(id, updatedNote);
    return updatedNote;
  }

  async deleteNote(id: number): Promise<void> {
    this.notes.delete(id);
  }

  // Appointments
  async getAppointments(): Promise<Appointment[]> {
    return Array.from(this.appointments.values());
  }

  async createAppointment(appointment: InsertAppointment): Promise<Appointment> {
    const id = this.currentId.appointments++;
    const newAppointment = { ...appointment, id };
    this.appointments.set(id, newAppointment);
    return newAppointment;
  }

  async updateAppointment(
    id: number,
    appointment: Partial<InsertAppointment>,
  ): Promise<Appointment> {
    const existingAppointment = this.appointments.get(id);
    if (!existingAppointment) throw new Error("Appointment not found");
    const updatedAppointment = { ...existingAppointment, ...appointment };
    this.appointments.set(id, updatedAppointment);
    return updatedAppointment;
  }

  async deleteAppointment(id: number): Promise<void> {
    this.appointments.delete(id);
  }

  // Meetings
  async getMeetings(): Promise<Meeting[]> {
    return Array.from(this.meetings.values());
  }

  async createMeeting(meeting: InsertMeeting): Promise<Meeting> {
    const id = this.currentId.meetings++;
    const newMeeting = { ...meeting, id };
    this.meetings.set(id, newMeeting);
    return newMeeting;
  }

  async updateMeeting(
    id: number,
    meeting: Partial<InsertMeeting>,
  ): Promise<Meeting> {
    const existingMeeting = this.meetings.get(id);
    if (!existingMeeting) throw new Error("Meeting not found");
    const updatedMeeting = { ...existingMeeting, ...meeting };
    this.meetings.set(id, updatedMeeting);
    return updatedMeeting;
  }

  async deleteMeeting(id: number): Promise<void> {
    this.meetings.delete(id);
  }

  // Pomodoro Settings
  async getPomodoroSettings(): Promise<PomodoroSettings> {
    return this.pomodoroSettings;
  }

  async updatePomodoroSettings(settings: InsertPomodoroSettings): Promise<PomodoroSettings> {
    this.pomodoroSettings = { ...this.pomodoroSettings, ...settings };
    return this.pomodoroSettings;
  }

  // User Settings
  async getUserSettings(): Promise<UserSettings> {
    return this.userSettings;
  }

  async updateUserSettings(settings: InsertUserSettings): Promise<UserSettings> {
    this.userSettings = { ...this.userSettings, ...settings };
    return this.userSettings;
  }
}

export const storage = new MemStorage();