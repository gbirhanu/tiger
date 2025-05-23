import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import AuthPage from './pages/auth';
import ResetPasswordPage from './pages/reset-password';
import Dashboard from './components/Dashboard';
import { Toaster } from './components/ui/toaster';
import { useEffect, Suspense, lazy } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import TermsPage from './pages/terms';
import PrivacyPage from './pages/privacy';
import { LoadingSpinner } from '@/components/ui/loading-spinner';


// Error Fallback Component
function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <h2 className="text-xl font-bold text-red-600 mb-2">Something went wrong</h2>
      <p className="text-gray-700 mb-4">{error.message}</p>
      <button
        onClick={resetErrorBoundary}
        className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/80 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}

// Loading component
function AppLoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <LoadingSpinner size="lg" message="Loading application..." showProgress={true} />
    </div>
  );
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <AppLoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" />;
  }

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => {
        // Reset the state of your app here
        window.location.reload();
      }}
    >
      <Suspense fallback={<AppLoadingSpinner />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

// Add a new component for admin route protection
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return <AppLoadingSpinner />;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/auth" />;
  }
  
  // Check if user is an admin
  if (!user || user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => window.location.reload()}
    >
      <Suspense fallback={<AppLoadingSpinner />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

function AppContent() {
  const { isAuthenticated, loading, error, clearErrors } = useAuth();

  // Clear any auth errors when component mounts
  useEffect(() => {
    if (error) {
      clearErrors();
    }
  }, [error, clearErrors]);

  if (loading) {
    return <AppLoadingSpinner />;
  }

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => {
        clearErrors();
        window.location.reload();
      }}
    >
      <Routes>
        <Route 
          path="/auth" 
          element={isAuthenticated ? <Navigate to="/" /> : <AuthPage />} 
        />
        
        {/* Public reset password page */}
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        
        {/* Public legal pages */}
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        
        <Route
          path="/*"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />
      </Routes>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => window.location.reload()}
    >
      <Router>
        <AuthProvider>
          <ThemeProvider>
            <Suspense fallback={<AppLoadingSpinner />}>
              <AppContent />
              <Toaster />
            </Suspense>
          </ThemeProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
