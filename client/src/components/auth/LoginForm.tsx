import { useState, useEffect, useRef, useId } from 'react';
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

export function LoginForm() {
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
  
  // Define handleGoogleResponse before it's used in useEffect
  const handleGoogleResponse = async (response: any) => {
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
  };
  
  // Cleanup function for Google sign-in resources
  const cleanupGoogleSignIn = () => {
    // Try to gracefully clean up Google resources - avoid direct property access
    try {
      // Use type assertion for advanced Google API features that might exist
      const googleId = window.google?.accounts?.id as any;
      if (googleId && typeof googleId.cancel === 'function') {
        googleId.cancel();
      }
    } catch (err) {
      console.warn('Error during Google sign-in cleanup:', err);
    }
    
    // Clean up the button container
    const container = document.getElementById(googleButtonContainerId);
    if (container) {
      container.innerHTML = '';
    }
  };
  
  // Load Google Sign-In script with theme support
  useEffect(() => {
    let isMounted = true;
    
    // Cleanup function that will run on unmount or before re-render
    return () => {
      isMounted = false;
      cleanupGoogleSignIn();
    };
  }, []); // Empty dependency array - only run on mount/unmount
  
  // Handle Google initialization and button rendering
  useEffect(() => {
    let isMounted = true;
    
    const initializeGoogle = () => {
      if (!window.google?.accounts?.id?.initialize) return;
      
      try {
        // Initialize Google sign-in
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          callback: handleGoogleResponse,
          cancel_on_tap_outside: true,
          ux_mode: 'popup',
        });
        
        // Mark as initialized globally to avoid re-initializing
        window.googleInitialized = true;
        
        // Render button if component is still mounted
        if (isMounted) {
          renderGoogleButton();
        }
      } catch (err) {
        console.error('Error initializing Google Sign-In:', err);
        if (isMounted) {
          setLocalError('Failed to initialize Google Sign-In');
        }
      }
    };
    
    const renderGoogleButton = () => {
      if (!window.google?.accounts?.id?.renderButton) return;
      
      // Get the container
      const container = document.getElementById(googleButtonContainerId);
      if (!container) return;
      
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
          }
        );
        
        setGoogleButtonReady(true);
      } catch (err) {
        console.error('Error rendering Google button:', err);
        if (isMounted) {
          setLocalError('Failed to render Google Sign-In button');
        }
      }
    };
    
    // Start Google integration based on current state
    const startGoogleIntegration = () => {
      // If already initialized globally, just render the button
      if (window.googleInitialized && window.google?.accounts?.id) {
        renderGoogleButton();
        return;
      }
      
      // If Google API is already loaded but not initialized
      if (window.google?.accounts?.id && !window.googleInitialized) {
        initializeGoogle();
        return;
      }
      
      // If script is already loading, just wait
      if (window.googleScriptLoading) {
        return;
      }
      
      // Need to load the script
      window.googleScriptLoading = true;
      
      // Create and add script
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.id = 'google-signin-script';
      
      script.onload = () => {
        if (!isMounted) return;
        
        if (window.google?.accounts?.id) {
          initializeGoogle();
        } else {
          setLocalError('Google Sign-In failed to load properly');
          window.googleScriptLoading = false;
        }
      };
      
      script.onerror = () => {
        if (!isMounted) return;
        
        console.error('Failed to load Google Sign-In script');
        setLocalError('Failed to load Google Sign-In. Please check your internet connection.');
        window.googleScriptLoading = false;
      };
      
      document.body.appendChild(script);
    };
    
    // Start the process
    startGoogleIntegration();
    
    // Cleanup on unmount or before re-render
    return () => {
      isMounted = false;
    };
  }, [resolvedTheme, handleGoogleResponse, googleButtonContainerId]);

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
              <a href="#" className="text-xs text-primary dark:text-amber-400 hover:underline font-medium">
                Forgot password?
              </a>
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
              <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading Google Sign-In...
              </div>
            ) : null}
            <div 
              id={googleButtonContainerId}
              className="w-fit min-h-11"
            />
          </div>
        </form>
      </div>
    </motion.div>
  );
}

