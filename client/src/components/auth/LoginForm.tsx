import { useState, useEffect, useRef, useId, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Separator } from '../ui/separator';
import { Loader2, Mail, Lock, AlertCircle, LogIn, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';


declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (element: HTMLElement, config: any) => void;
          prompt: () => void;
        };
      };
    };
    // Add a flag to track if the Google script is already loading
    googleScriptLoading?: boolean;
    // Track if Google was properly initialized in this session
    googleInitialized?: boolean;
  }
}

interface LoginFormProps {
  onForgotPassword?: () => void;
}

// Immediate preload of Google Sign-In script to improve loading time
// This runs before the component even mounts
if (!window.googleScriptLoading && !window.google?.accounts?.id) {
  window.googleScriptLoading = true;
  const preloadLink = document.createElement('link');
  preloadLink.rel = 'preload';
  preloadLink.as = 'script';
  preloadLink.href = 'https://accounts.google.com/gsi/client';
  document.head.appendChild(preloadLink);

  const script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  script.defer = true;
  script.id = 'google-signin-script';
  document.head.appendChild(script);
}

export function LoginForm({ onForgotPassword }: LoginFormProps) {
  const { login, loginWithGoogle, error } = useAuth();
  const { toast } = useToast();
  const { resolvedTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loginStatus, setLoginStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [localError, setLocalError] = useState<string | null>(null);
  const [googleButtonReady, setGoogleButtonReady] = useState(false);
  
  // Generate a unique ID for this instance of the component
  const containerId = useId();
  const googleButtonContainerId = `google-button-${containerId}`;
  
  // Define handleGoogleResponse with useCallback to prevent recreation on every render
  const handleGoogleResponse = useCallback(async (response: any) => {
    if (response.credential) {
      setLoginStatus('loading');
      try {
        await loginWithGoogle(response.credential);
        setLoginStatus('success');
        toast({
          title: "Success",
          description: "Google login successful. Redirecting...",
          variant: "default"
        });
      } catch (err) {
        setLoginStatus('error');
        const errorMessage = err instanceof Error ? err.message : 'Unknown error during Google login';
        setLocalError(errorMessage);
        toast({
          title: "Login Failed",
          description: errorMessage,
          variant: "destructive"
        });
      }
    }
  }, [loginWithGoogle, toast, setLoginStatus, setLocalError]);
  
  // Cleanup function for Google sign-in resources
  const cleanupGoogleSignIn = useCallback(() => {
    // Try to gracefully clean up Google resources - avoid direct property access
    try {
      // Use type assertion for advanced Google API features that might exist
      const googleId = window.google?.accounts?.id as any;
      if (googleId && typeof googleId.cancel === 'function') {
        googleId.cancel();
      }
    } catch (err) {
    }
    
    // Clean up the button container
    const container = document.getElementById(googleButtonContainerId);
    if (container) {
      container.innerHTML = '';
    }
  }, [googleButtonContainerId]);
  
  // Define renderGoogleButton at the component top level, not inside useEffect
  const renderGoogleButton = useCallback(() => {
    if (!window.google?.accounts?.id?.renderButton) return false;
    
    // Get the container
    const container = document.getElementById(googleButtonContainerId);
    if (!container) return false;
    
    try {
      // Clear any existing content
      container.innerHTML = '';
      
      // Render the Google button
      window.google.accounts.id.renderButton(
        container,
        { 
          theme: resolvedTheme === 'dark' ? 'filled_black' : 'outline',
          size: 'large', 
          width: '100%',
          text: 'continue_with',
          shape: 'pill',
          logo_alignment: 'center',
          type: 'standard'
        }
      );
      
      // Add CSS to ensure proper alignment of button content
      const googleButtonElement = container.querySelector('div[role="button"]');
      if (googleButtonElement) {
        (googleButtonElement as HTMLElement).style.display = 'flex';
        (googleButtonElement as HTMLElement).style.justifyContent = 'center';
        
        // Create a MutationObserver to ensure alignment is maintained
        // even when Google dynamically updates the button
        const observer = new MutationObserver((mutations) => {
          // Re-apply centering styles when content changes
          (googleButtonElement as HTMLElement).style.display = 'flex';
          (googleButtonElement as HTMLElement).style.justifyContent = 'center';
          
          // Find any child buttons and center them too
          const innerButtons = container.querySelectorAll('button');
          innerButtons.forEach((button) => {
            (button as HTMLElement).style.margin = '0 auto';
          });
        });
        
        // Watch for changes to the button content
        observer.observe(container, { 
          childList: true, 
          subtree: true,
          attributes: true 
        });
      }
      
      setGoogleButtonReady(true);
      return true;
    } catch (err) {
      return false;
    }
  }, [googleButtonContainerId, resolvedTheme, setLocalError, setGoogleButtonReady]);
  
  // Load Google Sign-In script with theme support
  useEffect(() => {
    let isMounted = true;
    
    // Cleanup function that will run on unmount or before re-render
    return () => {
      isMounted = false;
      cleanupGoogleSignIn();
    };
  }, [cleanupGoogleSignIn]); // Add cleanupGoogleSignIn as a dependency
  
  // Handle Google initialization and button rendering
  useEffect(() => {
    let isMounted = true;
    let initTimer: number | null = null;
    
    const initializeGoogle = async () => {
      if (!window.google?.accounts?.id) return false;
      
      try {
        // First try to use the environment variable
        let clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        
        // If not available in environment, fetch from server as fallback
        if (!clientId) {
          try {
            const response = await fetch('/public/google-client-id');
            
            if (!response.ok) {
              throw new Error(`Failed to fetch Google Client ID: ${response.status}`);
            }
            
            const data = await response.json();
            clientId = data.GOOGLE_CLIENT_ID;
          } catch (fetchError) {
            console.error('Error fetching Google Client ID:', fetchError);
            // Continue with initialization attempt even if fetch fails
            // The clientId might still be undefined which we check next
          }
        }
        
        if (!clientId) {
          console.error('Google client ID is not available');
          return false;
        }
        
        // Initialize Google Sign-In with the obtained client ID
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleResponse,
          cancel_on_tap_outside: true,
          ux_mode: 'popup',
        });
        
        // Mark as initialized globally
        window.googleInitialized = true;
        
        // Render button if component is still mounted
        if (isMounted) {
          renderGoogleButton();
        }
        return true;
      } catch (err) {
        console.error('Google initialization error:', err);
        if (isMounted) {
          setLocalError('Failed to initialize Google Sign-In');
        }
        return false;
      }
    };
    
    // Simplified approach with smarter retries
    const attemptInitialization = async () => {
      // Clear any existing timer
      if (initTimer) window.clearTimeout(initTimer);
      
      // Case 1: Already initialized, just render the button
      if (window.googleInitialized && window.google?.accounts?.id) {
        renderGoogleButton();
        return;
      }
      
      // Case 2: Script is loaded but not initialized
      if (window.google?.accounts?.id) {
        if (await initializeGoogle()) {
          return; // Success!
        }
      }
      
      // Case 3: Need to wait for script to load, set retry with backoff
      if (isMounted) {
        // Start with short retry intervals but increase over time to avoid excessive retries
        const retryCount = initTimer ? (parseInt(initTimer.toString()) || 0) + 1 : 0;
        const delay = Math.min(retryCount * 50 + 100, 1000); // Starts at 100ms, caps at 1s
        
        initTimer = window.setTimeout(() => {
          if (isMounted) {
            attemptInitialization();
          }
        }, delay);
      }
    };
    
    // Start initialization immediately
    attemptInitialization();
    
    // Cleanup on unmount or before re-render
    return () => {
      isMounted = false;
      if (initTimer) window.clearTimeout(initTimer);
    };
  }, [handleGoogleResponse, renderGoogleButton]);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setIsLoading(true);
    setLoginStatus('loading');
    setLocalError(null);
    
    try {
      const result = await login(email, password);
      
      // Verify user data and session is received
      if (result && result.session?.id) {
        setLoginStatus('success');
        toast({
          title: "Login Successful",
          description: "You have been logged in successfully.",
          variant: "default"
        });
      } else {
        setLoginStatus('error');
        setLocalError('Authentication failed. Please try again.');
        toast({
          title: "Login Failed",
          description: "Authentication failed. Please try again.",
          variant: "destructive"
        });
      }
    } catch (err) {
      setLoginStatus('error');
      const errorMessage = err instanceof Error ? err.message : 'Unknown error during login';
      setLocalError(errorMessage);
      toast({
        title: "Login Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full"
    >
      <div className="space-y-4">
        {(error || localError) && (
          <Alert variant="destructive" className="animate-in fade-in-50 border-red-500 bg-red-50 dark:bg-red-900/20">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Login Failed</AlertTitle>
            <AlertDescription>{localError || error}</AlertDescription>
          </Alert>
        )}
        
        {loginStatus === 'success' && (
          <Alert className="animate-in fade-in-50 border-green-500 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Login Successful</AlertTitle>
            <AlertDescription>You have been logged in successfully. Redirecting...</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Email Address
            </Label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400 dark:text-gray-500">
                <Mail className="h-4 w-4" />
              </div>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your email"
                className={cn(
                  "pl-10 focus-visible:ring-primary dark:focus-visible:ring-amber-500 border-gray-200 dark:border-gray-700 rounded-lg",
                  "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100",
                  "shadow-sm"
                )}
              />
            </div>
          </div>
          
          <div className="space-y-3 ">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Password
              </Label>
              <button 
                type="button"
                onClick={onForgotPassword}
                className="text-xs text-primary dark:text-amber-400 hover:underline font-medium">
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400 dark:text-gray-500">
                <Lock className="h-4 w-4" />
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
                className={cn(
                  "pl-10 focus-visible:ring-primary dark:focus-visible:ring-amber-500 border-gray-200 dark:border-gray-700 rounded-lg",
                  "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100",
                  "shadow-sm"
                )}
              />
            </div>
          </div>
          <Button 
            type="submit" 
            className={cn(
              "w-full shadow-md rounded-lg h-11 mt-2",
              "text-white font-medium transition-all duration-300",
              resolvedTheme === 'dark'
                ? "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
                : "bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            )}
            disabled={isLoading || loginStatus === 'loading'}
          >
            {isLoading || loginStatus === 'loading' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Logging in...
              </>
            ) : (
              <>
                <LogIn className="mr-2 h-4 w-4" />
                Sign In
              </>
            )}
          </Button>
          
          <div className="relative my-6">
            <Separator className="bg-gray-200 dark:bg-gray-700" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="bg-white dark:bg-gray-900 px-2 text-sm text-gray-500 dark:text-gray-400">
                Or continue with
              </span>
            </div>
          </div>
          
          <div className="w-full min-h-11 flex justify-center items-center">
            {!googleButtonReady ? (
              <Button
                type="button"
                variant="outline"
                disabled={true}
                className="w-full h-11 flex items-center justify-center gap-2 font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-full"
              >
                {/* Simple Google "G" SVG Icon */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" className="mr-2">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              </Button>
            ) : null}
            <div 
              id={googleButtonContainerId}
              className="w-full min-h-11 flex justify-center"
            />
          </div>
        </form>
      </div>
    </motion.div>
  );
}

