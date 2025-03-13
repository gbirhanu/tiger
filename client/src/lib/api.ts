import axios, { InternalAxiosRequestConfig, AxiosResponse, AxiosError } from "axios";
import type { Task, Note, Appointment, Meeting, PomodoroSettings, UserSettings, Subtask } from "../../../shared/schema";

// Import the shared token management functions from queryClient
import { setAuthToken as setToken, getAuthToken as getToken } from './queryClient';

// Re-export the token functions for backwards compatibility
export const setAuthToken = setToken;
export const getAuthToken = getToken;

// Create axios instance with consistent configuration
const api = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Allow cookies to be sent with requests
});

// Add request interceptor to include auth token in every request
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getToken();
    if (token) {
      // Ensure token is properly formatted with 'Bearer ' prefix
      config.headers = config.headers || {};
      config.headers["Authorization"] = `Bearer ${token}`;
      console.log("Request with auth token:", config.url);
    } else {
      console.warn("Request without auth token:", config.url);
    }
    return config;
  },
  (error: AxiosError) => {
    console.error("Request interceptor error:", error);
    return Promise.reject(error);
  }
);

// Add response interceptor to handle authentication errors
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error: AxiosError) => {
    // Handle unauthorized errors
    if (error.response && error.response.status === 401) {
      console.error("Authentication failed - Unauthorized access:", error.config?.url);
      // Clear token when unauthorized
      setToken(null);
    }
    return Promise.reject(error);
  }
);

// Get current user information
export const getCurrentUser = () => api.get<{ id: number; email: string; name: string }>("/auth/current-user")
  .then((res: AxiosResponse<{ id: number; email: string; name: string }>) => res.data);

// Tasks API endpoints
export const getTasks = () => api.get<Task[]>("/tasks").then((res: AxiosResponse<Task[]>) => res.data);
export const getTask = (id: number) => api.get<Task>(`/tasks/${id}`).then((res: AxiosResponse<Task>) => res.data);
export const createTask = (task: Omit<Task, "id">) => {
  // Allow user_id to be passed through instead of relying on the token
  return api.post<Task>("/tasks", task).then((res: AxiosResponse<Task>) => res.data);
};
export const updateTask = (task: Partial<Task> & { id: number }) => 
  api.patch<Task>(`/tasks/${task.id}`, task).then((res: AxiosResponse<Task>) => res.data);
export const deleteTask = (id: number) => api.delete(`/tasks/${id}`).then((res: AxiosResponse<any>) => res.data);

// Subtasks API endpoints
export const getSubtasks = (taskId: number) => api.get<Subtask[]>(`/tasks/${taskId}/subtasks`).then((res: AxiosResponse<Subtask[]>) => res.data);
export const createSubtasks = (taskId: number, subtasks: Array<{ title: string; completed: boolean }>) => 
  api.post<Subtask[]>(`/tasks/${taskId}/subtasks`, { 
    subtasks: subtasks.map(subtask => ({
      ...subtask,
      task_id: taskId,
      user_id: 2, // Explicitly set user_id to match authenticated user ID
    }))
  }).then((res: AxiosResponse<Subtask[]>) => res.data);
export const updateSubtask = (taskId: number, subtaskId: number, data: Partial<Subtask>) => 
  api.patch<Subtask>(`/tasks/${taskId}/subtasks/${subtaskId}`, data).then((res: AxiosResponse<Subtask>) => res.data);
export const deleteSubtask = (taskId: number, subtaskId: number) => 
  api.delete(`/tasks/${taskId}/subtasks/${subtaskId}`).then((res: AxiosResponse<any>) => res.data);
export const getTasksWithSubtasks = () => api.get<number[]>("/tasks/subtasks").then((res: AxiosResponse<number[]>) => res.data);

// Notes API endpoints
export const getNotes = () => api.get<Note[]>("/notes").then((res: AxiosResponse<Note[]>) => res.data);
export const getNote = (id: number) => api.get<Note>(`/notes/${id}`).then((res: AxiosResponse<Note>) => res.data);
export const createNote = (note: Omit<Note, "id" | "user_id">) => {
  // The server will set the user_id based on the authentication token
  return api.post<Note>("/notes", note).then((res: AxiosResponse<Note>) => res.data);
};
export const updateNote = (id: number, note: Partial<Note>) => api.patch<Note>(`/notes/${id}`, note).then((res: AxiosResponse<Note>) => res.data);
export const deleteNote = (id: number) => api.delete(`/notes/${id}`).then((res: AxiosResponse<any>) => res.data);

// Appointments API endpoints
export const getAppointments = () => api.get<Appointment[]>("/appointments").then((res: AxiosResponse<Appointment[]>) => res.data);
export const getAppointment = (id: number) => api.get<Appointment>(`/appointments/${id}`).then((res: AxiosResponse<Appointment>) => res.data);
export const createAppointment = (appointment: Omit<Appointment, "id" | "user_id">) => {
  // The server will set the user_id based on the authentication token
  return api.post<Appointment>("/appointments", appointment).then((res: AxiosResponse<Appointment>) => res.data);
};
export const updateAppointment = (id: number, appointment: Partial<Appointment>) => 
  api.patch<Appointment>(`/appointments/${id}`, appointment).then((res: AxiosResponse<Appointment>) => res.data);
export const deleteAppointment = (id: number) => api.delete(`/appointments/${id}`).then((res: AxiosResponse<any>) => res.data);

// Meetings API endpoints
export const getMeetings = () => api.get<Meeting[]>("/meetings").then((res: AxiosResponse<Meeting[]>) => res.data);
export const getMeeting = (id: number) => api.get<Meeting>(`/meetings/${id}`).then((res: AxiosResponse<Meeting>) => res.data);
export const createMeeting = (meeting: Omit<Meeting, "id" | "user_id">) => {
  // The server will set the user_id based on the authentication token
  return api.post<Meeting>("/meetings", meeting).then((res: AxiosResponse<Meeting>) => res.data);
};
export const updateMeeting = (id: number, meeting: Partial<Meeting>) => 
  api.patch<Meeting>(`/meetings/${id}`, meeting).then((res: AxiosResponse<Meeting>) => res.data);
export const deleteMeeting = (id: number) => api.delete(`/meetings/${id}`).then((res: AxiosResponse<any>) => res.data);

// Settings API endpoints
export const getPomodoroSettings = () => 
  api.get<PomodoroSettings>("/settings/pomodoro")
    .then((res: AxiosResponse<PomodoroSettings>) => res.data);

export const updatePomodoroSettings = (settings: Partial<PomodoroSettings>) => {
  // Create a completely new object with ONLY the fields we need
  // Explicitly convert to primitive numbers and omit any other properties
  const sanitizedSettings = {
    work_duration: Math.floor(Number(settings.work_duration)),
    break_duration: Math.floor(Number(settings.break_duration)),
    long_break_duration: Math.floor(Number(settings.long_break_duration)),
    sessions_before_long_break: Math.floor(Number(settings.sessions_before_long_break))
  };
  
  // Using PATCH as the server expects
  return api.patch<PomodoroSettings>("/settings/pomodoro", sanitizedSettings)
    .then((res: AxiosResponse<PomodoroSettings>) => res.data);
}

export const getUserSettings = () => 
  api.get<UserSettings>("/user-settings")
    .then((res: AxiosResponse<UserSettings>) => res.data);

export const updateUserSettings = (settings: Partial<UserSettings>) => 
  api.patch<UserSettings>("/user-settings", settings)
    .then((res: AxiosResponse<UserSettings>) => res.data);

// Auth-related API endpoints
export const validateToken = () => api.get<{ valid: boolean; user: any }>("/auth/validate-token")
  .then((res: AxiosResponse<{ valid: boolean; user: any }>) => res.data);

export const logout = () => api.post<{ success: boolean }>("/auth/logout")
  .then((res: AxiosResponse<{ success: boolean }>) => res.data);

// AI Features
export const generateSubtasks = (prompt: string) => 
  api.post<{ subtasks: string[] | string }>("/generate-subtasks", { prompt })
    .then((res: AxiosResponse<{ subtasks: string[] | string }>) => res.data);