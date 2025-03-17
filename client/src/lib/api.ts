import axios, { InternalAxiosRequestConfig, AxiosResponse, AxiosError } from "axios";
import type { Task, Note, Appointment, Meeting, PomodoroSettings, UserSettings, Subtask, LongNote } from "../../../shared/schema";

// Import the shared token management functions from queryClient
import { setAuthToken as setToken, getAuthToken as getToken, apiRequest } from './queryClient';

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
export const getAppointments = () => 
  api.get<Appointment[]>("/appointments")
    .then((res: AxiosResponse<Appointment[]>) => {
      console.log("API response for appointments:", res.data);
      return res.data;
    })
    .catch(error => {
      console.error("API error fetching appointments:", error);
      throw error;
    });

export const getAppointment = (id: number) => 
  api.get<Appointment>(`/appointments/${id}`)
    .then((res: AxiosResponse<Appointment>) => res.data)
    .catch(error => {
      console.error(`API error fetching appointment ${id}:`, error);
      throw error;
    });

export const createAppointment = (appointment: Omit<Appointment, "id" | "user_id">) => {
  // The server will set the user_id based on the authentication token
  console.log("Creating appointment with data:", appointment);
  return api.post<Appointment>("/appointments", appointment)
    .then((res: AxiosResponse<Appointment>) => {
      console.log("Appointment created successfully:", res.data);
      return res.data;
    })
    .catch(error => {
      console.error("API error creating appointment:", error);
      throw error;
    });
};

export const updateAppointment = (id: number, appointment: Partial<Appointment>) => 
  api.patch<Appointment>(`/appointments/${id}`, appointment)
    .then((res: AxiosResponse<Appointment>) => res.data)
    .catch(error => {
      console.error(`API error updating appointment ${id}:`, error);
      throw error;
    });

export const deleteAppointment = (id: number) => 
  api.delete(`/appointments/${id}`)
    .then((res: AxiosResponse<any>) => res.data)
    .catch(error => {
      console.error(`API error deleting appointment ${id}:`, error);
      throw error;
    });

// Meetings API endpoints
export const getMeetings = () => api.get<Meeting[]>("/meetings").then((res: AxiosResponse<Meeting[]>) => res.data);
export const getMeeting = (id: number) => api.get<Meeting>(`/meetings/${id}`).then((res: AxiosResponse<Meeting>) => res.data);
export const createMeeting = (meeting: Omit<Meeting, "id" | "user_id">) => {
  // The server will set the user_id based on the authentication token
  return api.post<Meeting>("/meetings", meeting).then((res: AxiosResponse<Meeting>) => res.data);
};
export const updateMeeting = async (meetingId: number, meetingData: Partial<Meeting>): Promise<Meeting> => {
  console.log(`Updating meeting ${meetingId} with data:`, meetingData);
  
  try {
    const response = await api.patch<Meeting>(`/meetings/${meetingId}`, meetingData);
    const updatedMeeting = await response.data;
    console.log('Meeting updated successfully:', updatedMeeting);
    return updatedMeeting;
  } catch (error) {
    console.error('Error updating meeting:', error);
    throw error;
  }
};
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

export const updateUserSettings = async (settings: any): Promise<UserSettings> => {
  console.log('Updating user settings:', settings);
  
  // Process work hours to ensure they're in the correct format for the server
  const formattedSettings = { ...settings };
  
  // Convert time objects to decimal hours (e.g., 9:30 becomes 9.5)
  if (formattedSettings.work_start_hour && 
      typeof formattedSettings.work_start_hour === 'object' && 
      'hour' in formattedSettings.work_start_hour) {
    // Convert hour and minute to decimal value
    const hour = formattedSettings.work_start_hour.hour;
    const minute = formattedSettings.work_start_hour.minute || 0;
    formattedSettings.work_start_hour = hour + (minute / 60);
    console.log('Converted time object to decimal hours for work_start_hour:', formattedSettings.work_start_hour);
  } else if (typeof formattedSettings.work_start_hour === 'number' && formattedSettings.work_start_hour > 1000000) {
    // If it's a Unix timestamp, convert to decimal hours
    const date = new Date(formattedSettings.work_start_hour * 1000);
    formattedSettings.work_start_hour = date.getHours() + (date.getMinutes() / 60);
    console.log('Converted timestamp to decimal hours for work_start_hour:', formattedSettings.work_start_hour);
  }
  
  if (formattedSettings.work_end_hour && 
      typeof formattedSettings.work_end_hour === 'object' && 
      'hour' in formattedSettings.work_end_hour) {
    // Convert hour and minute to decimal value
    const hour = formattedSettings.work_end_hour.hour;
    const minute = formattedSettings.work_end_hour.minute || 0;
    formattedSettings.work_end_hour = hour + (minute / 60);
    console.log('Converted time object to decimal hours for work_end_hour:', formattedSettings.work_end_hour);
  } else if (typeof formattedSettings.work_end_hour === 'number' && formattedSettings.work_end_hour > 1000000) {
    // If it's a Unix timestamp, convert to decimal hours
    const date = new Date(formattedSettings.work_end_hour * 1000);
    formattedSettings.work_end_hour = date.getHours() + (date.getMinutes() / 60);
    console.log('Converted timestamp to decimal hours for work_end_hour:', formattedSettings.work_end_hour);
  }
  
  // Use the existing api object instead of fetch
  const response = await api.patch<UserSettings>("/user-settings", formattedSettings);
  return response.data;
};

// Auth-related API endpoints
export const validateToken = () => api.get<{ valid: boolean; user: any }>("/auth/validate-token")
  .then((res: AxiosResponse<{ valid: boolean; user: any }>) => res.data);

export const logout = () => api.post<{ success: boolean }>("/auth/logout")
  .then((res: AxiosResponse<{ success: boolean }>) => res.data);

// AI Features
export const generateSubtasks = (prompt: string) => 
  api.post<{ subtasks: string[] | string }>("/generate-subtasks", { prompt })
    .then((res: AxiosResponse<{ subtasks: string[] | string }>) => res.data);

// Generate content for long notes using the generate-subtasks endpoint
export const generateContent = async (prompt: string): Promise<{ content: string }> => {
  try {
    console.log('Generating content with prompt:', prompt);
    const generationPrompt = `Generate a detailed markdown note about: "${prompt}". Include headings, bullet points, and detailed explanations.`;
    
    const response = await apiRequest('POST', '/generate-subtasks', { prompt: generationPrompt });
    console.log('generateContent response received');
    const data = await response.json();
    console.log('generateContent data parsed:', data);
    
    // The generate-subtasks endpoint returns { subtasks: string }
    // We need to convert it to { content: string }
    return { content: data.subtasks };
  } catch (error) {
    console.error('Error generating content:', error);
    throw error;
  }
};

// Study Sessions API
export async function getStudySessions() {
  const response = await apiRequest('GET', '/study-sessions');
  return response.json();
}

export async function getStudySession(id: string | number) {
  const response = await apiRequest('GET', `/study-sessions/${id}`);
  return response.json();
}

export async function createStudySession(data: {
  title: string;
  description?: string | null;
  subject?: string | null;
  goal?: string | null;
  completed?: boolean;
  total_focus_time?: number;
  total_breaks?: number;
}) {
  const response = await apiRequest('POST', '/study-sessions', data);
  return response.json();
}

export async function updateStudySession(
  id: string | number,
  data: {
    title?: string;
    description?: string | null;
    subject?: string | null;
    goal?: string | null;
    completed?: boolean;
    total_focus_time?: number;
    total_breaks?: number;
  }
) {
  const response = await apiRequest('PUT', `/study-sessions/${id}`, data);
  return response.json();
}

export async function deleteStudySession(id: string | number) {
  const response = await apiRequest('DELETE', `/study-sessions/${id}`);
  return response.ok;
}

// Long Notes API
export const getLongNotes = async (): Promise<LongNote[]> => {
  try {
    console.log('Calling getLongNotes API function');
    const response = await apiRequest('GET', '/long-notes');
    console.log('getLongNotes response received');
    const data = await response.json();
    console.log('getLongNotes data parsed:', data);
    return data;
  } catch (error) {
    console.error('Error fetching notes:', error);
    throw error;
  }
};

export const getLongNote = async (id: number): Promise<LongNote> => {
  try {
    const response = await apiRequest('GET', `/long-notes/${id}`);
    return response.json();
  } catch (error) {
    console.error('Error fetching note:', error);
    throw error;
  }
};

export const createLongNote = async (noteData: {
  title: string;
  content: string | null;
  tags: string | null;
  is_favorite: boolean;
}): Promise<LongNote> => {
  try {
    console.log('Creating long note with data:', noteData);
    // Ensure the data matches the schema expected by the server
    const validatedData = {
      title: noteData.title,
      content: noteData.content || null,
      tags: noteData.tags || null,
      is_favorite: Boolean(noteData.is_favorite)
    };
    
    const response = await apiRequest('POST', '/long-notes', validatedData);
    console.log('createLongNote response received');
    const data = await response.json();
    console.log('createLongNote data parsed:', data);
    return data;
  } catch (error) {
    console.error('Error creating note:', error);
    throw error;
  }
};

export const updateLongNote = async (id: number, data: Partial<LongNote>): Promise<LongNote> => {
  try {
    console.log('Updating long note with id:', id, 'and data:', data);
    // Ensure we only send valid fields to the server
    const validatedData: Partial<LongNote> = {};
    
    if (data.title !== undefined) validatedData.title = data.title;
    if (data.content !== undefined) validatedData.content = data.content;
    if (data.tags !== undefined) validatedData.tags = data.tags;
    if (data.is_favorite !== undefined) validatedData.is_favorite = Boolean(data.is_favorite);
    
    const response = await apiRequest('PATCH', `/long-notes/${id}`, validatedData);
    console.log('updateLongNote response received');
    const responseData = await response.json();
    console.log('updateLongNote data parsed:', responseData);
    return responseData;
  } catch (error) {
    console.error('Error updating note:', error);
    throw error;
  }
};

export const deleteLongNote = async (id: number): Promise<void> => {
  try {
    await apiRequest('DELETE', `/long-notes/${id}`);
    return;
  } catch (error) {
    console.error('Error deleting note:', error);
    throw error;
  }
};

export const enhanceLongNote = async (noteId: number, prompt: string): Promise<{ content: string }> => {
  try {
    console.log('Enhancing long note with id:', noteId, 'and prompt:', prompt);
    
    // Ensure we send the prompt in the expected format
    const response = await apiRequest('POST', `/long-notes/${noteId}/enhance`, { prompt });
    console.log('enhanceLongNote response received');
    const data = await response.json();
    console.log('enhanceLongNote data parsed:', data);
    
    // Ensure we return the expected format even if the server response is different
    if (data && typeof data === 'object') {
      if (data.content) {
        return { content: data.content };
      } else if (data.enhanced) {
        // Handle the case where the server returns { original, enhanced } format
        return { content: data.enhanced };
      }
    }
    
    // Fallback if the response format is unexpected
    console.error('Unexpected response format from enhance endpoint:', data);
    return { content: '' };
  } catch (error) {
    console.error('Error enhancing note content:', error);
    throw error;
  }
};