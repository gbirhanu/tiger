import axios, { InternalAxiosRequestConfig, AxiosResponse, AxiosError } from "axios";
import type { Task, Note, Appointment, Meeting, PomodoroSettings, UserSettings, Subtask, LongNote, SubscriptionPayment, AdminSettings, Subscription } from "../../../shared/schema";

// Import the shared token management functions from queryClient
import { setAuthToken as setToken, getAuthToken as getToken, apiRequest } from './queryClient';

// Re-export the token functions for backwards compatibility
export const setAuthToken = setToken;
export const getAuthToken = getToken;

// Client-side access to Gemini API key from Vite environment variables
// This provides a fallback in case the server-side key is not configured
const CLIENT_GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || null;

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
    }
    return config;
  },
  (error: AxiosError) => {
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
export const updateTask = (task: Partial<Task> & { id: number, update_all_recurring?: boolean }) => 
  api.patch<Task>(`/tasks/${task.id}`, task).then((res: AxiosResponse<Task>) => res.data);
export const deleteTask = (id: number) => api.delete(`/tasks/${id}`).then((res: AxiosResponse<any>) => res.data);

// Subtasks API endpoints
export const getSubtasks = (taskId: number) => api.get<Subtask[]>(`/tasks/${taskId}/subtasks`).then((res: AxiosResponse<Subtask[]>) => res.data);
export const createSubtasks = (taskId: number, subtasks: Array<Subtask | { title: string; completed: boolean }>) => 
  api.post<Subtask[]>(`/tasks/${taskId}/subtasks`, { 
    subtasks: subtasks.map(subtask => {
      // If it's a full Subtask object, preserve the ID only if it's a positive number
      // Negative IDs are temporary client-side IDs and should be treated as new subtasks
      if ('id' in subtask && typeof subtask.id === 'number' && subtask.id > 0) {
        return {
          id: subtask.id,
          title: subtask.title,
          completed: subtask.completed
        };
      }
      // Otherwise just pass the basic data for new subtasks
      return {
        title: subtask.title,
        completed: subtask.completed
      };
    })
  }).then((res: AxiosResponse<Subtask[]>) => res.data)
  .catch(error => {
    console.error("Error creating subtasks:", error);
    // Log the actual request details to help with debugging
    console.error("Request details:", {
      taskId,
      subtasksCount: subtasks.length,
      subtaskSample: subtasks.slice(0, 2)
    });
    throw error;
  });
export const updateSubtask = (taskId: number, subtaskId: number, data: Partial<Subtask>) => {
  // Validate inputs to catch problems early
  if (!taskId || isNaN(taskId) || taskId <= 0) {
    console.error("Invalid taskId:", taskId);
    return Promise.reject(new Error("Invalid taskId"));
  }
  
  if (!subtaskId || isNaN(subtaskId) || subtaskId <= 0) {
    console.error("Invalid subtaskId:", subtaskId);
    return Promise.reject(new Error("Invalid subtaskId"));
  }
  
  // When only updating position, make that clear in the request
  // This helps the server know not to update the updated_at timestamp
  const requestData: any = {};
  
  // Only include fields that are explicitly provided
  if (data.title !== undefined) requestData.title = data.title;
  if (data.completed !== undefined) requestData.completed = data.completed;
  if (data.position !== undefined) requestData.position = data.position;
  if (data.updated_at !== undefined) requestData.updated_at = data.updated_at;
  
  // If we're only updating position, send an extra flag
  if (data.position !== undefined && data.title === undefined && data.completed === undefined) {
    requestData.position_only_update = true;
  }
  
  return api.patch<Subtask>(`/tasks/${taskId}/subtasks/${subtaskId}`, requestData)
    .then((res: AxiosResponse<Subtask>) => {
      return res.data;
    })
    .catch((error) => {
      console.error(`API: Error updating subtask ${subtaskId} of task ${taskId}:`, error);
      if (error.response) {
        console.error("Response status:", error.response.status);
        console.error("Response data:", error.response.data);
      }
      throw error;
    });
};
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
export const updateNote = (id: number, note: Partial<Note>) => {
  const updatedNote = { ...note };
  
  return api.patch<Note>(`/notes/${id}`, updatedNote)
    .then((res: AxiosResponse<Note>) => res.data)
    .catch((error) => {
      throw error;
    });
};
export const deleteNote = (id: number) => api.delete(`/notes/${id}`).then((res: AxiosResponse<any>) => res.data);

// Appointments API endpoints
export const getAppointments = () => 
  api.get<Appointment[]>("/appointments")
    .then((res: AxiosResponse<Appointment[]>) => {
      
      return res.data;
    })
    .catch(error => {
      throw error;
    });

export const getAppointment = (id: number) => 
  api.get<Appointment>(`/appointments/${id}`)
    .then((res: AxiosResponse<Appointment>) => res.data)
    .catch(error => {
      throw error;
    });

export const createAppointment = (appointment: Omit<Appointment, "id" | "user_id">) => {
  // The server will set the user_id based on the authentication token
  
  return api.post<Appointment>("/appointments", appointment)
    .then((res: AxiosResponse<Appointment>) => {
      
      return res.data;
    })
    .catch(error => {
      throw error;
    });
};

export const updateAppointment = (id: number, appointment: Partial<Appointment> & { update_all_recurring?: boolean }) => 
  api.patch<Appointment>(`/appointments/${id}`, appointment)
    .then((res: AxiosResponse<Appointment>) => res.data)
    .catch(error => {
      throw error;
    });

export const deleteAppointment = (id: number) => 
  api.delete(`/appointments/${id}`)
    .then((res: AxiosResponse<any>) => res.data)
    .catch(error => {
      throw error;
    });

// Meetings API endpoints
export const getMeetings = () => api.get<Meeting[]>("/meetings").then((res: AxiosResponse<Meeting[]>) => res.data);

export const getMeeting = (id: number) => api.get<Meeting>(`/meetings/${id}`).then((res: AxiosResponse<Meeting>) => res.data);
export const createMeeting = (meeting: Omit<Meeting, "id" | "user_id">) => {
  // The server will set the user_id based on the authentication token
  return api.post<Meeting>("/meetings", meeting).then((res: AxiosResponse<Meeting>) => res.data);
};
export const updateMeeting = async (meetingId: number | string, meetingData: Partial<Meeting> & { update_all_recurring?: boolean }): Promise<Meeting> => {
  try {
    const id = typeof meetingId === 'string' ? parseInt(meetingId) : meetingId;
    const response = await api.patch<Meeting>(`/meetings/${id}`, meetingData);
    return response.data;
  } catch (error) {
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

export const updateUserSettings = async (settings: Partial<UserSettings>) => {
  try {
    // Create a copy of the settings to avoid mutating the original
    const formattedSettings: Record<string, any> = { ...settings };
    
    // Ensure boolean values are correctly handled
    if ('show_notifications' in formattedSettings) {
      formattedSettings.show_notifications = Boolean(formattedSettings.show_notifications);
    }
    
    if ('notifications_enabled' in formattedSettings) {
      formattedSettings.notifications_enabled = Boolean(formattedSettings.notifications_enabled);
    }
    
    const response = await api.patch<UserSettings>('/user-settings', formattedSettings);
    return response.data;
  } catch (error) {
    throw error;
  }
};


export const logout = () => api.post<{ success: boolean }>("/auth/logout")
  .then((res: AxiosResponse<{ success: boolean }>) => res.data);

// Subscription API endpoints
export const getSubscriptionStatus = async () => {
  try {
    const response = await api.get('/subscription/status');
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Get user subscription data
export const getUserSubscription = () => 
  api.get<Subscription>("/user/subscription")
    .then((res) => res.data)
    .catch(error => {
      return null;
    });

// Get all subscription plans
export const getSubscriptionPlans = async () => {
  try {
    const response = await api.get('/subscription/plans');
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Create a new subscription plan (admin only)
export const createSubscriptionPlan = async (data: {
  name: string;
  price: number;
  duration_months: number;
  description?: string;
  features?: string;
  is_active?: boolean;
}) => {
  try {
    const response = await api.post('/subscription/plans', data);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Update an existing subscription plan (admin only)
export const updateSubscriptionPlan = async (planId: number, data: {
  name?: string;
  price?: number;
  duration_months?: number;
  description?: string;
  features?: string;
  is_active?: boolean;
}) => {
  try {
    const response = await api.patch(`/subscription/plans/${planId}`, data);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Create a subscription for upgrading to pro
export const createSubscription = async (data: {
  user_id?: number;
  plan: string;
  status?: string;
  start_date?: number;
  end_date?: number;
  auto_renew?: boolean;
}) => {
  try {
    const subscriptionData = {
      ...data,
      // Use current timestamp if start_date is not provided
      start_date: data.start_date || Math.floor(Date.now() / 1000),
    };
    
    const response = await api.post('/subscription', subscriptionData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Create a payment for a subscription
export const createSubscriptionPayment = async (data: {
  subscription_id?: number;
  user_id: number;
  amount: number;
  currency: string;
  transaction_id?: string;
  deposited_by: string;
  deposited_date: number;
  payment_method?: string;
  status?: string;
  notes?: string;
}) => {
  try {
    const response = await api.post('/subscription/payment', data);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const upgradeToProPlan = async (paymentData: {
  deposited_by: string;
  deposited_date: number;
  transaction_id: string;
  amount: number;
  duration_months: number;
  notes?: string;
  user_id?: number;
}) => {
  try {
    const response = await api.post('/subscription/upgrade', paymentData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const checkGeminiUsage = async () => {
  try {
    const response = await api.get('/gemini/usage');
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const incrementGeminiUsage = async () => {
  try {
    const response = await api.post('/gemini/increment-usage');
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Currency conversion functions
export const convertCurrency = (amount: number, fromCurrency: string, toCurrency: string): number => {
  // Simple conversion rates (fixed)
  const conversionRates: Record<string, Record<string, number>> = {
    'USD': { 'ETB': 55.5, 'EUR': 0.92 },
    'ETB': { 'USD': 0.018, 'EUR': 0.017 },
    'EUR': { 'USD': 1.09, 'ETB': 60.3 }
  };
  
  // If same currency, no conversion needed
  if (fromCurrency === toCurrency) {
    return amount;
  }
  
  // Check if conversion rate exists
  if (conversionRates[fromCurrency] && conversionRates[fromCurrency][toCurrency]) {
    return amount * conversionRates[fromCurrency][toCurrency];
  }
  
  // Default to original amount if conversion rate not found
  return amount;
};

// Format currency based on currency code
export const formatCurrency = (amount: number, currency: string): string => {
  switch (currency) {
    case 'USD':
      return `$${amount.toFixed(2)}`;
    case 'ETB':
      return `${amount.toFixed(2)} ETB`;
    default:
      return `${amount.toFixed(2)} ${currency}`;
  }
};

// Get admin subscription settings including new fields
export const getAdminSettings = async () => {
  try {
    const response = await api.get<AdminSettings>('admin-settings');
    return response.data;
  } catch (error) {
    // Return default values if error
    return {
      id: 0,
      gemini_max_free_calls: 5,
      enable_marketing: false,
      bank_account: '',
      bank_owner: '',
      subscription_amount: 19.99,
      default_currency: 'ETB',
      created_at: Date.now(),
      updated_at: Date.now()
    };
  }
};

// Update admin subscription settings with new fields
export const updateAdminSettings = async (data: Partial<AdminSettings>) => {
  try {
    const response = await api.patch<AdminSettings>('admin-settings', data);
    return response.data;
  } catch (error) {
    throw error;
  }
};




// Add the missing generateContent function
export const generateContent = async (prompt: string): Promise<string> => {
  try {
    console.log("Sending generateContent request with prompt:", prompt.substring(0, 50) + (prompt.length > 50 ? "..." : ""));
    
    // Updated to use the correct endpoint path that matches server/index.ts configuration
    const response = await api.post('generate-content', { prompt });
    
    console.log("Received generateContent response:", {
      status: response.status,
      hasText: !!response.data.text,
      textLength: response.data.text ? response.data.text.length : 0
    });
    
    if (!response.data || !response.data.text) {
      console.error("Invalid response from generate-content API:", response.data);
      return ""; // Return empty string instead of throwing to prevent UI errors
    }
    
    return response.data.text;
  } catch (error) {
    console.error("Error in generateContent API call:", error);
    console.log("Error object details:", {
      type: typeof error, 
      isAxiosError: axios.isAxiosError(error),
      status: axios.isAxiosError(error) && error.response ? error.response.status : 'N/A',
      responseData: axios.isAxiosError(error) && error.response ? error.response.data : 'N/A'
    });
    
    // For API key configuration error, try direct access with client-side key if available
    if (axios.isAxiosError(error) && error.response && 
        error.response.data?.error === "Gemini API key is not configured" && 
        CLIENT_GEMINI_API_KEY) {
      
      console.log("Attempting direct Gemini API access with client-side key");
      try {
        // Import the Gemini API directly
        const { GoogleGenerativeAI } = await import("@google/generative-ai");
        
        // Initialize Gemini API with the client-side key
        const genAI = new GoogleGenerativeAI(CLIENT_GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
        
        // Generate content directly
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();
        
        // Clean up the response text the same way the server does
        text = text
          .replace(/^\s*\[|\]\s*$/g, '') // Remove opening/closing brackets
          .replace(/"/g, '') // Remove quotes
          .replace(/,\s*/g, '\n') // Replace commas with newlines
          .replace(/\\n/g, '\n'); // Replace escaped newlines
          
        console.log("Successfully generated content with client-side key");
        return text;
      } catch (directError) {
        console.error("Error with direct Gemini API access:", directError);
        throw new Error("Failed to generate content: Could not access Gemini API");
      }
    }
    
    // Enhanced error handling for usage limit errors
    if (axios.isAxiosError(error) && error.response) {
      // Check if this is a usage limit error
      if (error.response.status === 403 && 
         (error.response.data?.code === 'USAGE_LIMIT_REACHED' || 
          error.response.data?.error?.includes('usage limit') ||
          error.response.data?.details?.includes('usage limit'))) {
        
        console.log("Usage limit error detected in generateContent");
        
        // Create a properly formatted limit error that the component can detect
        const limitError = new Error(
          error.response.data.details || 
          "You've reached your free limit of Gemini API calls. Please upgrade to Pro to continue using AI features."
        ) as any;
        
        // Add fields that will be detected by the component
        limitError.limitReached = true;
        limitError.response = error.response;
        limitError.showUpgrade = error.response.data.showUpgrade || true;
        limitError.currentUsage = error.response.data.currentUsage;
        limitError.maxFreeCalls = error.response.data.maxFreeCalls;
        limitError.code = 'USAGE_LIMIT_REACHED';
        
        console.log("Throwing limitError:", {
          message: limitError.message,
          limitReached: limitError.limitReached,
          code: limitError.code
        });
        
        throw limitError;
      }
      
      // Return error message from server if available
      const apiError = new Error(error.response.data?.error || error.response.data?.details || error.message) as any;
      apiError.response = error.response;
      throw apiError;
    }
    
    // For non-axios errors, or if error.response is undefined
    throw error;
  }
};

// Define the Gemini usage limit error type
export interface GeminiUsageLimitError {
  limitReached: boolean;
  message: string;
  showUpgrade: boolean;
  currentUsage?: number;
  maxFreeCalls?: number;
}

// Existing generateSubtasks API call modified to check usage limit
export const generateSubtasks = async (data: { task: { title: string; description?: string | null }; count?: number }) => {
  try {
    // Ensure we have a properly structured payload
    const payload = {
      task: {
        title: data.task.title || "Untitled Task",
        description: data.task.description || ""
      },
      count: data.count || 5
    };
    
    console.log("Sending generateSubtasks request with payload:", {
      ...payload,
      task: {
        ...payload.task,
        // Redact potentially sensitive information in description
        description: payload.task.description ? "[CONTENT]" : ""
      }
    });

    // Get the token and verify it's available
    const token = getToken();
    if (!token) {
      console.error("No authentication token available for generateSubtasks call");
      throw new Error("Authentication required. Please log in again.");
    }
    
    // Make the API call with the correct path - baseURL is already "/api"
    const response = await api.post(`generate`, payload);
    
    console.log("Received generateSubtasks response:", {
      status: response.status,
      statusText: response.statusText,
      hasData: !!response.data,
      hasSubtasks: response.data && !!response.data.subtasks,
      subtasksType: response.data && response.data.subtasks ? 
        (Array.isArray(response.data.subtasks) ? 
          `array[${response.data.subtasks.length}]` : 
          typeof response.data.subtasks) : 
        'none'
    });
    
    // Ensure we have a valid response
    if (!response.data || !response.data.subtasks) {
      console.error("Invalid response from generate API:", response.data);
      return { subtasks: [] }; // Return empty array instead of throwing to prevent UI errors
    }
    
    return response.data;
  } catch (error) {
    console.error("Error in generateSubtasks API call:", error);
    
    // For API key configuration error, try direct access with client-side key if available
    if (axios.isAxiosError(error) && error.response && 
        (error.response.data?.error === "Gemini API key is not configured" ||
         error.response.data?.details?.includes("Gemini API key is not configured")) && 
        CLIENT_GEMINI_API_KEY) {
      
      console.log("Attempting direct Gemini API access with client-side key for subtask generation");
      try {
        // Extract the count and task details
        const { task, count = 5 } = data;
        const taskTitle = task.title || "Untitled Task";
        const taskDescription = task.description || "";
        
        // Import the Gemini API directly
        const { GoogleGenerativeAI } = await import("@google/generative-ai");
        
        // Initialize Gemini API with the client-side key
        const genAI = new GoogleGenerativeAI(CLIENT_GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
        
        // Create a prompt for generating subtasks (similar to server-side)
        const prompt = `
          Please generate ${count} specific, actionable subtasks for the following task: "${taskTitle}".
          
          ${taskDescription ? `Additional task context: "${taskDescription}"` : ''}
          
          Each subtask should:
          1. Be clear and specific
          2. Be actionable (start with a verb when possible)
          3. Be reasonable in scope (completable in one sitting)
          4. Collectively help complete the main task
          5. Be of similar scale/scope to each other
          
          Format your response as a simple array of strings, e.g. ["Subtask 1", "Subtask 2"]. 
          DO NOT include any numbering, additional formatting, or explanation.
        `;
        
        // Generate content directly
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();
        
        console.log("Raw response from Gemini API:", text);
        
        // Try to parse the response as JSON array
        try {
          // First, process text to ensure it's in valid JSON format:
          // 1. Strip any markdown code blocks if present
          text = text.replace(/```json\s*|\s*```/g, '');
          // 2. Ensure we have square brackets
          text = text.trim();
          if (!text.startsWith('[')) text = '[' + text;
          if (!text.endsWith(']')) text = text + ']';
          
          console.log("Preprocessed text before parsing:", text.substring(0, 100) + (text.length > 100 ? "..." : ""));
          
          // Parse as JSON
          const subtasks = JSON.parse(text);
          
          if (!Array.isArray(subtasks)) {
            throw new Error("Response is not an array");
          }
          
          console.log("Successfully generated subtasks with client-side key:", subtasks);
          return { subtasks };
        } catch (parseError) {
          console.error("Error parsing JSON response from direct API call:", parseError);
          // If parsing fails, return the raw text as a fallback
          const fallbackSubtasks = text.replace(/^\[|\]$/g, '').split('\n').map(s => s.trim()).filter(Boolean);
          const finalSubtasks = fallbackSubtasks.length > 0 ? fallbackSubtasks : ["Review task details", "Organize resources", "Create outline", "Implement solution", "Test results"];
          return { subtasks: finalSubtasks };
        }
      } catch (directError) {
        console.error("Error with direct Gemini API access for subtask generation:", directError);
        // Return fallback subtasks instead of throwing an error
        return { 
          subtasks: ["Review task details", "Organize resources", "Create outline", "Implement solution", "Test results"],
          error: "Failed to generate personalized subtasks"
        };
      }
    }
    
    // Handle specific error types
    if (axios.isAxiosError(error) && error.response) {
      console.error("API error details:", {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
      
      // Check for usage limit error
      if (error.response.status === 403 && error.response.data?.code === "USAGE_LIMIT_REACHED") {
        const limitError: GeminiUsageLimitError = {
          limitReached: true,
          message: error.response.data.details || "You've reached your usage limit for AI features.",
          showUpgrade: error.response.data.showUpgrade || false,
          currentUsage: error.response.data.currentUsage,
          maxFreeCalls: error.response.data.maxFreeCalls
        };
        throw limitError;
      }
      
      // Return error message from server if available
      throw new Error(error.response.data?.error || error.message);
    }
    
    // For non-axios errors, or if error.response is undefined
    throw error;
  }
};


// Study Sessions API
export async function getStudySessions() {
  try {
    const response = await api.get('/study-sessions');
    return response.data;
  } catch (error) {
    throw error;
  }
}

export async function getStudySession(id: string | number) {
  try {
    const response = await api.get(`/study-sessions/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
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
  try {
    const response = await api.post('/study-sessions', data);
    return response.data;
  } catch (error) {
    throw error;
  }
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
  try {
    const response = await api.put(`/study-sessions/${id}`, data);
    return response.data;
  } catch (error) {
    throw error;
  }
}

export async function deleteStudySession(id: string | number) {
  try {
    const response = await api.delete(`/study-sessions/${id}`);
    return response.status === 200;
  } catch (error) {
    throw error;
  }
}

// Long Notes API
export const getLongNotes = async (): Promise<LongNote[]> => {
  try {
    const response = await api.get<LongNote[]>('/long-notes');
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getLongNote = async (id: number): Promise<LongNote> => {
  try {
    const response = await api.get<LongNote>(`/long-notes/${id}`);
    return response.data;
  } catch (error) {
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
    // Ensure the data matches the schema expected by the server
    const validatedData = {
      title: noteData.title,
      content: noteData.content || null,
      tags: noteData.tags || null,
      is_favorite: Boolean(noteData.is_favorite)
    };
    
    const response = await api.post<LongNote>('/long-notes', validatedData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const updateLongNote = async (id: number, data: Partial<LongNote>): Promise<LongNote> => {
  try {
    // Ensure we only send valid fields to the server
    const validatedData: Partial<LongNote> = {};
    
    if (data.title !== undefined) validatedData.title = data.title;
    if (data.content !== undefined) validatedData.content = data.content;
    if (data.tags !== undefined) validatedData.tags = data.tags;
    if (data.is_favorite !== undefined) validatedData.is_favorite = Boolean(data.is_favorite);
    
    const response = await api.patch<LongNote>(`/long-notes/${id}`, validatedData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const deleteLongNote = async (id: number): Promise<void> => {
  try {
    await api.delete(`/long-notes/${id}`);
    return;
  } catch (error) {
    throw error;
  }
};

export const enhanceLongNote = async (noteId: number, prompt: string): Promise<{ content: string }> => {
  try {
    console.log(`Enhancing note ${noteId} with prompt:`, prompt.substring(0, 50) + (prompt.length > 50 ? "..." : ""));
    
    // Ensure we send the prompt in the expected format
    const response = await api.post<{ content: string }>(`/long-notes/${noteId}/enhance`, { prompt });
    
    console.log(`Received enhanced content for note ${noteId}:`, {
      hasContent: !!response.data.content,
      contentLength: response.data.content ? response.data.content.length : 0
    });
    
    return response.data;
  } catch (error) {
    console.error(`Error enhancing note ${noteId}:`, error);
    console.log("Error object details:", {
      type: typeof error, 
      isAxiosError: axios.isAxiosError(error),
      status: axios.isAxiosError(error) && error.response ? error.response.status : 'N/A',
      responseData: axios.isAxiosError(error) && error.response ? error.response.data : 'N/A'
    });
    
    // For API key configuration error, try direct access with client-side key if available
    if (axios.isAxiosError(error) && error.response && 
        error.response.data?.error === "Gemini API key is not configured" && 
        CLIENT_GEMINI_API_KEY) {
      
      console.log("Attempting direct Gemini API access with client-side key for note enhancement");
      try {
        // Import the Gemini API directly
        const { GoogleGenerativeAI } = await import("@google/generative-ai");
        
        // Initialize Gemini API with the client-side key
        const genAI = new GoogleGenerativeAI(CLIENT_GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
        
        // Generate content directly
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();
        
        // Clean up the response text the same way the server does
        text = text
          .replace(/^\s*\[|\]\s*$/g, '') // Remove opening/closing brackets
          .replace(/"/g, '') // Remove quotes
          .replace(/,\s*/g, '\n') // Replace commas with newlines
          .replace(/\\n/g, '\n'); // Replace escaped newlines
          
        console.log("Successfully enhanced note content with client-side key");
        return { content: text };
      } catch (directError) {
        console.error("Error with direct Gemini API access for note enhancement:", directError);
        throw new Error("Failed to enhance note: Could not access Gemini API");
      }
    }
    
    // Enhanced error handling for usage limit errors (consistent with generateContent)
    if (axios.isAxiosError(error) && error.response) {
      // Check if this is a usage limit error
      if (error.response.status === 403 && 
         (error.response.data?.code === 'USAGE_LIMIT_REACHED' || 
          error.response.data?.error?.includes('usage limit') ||
          error.response.data?.details?.includes('usage limit'))) {
        
        console.log("Usage limit error detected in enhanceLongNote");
        
        // Create a properly formatted limit error that the component can detect
        const limitError = new Error(
          error.response.data.details || 
          "You've reached your free limit of Gemini API calls. Please upgrade to Pro to continue using AI features."
        ) as any;
        
        // Add fields that will be detected by the component
        limitError.limitReached = true;
        limitError.response = error.response;
        limitError.showUpgrade = error.response.data.showUpgrade || true;
        limitError.currentUsage = error.response.data.currentUsage;
        limitError.maxFreeCalls = error.response.data.maxFreeCalls;
        limitError.code = 'USAGE_LIMIT_REACHED';
        
        console.log("Throwing limitError:", {
          message: limitError.message,
          limitReached: limitError.limitReached,
          code: limitError.code
        });
        
        throw limitError;
      }
      
      // Return error message from server if available
      const apiError = new Error(error.response.data?.error || error.response.data?.details || error.message) as any;
      apiError.response = error.response;
      throw apiError;
    }
    
    // For non-axios errors, or if error.response is undefined
    throw error;
  }
};

// Admin functions for managing subscriptions
export const fetchPendingPayments = async () => {
  try {
    const response = await api.get('/subscription/pending-payments');
    
    // Map the nested structure from the server to a flat structure needed by the UI
    return response.data.map((item: any) => ({
      id: item.payment.id,
      user_id: item.payment.user_id,
      amount: item.payment.amount,
      currency: item.payment.currency,
      transaction_id: item.payment.transaction_id,
      deposited_by: item.payment.deposited_by,
      deposited_date: item.payment.deposited_date,
      payment_method: item.payment.payment_method,
      status: item.payment.status,
      subscription_plan: item.payment.subscription_plan,
      duration_months: item.payment.duration_months,
      notes: item.payment.notes,
      created_at: item.payment.created_at,
      updated_at: item.payment.updated_at,
      // Add user details from the nested structure
      user_email: item.user?.email || null,
      user_name: item.user?.name || null
    }));
  } catch (error) {
    throw error;
  }
};

// Fetch all payments (including approved and rejected)
export const fetchAllPayments = async () => {
  try {
    const response = await api.get('/subscription/payments');
    
    // Map the nested structure from the server to a flat structure needed by the UI
    return response.data.map((item: any) => ({
      id: item.payment.id,
      user_id: item.payment.user_id,
      amount: item.payment.amount,
      currency: item.payment.currency,
      transaction_id: item.payment.transaction_id,
      deposited_by: item.payment.deposited_by,
      deposited_date: item.payment.deposited_date,
      payment_method: item.payment.payment_method,
      status: item.payment.status,
      notes: item.payment.notes,
      created_at: item.payment.created_at,
      updated_at: item.payment.updated_at,
      // Add user details from the nested structure
      user_email: item.user?.email || null,
      user_name: item.user?.name || null
    }));
  } catch (error) {
    throw error;
  }
};

export const approvePayment = async (paymentId: number) => {
  try {
    const response = await api.post(`/subscription/payments/${paymentId}/approve`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const rejectPayment = async (paymentId: number, reason?: string) => {
  try {
    const response = await api.post(`/subscription/payments/${paymentId}/reject`, { reason });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Subscription management
export const grantProSubscription = async (userId: number, duration = 30) => {
  const response = await api.post(`/subscription/grant-pro/${userId}`, { duration });
  return response.data;
};

export const revokeSubscription = async (userId: number) => {
  const response = await api.post(`/subscription/revoke-pro/${userId}`);
  return response.data;
};

export const resetGeminiUsage = async (userId: number) => {
  const response = await api.post(`/users/${userId}/reset-gemini-usage`);
  return response.data;
};

// Get payment history for a user
export const getUserPaymentHistory = async (userId: number) => {
  try {
    const response = await api.get(`/subscription/user/${userId}/payments`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Sync a user's subscription with payment records
export const syncUserSubscription = async (userId: number): Promise<any> => {
  try {
    const response = await api.post(`/users/${userId}/sync-subscription`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data?.message || 'Failed to sync subscription');
    }
    throw error;
  }
};