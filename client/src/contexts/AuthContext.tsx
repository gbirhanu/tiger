import { createContext, useContext, useState, useEffect, ReactNode, useMemo, Component, ErrorInfo } from 'react';
import { User as BaseUser } from '../../../shared/schema';
import { useNavigate } from 'react-router-dom';
import { setAuthToken as setApiAuthToken } from '../lib/api';
import { setAuthToken, getAuthToken, resetQueryCache } from '../lib/queryClient';

// Define the Session type based on the server response
interface Session {
  id: string;
  active: boolean;
}

// Extend the User type to include session information
interface User extends BaseUser {
  session?: Session;
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
    // Initialize auth token from stored session on component mount
    const storedToken = localStorage.getItem('sessionToken');
    if (storedToken) {
      
      // Verify if token format looks valid before using it
      if (typeof storedToken === 'string' && storedToken.trim() !== '') {
        updateToken(storedToken);
        
        // Validate the token asynchronously
        (async () => {
          try {
            const isValid = await validateToken();
            
            // If token is invalid, clear it
            if (!isValid) {
              updateToken(null);
            }
          } catch (err) {
          }
        })();
      } else {
        localStorage.removeItem('sessionToken');
      }
    } else {
    }
    
    const fetchUserAndSettings = async () => {
      try {
        const userRes = await fetch('/api/auth/me', {
          credentials: 'include',
          headers: storedToken ? { 
            Authorization: `Bearer ${storedToken}` 
          } : undefined
        });
        
        if (!userRes.ok) {
          throw new Error('Authentication check failed');
        }
        
        const userData = await userRes.json();

        if (userData.user) {
          setUser(userData.user);
          
          // Set the auth token from the active session
          if (userData.user.session && userData.user.session.active) {
            updateToken(userData.user.session.id);
          } else {
            updateToken(null);
          }
          // Fetch user settings
          try {
            const settingsRes = await fetch('/api/settings/user', {
              credentials: 'include',
              headers: { 
                Authorization: `Bearer ${userData.user.session?.id || storedToken}` 
              }
            });
            
            if (!settingsRes.ok) {
            } else {
              const settingsData = await settingsRes.json();
              // Store all user settings
              setSettings(settingsData);
              
              // Update theme or other user settings if they exist
              if (settingsData.theme) {
                setTheme(settingsData.theme);
                document.documentElement.className = settingsData.theme;
              }
            }
          } catch (settingsError) {
          }
        } else {
          setUser(null);
          updateToken(null);
        }
      } catch (error) {
        setUser(null);
        updateToken(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUserAndSettings();
  }, []);

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
      alert("what is recieved:   " + responseText);
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
      // Reset theme to default
      setTheme('light');
      document.documentElement.className = 'light';
      // Reset query cache to clear any authenticated data
      resetQueryCache();
      navigate('/auth');
    } catch (err) {
      // Even if there's an error, we should still clear the local session
      setUser(null);
      setSettings(null);
      updateToken(null);
      // Reset theme to default
      setTheme('light');
      document.documentElement.className = 'light';
      // Reset query cache to clear any authenticated data
      resetQueryCache();
      navigate('/auth');
      setLoading(false);
    }
  };
  // Validate token function
  const validateToken = async (): Promise<boolean> => {
    if (!sessionToken) {
      return false;
    }
    
    
    try {
      const response = await fetch('/api/auth/validate-token', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${sessionToken}`
        },
        credentials: 'include'
      });
      
      // Log response status for debugging
      
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
        }}
      >
        {children}
      </AuthContext.Provider>
    </AuthErrorBoundary>
  );
}