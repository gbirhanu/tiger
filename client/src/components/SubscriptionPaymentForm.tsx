import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { QUERY_KEYS } from '@/lib/queryClient';
import {
  ArrowRight,
  Ban as Bank,
  Building,
  CalendarIcon,
  CreditCard,
  CheckCircle2,
  ChevronsUpDown,
  DollarSign,
  InfoIcon,
  Landmark,
  Loader2,
  ShieldCheck as Shield,
  User,
  Copy,
  Check,
} from 'lucide-react';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/timezone';
import { 
  createSubscriptionPayment, 
  upgradeToProPlan, 
  getUserSettings, 
  getAdminSettings,
  convertCurrency,
  formatCurrency,
  createSubscription
} from '@/lib/api';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';

// Define the form schema
const paymentFormSchema = z.object({
  deposited_by: z.string().min(2, { message: 'Please enter the name of the person who made the deposit' }),
  deposited_date: z.date({ required_error: 'Please select the date of deposit' }),
  transaction_id: z.string().min(3, { message: 'Please enter a valid transaction ID or reference number' }),
  currency: z.string().default('ETB'),
  notes: z.string().optional(),
});

type PaymentFormValues = z.infer<typeof paymentFormSchema>;

interface SubscriptionPaymentFormProps {
  onSuccess?: (payment?: any) => void;
  bankAccount?: string;
  userId?: number;
  subscriptionId?: number | null;
  planDetails: {
    name: string;
    price: number;
    duration: number;
  };
  compact?: boolean;
}

const SubscriptionPaymentForm = ({ 
  onSuccess, 
  bankAccount: propBankAccount, 
  userId,
  subscriptionId,
  planDetails,
  compact = true
}: SubscriptionPaymentFormProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<string>('ETB');
  const [copied, setCopied] = useState(false);
  
 
  
  // Always fetch admin settings to get bank account information
  const { data: adminSettings } = useQuery({
    queryKey: ['admin', 'subscription-settings'],
    queryFn: getAdminSettings,
    enabled: true, // Always fetch
    retry: 3,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  
  // Use settings from admin settings
  const bankAccount = propBankAccount || adminSettings?.bank_account || "Please contact admin for payment details";
  const bankOwner = adminSettings?.bank_owner || "Account Owner";
  const defaultCurrency = adminSettings?.default_currency || "ETB";
  const subscriptionAmount = adminSettings?.subscription_amount || planDetails.price;
  
  // Set default currency from admin settings
  useEffect(() => {
    if (defaultCurrency) {
      setSelectedCurrency(defaultCurrency);
    }
  }, [defaultCurrency]);
  
  // Calculate converted amount
  const convertedAmount = selectedCurrency === 'USD' 
    ? subscriptionAmount 
    : convertCurrency(subscriptionAmount, 'USD', selectedCurrency);
  
  const formattedAmount = formatCurrency(convertedAmount, selectedCurrency);

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      deposited_by: '',
      transaction_id: '',
      currency: defaultCurrency,
      notes: '',
    },
  });

  // Update form when currency changes
  useEffect(() => {
    form.setValue('currency', selectedCurrency);
  }, [selectedCurrency, form]);

  const createPaymentMutation = useMutation({
    mutationFn: async (data: PaymentFormValues) => {
      try {
       
        
        // If no userId is explicitly provided, try to get current user info
        let actualUserId = userId;
        if (!actualUserId) {
          try {
            const userSettings = await getUserSettings();
            actualUserId = userSettings.user_id;
          } catch (error) {
            console.error("Error getting user settings:", error);
            // Continue with unknown user ID, server will handle it
          }
        }
        
        // If no subscriptionId is provided, try to create a subscription first
        let actualSubscriptionId = subscriptionId;
        if (!actualSubscriptionId) {
          try {
            const newSubscription = await createSubscription({
              user_id: actualUserId,
              plan: 'pro',
              status: 'pending',
              start_date: Math.floor(Date.now() / 1000),
              end_date: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
              auto_renew: false
            });
            actualSubscriptionId = newSubscription.id;
          } catch (subscriptionError) {
            // Continue without subscription ID, we'll create a standalone payment
          }
        }
        
        // Store amount in USD for consistency in database
        const amountInUSD = data.currency === 'USD' 
          ? subscriptionAmount 
          : convertCurrency(subscriptionAmount, data.currency, 'USD');
        
        // Create payment data
        const paymentData: any = {
          user_id: actualUserId || 0, // Server will use authenticated user if 0
          amount: amountInUSD,
          currency: data.currency,
          payment_method: 'bank_transfer',
          status: 'pending',
          deposited_by: data.deposited_by,
          deposited_date: Math.floor(data.deposited_date.getTime() / 1000),
          transaction_id: data.transaction_id,
          notes: data.notes || `Plan: ${planDetails.name} | Duration: ${planDetails.duration} months`,
        };
        
        // Don't add subscription_id as the column doesn't exist in the database yet
        const payment = await createSubscriptionPayment(paymentData);
        
        onSuccess?.(payment);
        setIsSuccess(true);
        queryClient.invalidateQueries({ queryKey: ['subscriptionPayments'] });
        form.reset();
        return payment;
      } catch (error) {
        console.error("Payment creation error:", error);
        setIsSuccess(false);
        toast({
          title: "Payment creation failed",
          description: "We couldn't process your payment. Please try again.",
          variant: "destructive",
        });
        throw error;
      }
    },
    onSuccess: () => {
      setIsSuccess(true);
      toast({
        title: "Payment submitted successfully",
        description: "Your payment information has been submitted and is awaiting approval.",
      });
      queryClient.invalidateQueries({ queryKey: ['subscriptionPayments'] });
      form.reset();
    },
    onError: (error) => {
      console.error("Error creating payment:", error);
      toast({
        title: "Error",
        description: "There was an error submitting your payment information. Please try again.",
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: PaymentFormValues) => {
    createPaymentMutation.mutate(data);
  };

  const handleCopyBankAccount = async () => {
    try {
      await navigator.clipboard.writeText(bankAccount);
      setCopied(true);
      toast({
        title: "Copied to clipboard",
        description: "Bank account number has been copied to your clipboard.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Could not copy bank account number to clipboard.",
        variant: "destructive",
      });
    }
  };

  if (isSuccess) {
    return (
      <Card className="w-full max-w-md mx-auto border-green-100 dark:border-green-900 shadow-md">
        <CardContent className="pt-8 pb-8 flex flex-col items-center justify-center">
          <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-4 mb-6">
            <CheckCircle2 className="h-14 w-14 text-green-600 dark:text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-center mb-3">Payment Submitted</h2>
          <p className="text-center text-muted-foreground mb-6 max-w-xs">
            Your payment information has been submitted and is pending approval. You'll be notified when your subscription is activated.
          </p>
          <Button variant="outline" onClick={onSuccess} className="mt-2">
            Return to Dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`w-full ${compact ? 'w-[650px]' : 'max-w-[1200px] mx-auto'} shadow border-muted overflow-hidden`}>
      <CardHeader className="border-b py-2 px-6">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <CardTitle className={compact ? 'text-lg' : undefined}>
            {planDetails.name} Plan Subscription
          </CardTitle>
        </div>
        <CardDescription>
          Complete your payment to activate your {planDetails.duration}-month subscription
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pt-4 px-6">
        {/* Plan details and summary */}
        <div className="flex items-center justify-between p-3 bg-accent/50 rounded-md mb-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary flex-shrink-0" />
            <div>
              <p className="font-medium">{planDetails.name} Plan</p>
              <p className="text-sm text-muted-foreground">{planDetails.duration} month{planDetails.duration > 1 ? 's' : ''}</p>
            </div>
          </div>
          <Badge variant="outline" className="font-semibold">
            {formattedAmount}
          </Badge>
        </div>
        
        {/* Two-column layout for payment instructions and payment form */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Payment Instructions - Column 1 */}
          <div className="rounded-lg overflow-hidden border h-fit lg:col-span-5">
            <div className="bg-accent/50 px-4 py-2 flex items-center gap-2">
              <Bank className="h-4 w-4 text-primary flex-shrink-0" />
              <h3 className="font-medium text-sm">Payment Instructions</h3>
            </div>
            
            <div className="p-4">
              <div className="space-y-3 mb-3">
                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div className="flex-1 overflow-hidden">
                    <div className="text-sm font-medium">Account Name</div>
                    <div className="text-sm">{bankOwner}</div>
                  </div>
                </div>
                
                <div className="flex items-start gap-2">
                  <Building className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div className="flex-1 overflow-hidden">
                    <div className="text-sm font-medium">Bank Details</div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm whitespace-pre-line break-words">{bankAccount}</div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 p-0 hover:bg-accent"
                        onClick={handleCopyBankAccount}
                      >
                        {copied ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              
              <Separator className="my-3" />
              
              <div className="flex justify-between items-center">
                <div className="flex items-center text-sm">
                  <span>Currency:</span>
                </div>
                <Select 
                  value={selectedCurrency}
                  onValueChange={setSelectedCurrency}
                >
                  <SelectTrigger className="w-28 h-8 text-xs">
                    <SelectValue placeholder="Currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ETB">ETB</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
                
              <div className="flex justify-between items-center bg-accent/50 rounded p-2 mt-3">
                <span className="text-sm font-medium">Total Amount:</span>
                <span className="font-bold">
                  {formattedAmount}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Form - Column 2 */}
          <div className="rounded-lg border p-4 h-fit lg:col-span-7">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard className="h-4 w-4 text-primary" />
                  <h3 className="font-medium text-sm">Payment Details</h3>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="deposited_by"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Depositor's Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Full name on bank transfer" {...field} className="h-10" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="transaction_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Transaction Ref.</FormLabel>
                        <FormControl>
                          <Input placeholder="Transaction ID or reference" {...field} className="h-10" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem className="hidden">
                        <FormControl>
                          <Input type="hidden" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="deposited_date"
                    render={({ field }) => (
                      <FormItem className="col-span-full">
                        <FormLabel className="text-sm">Date of Deposit</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full h-10 justify-start text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? (
                                  formatDate(field.value, "PPP")
                                ) : (
                                  <span>Select date of payment</span>
                                )}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) => date > new Date() || date < new Date('2023-01-01')}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem className="col-span-full">
                        <FormLabel className="text-sm">Additional Notes (Optional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Any additional information about your payment" 
                            className="resize-none min-h-[60px]"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full gap-2 mt-4" 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Payment</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SubscriptionPaymentForm; 