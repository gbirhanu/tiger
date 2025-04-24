import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Loader2, Lock, AlertCircle, CheckCircle2, ArrowLeft, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { resolvedTheme } = useTheme();
  const [token, setToken] = useState<string>('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [requestMode, setRequestMode] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);
  
  // Get token from URL when component mounts
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tokenParam = params.get('token');
    if (tokenParam) {
      setToken(tokenParam);
      setRequestMode(false);
    } else {
      // No token, switch to request mode
      setRequestMode(true);
    }
  }, [location]);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    
    if (requestMode) {
      await handleRequestReset();
      return;
    }
    
    // Client-side validation
    if (!password) {
      setError('Please enter a new password');
      return;
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    setIsLoading(true);
    setStatus('loading');
    setError(null);
    
    try {
      const response = await fetch('/api/auth/reset-password/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          newPassword: password,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to reset password');
      }
      
      setStatus('success');
      toast({
        title: "Password Reset Successful",
        description: "Your password has been reset successfully.",
        variant: "default"
      });
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/auth');
      }, 2000);
    } catch (err) {
      setStatus('error');
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      toast({
        title: "Password Reset Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestReset = async (): Promise<void> => {
    // Client-side validation
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    
    setIsLoading(true);
    setStatus('loading');
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
      
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to send password reset email');
      }
      
      setStatus('success');
      setRequestSuccess(true);
      toast({
        title: "Request Sent",
        description: data.message || "If an account exists with this email, a password reset link will be sent.",
        variant: "default"
      });
    } catch (err) {
      setStatus('error');
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      toast({
        title: "Request Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-white dark:from-gray-950 dark:via-black dark:to-gray-950 flex items-center justify-center p-4 sm:p-6 md:p-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md bg-white dark:bg-gray-900 p-6 rounded-xl shadow-lg"
      >
        <div className="space-y-4">
          {error && status !== 'success' && (
            <Alert variant="destructive" className="animate-in fade-in-50 border-red-500 bg-red-50 dark:bg-red-900/20">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {status === 'success' && !requestMode && (
            <Alert className="animate-in fade-in-50 border-green-500 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300">
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Password Reset Successful</AlertTitle>
              <AlertDescription>
                Your password has been reset successfully. You will be redirected to the login page shortly.
              </AlertDescription>
            </Alert>
          )}
          
          {requestSuccess && (
            <Alert className="animate-in fade-in-50 border-green-500 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300">
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Check Your Email</AlertTitle>
              <AlertDescription>
                If an account exists with this email, we've sent a password reset link. 
                Please check your inbox and spam folder.
              </AlertDescription>
            </Alert>
          )}

          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
              {requestMode ? "Reset your password" : "Create new password"}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {requestMode 
                ? "Enter your email to receive a password reset link." 
                : "Enter your new password below to reset your account password."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {requestMode ? (
              // Request Reset Form
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
                    placeholder="Enter your email address"
                    className={cn(
                      "pl-10 focus-visible:ring-primary dark:focus-visible:ring-amber-500 border-gray-200 dark:border-gray-700 rounded-lg",
                      "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100",
                      "shadow-sm"
                    )}
                  />
                </div>
              </div>
            ) : (
              // Reset Password Form (with token)
              <>
                <div className="space-y-3">
                  <Label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    New Password
                  </Label>
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
                      placeholder="Enter your new password"
                      className={cn(
                        "pl-10 focus-visible:ring-primary dark:focus-visible:ring-amber-500 border-gray-200 dark:border-gray-700 rounded-lg",
                        "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100",
                        "shadow-sm"
                      )}
                    />
                  </div>
                </div>
                
                <div className="space-y-3">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    Confirm Password
                  </Label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400 dark:text-gray-500">
                      <Lock className="h-4 w-4" />
                    </div>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="Confirm your new password"
                      className={cn(
                        "pl-10 focus-visible:ring-primary dark:focus-visible:ring-amber-500 border-gray-200 dark:border-gray-700 rounded-lg",
                        "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100",
                        "shadow-sm"
                      )}
                    />
                  </div>
                </div>
              </>
            )}
            
            <div className="flex space-x-4">
              <Button 
                type="submit" 
                className={cn(
                  "flex-1 shadow-md rounded-lg h-11 mt-2",
                  "text-white font-medium transition-all duration-300",
                  resolvedTheme === 'dark'
                    ? "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
                    : "bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                )}
                disabled={isLoading || (status === 'success' && !requestMode) || requestSuccess}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {requestMode ? "Sending..." : "Resetting..."}
                  </>
                ) : (
                  <>
                    {requestMode ? "Send Reset Link" : "Reset Password"}
                  </>
                )}
              </Button>
              
              <Button 
                type="button"
                variant="outline" 
                className="mt-2 h-11"
                onClick={handleBack}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
} 