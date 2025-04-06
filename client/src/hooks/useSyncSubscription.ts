import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';

export function useSyncSubscription() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = async (userId: string) => {
    setIsLoading(true);
    setError(null);
    const token = useAuth().sessionToken;
    try {
      // Replace with actual API call
      await fetch(`/api/users/${userId}/sync`, {
        method: 'POST',
   
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  return { mutate, isLoading, error };
} 