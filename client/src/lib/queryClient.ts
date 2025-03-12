import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Token management functions
// Use localStorage to persist token between page refreshes
const TOKEN_STORAGE_KEY = 'auth_token';

export const setAuthToken = (token: string | null) => {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    console.log("Auth token set in localStorage");
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    console.log("Auth token removed from localStorage");
  }
};

export const getAuthToken = (): string | null => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  
  if (token) {
    console.log(`Retrieved auth token from storage: ${token.substring(0, 5)}...`);
    return token;
  }
  
  console.log('No auth token found in storage');
  return null;
};

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorMessage = `${res.status}: ${res.statusText}`;
    try {
      const text = await res.text();
      if (text) {
        try {
          // Try to parse as JSON for structured error messages
          const errorData = JSON.parse(text);
          if (errorData.error) {
            errorMessage = `${res.status}: ${errorData.error}`;
          } else {
            errorMessage = `${res.status}: ${text}`;
          }
        } catch {
          // If not JSON, use the raw text
          errorMessage = `${res.status}: ${text}`;
        }
      }
    } catch (error) {
      console.error('Error parsing response body:', error);
    }
    
    throw new Error(errorMessage);
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

    const token = getAuthToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
      console.log(`API Request to ${url} with token: ${token.substring(0, 10)}...`);
    } else {
      console.warn(`API Request to ${url} without authentication token`);
    }

    const res = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    // Handle authentication errors specifically
    if (res.status === 401) {
      console.error(`Authentication failed for request to ${url} - clearing token`);
      setAuthToken(null);
      // You could trigger a redirect to login here if needed
      // window.location.href = '/auth';
    }

    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    console.error(`API Request failed for ${method} ${url}:`, error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      const token = getAuthToken();
      const headers: HeadersInit = {};
      const url = queryKey[0] as string;

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
        console.log(`Query request to ${url} with token: ${token.substring(0, 10)}...`);
      } else {
        console.warn(`Query request to ${url} without authentication token`);
      }

      const res = await fetch(url, {
        credentials: "include",
        headers,
      });

      if (res.status === 401) {
        console.error(`Authentication failed for query to ${url} - clearing token`);
        setAuthToken(null);
        
        if (unauthorizedBehavior === "returnNull") {
          return null;
        }
        
        throw new Error(`401: Unauthorized access to ${url}`);
      }

      await throwIfResNotOk(res);
      return await res.json();
    } catch (error) {
      console.error(`Query function error:`, error);
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: (failureCount, error: any) => {
        // Don't retry auth errors, but retry other errors up to 2 times
        if (error?.message?.includes('401')) {
          return false;
        }
        return failureCount < 2;
      },
      onError: (error: any) => {
        if (error?.message?.includes('401')) {
          console.error('Authentication error in query:', error.message);
          setAuthToken(null);
        }
      }
    },
    mutations: {
      retry: (failureCount, error: any) => {
        // Don't retry auth errors, but retry other errors once
        if (error?.message?.includes('401')) {
          return false;
        }
        return failureCount < 1;
      },
      onError: (error: any) => {
        if (error?.message?.includes('401')) {
          console.error('Authentication error in mutation:', error.message);
          setAuthToken(null);
        }
      }
    },
  },
});

// Add a global error handler for unhandled errors
window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason;
  if (error?.message?.includes('401')) {
    console.error('Unhandled authentication error:', error.message);
    // Clear token and potentially redirect to login
    setAuthToken(null);
  }
});

// Export a function to reset the query cache when logging out
export function resetQueryCache() {
  console.log('Resetting query cache');
  queryClient.clear();
}
