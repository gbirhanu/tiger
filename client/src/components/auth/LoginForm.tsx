import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../ui/card';
import { Label } from '../ui/label';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Separator } from '../ui/separator';
import { Loader2, Mail, Lock, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
  }
}

export function LoginForm() {
  const { login, loginWithGoogle, error } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loginStatus, setLoginStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    // Load Google Sign-In script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    script.onload = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          callback: handleGoogleResponse,
        });

        window.google.accounts.id.renderButton(
          document.getElementById('googleButton')!,
          { theme: 'outline', size: 'large', width: '100%' }
        );
      }
    };

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handleGoogleResponse = async (response: any) => {
    if (response.credential) {
      setLoginStatus('loading');
      try {
        console.log('Google login credential received, attempting login...');
        const result = await loginWithGoogle(response.credential);
        
        console.debug('Login response:', result);
        console.debug('Google login successful');
        setLoginStatus('success');
        toast({
          title: "Success",
          description: "Google login successful. Redirecting...",
          variant: "default"
        });
      } catch (err) {
        console.error('Google login error:', err);
        setLoginStatus('error');
        setLocalError(err instanceof Error ? err.message : 'Unknown error during Google login');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setIsLoading(true);
    setLoginStatus('loading');
    setLocalError(null);
    
    try {
      console.log('Attempting login with email and password...');
      const result = await login(email, password);
      
      console.debug('Login response:', result);
      
      // Verify user data and session is received
      if (result && result.session?.id) {
        console.debug('Session token received:', result.session.id);
        setLoginStatus('success');
        toast({
          title: "Login Successful",
          description: "You have been logged in successfully.",
          variant: "default"
        });
      } else {
        console.error('No session token in login response');
        setLoginStatus('error');
        setLocalError('Authentication failed. Please try again.');
        toast({
          title: "Login Failed",
          description: "Authentication failed. Please try again.",
          variant: "destructive"
        });
      }
    } catch (err) {
      console.error('Login error:', err);
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
    <Card className="w-[400px] shadow-lg border-muted/30">
      <CardHeader className="space-y-2 pb-4">
        
        <CardTitle className="text-2xl font-bold text-center bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">Welcome Back</CardTitle>
        <CardDescription className="text-center">Enter your credentials to access your account</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {(error || localError) && (
            <Alert variant="destructive" className="animate-in fade-in-50">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Login Failed</AlertTitle>
              <AlertDescription>{localError || error}</AlertDescription>
            </Alert>
          )}
          
          {loginStatus === 'success' && (
            <Alert className="bg-green-50 border-green-500 text-green-700 animate-in fade-in-50">
              <AlertTitle>Login Successful</AlertTitle>
              <AlertDescription>You have been logged in successfully. Redirecting...</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">
              Email
            </Label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                <Mail className="h-4 w-4" />
              </div>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your email"
                className="pl-10 focus-visible:ring-primary"
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <a href="#" className="text-xs text-primary hover:underline">
                Forgot password?
              </a>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                <Lock className="h-4 w-4" />
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
                className="pl-10 focus-visible:ring-primary"
              />
            </div>
          </div>
          <Button 
            type="submit" 
            className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all duration-300 shadow-md" 
            disabled={isLoading || loginStatus === 'loading'}
          >
            {isLoading || loginStatus === 'loading' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Logging in...
              </>
            ) : 'Sign In'}
          </Button>

          <div className="relative my-6">
            <Separator />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="bg-card px-2 text-muted-foreground text-sm">Or continue with</span>
            </div>
          </div>
          
          <div id="googleButton" className="w-full h-10"></div>
          
          
        </form>
      </CardContent>
      <CardFooter className="flex justify-center border-t p-4">
        <p className="text-sm text-muted-foreground">
          Don't have an account?{" "}
          <a href="#register" className="text-primary hover:underline font-medium">
            Create account
          </a>
        </p>
      </CardFooter>
    </Card>
  );
}
