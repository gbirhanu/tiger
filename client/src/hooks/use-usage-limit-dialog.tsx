import { useState, useCallback } from 'react';
import axios from 'axios';

/**
 * Custom hook for managing the usage limit dialog when Gemini API usage limits are reached
 */
interface UsageLimitDialogHook {
  showLimitDialog: boolean;
  setShowLimitDialog: (show: boolean) => void;
  limitErrorMessage: string;
  handleApiError: (error: unknown) => boolean;
}

const useUsageLimitDialog = (): UsageLimitDialogHook => {
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  const [limitErrorMessage, setLimitErrorMessage] = useState('You have reached your usage limit for AI features.');

  /**
   * Handle API errors and show the UsageLimitDialog for usage limit errors
   * @param error The error object from the API call
   * @returns true if the error was a usage limit error and handled, false otherwise
   */
  const handleApiError = useCallback((error: unknown): boolean => {
    // Check if this is an axios error with the USAGE_LIMIT_REACHED code
    if (axios.isAxiosError(error) && error.response) {
      const { data, status } = error.response;
      
      if (status === 403 && data?.code === 'USAGE_LIMIT_REACHED') {
        // Set custom message if available from the API
        const message = data?.message || 'You have reached your usage limit for AI features.';
        setLimitErrorMessage(message);
        setShowLimitDialog(true);
        return true; // Error was handled
      }
    }
    
    return false; // Not a usage limit error
  }, []);

  /**
   * Close the usage limit dialog
   */
  const closeLimitDialog = useCallback(() => {
    setShowLimitDialog(false);
  }, []);

  return {
    showLimitDialog,
    setShowLimitDialog,
    limitErrorMessage,
    handleApiError,
  };
};

export default useUsageLimitDialog; 