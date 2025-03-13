import { QueryClient, QueryFunction } from "@tanstack/react-query";
import cookieParser from "cookie-parser";

// Token management functions
// Supports both cookie-based and localStorage token storage
const TOKEN_STORAGE_KEY = 'auth_token';

// Helper function to parse cookies in browser
const getCookieValue = (cookieName: string): string | null => {
  if (typeof document === 'undefined') return null;
  
  const cookies = document.cookie.split(';');
  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i].trim();
    if (cookie.startsWith(cookieName + '=')) {
      return decodeURIComponent(cookie.substring(cookieName.length + 1));
    }
  }
  return null;
};

// Helper function to validate token format and expiration
const isValidToken = (token: string): boolean => {
  if (!token) return false;
  
  // Basic format validation - tokens should have at least 2 parts separated by tabs
  const parts = token.split('\t');
  if (parts.length < 3) {
    return false;
  }
  
  // Check expiration time if the third part is a timestamp
  try {
    const expiryTimestamp = parseInt(parts[2], 10);
    if (isNaN(expiryTimestamp)) return false;
    
    // Check if token is expired
    if (Date.now() / 1000 > expiryTimestamp) {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
};

export const setAuthToken = (token: string | null) => {
  if (token) {
    if (isValidToken(token)) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
};

export const getAuthToken = (): string | null => {
  // First check for session cookie
  const sessionId = getCookieValue('sessionId');
  console.log(sessionId);
  
  if (sessionId && isValidToken(sessionId)) {
    return sessionId;
  }
  
  // If no valid cookie, check localStorage
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token && isValidToken(token)) {
    return token;
  }
  
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
      // Send token in Authorization header, but only if it's valid
      // This handles token-based authentication
      if (isValidToken(token)) {
        headers["Authorization"] = `Bearer ${token}`;
      } else {
        // Clear invalid token from storage
        setAuthToken(null);
      }
    } else {
    }

    // Always include credentials for cookie-based auth support
    const res = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include", // This enables cookie-based authentication
    });

    // Handle authentication errors specifically
    if (res.status === 401) {
      setAuthToken(null);
      // You could trigger a redirect to login here if needed
      // window.location.href = '/auth';
    }

    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    if (error instanceof TypeError) {
    } else {
    }
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
        // Send token in Authorization header, but only if it's valid
        if (isValidToken(token)) {
          headers["Authorization"] = `Bearer ${token}`;
        } else {
          // Clear invalid token from storage
          setAuthToken(null);
        }
      } else {
      }

      // Always include credentials for cookie-based auth
      const res = await fetch(url, {
        credentials: "include", // This enables cookie-based authentication
        headers,
      });

      if (res.status === 401) {
        setAuthToken(null);
        
        if (unauthorizedBehavior === "returnNull") {
          return null;
        }
        
        throw new Error(`401: Unauthorized access to ${url}`);
      }

      await throwIfResNotOk(res);
      return await res.json();
    } catch (error) {
      if (error instanceof TypeError) {
      } else {
      }
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
          setAuthToken(null);
        }
      }
    },
  },
});

// Add a global error handler for unhandled errors
if (typeof window === 'undefined') {
}else{
window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason;
  if (error?.message?.includes('401')) {
    // Clear token and potentially redirect to login
    setAuthToken(null);
  }
});
}

// Export a function to reset the query cache when logging out
export function resetQueryCache() {
  queryClient.clear();
}
