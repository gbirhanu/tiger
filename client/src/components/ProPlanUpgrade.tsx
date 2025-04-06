import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/lib/queryClient';
import { getUserSettings, getAdminSettings, getUserSubscription } from '@/lib/api';
import { formatDate } from '@/lib/timezone';
import { Badge } from './ui/badge';
import { Crown, AlertCircle, CheckCircle, CreditCard, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Progress } from './ui/progress';
import SubscriptionPaymentForm from './SubscriptionPaymentForm';
import { Subscription } from '../../../shared/schema';

interface ProPlanUpgradeProps {
  showUpgradeButton?: boolean;
  onSuccess?: () => void;
  inline?: boolean;
  limitReached?: boolean;
}

const ProPlanUpgrade: React.FC<ProPlanUpgradeProps> = ({ 
  showUpgradeButton = true, 
  onSuccess,
  inline = false,
  limitReached = false
}) => {
  const [open, setOpen] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  
  const { data: userSettings } = useQuery({
    queryKey: [QUERY_KEYS.USER_SETTINGS],
    queryFn: getUserSettings,
  });
  
  // Fetch user subscription
  const { data: subscription } = useQuery<Subscription | null>({
    queryKey: [QUERY_KEYS.USER_SUBSCRIPTION],
    queryFn: getUserSubscription,
  });
  
  // Always fetch admin settings for all users
  const { data: adminSettings, isLoading: isLoadingAdminSettings } = useQuery({
    queryKey: [QUERY_KEYS.ADMIN_SETTINGS],
    queryFn: getAdminSettings,
    // Always enabled, not dependent on user role
    enabled: true,
    // Add retry to ensure we get the admin settings
    retry: 3,
    // Add stale time to avoid too many refetches
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  
  // Auto-open the dialog if limit is reached
  useEffect(() => {
    if (limitReached) {
      setOpen(true);
    }
  }, [limitReached]);
  
  // Always use admin settings for bank account info and marketing settings
  const bankAccount = adminSettings?.bank_account || "Please contact admin for payment details";
  // Always use admin settings for max free calls setting
  const maxFreeCalls = adminSettings?.gemini_max_free_calls || 5;
  const currentUsage = userSettings?.gemini_calls_count || 0;
  const usagePercentage = Math.min(100, Math.round((currentUsage / maxFreeCalls) * 100));
  
  const isPro = subscription?.plan === 'pro' && subscription?.status === 'active';
  const isExpired = subscription?.status === 'expired' || (subscription?.end_date && subscription.end_date < Math.floor(Date.now() / 1000));
  
  // Check if marketing is enabled from admin settings, not user settings
  const marketingEnabled = adminSettings?.enable_marketing ?? false;
  
  // If admin settings are still loading or if marketing is disabled and user is not on pro plan, don't show anything
  if (isLoadingAdminSettings) {
    return null;
  }
  
  // If marketing is disabled and user is not on pro plan, don't show anything
  if (!isPro && !isExpired && !marketingEnabled && !limitReached && !showUpgradeButton) {
    return null;
  }
  
  const subscriptionMessage = () => {
    if (isPro && !isExpired) {
      return (
        <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertTitle className="text-green-800 dark:text-green-300">Pro Plan Active</AlertTitle>
          <AlertDescription className="text-green-700 dark:text-green-400">
            Your subscription is active until {subscription?.end_date 
              ? formatDate(new Date(subscription.end_date * 1000), "PPP") 
              : 'Unlimited'}
          </AlertDescription>
        </Alert>
      );
    } else if (isExpired) {
      return (
        <Alert className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="text-amber-800 dark:text-amber-300">Subscription Expired</AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-400">
            Your Pro plan expired on {subscription?.end_date 
              ? formatDate(new Date(subscription.end_date * 1000), "PPP")
              : 'N/A'}. Please renew to continue enjoying premium features.
          </AlertDescription>
        </Alert>
      );
    } else if (limitReached) {
      return (
        <Alert className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          <AlertTitle className="text-red-800 dark:text-red-300">AI Usage Limit Reached</AlertTitle>
          <AlertDescription className="text-red-700 dark:text-red-400">
            You've reached your free quota of {maxFreeCalls} Gemini API calls. 
            Upgrade to Pro to get unlimited AI features.
          </AlertDescription>
        </Alert>
      );
    } else {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Gemini AI Usage</span>
            </div>
            <Badge variant="outline" className="text-xs">
              {currentUsage} / {maxFreeCalls} calls
            </Badge>
          </div>
          <Progress value={usagePercentage} className="h-2" />
          {usagePercentage >= 80 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              You're approaching your free usage limit. Consider upgrading to Pro.
            </p>
          )}
        </div>
      );
    }
  };
  
  // If inline mode is requested, show without dialog
  if (inline) {
    return (
      <>
        {subscriptionMessage()}
        
        {(!isPro || isExpired) && showUpgradeButton && (
          <div className="flex justify-center">
            {!showPaymentForm ? (
              <Button 
                onClick={() => setShowPaymentForm(true)}
                className="gap-2"
                variant="default"
              >
                <Crown className="h-4 w-4" />
                Upgrade to Pro Plan
              </Button>
            ) : (
              <SubscriptionPaymentForm
                bankAccount={bankAccount}
                planDetails={{
                  name: "Pro",
                  price: 19.99,
                  duration: 1
                }}
                userId={1}
                onSuccess={() => {
                  if (onSuccess) onSuccess();
                }}
              />
            )}
          </div>
        )}
      </>
    );
  }
  
  // Otherwise show with dialog
  return (
    <>
      {showUpgradeButton && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" variant={limitReached ? "destructive" : "default"}>
              <Crown className="h-4 w-4" />
              {isPro ? "Manage Subscription" : "Upgrade to Pro"}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {isPro ? "Manage Your Pro Subscription" : "Upgrade to Pro Plan"}
              </DialogTitle>
              <DialogDescription>
                {isPro 
                  ? "Your subscription details and status" 
                  : "Unlock premium features with our Pro Plan"}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 pt-4">
              {subscriptionMessage()}
              
              {!showPaymentForm && !isPro && (
                <Card className="overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-primary/20 to-primary/5 pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Crown className="h-5 w-5 text-primary" />
                        Pro Plan
                      </CardTitle>
                      <Badge className="text-sm">$19.99/month</Badge>
                    </div>
                    <CardDescription>
                      Unlock all premium features
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                        <span>Unlimited Gemini AI features</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                        <span>Priority customer support</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                        <span>Early access to new features</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              )}
              
              {showPaymentForm ? (
                <SubscriptionPaymentForm
                  bankAccount={bankAccount}
                  planDetails={{
                    name: "Pro",
                    price: 19.99,
                    duration: 1
                  }}
                  userId={1}
                  onSuccess={() => {
                    setOpen(false);
                    if (onSuccess) onSuccess();
                  }}
                />
              ) : (
                !isPro && (
                  <DialogFooter>
                    <Button
                      className="w-full gap-2"
                      onClick={() => setShowPaymentForm(true)}
                    >
                      <CreditCard className="h-4 w-4" />
                      Continue to Payment
                    </Button>
                  </DialogFooter>
                )
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default ProPlanUpgrade; 