import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthPage from './pages/auth';
import Dashboard from './components/Dashboard';
import { Toaster } from './components/ui/toaster';
import { useEffect, Suspense, lazy } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

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
function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
    </div>
  );
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, theme } = useAuth();

  useEffect(() => {
    // Apply theme class to root element
    document.documentElement.className = theme;
  }, [theme]);

  if (loading) {
    return <LoadingSpinner />;
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
      <Suspense fallback={<LoadingSpinner />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

function AppContent() {
  const { theme, isAuthenticated, loading, error, clearErrors } = useAuth();

  useEffect(() => {
    // Apply theme class to root element
    document.documentElement.className = theme;
  }, [theme]);

  // Clear any auth errors when component mounts
  useEffect(() => {
    if (error) {
      clearErrors();
    }
  }, [error, clearErrors]);

  if (loading) {
    return <LoadingSpinner />;
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
          <Suspense fallback={<LoadingSpinner />}>
            <AppContent />
            <Toaster />
          </Suspense>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
