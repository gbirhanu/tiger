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
    console.error('AuthContext Error:', error, errorInfo);
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
    console.debug(`[Auth] Updating token: ${token ? `${token.substring(0, 5)}...` : 'null'}`);
    
    // Validate token if present
    if (token) {
      if (typeof token !== 'string' || token.trim() === '') {
        console.error('[Auth] Invalid token format - not setting token');
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
        
        console.debug(`[Auth] Token stored successfully: ${cleanToken.substring(0, 5)}...`);
        
        // Verify the token was actually set in localStorage (can fail in incognito mode)
        const storedToken = localStorage.getItem('sessionToken');
        if (!storedToken) {
          console.warn('[Auth] Failed to store token in localStorage - possibly in private browsing mode');
        }
      } catch (err) {
        console.error('[Auth] Error while setting auth token:', err);
      }
    } else {
      console.debug('[Auth] Clearing authentication token');
      try {
        // Clear token from all locations
        setSessionToken(null);
        localStorage.removeItem('sessionToken');
        setAuthToken(null);
        setApiAuthToken(null);
        
        // Verify token was cleared from localStorage
        const storedToken = localStorage.getItem('sessionToken');
        if (storedToken) {
          console.warn('[Auth] Failed to remove token from localStorage');
        }
      } catch (err) {
        console.error('[Auth] Error while clearing auth token:', err);
      }
    }
  };

  // Unified error handling function
  const handleError = (err: unknown, defaultMessage: string) => {
    console.error(`${defaultMessage}:`, err);
    setError(err instanceof Error ? err.message : defaultMessage);
    
    // Check if it's an authentication error
    const errorMessage = err instanceof Error ? err.message : '';
    if (errorMessage.includes('401') || 
        errorMessage.toLowerCase().includes('unauthorized') || 
        errorMessage.toLowerCase().includes('session')) {
      console.debug('[Auth] Authentication error detected, clearing token');
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
            // Handle error silently
          }
        })();
      } else {
        localStorage.removeItem('sessionToken');
      }
    }
    
    const fetchUserAndSettings = async () => {
      try {
        const token = getAuthToken();
        const userRes = await fetch('/api/auth/me', {
          credentials: 'include',
          headers: token ? { 
            Authorization: `Bearer ${token}` 
          } : undefined
        });
        
        if (!userRes.ok) {
          throw new Error('Authentication check failed');
        }
        
        const userData = await userRes.json();

        if (userData.user) {
          setUser(userData.user);
          
          // Save user's name in localStorage
          if (userData.user.name) {
            localStorage.setItem('userName', userData.user.name);
          }
          
          // Set the auth token from the active session
          if (userData.user.session && userData.user.session.active) {
            console.debug('[Auth] User has active session - updating token');
            updateToken(userData.user.session.id);
          } else {
            console.warn('[Auth] User has no active session');
            updateToken(null);
          }
          // Fetch user settings
          try {
            const settingsRes = await fetch('/api/settings/user', {
              credentials: 'include',
              headers: { 
                Authorization: `Bearer ${userData.user.session?.id || token}` 
              }
            });
            
            if (!settingsRes.ok) {
              console.warn('Failed to fetch user settings:', settingsRes.statusText);
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
            console.warn('Error fetching user settings:', settingsError);
          }
        } else {
          
          setUser(null);
          updateToken(null);
        }
      } catch (error) {
        console.error('Error checking authentication status:', error);
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
    
    console.debug('[Auth] Attempting login for email:', email);
    
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
      console.debug('[Auth] Login response status:', response.status);
      
      let data;
      try {
        // Parse the response text
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('[Auth] Failed to parse login response:', responseText);
        throw new Error('Invalid response from server');
      }

      if (!response.ok) {
        const errorMessage = data.error || 'Login failed';
        console.error('[Auth] Login failed with status:', response.status, errorMessage);
        throw new Error(errorMessage);
      }

      console.debug('[Auth] Login response data:', JSON.stringify(data));
      
      // Validate response structure
      if (!data.user) {
        console.error('[Auth] Missing user in login response:', data);
        throw new Error('Invalid response: Missing user data');
      }
      
      // Check session existence
      if (!data.user.session) {
        console.error('[Auth] Missing session in login response:', data.user);
        throw new Error('No active session found');
      }
      
      // Validate session ID - critical for auth
      if (!data.user.session.id) {
        console.error('[Auth] Missing session ID in login response:', data.user.session);
        throw new Error('Invalid session: Missing session ID');
      }
      
      if (typeof data.user.session.id !== 'string') {
        console.error('[Auth] Session ID is not a string:', typeof data.user.session.id);
        throw new Error('Invalid session ID format');
      }
      
      if (data.user.session.id.trim() === '') {
        console.error('[Auth] Empty session ID received');
        throw new Error('Empty session ID received');
      }

      console.debug('[Auth] Login successful, setting user and session token');
      
      // Store user information
      setUser(data.user);
      
      // Save user's name in localStorage
      if (data.user.name) {
        localStorage.setItem('userName', data.user.name);
      }
      
      // Save and propagate the session token
      const sessionToken = data.user.session.id;
      console.debug(`[Auth] Setting session token: ${sessionToken.substring(0, 5)}...`);
      updateToken(sessionToken);
      
      return data.user;
    } catch (err) {
      console.error('[Auth] Login process failed:', err);
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

      console.debug('[Auth] Registration successful, setting user and token');
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

      console.debug('[Auth] Google login successful, setting user and token');
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
          console.warn('Error removing Google script:', e);
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
            console.warn('Error removing Google container:', e);
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
        console.warn('Server logout failed, clearing session locally');
      }
      
      // Clear local state
      console.debug('[Auth] Logging out user, clearing user data and token');
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
        console.warn('Error accessing theme preference:', e);
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
      console.error('Logout error:', err);
      
      // Even if there's an error, we should still clear the local session
      console.debug('[Auth] Logout encountered an error, still clearing user data and token');
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
        console.warn('Error accessing theme preference:', e);
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
        console.debug('[Auth] No token to validate');
        setUser(null);
        setLoading(false);
        return false;
      }
      
      console.debug(`[Auth] Validating token: ${token.substring(0, 5)}...`);
      
      const response = await fetch('/api/auth/validate-token', {
        headers: {
          Authorization: `Bearer ${token}` // Ensure proper Bearer token format
        },
        credentials: 'include'
      });
      
      // Log response status for debugging
      console.debug('[Auth] Token validation response status:', response.status);
      
      if (!response.ok) {
        console.warn('[Auth] Token validation failed with status:', response.status);
        
        // If the token is invalid, clear it
        if (response.status === 401) {
          console.debug('[Auth] Clearing invalid token');
          updateToken(null);
        }
        
        return false;
      }
      
      const data = await response.json();
      
      if (data.valid === true) {
        console.debug('[Auth] Token validated successfully');
        
        // If the response includes updated user/session info, update it
        if (data.user && data.user.session) {
          console.debug('[Auth] Updating user data from validation response');
          setUser(data.user);
        }
        
        return true;
      } else {
        console.warn('[Auth] Server returned valid:false for token');
        // Token is explicitly invalid, clear it
        updateToken(null);
        return false;
      }
    } catch (err) {
      console.error('[Auth] Token validation error:', err);
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
    console.error('Auth Error Boundary caught an error:', error, errorInfo);
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
