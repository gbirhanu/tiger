import { useState, useEffect } from 'react';
import { LoginForm } from '../components/auth/LoginForm';
import { RegisterForm } from '../components/auth/RegisterForm';
import { ForgotPasswordForm } from '../components/auth/ForgotPasswordForm';
import { Button } from '../components/ui/button';
import { Flame, CheckCircle2, Zap, Clock, Calendar, Sparkles, BookOpen } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTheme } from '@/contexts/ThemeContext';

// Define Theme type to match the one in ThemeContext
type Theme = 'light' | 'dark' | 'system';

// Auth mode enum
type AuthMode = 'login' | 'register' | 'forgot-password';

export default function AuthPage() {
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  // Simpler initialization - just set mounted state when component loads
  useEffect(() => {
    // Simply mark as mounted - ThemeContext already handles theme initialization
    setMounted(true);
  }, []);

  const features = [
    {
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
      title: "Task Management",
      description: "Create, organize, and track tasks with powerful subtask functionality"
    },
    {
      icon: <Clock className="h-5 w-5 text-blue-500" />,
      title: "Time Tracking",
      description: "Monitor productivity and focus time with built-in time tracking"
    },
    {
      icon: <Calendar className="h-5 w-5 text-purple-500" />,
      title: "Calendar Integration",
      description: "Seamlessly integrate with your calendar for appointments and events"
    },
    {
      icon: <BookOpen className="h-5 w-5 text-amber-500" />,
      title: "Rich Note Taking",
      description: "Capture ideas with markdown support and AI-enhanced editing"
    },
    {
      icon: <Sparkles className="h-5 w-5 text-indigo-500" />,
      title: "AI Assistance",
      description: "Generate content and get smart suggestions powered by Gemini"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-white dark:from-gray-950 dark:via-black dark:to-gray-950 flex items-center justify-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-7xl overflow-hidden rounded-2xl shadow-2xl flex flex-col md:flex-row bg-white dark:bg-gray-900 backdrop-blur-sm bg-opacity-80 dark:bg-opacity-90">
        {/* Left Column - App Info */}
        <div className="relative md:w-1/2 p-8 md:p-12 bg-gradient-to-br from-primary/5 via-primary/10 to-primary/20 dark:from-primary/5 dark:via-primary/10 dark:to-primary/15 overflow-hidden">
          {/* Background Elements */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-10 dark:opacity-20">
            <div className="absolute top-[10%] left-[15%] w-64 h-64 rounded-full bg-purple-400 dark:bg-purple-600 blur-3xl animate-pulse-slow"></div>
            <div className="absolute bottom-[20%] right-[10%] w-72 h-72 rounded-full bg-blue-400 dark:bg-blue-600 blur-3xl animate-pulse-slow animation-delay-2000"></div>
            <div className="absolute top-[40%] right-[30%] w-40 h-40 rounded-full bg-amber-400 dark:bg-amber-600 blur-3xl animate-pulse-slow animation-delay-4000"></div>
          </div>
          
          <div className="relative z-10">
            {/* App Logo & Name - Updated to match Dashboard */}
            <div className="flex items-center mb-10">
              <div className="flex items-center justify-center
                rounded-full
                bg-gradient-to-br from-yellow-500 to-amber-700
                p-1
                shadow-lg
                group-hover:from-yellow-400 group-hover:to-amber-600
                transition-all
                duration-300
                transform hover:scale-105
                border-2 border-yellow-400/40
                mr-4
              ">
                {mounted && resolvedTheme ? (
                  <img 
                    src="/assets/tiger_logo.png" 
                    alt="Tiger" 
                    className="h-8 w-8 drop-shadow-md" 
                  />
                ) : (
                  <Flame className="h-8 w-8 text-white drop-shadow-md" />
                )}
              </div>
              <div className="flex items-center">
                <h1 className="text-3xl
                  font-extrabold
                  bg-gradient-to-r from-yellow-500 to-amber-700
                  bg-clip-text text-transparent
                  hover:from-yellow-400 hover:to-amber-600
                  transition-colors
                  duration-300
                  cursor-pointer
                ">Tiger</h1>
                <span className="text-xs text-amber-500 ml-0.5">
                  <sup className="font-semibold">TM</sup>
                </span>
              </div>
            </div>
            
            {/* Hero Message */}
            <div className="mb-10">
              <h2 className="text-3xl md:text-4xl font-bold leading-tight text-gray-900 dark:text-white mb-4 tracking-tight">
                Organize your work and <span className="text-amber-600">boost productivity</span>
              </h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-lg">
                Tiger helps you manage tasks, track time, take notes, and stay organized with powerful AI assistance.
              </p>
            </div>
            
            {/* App Screenshot/Illustration - 3D Effect */}
            <div className="mb-10 group">
              <div className="relative transform perspective-1000 transition-all duration-500 hover:rotate-y-3 hover:-rotate-x-2 hover:scale-[1.01] cursor-pointer">
                {/* Shadow and Border */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-gray-400/10 to-gray-500/10 dark:from-gray-500/15 dark:to-gray-600/15 blur-md transform -translate-y-1 translate-x-1 group-hover:-translate-y-2 group-hover:translate-x-2 transition-all duration-500"></div>
                
                {/* Card Container */}
                <div className="p-3 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 relative z-10 transform transition-all duration-300 group-hover:shadow-xl">
                  {/* Screen Glare Effect */}
                  <div className="absolute inset-0 overflow-hidden rounded-lg">
                    <div className="absolute -inset-x-full top-0 h-[250%] w-[200%] -rotate-45 bg-gradient-to-r from-transparent via-white/30 dark:via-white/20 to-transparent transform -translate-x-full group-hover:translate-x-full transition-all duration-1000 ease-in-out"></div>
                  </div>
                  
                  {/* Image */}
                  <div className="rounded-lg overflow-hidden shadow-inner ring-1 ring-black/5 dark:ring-amber-500/20">
                    {mounted && (
                      <img 
                        src={resolvedTheme === 'dark' ? '/assets/dark_preview.png' : '/assets/light_preview.png'} 
                        alt="Tiger App Dashboard" 
                        className="w-full h-auto object-cover"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Features List */}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-amber-300 mb-6 tracking-tight">Everything you need to stay productive</h3>
              <div className="space-y-5">
                {features.map((feature, index) => (
                  <div 
                    key={index} 
                    className="flex items-start gap-4 p-3 rounded-lg hover:bg-white/50 dark:hover:bg-gray-800/70 transition-colors duration-300"
                  >
                    <div className="flex-shrink-0 p-2 bg-white dark:bg-gray-800 rounded-full shadow-sm ring-1 ring-black/5 dark:ring-amber-500/20">
                      {feature.icon}
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white tracking-tight">{feature.title}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Auth Forms */}
        <div className="md:w-1/2 p-6 md:p-12 bg-white dark:bg-gray-900 flex flex-col">
          <div className="w-full max-w-md mx-auto">
            {/* Auth Tabs - Now with 3 options */}
            <div className="flex space-x-2 mb-8 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg shadow-inner">
              <Button
                variant={authMode === 'login' ? "default" : "ghost"}
                className={cn(
                  "flex-1 font-medium transition-all duration-200",
                  authMode === 'login' 
                    ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm" 
                    : "text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                )}
                onClick={() => setAuthMode('login')}
              >
                Login
              </Button>
              <Button
                variant={authMode === 'register' ? "default" : "ghost"}
                className={cn(
                  "flex-1 font-medium transition-all duration-200",
                  authMode === 'register' 
                    ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm" 
                    : "text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                )}
                onClick={() => setAuthMode('register')}
              >
                Register
              </Button>
              <Button
                variant={authMode === 'forgot-password' ? "default" : "ghost"}
                className={cn(
                  "flex-1 font-medium transition-all duration-200",
                  authMode === 'forgot-password' 
                    ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm" 
                    : "text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                )}
                onClick={() => setAuthMode('forgot-password')}
              >
                Reset
              </Button>
            </div>

            {/* Forms Container - Align to top */}
            <div className="w-full mt-4">
              {/* Form */}
              {authMode === 'login' && <LoginForm onForgotPassword={() => setAuthMode('forgot-password')} />}
              {authMode === 'register' && <RegisterForm />}
              {authMode === 'forgot-password' && <ForgotPasswordForm onBack={() => setAuthMode('login')} />}
               
              {/* Account Switch Link */}
              <div className="text-center mt-8 border-t border-gray-100 dark:border-gray-800 pt-6">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {authMode === 'login' ? (
                    <>
                      Don't have an account?{" "}
                      <button 
                        onClick={() => setAuthMode('register')} 
                        className="text-gray-900 dark:text-white hover:underline font-medium transition-colors"
                      >
                        Create account
                      </button>
                    </>
                  ) : authMode === 'register' ? (
                    <>
                      Already have an account?{" "}
                      <button 
                        onClick={() => setAuthMode('login')}
                        className="text-gray-900 dark:text-white hover:underline font-medium transition-colors"
                      >
                        Sign in
                      </button>
                    </>
                  ) : (
                    <>
                      Remember your password?{" "}
                      <button 
                        onClick={() => setAuthMode('login')}
                        className="text-gray-900 dark:text-white hover:underline font-medium transition-colors"
                      >
                        Sign in
                      </button>
                    </>
                  )}
                </p>
              </div>
              
              {/* Terms */}
              <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-8">
                By continuing, you agree to our{" "}
                <a href="/terms" className="text-gray-900 dark:text-white hover:underline">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="/privacy" className="text-gray-900 dark:text-white hover:underline">
                  Privacy Policy
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 