import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { checkGeminiUsage, incrementGeminiUsage } from '@/lib/api';
import { useMarketingSettings } from '@/lib/hooks/useMarketingSettings';
import { useToast } from '@/hooks/use-toast';
import useUsageLimitDialog from './use-usage-limit-dialog';

interface UseAiEligibilityResult {
  isLoading: boolean;
  canUseAi: boolean;
  currentUsage: number;
  maxFreeCalls: number;
  isPro: boolean;
  hasOwnApiKey: boolean;
  incrementUsage: () => Promise<boolean>;
  checkEligibility: () => Promise<boolean>;
}

/**
 * Hook to check if a user is eligible to use AI features
 * When marketing is disabled, all users can use AI without limits
 * When marketing is enabled, limits are enforced based on subscription status
 * Usage is always tracked regardless of marketing setting
 */
export default function useAiEligibility(): UseAiEligibilityResult {
  const { toast } = useToast();
  const { showLimitDialog, setShowLimitDialog } = useUsageLimitDialog();
  const { canUseAiFeatures, showSubscriptionFeatures } = useMarketingSettings();
  
  // Fetch current usage data
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['gemini-usage'],
    queryFn: checkGeminiUsage,
    staleTime: 60000, // 1 minute
  });
  
  // Extract usage data
  const currentUsage = data?.currentUsage || 0;
  const maxFreeCalls = data?.maxFreeCalls || 5;
  const isPro = data?.isPro || false;
  const hasOwnApiKey = data?.has_api_key || false;
  
  // Determine if user can use AI features
  // If marketing is disabled OR user is pro OR user has own API key, they can use AI
  const canUseAi = canUseAiFeatures || data?.canUseGemini || false;
  
  /**
   * Increment the usage counter and check if user is still eligible
   * @returns Whether the user can continue using AI features
   */
  const incrementUsage = useCallback(async (): Promise<boolean> => {
    try {
      // Increment usage regardless of marketing setting
      const result = await incrementGeminiUsage();
      
      // Refresh usage data
      await refetch();
      
      // If marketing is disabled, always allow usage
      if (!showSubscriptionFeatures) {
        return true;
      }
      
      // Check if user has reached limit
      if (result.currentUsage >= maxFreeCalls && !isPro && !hasOwnApiKey) {
        setShowLimitDialog(true);
        return false;
      }
      
      return true;
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update AI usage. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  }, [maxFreeCalls, isPro, hasOwnApiKey, refetch, setShowLimitDialog, toast, showSubscriptionFeatures]);
  
  /**
   * Check if user is eligible to use AI features
   * @returns Whether the user can use AI features
   */
  const checkEligibility = useCallback(async (): Promise<boolean> => {
    try {
      // Refresh usage data
      await refetch();
      
      // If marketing is disabled, always allow usage
      if (!showSubscriptionFeatures) {
        return true;
      }
      
      // If user is at or over limit, and not pro, and doesn't have own API key, show limit dialog
      if (currentUsage >= maxFreeCalls && !isPro && !hasOwnApiKey) {
        setShowLimitDialog(true);
        return false;
      }
      
      return true;
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to check AI eligibility. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  }, [currentUsage, maxFreeCalls, isPro, hasOwnApiKey, refetch, setShowLimitDialog, toast, showSubscriptionFeatures]);
  
  return {
    isLoading,
    canUseAi,
    currentUsage,
    maxFreeCalls,
    isPro,
    hasOwnApiKey,
    incrementUsage,
    checkEligibility,
  };
} 