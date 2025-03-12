import axios from "axios";
import type { Task, Note, Appointment, Meeting, PomodoroSettings, UserSettings } from "../../../shared/schema";

// Import the shared token management functions from queryClient
import { setAuthToken as setToken, getAuthToken as getToken } from './queryClient';

// Re-export the token functions for backwards compatibility
export const setAuthToken = setToken;
export const getAuthToken = getToken;
const api = axios.create({
  baseURL: "http://localhost:3000/api",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Allow cookies to be sent with requests
});
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    console.log("Using session token:", token ? "token-exists" : "no-token");
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle authentication errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle unauthorized errors
    if (error.response && error.response.status === 401) {
      console.error("Authentication failed - Unauthorized access");
      // Clear token when unauthorized
      setToken(null);
      
      // You could redirect to login page here
      // window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
// Tasks
//add auth

export const getTasks = () => api.get<Task[]>("/tasks").then((res) => res.data);
export const createTask = (task: Omit<Task, "id">) => api.post<Task>("/tasks", task).then((res) => res.data);
export const updateTask = (id: number, task: Partial<Task>) => api.patch<Task>(`/tasks/${id}`, task).then((res) => res.data);
export const deleteTask = (id: number) => api.delete(`/tasks/${id}`).then((res) => res.data);
export const generateSubtasks = (prompt: string) => api.post<{ subtasks: string[] }>("/generate-subtasks", { prompt }).then((res) => res.data);

// Notes
export const getNotes = () => api.get<Note[]>("/notes").then((res) => res.data);
export const createNote = (note: Omit<Note, "id">) => api.post<Note>("/notes", note).then((res) => res.data);

// Appointments
export const getAppointments = () => api.get<Appointment[]>("/appointments").then((res) => res.data);
export const createAppointment = (appointment: Omit<Appointment, "id">) => 
  api.post<Appointment>("/appointments", appointment).then((res) => res.data);

// Meetings
export const getMeetings = () => api.get<Meeting[]>("/meetings").then((res) => res.data);
export const createMeeting = (meeting: Omit<Meeting, "id">) => 
  api.post<Meeting>("/meetings", meeting).then((res) => res.data);

// Settings
export const getPomodoroSettings = () => 
  api.get<PomodoroSettings>("/settings/pomodoro")
    .then((res) => res.data)
    .catch((error) => {
      console.error("Failed to fetch pomodoro settings:", error);
      throw error;
    });
export const updatePomodoroSettings = (settings: Partial<PomodoroSettings>) => 
  api.put<PomodoroSettings>("/settings/pomodoro", settings)
    .then((res) => res.data)
    .catch((error) => {
      console.error("Failed to update pomodoro settings:", error);
      throw error;
    });

export const getUserSettings = () => 
  api.get<UserSettings>("/user-settings").then((res) => res.data);
export const updateUserSettings = (settings: Partial<UserSettings>) => 
  api.put<UserSettings>("/user-settings", settings).then((res) => res.data); 