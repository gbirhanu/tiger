import { createContext, useContext, useState, useEffect, ReactNode, useMemo, Component, ErrorInfo } from 'react';
import { User as BaseUser } from '../../../shared/schema';
import { useNavigate } from 'react-router-dom';
import { setAuthToken as setApiAuthToken } from '../lib/api';
import { setAuthToken, getAuthToken, resetQueryCache } from '../lib/queryClient';

// Add window.googleScriptLoading to global interface
declare global {
  interface Window {
    googleScriptLoading?: boolean;
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (element: HTMLElement, config: any) => void;
          prompt: () => void;
        };
      };
    };
  }
}

// Define the Session type based on the server response
interface Session {
  id: string;
  active: boolean;
}

// Extend the User type to include session information
interface User extends Omit<BaseUser, 'role' | 'status'> {
  session?: Session;
  role: 'admin' | 'user';
  status?: 'active' | 'inactive' | 'suspended';
}
interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<User>;
  register: (email: string, password: string, name?: string) => Promise<User>;
  loginWithGoogle: (credential: string) => Promise<User>;
  logout: () => Promise<void>;
  theme: string;
  sessionToken: string | null;
  isAuthenticated: boolean;
  validateToken: () => Promise<boolean>;
  clearErrors: () => void;
  settings: UserSettings | null;
  sendPasswordResetEmail: (email: string) => Promise<{error?: string, message?: string}>;
}

// Create the auth context
const AuthContext = createContext<AuthContextType | null>(null);
// Custom hook to use the auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
// Define a type for user settings
interface UserSettings {
  theme?: string;
  emailNotifications?: boolean;
  taskReminders?: boolean;
  language?: string;
  dateFormat?: string;
  timezone?: string;
  defaultView?: 'list' | 'kanban' | 'calendar';
}

interface AuthProviderProps {
  children: ReactNode;
}
// Error Boundary for Auth Provider
class AuthErrorBoundary extends Component<{ children: ReactNode; onError: (error: Error, errorInfo: ErrorInfo) => void }, { hasError: boolean }> {
  constructor(props: { children: ReactNode; onError: (error: Error, errorInfo: ErrorInfo) => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.props.onError(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="auth-error-boundary">
          <h2>Authentication Error</h2>
          <p>There was a problem with the authentication system. Please try refreshing the page.</p>
          <button onClick={() => this.setState({ hasError: false })}>Try Again</button>
        </div>
      );
    }

    return this.props.children;
  }
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<string>('light');
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const navigate = useNavigate();

  // Unified token management function to avoid code duplication
  const updateToken = (token: string | null) => {
    
    // Validate token if present
    if (token) {
      if (typeof token !== 'string' || token.trim() === '') {
        return;
      }
      
      try {
        // Make sure the token is properly formatted before saving it
        const cleanToken = token.trim();
        
        // Update all token locations for consistency
        setSessionToken(cleanToken);
        localStorage.setItem('sessionToken', cleanToken);
        setAuthToken(cleanToken);
        setApiAuthToken(cleanToken);
        
        // Verify the token was actually set in localStorage (can fail in incognito mode)
        const storedToken = localStorage.getItem('sessionToken');
        if (!storedToken) {
          
        }
      } catch (err) {
        
      }
    } else {
      try {
        // Clear token from all locations
        setSessionToken(null);
        localStorage.removeItem('sessionToken');
        setAuthToken(null);
        setApiAuthToken(null);
        
        // Verify token was cleared from localStorage
        const storedToken = localStorage.getItem('sessionToken');
        if (storedToken) {
          
        }
      } catch (err) {
        
      }
    }
  };

  // Unified error handling function
  const handleError = (err: unknown, defaultMessage: string) => {
    setError(err instanceof Error ? err.message : defaultMessage);
    
    // Check if it's an authentication error
    const errorMessage = err instanceof Error ? err.message : '';
    if (errorMessage.includes('401') || 
        errorMessage.toLowerCase().includes('unauthorized') || 
        errorMessage.toLowerCase().includes('session')) {
      updateToken(null); // Clear token on auth error
    }
  };

  // Check if user is already logged in and fetch their settings
  useEffect(() => {
    let isMounted = true; // Flag to prevent state updates on unmounted component

    const initializeAuth = async () => {
      setLoading(true); // Start loading
      let initialToken: string | null = null;
      let tokenIsValid = false;

      try {
        // 1. Check localStorage for a token
        const storedToken = localStorage.getItem('sessionToken');
        if (storedToken && typeof storedToken === 'string' && storedToken.trim() !== '') {
          initialToken = storedToken.trim();

          // 2. Validate the token with the backend
          try {
            const response = await fetch('/api/auth/validate-token', {
              headers: { Authorization: `Bearer ${initialToken}` },
              credentials: 'include'
            });
            if (response.ok) {
              const data = await response.json();
              if (data.valid === true) {
                tokenIsValid = true;
                // If validation returns user data, we can use it directly
                if (data.user && isMounted) {
                  setUser(data.user);
                  if (data.user.name) localStorage.setItem('userName', data.user.name);
                  if (data.user.session?.id) initialToken = data.user.session.id; // Use session ID from validation if available
                }
              } else {
              }
            } else {
            }
          } catch (validationError) {
            // Treat validation error as invalid token for safety
            tokenIsValid = false;
          }
        } else {
          if (storedToken) localStorage.removeItem('sessionToken'); // Clean up invalid entry
        }

        // 3. If token is valid, set it and fetch user settings
        if (tokenIsValid && initialToken) {
          if (isMounted) {
            updateToken(initialToken); // Set the validated token
            // If user wasn't set during validation, fetch fresh data
            if (!user) { 
              try {
                const userRes = await fetch('/api/auth/me', {
                  credentials: 'include',
                  headers: { Authorization: `Bearer ${initialToken}` }
                });
                if (userRes.ok) {
                  const userData = await userRes.json();
                  if (userData.user && isMounted) {
                    setUser(userData.user);
                    if (userData.user.name) localStorage.setItem('userName', userData.user.name);
                     // Ensure token is synced with session from /me endpoint
                     if (userData.user.session?.id && userData.user.session.id !== initialToken) {
                         updateToken(userData.user.session.id);
                         initialToken = userData.user.session.id;
                     }
                  } else if (isMounted) {
                     setUser(null);
                     updateToken(null);
                     tokenIsValid = false; // Mark as invalid if /me fails
                  }
                } else {
                   if (isMounted) {
                       setUser(null);
                       updateToken(null);
                       tokenIsValid = false; // Mark as invalid if /me fails
                   }
                }
              } catch (fetchMeError) {
                 if (isMounted) {
                     setUser(null);
                     updateToken(null);
                     tokenIsValid = false; // Mark as invalid if /me fails
                 }
              }
            }

            // Now fetch settings only if token is valid and user might be set
             if (tokenIsValid && isMounted) {
                 try {
                     
                     // Don't fetch user settings on the auth page
                     const currentPath = window.location.pathname;
                     if (currentPath === '/auth' || currentPath === '/reset-password') {
                         if (isMounted) {
                             setLoading(false);
                         }
                         return;
                     }
                     
                     const settingsRes = await fetch('/api/user-settings', {
                         credentials: 'include',
                         headers: { Authorization: `Bearer ${initialToken}` }
                     });
                     if (settingsRes.ok) {
                         const settingsData = await settingsRes.json();
                         if (isMounted) {
                            setSettings(settingsData);
                            if (settingsData.theme) {
                                setTheme(settingsData.theme);
                                document.documentElement.className = settingsData.theme;
                            }
                         }
                     } else {
                     }
                 } catch (settingsError) {
                     
                 }
             }
          }
        } else {
          // 4. If no valid token, ensure everything is cleared
          if (isMounted) {
            setUser(null);
            setSettings(null);
            updateToken(null);
          }
        }
      } catch (initError) {
        if (isMounted) {
           setUser(null);
           setSettings(null);
           updateToken(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false); // Stop loading only after all steps
        }
      }
    };

    initializeAuth();

    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, []); // Dependency array is empty, runs once on mount

  // Login function
  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      // Save the raw response for debugging if needed
      const responseText = await response.text();
      
      let data;
      try {
        // Parse the response text
        data = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error('Invalid response from server');
      }

      if (!response.ok) {
        const errorMessage = data.error || 'Login failed';
        throw new Error(errorMessage);
      }

      
      // Validate response structure
      if (!data.user) {
        throw new Error('Invalid response: Missing user data');
      }
      
      // Check session existence
      if (!data.user.session) {
        throw new Error('No active session found');
      }
      
      // Validate session ID - critical for auth
      if (!data.user.session.id) {
        throw new Error('Invalid session: Missing session ID');
      }
      
      if (typeof data.user.session.id !== 'string') {
        throw new Error('Invalid session ID format');
      }
      
      if (data.user.session.id.trim() === '') {
        throw new Error('Empty session ID received');
      }

      
      // Store user information
      setUser(data.user);
      
      // Save user's name in localStorage
      if (data.user.name) {
        localStorage.setItem('userName', data.user.name);
      }
      
      // Save and propagate the session token
      const sessionToken = data.user.session.id;
      updateToken(sessionToken);
      
      return data.user;
    } catch (err) {
      handleError(err, 'Login error');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Register function
  const register = async (email: string, password: string, name?: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password, name }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Registration failed');
      }

      const data = await response.json();
      
      if (!data.user || !data.user.session) {
        throw new Error('No active session found');
      }
      
      // Validate session ID
      if (!data.user.session.id || typeof data.user.session.id !== 'string') {
        throw new Error('Invalid session ID received from server');
      }

      setUser(data.user);
      
      // Save user's name in localStorage
      if (data.user.name) {
        localStorage.setItem('userName', data.user.name);
      }
      
      updateToken(data.user.session.id);
      
      return data.user;
    } catch (err) {
      handleError(err, 'Registration error');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Login with Google
  const loginWithGoogle = async (credential: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ credential }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Google login failed');
      }

      const data = await response.json();
      
      if (!data.user || !data.user.session) {
        throw new Error('No active session found');
      }
      
      // Validate session ID
      if (!data.user.session.id || typeof data.user.session.id !== 'string') {
        throw new Error('Invalid session ID received from server');
      }

      setUser(data.user);
      
      // Save user's name in localStorage
      if (data.user.name) {
        localStorage.setItem('userName', data.user.name);
      }
      
      updateToken(data.user.session.id);
      
      return data.user;
    } catch (err) {
      handleError(err, 'Google login error');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    setLoading(true);
    setError(null);
    try {
      // First clean up any existing Google sign-in related elements
      // This helps prevent the "removeChild" error on re-login
      const googleScript = document.getElementById('google-signin-script');
      if (googleScript && googleScript.parentNode) {
        try {
          // Remove the script properly
          googleScript.parentNode.removeChild(googleScript);
        } catch (e) {
          
        }
      }
      
      // Reset the Google script loading flag to ensure proper reinitialization
      window.googleScriptLoading = false;
      
      // Find and clean up Google sign-in containers
      const googleButtonContainers = document.querySelectorAll('[id^="gsi_"]');
      googleButtonContainers.forEach(container => {
        if (container.parentNode) {
          try {
            container.parentNode.removeChild(container);
          } catch (e) {
            
          }
        }
      });
      
      // Call the logout endpoint
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: sessionToken ? {
          'Authorization': `Bearer ${sessionToken}`
        } : undefined
      });

      // Even if the server returns an error, we should still clear the local session
      if (!response.ok) {
        
      }
      
      // Clear local state
      setUser(null);
      setSettings(null);
      updateToken(null);
      
      // Preserve the user's theme preference from localStorage instead of resetting
      // Try to get the theme from localStorage
      try {
        const savedTheme = localStorage.getItem('theme');
        // Only update if the theme isn't already set in localStorage
        if (!savedTheme || !['light', 'dark', 'system'].includes(savedTheme)) {
          // If no valid theme in localStorage, check system preference
          const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          const preferredTheme = systemPrefersDark ? 'dark' : 'light';
          
          // Set theme based on system preference
          document.documentElement.classList.remove('light', 'dark');
          document.documentElement.classList.add(preferredTheme);
        } else {
          // Theme exists in localStorage, use it
          const resolvedTheme = savedTheme === 'system' 
            ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
            : savedTheme;
            
          // Apply the theme
          document.documentElement.classList.remove('light', 'dark');
          document.documentElement.classList.add(resolvedTheme);
        }
      } catch (e) {
        
        // Fallback in case of error
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add('light');
      }
      
      // Reset query cache to clear any authenticated data
      resetQueryCache();
      
      // Clear any localStorage items that might cause issues on re-login
      localStorage.removeItem('editAppointmentId');
      localStorage.removeItem('profileActiveTab');
      localStorage.removeItem('userName');
      
      // Add a small delay to ensure state updates before navigation
      setTimeout(() => {
        navigate('/auth');
        setLoading(false);
      }, 100);
    } catch (err) {
      // Even if there's an error, we should still clear the local session
      setUser(null);
      setSettings(null);
      updateToken(null);
      
      // Preserve the user's theme preference from localStorage instead of resetting
      try {
        const savedTheme = localStorage.getItem('theme');
        // Only update if the theme isn't already set in localStorage
        if (!savedTheme || !['light', 'dark', 'system'].includes(savedTheme)) {
          // If no valid theme in localStorage, check system preference
          const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          const preferredTheme = systemPrefersDark ? 'dark' : 'light';
          
          // Set theme based on system preference
          document.documentElement.classList.remove('light', 'dark');
          document.documentElement.classList.add(preferredTheme);
        } else {
          // Theme exists in localStorage, use it
          const resolvedTheme = savedTheme === 'system' 
            ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
            : savedTheme;
            
          // Apply the theme
          document.documentElement.classList.remove('light', 'dark');
          document.documentElement.classList.add(resolvedTheme);
        }
      } catch (e) {
        
        // Fallback in case of error
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add('light');
      }
      
      // Reset query cache to clear any authenticated data
      resetQueryCache();
      
      // Clear any localStorage items that might cause issues on re-login
      localStorage.removeItem('editAppointmentId');
      localStorage.removeItem('profileActiveTab');
      localStorage.removeItem('userName');
      
      // Add a small delay to ensure state updates before navigation
      setTimeout(() => {
        navigate('/auth');
        setLoading(false);
      }, 100);
    }
  };
  // Validate token function
  const validateToken = async (): Promise<boolean> => {
    try {
      setLoading(true);
      
      const token = getAuthToken(); // Use the shared token getter function for consistency
      if (!token) {
        setUser(null);
        setLoading(false);
        return false;
      }
      
      
      const response = await fetch('/api/auth/validate-token', {
        headers: {
          Authorization: `Bearer ${token}` // Ensure proper Bearer token format
        },
        credentials: 'include'
      });
      
      
      if (!response.ok) {
        
        // If the token is invalid, clear it
        if (response.status === 401) {
          updateToken(null);
        }
        
        return false;
      }
      
      const data = await response.json();
      
      if (data.valid === true) {
        
        // If the response includes updated user/session info, update it
        if (data.user && data.user.session) {
          setUser(data.user);
        }
        
        return true;
      } else {
        // Token is explicitly invalid, clear it
        updateToken(null);
        return false;
      }
    } catch (err) {
      // Don't clear token on network errors as it might be temporary
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Clear errors function
  const clearErrors = () => {
    setError(null);
  };

  // Compute isAuthenticated state
  const isAuthenticated = useMemo(() => {
    return !!user && !!sessionToken;
  }, [user, sessionToken]);

  // Handle authentication errors
  const handleAuthError = (error: Error, errorInfo: ErrorInfo) => {
    setError(error.message);
    setLoading(false);
  };

  // Password reset email function
  const sendPasswordResetEmail = async (email: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      
      // Check if the request was not successful
      if (!response.ok) {
        handleError(new Error(data.error || 'Failed to send password reset email'), 'Password reset error');
        return data; // Return the error data
      }

      return data;
    } catch (err) {
      handleError(err, 'Password reset error');
      // Don't rethrow the error, just return a generic success message
      return { 
        message: 'If an account exists with this email, password reset instructions have been sent.' 
      };
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthErrorBoundary onError={handleAuthError}>
      <AuthContext.Provider
        value={{
          user,
          loading,
          error,
          login,
          loginWithGoogle,
          register,
          logout,
          theme,
          sessionToken,
          isAuthenticated,
          validateToken,
          clearErrors,
          settings,
          sendPasswordResetEmail,
        }}
      >
        {children}
      </AuthContext.Provider>
    </AuthErrorBoundary>
  );
}
