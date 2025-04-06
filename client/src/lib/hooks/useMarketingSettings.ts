import { useQuery } from "@tanstack/react-query";
import { getAdminSettings, getSubscriptionStatus } from "@/lib/api";
import { QUERY_KEYS } from "@/lib/queryClient";

/**
 * Custom hook that provides marketing and subscription visibility settings
 * based on admin configuration
 */
export const useMarketingSettings = () => {
  const { data: adminSettings, isLoading } = useQuery({
    queryKey: [QUERY_KEYS.ADMIN_SETTINGS],
    queryFn: getAdminSettings,
    // Set staleTime to reduce unnecessary fetches
    staleTime: 5 * 60 * 1000, // 5 minutes
    // Only retry once to avoid excessive API calls
    retry: 1,
  });

  // Fetch user subscription status
  const { data: subscriptionStatus } = useQuery({
    queryKey: ['subscription-status'],
    queryFn: getSubscriptionStatus,
    staleTime: 5 * 60 * 1000,
  });

  // Default to not showing subscription features if loading or no data
  const showSubscriptionFeatures = !!adminSettings?.enable_marketing;
  
  // If marketing is disabled, users can always use AI features regardless of subscription
  // Users with their own API key or Pro status can also always use AI features
  const canUseAiFeatures = !showSubscriptionFeatures || 
                           !!subscriptionStatus?.has_api_key || 
                           (subscriptionStatus?.is_pro && !subscriptionStatus?.is_expired);
  
  // Calculate formatted price
  const subscriptionPrice = adminSettings?.subscription_amount || 9.99;
  const currency = adminSettings?.default_currency || 'USD';
  
  // Provide a formatter for subscription price
  const formattedPrice = (price = subscriptionPrice, curr = currency) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: curr,
    }).format(price);
  };

  // Determine if pro upgrade options should be shown
  // If marketing is enabled, show pro upgrade options to non-pro users
  // If marketing is disabled, never show pro upgrade options
  const showProUpgradeOptions = showSubscriptionFeatures && 
                               (!subscriptionStatus?.is_pro || subscriptionStatus?.is_expired);

  return {
    isLoading,
    showSubscriptionFeatures,
    canUseAiFeatures,
    showProUpgradeOptions,
    subscriptionPrice,
    currency,
    formattedPrice,
    bankAccount: adminSettings?.bank_account || null,
    bankOwner: adminSettings?.bank_owner || null,
  };
}; 