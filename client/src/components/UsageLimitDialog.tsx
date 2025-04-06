import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InfoIcon, Key, ShieldCheck } from "lucide-react";
import { createSubscription } from '@/lib/api';
import SubscriptionPaymentForm from "./SubscriptionPaymentForm";
import { useMarketingSettings } from '@/lib/hooks/useMarketingSettings';

interface UsageLimitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message?: string;
}

// Define as const to make it exportable in multiple ways
const UsageLimitDialog = ({ open, onOpenChange, message }: UsageLimitDialogProps) => {
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [subscriptionId, setSubscriptionId] = useState<number | null>(null);
  const [isCreatingSubscription, setIsCreatingSubscription] = useState(false);
  
  // Get marketing settings
  const { showSubscriptionFeatures } = useMarketingSettings();

  // Default plan details
  const planDetails = {
    name: "Pro",
    price: 19.99,
    duration: 1 // month
  };

  // Effect to automatically close dialog if marketing is disabled
  useEffect(() => {
    // If dialog is open and marketing is disabled, close it immediately
    if (open && !showSubscriptionFeatures) {
      console.log("Marketing disabled, automatically closing usage limit dialog");
      onOpenChange(false);
    }
  }, [open, showSubscriptionFeatures, onOpenChange]);

  // Add useEffect to log dialog state changes
  React.useEffect(() => {
    console.log("UsageLimitDialog state:", { 
      open, 
      showPaymentForm, 
      subscriptionId,
      isCreatingSubscription,
      marketingEnabled: showSubscriptionFeatures
    });
    
    if (open && !showPaymentForm) {
      console.log("UsageLimitDialog is open and showing options");
    }
    
    if (open && showPaymentForm) {
      console.log("UsageLimitDialog is open and showing payment form");
    }
  }, [open, showPaymentForm, subscriptionId, isCreatingSubscription, showSubscriptionFeatures]);

  // Navigate to settings and select API integration tab
  const handleGoToSettings = () => {
    try {
      // Set the selected nav tab to "settings" in localStorage
      localStorage.setItem('selectedNav', 'Settings');
      
      // Set the selected settings tab to "api" in localStorage
      localStorage.setItem('selectedSettingsTab', 'api');
      
      // Redirect to settings page
      window.location.href = "/settings";
    } catch (error) {
      // Fallback in case localStorage fails
      window.location.href = "/settings";
    }
  };

  // Handle upgrade click - simplified to be more reliable
  const handleUpgradeClick = async () => {
    try {
      setIsCreatingSubscription(true);
      console.log("Starting upgrade process");
      
      // Try to create a subscription, but continue even if it fails
      try {
        const subscription = await createSubscription({
          user_id: 0, // Will be set by the server based on the authenticated user
          plan: 'pro',
          status: 'pending',
          start_date: Math.floor(Date.now() / 1000),
          end_date: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
          auto_renew: false
        });
        
        console.log("Subscription created successfully:", subscription);
        
        if (subscription && subscription.id) {
          setSubscriptionId(subscription.id);
        }
      } catch (subscriptionError) {
        console.error("Error creating subscription:", subscriptionError);
        // Continue without subscription ID
      }
      
      // Always show payment form, even if subscription creation failed
      setShowPaymentForm(true);
      console.log("Payment form should now be visible");
      
    } catch (error) {
      console.error("Unexpected error in handleUpgradeClick:", error);
      // Show payment form anyway
      setShowPaymentForm(true);
    } finally {
      setIsCreatingSubscription(false);
    }
  };

  const handlePaymentSuccess = () => {
    // Close the dialog
    onOpenChange(false);
    // Reset state
    setShowPaymentForm(false);
    setSubscriptionId(null);
  };

  // If marketing is disabled, don't render the dialog at all
  if (!showSubscriptionFeatures) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[700px] max-w-[700px]">
        {!showPaymentForm ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <InfoIcon className="h-5 w-5 text-amber-500" />
                AI Usage Limit Reached
              </DialogTitle>
              <DialogDescription>
                You've reached your free usage limit for AI features.
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-4">
              <Alert className="mb-4 bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800/30">
                <AlertDescription>
                  {message || "You've reached your free limit of AI calls. Please upgrade to Pro or add your own API key to continue using AI features."}
                </AlertDescription>
              </Alert>
              
              <div className="grid gap-4 mt-4">
                <div className="flex flex-col p-4 border rounded-lg bg-card">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full p-2 bg-primary/10">
                      <Key className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium">Use Your Own API Key</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Add your Gemini API key in Settings to use unlimited AI features without upgrading.
                      </p>
                      <Button 
                        variant="outline" 
                        className="mt-3" 
                        onClick={handleGoToSettings}
                      >
                        Go to Settings
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col p-4 border-2 border-primary/20 rounded-lg bg-primary/5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full p-2 bg-primary/15">
                      <ShieldCheck className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium">Upgrade to Pro</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Get unlimited AI features plus all premium benefits for just ${planDetails.price}/month.
                      </p>
                      <Button className="mt-3" onClick={handleUpgradeClick} disabled={isCreatingSubscription}>
                        {isCreatingSubscription ? "Processing..." : "Upgrade Now"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <SubscriptionPaymentForm 
            subscriptionId={subscriptionId}
            planDetails={planDetails}
            onSuccess={handlePaymentSuccess}
            compact
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

// Export both as named and default export
export { UsageLimitDialog };
export default UsageLimitDialog; 