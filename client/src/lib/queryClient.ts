import { QueryClient, QueryFunction, QueryKey } from "@tanstack/react-query";

// Token management functions
// Use localStorage to persist token between page refreshes
const TOKEN_STORAGE_KEY = 'sessionToken';

export const setAuthToken = (token: string | null) => {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    
  }
};

export const getAuthToken = (): string | null => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  
  if (token) {
    
    return token;
  }
  
  
  return null;
};

async function parseResponseForError(response: Response) {
  try {
    const text = await response.text();
    try {
      const errorData = JSON.parse(text);
      if (errorData.error) {
        if (errorData.details) {
        }
        throw new Error(errorData.error);
      }
      if (errorData.message) {
        throw new Error(errorData.message);
      }
      return errorData;
    } catch (parseError) {
      throw new Error(`Failed to parse error response: ${text}`);
    }
  } catch (error) {
    throw error;
  }
}

async function fetchWithAuth(
  apiUrl: string, 
  options: RequestInit = {},
  throwOnUnauth = true
): Promise<any> {
  const token = getAuthToken();
  
  if (!token) {
    if (throwOnUnauth) {
      throw new Error('Authentication required');
    }
  }

  const method = options.method || 'GET';
  
  try {
    const response = await fetch(apiUrl, {
      ...options,
      headers: {
        ...options.headers,
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });

    if (response.status === 401) {
      setAuthToken(null);
      if (throwOnUnauth) {
        throw new Error('Authentication required');
      }
    }

    return await parseResponseForError(response);
  } catch (error) {
    throw error;
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined
): Promise<Response> {
  try {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    // Ensure URL has the correct prefix
    const apiUrl = url.startsWith('/api') ? url : `/api${url}`;

    const token = getAuthToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    
    const res = await fetch(apiUrl, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    // Handle authentication errors specifically
    if (res.status === 401) {
      setAuthToken(null);
      // You could trigger a redirect to login here if needed
      // window.location.href = '/auth';
    }

    // Don't parse for error here, let the caller handle the response
    // This prevents throwing errors for valid responses
    // await parseResponseForError(res);
    return res;
  } catch (error) {
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn = <T>(options: {
  on401: UnauthorizedBehavior;
}): QueryFunction<T> =>
  async ({ queryKey }: { queryKey: QueryKey }) => {
    try {
      const token = getAuthToken();
      const headers: HeadersInit = {};
      const url = queryKey[0] as string;

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
        
      } else {
      }

      const res = await fetch(url, {
        credentials: "include",
        headers,
      });

      if (res.status === 401) {
        setAuthToken(null);
        
        if (options.on401 === "returnNull") {
          return null;
        }
        
        throw new Error(`401: Unauthorized access to ${url}`);
      }

      await parseResponseForError(res);
      return await res.json();
    } catch (error) {
      throw error;
    }
  };

// Define standardized query keys as constants for consistent usage across components
export const QUERY_KEYS = {
  TASKS: 'tasks',
  TASK: 'task',
  NOTES: 'notes',
  LONG_NOTES: 'long-notes',
  STUDY_SESSIONS: 'study-sessions',
  TASKS_WITH_SUBTASKS: 'task-with-subtasks',
  TASK_SUBTASKS: (taskId: number) => ['task-subtasks', taskId],
  APPOINTMENTS: 'appointments',
  USER_SUBSCRIPTION: 'user-subscription',
  MEETINGS: 'meetings',
  POMODORO_SETTINGS: 'pomodoro-settings',
  USER_SETTINGS: 'user-settings',
  USER_PROFILE: 'user-profile',
  NOTIFICATIONS: 'notifications',
  SUBTASKS: "subtasks",
  ADMIN_SETTINGS: "admin-settings",
  STUDY_SESSION: "study-session",
  LONG_NOTE: "long-note",
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true,
      staleTime: 0, // Keep at 0 to ensure immediate updates
      gcTime: 1000 * 60 * 10, // 10 minutes garbage collection time
      refetchOnMount: true, // Always refetch when component mounts
      retry: (failureCount: number, error: any) => {
        // Don't retry auth errors, but retry other errors up to 2 times
        if (error?.message?.includes('401')) {
          setAuthToken(null); // Clear token on auth errors
          return false;
        }
        return failureCount < 2;
      },
      // FIXED: Disable structural sharing to ensure state updates are always detected
      structuralSharing: false
    },
    mutations: {
      // FIXED: Properly handle mutation lifecycle
      onMutate: async (variables) => {
        
        // Cancel any in-flight or pending queries that might conflict
        await queryClient.cancelQueries();
        // This is a fallback - specific mutations should define their own onMutate
        return {};
      },
      // FIXED: Always invalidate related queries after mutation
      onSettled: (data, error, variables, context) => {
        
        // Force refetch of all critical data
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TASKS] });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.NOTES] });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LONG_NOTES] });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MEETINGS] });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.APPOINTMENTS] });
        // This is a fallback - specific mutations should handle their own invalidation
      },
      retry: (failureCount: number, error: any) => {
        // Don't retry auth errors, but retry other errors once
        if (error?.message?.includes('401')) {
          setAuthToken(null); // Clear token on auth errors
          return false;
        }
        return failureCount < 1;
      },
    },
  },
});

// Add global focus refetching for critical data
// This ensures data is refreshed when the user returns to the tab
window.addEventListener('focus', () => {
  
  queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.NOTES] });
  queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LONG_NOTES] });
  queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TASKS] });
  queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.USER_SETTINGS] });
  queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MEETINGS] });
  queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.APPOINTMENTS] });
});

// ADDED: Add a global visibility change handler to refresh data when tab becomes visible
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    
    queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.NOTES] });
    queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LONG_NOTES] });
    queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TASKS] });
    queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.USER_SETTINGS] });
    queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MEETINGS] });
    queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.APPOINTMENTS] });
  }
});

// Add a global error handler for unhandled errors
window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason;
  if (error?.message?.includes('401')) {
    setAuthToken(null);
  }
});

// Export a function to reset the query cache when logging out
export function resetQueryCache() {
  
  queryClient.clear();
}

// ADDED: Helper function to create deep copies of objects to avoid reference issues
export function deepCopy<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// ADDED: Helper function to force a UI refresh for a specific query
export function forceRefreshQuery(queryKey: unknown[]) {
  
  
  // Get the current data
  const currentData = queryClient.getQueryData(queryKey);
  
  if (currentData) {
    // Create a deep copy to ensure React detects the change
    const freshData = deepCopy(currentData);
    
    // Set the data back to trigger a re-render
    queryClient.setQueryData(queryKey, freshData);
    
    // Also invalidate to ensure we get fresh data from the server
    queryClient.invalidateQueries({ queryKey });
  } else {
    // If no data exists, just invalidate
    queryClient.invalidateQueries({ queryKey });
  }
}

// Helper function to refresh tasks specifically
export function refreshTasks() {
  
  
  // Simply invalidate the query to fetch fresh data from the server
  queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TASKS] });
}
