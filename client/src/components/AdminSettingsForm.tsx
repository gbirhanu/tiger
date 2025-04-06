import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { AdminSettings } from '../../../shared/schema';
import { getAdminSettings, updateAdminSettings } from '@/lib/api';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, CreditCard as CreditCardIcon, PiggyBank as BankIcon, Settings, CreditCard, RefreshCcw, UserCheck, Currency, AlertCircle, Sparkles, DollarSign } from 'lucide-react';
import { QUERY_KEYS } from '@/lib/queryClient'; 
import { Separator } from './ui/separator';

// Form schema based on AdminSettings
const adminSettingsFormSchema = z.object({
  gemini_max_free_calls: z.number().min(0).default(5),
  enable_marketing: z.boolean().default(false),
  bank_account: z.string().nullable(),
  bank_owner: z.string().nullable(),
  subscription_amount: z.number().positive().default(19.99),
  default_currency: z.string().default('ETB'),
});

type AdminSettingsFormValues = z.infer<typeof adminSettingsFormSchema>;

interface AdminSettingsFormProps {
  onSuccess?: () => void;
}

const AdminSettingsForm: React.FC<AdminSettingsFormProps> = ({ onSuccess }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch current admin settings
  const { data: adminSettings, isLoading: isLoadingSettings } = useQuery({
    queryKey: [QUERY_KEYS.ADMIN_SETTINGS],
    queryFn: getAdminSettings,
    enabled: true,
  });

  // Set up form with default values from adminSettings
  const form = useForm<AdminSettingsFormValues>({
    resolver: zodResolver(adminSettingsFormSchema),
    defaultValues: {
      gemini_max_free_calls: adminSettings?.gemini_max_free_calls || 5,
      enable_marketing: adminSettings?.enable_marketing || false,
      bank_account: adminSettings?.bank_account || '',
      bank_owner: adminSettings?.bank_owner || '',
      subscription_amount: adminSettings?.subscription_amount || 19.99,
      default_currency: adminSettings?.default_currency || 'ETB',
    },
  });

  // Update form values when admin settings are loaded
  React.useEffect(() => {
    if (adminSettings) {
      form.reset({
        gemini_max_free_calls: adminSettings.gemini_max_free_calls,
        enable_marketing: adminSettings.enable_marketing,
        bank_account: adminSettings.bank_account || '',
        bank_owner: adminSettings.bank_owner || '',
        subscription_amount: adminSettings.subscription_amount,
        default_currency: adminSettings.default_currency,
      });
    }
  }, [adminSettings, form]);

  // Mutation for updating admin settings
  const updateSettingsMutation = useMutation({
    mutationKey: [QUERY_KEYS.ADMIN_SETTINGS],
    mutationFn: (data: AdminSettingsFormValues) => {
      return updateAdminSettings({
        ...data,
        id: adminSettings?.id,
      });
    },
    onSuccess: () => {
      toast({
        title: 'Settings updated',
        description: 'Admin settings have been updated successfully.',
      });
      
      // Invalidate the admin settings query to refetch the latest data
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN_SETTINGS] });
      
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error) => {
      toast({
        title: 'Failed to update settings',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: AdminSettingsFormValues) => {
    updateSettingsMutation.mutate(data);
  };

  if (isLoadingSettings) {
    return (
      <div className="flex items-center justify-center p-12 rounded-lg border border-muted bg-card/50 shadow-sm">
        <Loader2 className="h-8 w-8 animate-spin text-primary mr-3" />
        <span className="text-lg font-medium">Loading settings...</span>
      </div>
    );
  }

  return (
    <Card className="w-full shadow-md border-muted/50">
      <CardHeader className="bg-primary/5 rounded-t-lg border-b border-border/50 space-y-1.5">
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Settings className="h-6 w-6 text-primary" />
          Admin Settings
        </CardTitle>
        <CardDescription className="text-muted-foreground text-sm">
          Configure system-wide settings for subscriptions and payments
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue="subscription" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1 m-4 rounded-lg">
            <TabsTrigger value="subscription" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <CreditCard className="h-4 w-4 mr-2" />
              Subscription
            </TabsTrigger>
            <TabsTrigger value="api" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <RefreshCcw className="h-4 w-4 mr-2" />
              API & Features
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="subscription" className="space-y-6 p-6 pt-2">
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 p-4 border border-amber-200 dark:border-amber-800/30 flex items-start space-x-3 mb-6">
              <AlertCircle className="h-5 w-5 text-amber-500 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-amber-800 dark:text-amber-300">Subscription Settings</h4>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                  These settings affect how subscriptions are managed and displayed to your users.
                </p>
              </div>
            </div>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div>
                  <h3 className="font-semibold text-base mb-4 flex items-center text-foreground">
                    <DollarSign className="h-5 w-5 mr-2 text-primary" />
                    Pricing Configuration
                  </h3>
                  <Separator className="mb-5" />
                  
                  <div className="grid gap-6 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="subscription_amount"
                      render={({ field }) => (
                        <FormItem className="bg-card dark:bg-card p-4 rounded-lg border shadow-sm">
                          <FormLabel className="flex items-center gap-2 text-sm font-medium">
                            <CreditCardIcon className="h-4 w-4 text-primary" />
                            Subscription Amount
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                type="number" 
                                step="0.01" 
                                placeholder="Enter amount" 
                                className="pl-7 focus-visible:ring-primary/50"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                value={field.value || ''}
                              />
                              <span className="absolute left-2.5 mr-2 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-xs">
                                {form.watch("default_currency") === "ETB" ? "" : "$"}
                              </span>
                            </div>
                          </FormControl>
                          <FormDescription className="text-xs mt-1.5">
                            The base price for Pro subscription
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="default_currency"
                      render={({ field }) => (
                        <FormItem className="bg-card dark:bg-card p-4 rounded-lg border shadow-sm">
                          <FormLabel className="flex items-center gap-2 text-sm font-medium">
                            <Currency className="h-4 w-4 text-primary" />
                            Default Currency
                          </FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full focus-visible:ring-primary/50">
                                <SelectValue placeholder="Select currency" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="ETB">ETB (Ethiopian Birr)</SelectItem>
                              <SelectItem value="USD">USD (US Dollar)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription className="text-xs mt-1.5">
                            The default currency to display to users
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                
                <div>
                  <h3 className="font-semibold text-base mb-4 flex items-center text-foreground">
                    <BankIcon className="h-5 w-5 mr-2 text-primary" />
                    Payment Information
                  </h3>
                  <Separator className="mb-5" />
                  
                  <div className="grid gap-6 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="bank_owner"
                      render={({ field }) => (
                        <FormItem className="bg-card dark:bg-card p-4 rounded-lg border shadow-sm">
                          <FormLabel className="flex items-center gap-2 text-sm font-medium">
                            <UserCheck className="h-4 w-4 text-primary" />
                            Bank Account Owner
                          </FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Enter account owner name" 
                              className="focus-visible:ring-primary/50"
                              {...field}
                              value={field.value || ''}
                            />
                          </FormControl>
                          <FormDescription className="text-xs mt-1.5">
                            The name of the bank account owner
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="bank_account"
                      render={({ field }) => (
                        <FormItem className="bg-card dark:bg-card p-4 rounded-lg border shadow-sm">
                          <FormLabel className="flex items-center gap-2 text-sm font-medium">
                            <BankIcon className="h-4 w-4 text-primary" />
                            Bank Account Number
                          </FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Enter account number" 
                              className="focus-visible:ring-primary/50"
                              {...field}
                              value={field.value || ''}
                            />
                          </FormControl>
                          <FormDescription className="text-xs mt-1.5">
                            Complete bank account details shown to users for payments
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                
                <div>
                  <h3 className="font-semibold text-base mb-4 flex items-center text-foreground">
                    <Sparkles className="h-5 w-5 mr-2 text-primary" />
                    Marketing Options
                  </h3>
                  <Separator className="mb-5" />
                  
                  <FormField
                    control={form.control}
                    name="enable_marketing"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-5 shadow-sm bg-card dark:bg-card">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base font-medium">Enable Marketing</FormLabel>
                          <FormDescription className="text-xs mt-1.5">
                            Show subscription upgrade prompts to free users
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="data-[state=checked]:bg-primary"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="flex justify-end pt-3">
                  <Button 
                    type="submit" 
                    size="lg"
                    className="w-fit gap-2 px-6"
                    disabled={updateSettingsMutation.isPending}
                  >
                    {updateSettingsMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Save Settings
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>
          
          <TabsContent value="api" className="space-y-6 p-6 pt-2">
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-4 border border-blue-200 dark:border-blue-800/30 flex items-start space-x-3 mb-6">
              <AlertCircle className="h-5 w-5 text-blue-500 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300">API Settings</h4>
                <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                  Configure system-wide API usage limits and feature availability.
                </p>
              </div>
            </div>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div>
                  <h3 className="font-semibold text-base mb-4 flex items-center text-foreground">
                    <RefreshCcw className="h-5 w-5 mr-2 text-primary" />
                    API Usage Limits
                  </h3>
                  <Separator className="mb-5" />
                  
                  <FormField
                    control={form.control}
                    name="gemini_max_free_calls"
                    render={({ field }) => (
                      <FormItem className="bg-card dark:bg-card p-5 rounded-lg border shadow-sm max-w-md">
                        <FormLabel className="text-sm font-medium flex items-center">
                          <Sparkles className="h-4 w-4 mr-2 text-primary" />
                          Maximum Free Gemini API Calls
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            className="focus-visible:ring-primary/50"
                            placeholder="Enter maximum calls"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormDescription className="text-xs mt-1.5">
                          Number of API calls allowed for free users before requiring Pro upgrade
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="flex justify-end pt-3">
                  <Button 
                    type="submit" 
                    size="lg"
                    className="w-fit gap-2 px-6"
                    disabled={updateSettingsMutation.isPending}
                  >
                    {updateSettingsMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Save API Settings
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default AdminSettingsForm; 