import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Separator } from '../ui/separator';
import { Loader2, Mail, Lock, AlertCircle, UserRound, CheckCircle2, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';
import { cn, safeDOM } from '@/lib/utils';

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
  }
}

export function RegisterForm() {
  const { register, loginWithGoogle, error } = useAuth();
  const { toast } = useToast();
  const { resolvedTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [registerStatus, setRegisterStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [localError, setLocalError] = useState<string | null>(null);
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const googleInitializedRef = useRef(false);
  
  // Define Google response handler first, before it's used in the useEffect
  const handleGoogleResponse = async (response: any) => {
    if (!response || !response.credential) {
      setLocalError('Google sign-in failed. Please try again.');
      return;
    }
    
    try {
      setIsLoading(true);
      const result = await loginWithGoogle(response.credential);
      
      if (result) {
        setRegisterStatus('success');
        toast({
          title: "Success",
          description: "Google sign-up successful. Redirecting...",
          variant: "default"
        });
      } else {
        setRegisterStatus('error');
        setLocalError('Registration failed. Please try again.');
        toast({
          title: "Registration Failed",
          description: "Registration failed. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      setLocalError(error.message || 'An error occurred during registration');
      toast({
        title: "Registration Error",
        description: error.message || 'An error occurred during registration',
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Load Google Sign-In script with theme support
  useEffect(() => {
    // Only initialize Google once
    let clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.error('Google client ID is not defined');
      return;
    }
    if (!googleInitializedRef.current && window.google?.accounts) {
      googleInitializedRef.current = true;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleResponse,
        cancel_on_tap_outside: true,
        ux_mode: 'popup',
      });
    }

    // Render the button if Google is available and the button ref exists
    const renderGoogleButton = () => {
      if (window.google?.accounts && googleButtonRef.current) {
        // Clear previous content safely using our utility
        safeDOM.clearChildren(googleButtonRef.current);
        
        try {
          window.google.accounts.id.renderButton(
            googleButtonRef.current,
            { 
              theme: resolvedTheme === 'dark' ? 'filled_black' : 'outline',
              size: 'large', 
              width: '100%',
              text: 'signup_with',
              shape: 'pill',
              logo_alignment: 'center',
            }
          );
        } catch (err) {
        }
      }
    };

    // If Google is already loaded, render the button
    if (window.google?.accounts) {
      renderGoogleButton();
      return;
    }
    
    // Check periodically if Google API is loaded, then render
    const checkGoogleInterval = setInterval(() => {
      if (window.google?.accounts) {
        clearInterval(checkGoogleInterval);
        // Initialize if not already done (though LoginForm usually handles this)
        if (!googleInitializedRef.current) {
          googleInitializedRef.current = true;
          try {
            window.google.accounts.id.initialize({
              client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
              callback: handleGoogleResponse,
              cancel_on_tap_outside: true,
              ux_mode: 'popup',
            });
          } catch (err) {
          }
        }
        renderGoogleButton();
      }
    }, 100); // Check every 100ms

    // Cleanup interval on component unmount
    return () => clearInterval(checkGoogleInterval);

    // No cleanup needed on theme changes
  }, [resolvedTheme, handleGoogleResponse]);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setIsLoading(true);
    setRegisterStatus('loading');
    setLocalError(null);
    
    try {
      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }
      
      const result = await register(email, password, name);
      
      // Verify user data and session is received
      if (result && result.session?.id) {
        setRegisterStatus('success');
      toast({
          title: "Registration Successful",
          description: "Your account has been created. Logging you in...",
        variant: "default"
      });
      } else {
        setRegisterStatus('error');
        setLocalError('Registration failed. Please try again.');
        toast({
          title: "Registration Failed",
          description: "Registration failed. Please try again.",
          variant: "destructive"
        });
      }
    } catch (err) {
      setRegisterStatus('error');
      const errorMessage = err instanceof Error ? err.message : 'Unknown error during registration';
      setLocalError(errorMessage);
      toast({
        title: "Registration Error",
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
              <AlertTitle>Registration Failed</AlertTitle>
              <AlertDescription>{localError || error}</AlertDescription>
            </Alert>
          )}
          
        {registerStatus === 'success' && (
          <Alert className="animate-in fade-in-50 border-green-500 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Registration Successful</AlertTitle>
            <AlertDescription>Your account has been created. Logging you in...</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <Label htmlFor="name" className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Your Name
            </Label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400 dark:text-gray-500">
                <User className="h-4 w-4" />
              </div>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Enter your name"
                className={cn(
                  "pl-10 focus-visible:ring-primary dark:focus-visible:ring-amber-500 border-gray-200 dark:border-gray-700 rounded-lg",
                  "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100",
                  "shadow-sm"
                )}
              />
            </div>
          </div>
          
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
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Password
            </Label>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Min. 6 characters
              </div>
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
                placeholder="Create a password"
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
            disabled={isLoading || registerStatus === 'loading'}
          >
            {isLoading || registerStatus === 'loading' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              <>
                <UserRound className="mr-2 h-4 w-4" />
                Create Account
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
          
          <div 
            ref={googleButtonRef} 
            className="w-full min-h-11 flex justify-center items-center"
          >
            {!window.google && (
              <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading Google Sign-In...
              </div>
            )}
          </div>
        </form>
      </div>
    </motion.div>
  );
} 