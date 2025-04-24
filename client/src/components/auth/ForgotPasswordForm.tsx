import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Loader2, Mail, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

interface ForgotPasswordFormProps {
  onBack?: () => void;
}

export function ForgotPasswordForm({ onBack }: ForgotPasswordFormProps) {
  const { sendPasswordResetEmail, error } = useAuth();
  const { toast } = useToast();
  const { resolvedTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!email) {
      setLocalError('Please enter your email address');
      return;
    }

    setIsLoading(true);
    setStatus('loading');
    setLocalError(null);
    
    try {
      const result = await sendPasswordResetEmail(email);
      
      if (result.error) {
        // Handle API-returned error
        setStatus('error');
        setLocalError(result.error);
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive"
        });
      } else {
        // Success case
        setStatus('success');
        toast({
          title: "Email Sent",
          description: result.message || "If an account exists with this email, you will receive password reset instructions.",
          variant: "default"
        });
      }
    } catch (err) {
      setStatus('error');
      
      // We don't want to show specific errors for security reasons
      // Even if the email doesn't exist, we want to show the same message
      toast({
        title: "Password Reset Request Sent",
        description: "If an account exists with this email, you will receive password reset instructions.",
        variant: "default"
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
        {(error || localError) && status !== 'success' && (
          <Alert variant="destructive" className="animate-in fade-in-50 border-red-500 bg-red-50 dark:bg-red-900/20">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{localError || error}</AlertDescription>
          </Alert>
        )}
        
        {status === 'success' && (
          <Alert className="animate-in fade-in-50 border-green-500 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Email Sent</AlertTitle>
            <AlertDescription>
              If an account exists with this email, you will receive password reset instructions.
            </AlertDescription>
          </Alert>
        )}

        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">Reset your password</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Enter your email address and we'll send you instructions to reset your password.
          </p>
        </div>

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
              disabled={isLoading || status === 'loading' || status === 'success'}
            >
              {isLoading || status === 'loading' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  Send Reset Link
                </>
              )}
            </Button>
            
            {onBack && (
              <Button 
                type="button"
                variant="outline" 
                className="mt-2 h-11"
                onClick={onBack}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            )}
          </div>
        </form>
      </div>
    </motion.div>
  );
} 