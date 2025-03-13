import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Separator } from '../ui/separator';
import { Loader2 } from 'lucide-react';
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
        const result = await loginWithGoogle(response.credential);
        
      
        setLoginStatus('success');
        toast({
          title: "Success",
          description: "Google login successful. Redirecting...",
          variant: "default"
        });
      } catch (err) {
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
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Login</CardTitle>
        <CardDescription>Enter your email and password to continue</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {(error || localError) && (
            <Alert variant="destructive">
              <AlertTitle>Login Failed</AlertTitle>
              <AlertDescription>{localError || error}</AlertDescription>
            </Alert>
          )}
          
          {loginStatus === 'success' && (
            <Alert className="bg-green-50 border-green-500 text-green-700">
              <AlertTitle>Login Successful</AlertTitle>
              <AlertDescription>You have been logged in successfully. Redirecting you to the dashboard...</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Enter your email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
            />
          </div>
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading || loginStatus === 'loading'}
          >
            {isLoading || loginStatus === 'loading' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Logging in...
              </>
            ) : 'Login'}
          </Button>

          <div className="relative my-4">
            <Separator />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="bg-white px-2 text-gray-500 text-sm">Or continue with</span>
            </div>
          </div>
          
          <div id="googleButton" className="w-full"></div>
          
          {/* Debug information - only shown in development */}
          {import.meta.env.DEV && (
            <div className="mt-4 p-2 bg-gray-100 rounded text-xs">
              <p>Login Status: {loginStatus}</p>
              <p>Is Loading: {isLoading ? 'true' : 'false'}</p>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
