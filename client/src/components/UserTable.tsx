import { UseMutationResult } from '@tanstack/react-query';
import { useState } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { useMarketingSettings } from '@/lib/hooks/useMarketingSettings';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, RefreshCw, Shield, Crown, UserIcon, Info, Settings, Ban, CreditCard, DollarSign, Banknote, UserCheck, UserX, ShieldAlert, User2Icon } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { formatDateTime } from '@/lib/timezone';
import { User, Subscription, AdminSettings } from '@shared/schema';
import { formatDate } from 'date-fns';
import { cn } from '@/lib/utils';
import { getAdminSettings, formatCurrency, convertCurrency } from '@/lib/api';



// Extended User type with additional fields for the UI
interface ExtendedUser extends User {
  lastLoginFormatted?: string;
  gemini_calls_count?: number;
  // Updated subscription fields
  subscription?: Omit<Subscription, 'user_id' | 'created_at' | 'updated_at'>;
  // Payment history fields
  has_payment?: boolean;
  payment_id?: number;
  payment_plan?: string;
  payment_expiry?: number;
  payment_expired?: boolean;
  needs_sync?: boolean;
  settings?: {
    is_pro: boolean;
    subscription_end_date: number;
  };
}


// User Table Component
interface UserTableProps {
  users: ExtendedUser[];
  currentUser: any;
  handleStatusChange: (user: ExtendedUser, status: 'active' | 'inactive' | 'suspended') => void;
  handleRoleChange: (user: ExtendedUser, role: 'admin' | 'user') => void;
  renderStatusBadge: (status: string) => React.ReactNode;
  renderRoleBadge: (role: string) => React.ReactNode;
  renderOnlineStatus: (isOnline: boolean) => React.ReactNode;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  itemsPerPage: number;
  setItemsPerPage: React.Dispatch<React.SetStateAction<number>>;
  grantProSubscription: UseMutationResult<any, Error, number, unknown>;
  resetGeminiUsage: UseMutationResult<any, Error, number, unknown>;
  revokeSubscription: UseMutationResult<any, Error, number, unknown>;
  syncSubscription: UseMutationResult<any, Error, number, unknown>;
}
export const  UserTable =  ({ 
  users, 
  currentUser, 
  handleStatusChange, 
  handleRoleChange,
  renderStatusBadge,
  renderRoleBadge,
  renderOnlineStatus,
  currentPage,
  setCurrentPage,
  itemsPerPage,
  setItemsPerPage,
  grantProSubscription,
  resetGeminiUsage,
  revokeSubscription,
  syncSubscription
}: UserTableProps) =>  {
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const queryClient = useQueryClient();
  
  // Get marketing settings
  const { showSubscriptionFeatures } = useMarketingSettings();
  
  // Calculate pagination details
  const totalUsers = users.length;
  console.log("totalUsers",totalUsers);
  const totalPages = Math.ceil(totalUsers / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalUsers);
  const paginatedUsers = users.slice(startIndex, endIndex);
  
  // Function to handle page changes
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };
  
  // Function to handle changing items per page
  const handleItemsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setItemsPerPage(Number(e.target.value));
    setCurrentPage(1); // Reset to first page when changing items per page
  };
  
  // Function to handle opening the subscription modal
  const handleManageSubscription = (userId: number) => {
    setSelectedUserId(userId);
    setShowSubscriptionModal(true);
    
    // Fetch payment history when opening the modal
    queryClient.invalidateQueries({ queryKey: ['paymentHistory', userId] });
  };
  
  // Get the selected user
  const selectedUser = users.find(user => user.id === selectedUserId);
  
  // Add query to fetch payment history for a user
  const fetchPaymentHistory = async (userId: number) => {
    try {
      // Import the API function dynamically to avoid circular dependencies
      const { getUserPaymentHistory } = await import('@/lib/api');
      return await getUserPaymentHistory(userId);
    } catch (error) {
      console.error("Error fetching payment history:", error);
      toast({
        title: "Error fetching payment history",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
      return null;
    }
  };

  // Add payment history query
  const { data: paymentHistory, isLoading: isLoadingPayments } = useQuery({
    queryKey: ['paymentHistory', selectedUserId],
    queryFn: () => selectedUserId ? fetchPaymentHistory(selectedUserId) : null,
    enabled: !!selectedUserId && showSubscriptionModal,
  });
  
  // Add query for admin settings
  const { data: adminSettings } = useQuery({
    queryKey: ['admin', 'subscription-settings'],
    queryFn: getAdminSettings,
    enabled: true,
  });
  
  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[49px]">ID</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-center">Status</TableHead>
              {/* Only show subscription column if marketing features are enabled */}
              {showSubscriptionFeatures && (
                <TableHead className="text-center">Subscription</TableHead>
              )}
              <TableHead>Last Activity</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-mono text-xs">{user.id}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    {renderOnlineStatus(user.is_online)}
                    <div>
                      <div className="font-medium">{user.name || 'Unnamed User'}</div>
                      <div className="text-xs text-muted-foreground">{user.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{renderRoleBadge(user.role)}</TableCell>
                <TableCell className="text-center">{renderStatusBadge(user.status)}</TableCell>
                {/* Only show subscription cell if marketing features are enabled */}
                {showSubscriptionFeatures && (
                  <TableCell className="text-center">
                    {user.settings?.is_pro ? (
                      <div className="flex flex-col">
                        <Badge variant="outline" className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800 mb-1">
                          Pro
                        </Badge>
                        {user.settings.subscription_end_date && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(user.settings.subscription_end_date * 1000).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    ) : (
                      <Badge variant="outline" className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700">
                        Free
                      </Badge>
                    )}
                  </TableCell>
                )}
                <TableCell>
                   <div className="text-xs" title={formatDateTime(user.last_login).absoluteTime}>
                    <span>{formatDateTime(user.last_login).absoluteTime}</span>
                    <div className="text-muted-foreground mt-0.5">({formatDateTime(user.last_login).relativeTime})</div>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      
                      {/* Status change options */}
                      <DropdownMenuItem 
                        disabled={user.status === 'active'}
                        onClick={() => handleStatusChange(user, 'active')}
                      >
                        <UserCheck className="mr-2 h-4 w-4 text-green-600" />
                        <span>Set as Active</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={user.status === 'inactive' || user.id === currentUser?.id}
                        onClick={() => handleStatusChange(user, 'inactive')}
                      >
                        <UserX className="mr-2 h-4 w-4 text-amber-600" />
                        <span>Set as Inactive</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={user.status === 'suspended' || user.id === currentUser?.id}
                        onClick={() => handleStatusChange(user, 'suspended')}
                      >
                        <ShieldAlert className="mr-2 h-4 w-4 text-red-600" />
                        <span>Suspend User</span>
                      </DropdownMenuItem>
                      
                      <DropdownMenuSeparator />
                      
                      {/* Role change options */}
                      <DropdownMenuItem
                        disabled={user.role === 'admin' || user.id === currentUser?.id}
                        onClick={() => handleRoleChange(user, 'admin')}
                      >
                        <Shield className="mr-2 h-4 w-4 text-purple-600" />
                        <span>Make Admin</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={user.role === 'user'}
                        onClick={() => handleRoleChange(user, 'user')}
                      >
                        <User2Icon className="mr-2 h-4 w-4 text-blue-600" />
                        <span>Make Regular User</span>
                      </DropdownMenuItem>
                      
                      <DropdownMenuSeparator />
                      
                      {/* Only show subscription options if marketing features are enabled */}
                      {showSubscriptionFeatures && (
                        <>
                          {/* Subscription options */}
                          {user.settings?.is_pro ? (
                            <DropdownMenuItem onClick={() => revokeSubscription.mutate(user.id)}>
                              <CreditCard className="mr-2 h-4 w-4 text-red-600" />
                              <span>Revoke Pro</span>
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => grantProSubscription.mutate(user.id)}>
                              <CreditCard className="mr-2 h-4 w-4 text-green-600" />
                              <span>Grant Pro (30 days)</span>
                            </DropdownMenuItem>
                          )}
                        </>
                      )}
                      
                      {/* Reset Gemini usage counter - always show this option */}
                      <DropdownMenuItem onClick={() => resetGeminiUsage.mutate(user.id)}>
                        <RefreshCw className="mr-2 h-4 w-4 text-blue-600" />
                        <span>Reset API Usage</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      {/* Pagination Controls */}
      {totalUsers > -1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-5 mt-4">
          <div className="text-sm text-muted-foreground">
            Showing {startIndex + 0}-{endIndex} of {totalUsers} users
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center space-x-3">
              <span className="text-sm text-muted-foreground">Rows per page:</span>
              <select
                className="h-9 w-16 rounded-md border border-input bg-background px-2 text-xs"
                value={itemsPerPage}
                onChange={handleItemsPerPageChange}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
                className="hidden sm:flex"
              >
                First
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <div className="flex items-center gap-2">
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  // Logic to show pages around the current page
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(pageNum)}
                      className="w-8 h-8 p-0"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
                className="hidden sm:flex"
              >
                Last
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Subscription Management Modal */}
      {selectedUser && (
        <Dialog open={showSubscriptionModal} onOpenChange={setShowSubscriptionModal}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Manage User Subscription
              </DialogTitle>
              <DialogDescription>
                Manage subscription status for <span className="font-medium">{selectedUser.name || selectedUser.email}</span>
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              {/* Current Subscription Status */}
              <div className="bg-muted/40 p-4 rounded-lg border">
                <h3 className="text-sm font-medium mb-3">Current Subscription</h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center",
                      selectedUser.subscription?.plan === 'pro' && selectedUser.subscription?.status === 'active'
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-600"
                    )}>
                      {selectedUser.subscription?.plan === 'pro' && selectedUser.subscription?.status === 'active' 
                        ? <Crown className="h-6 w-6" /> 
                        : <UserIcon className="h-6 w-6" />}
                    </div>
                    <div>
                      <div className="font-medium">
                        {selectedUser.subscription?.plan === 'pro' 
                          ? 'Pro Plan' 
                          : selectedUser.subscription?.plan === 'enterprise'
                            ? 'Enterprise Plan'
                            : 'Free Plan'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Status: <Badge variant="outline" className={cn(
                          "ml-1",
                          selectedUser.subscription?.status === 'active'
                            ? "bg-green-100 text-green-700 border-green-200"
                            : selectedUser.subscription?.status === 'expired'
                              ? "bg-red-100 text-red-700 border-red-200"
                              : "bg-gray-100 text-gray-700 border-gray-200"
                        )}>
                          {selectedUser.subscription?.status || 'Free'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    {selectedUser.subscription?.end_date && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Expires:</span> 
                        <span className={cn(
                          "ml-1 font-medium",
                          selectedUser.subscription.status === 'expired'
                            ? "text-red-600"
                            : ""
                        )}>
                          {formatDate(new Date(selectedUser.subscription.end_date * 1000), "PPP")}
                        </span>
                      </div>
                    )}
                    {selectedUser.subscription?.start_date && (
                      <div className="text-xs text-muted-foreground">
                        Started: {formatDate(new Date(selectedUser.subscription.start_date * 1000), "PP")}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Subscription Pricing */}
              {adminSettings && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800 p-4">
                  <h3 className="text-sm font-medium mb-3 flex items-center gap-2 text-blue-800 dark:text-blue-300">
                    <DollarSign className="h-4 w-4" /> 
                    Subscription Pricing
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col">
                      <span className="text-xs text-blue-700 dark:text-blue-400">USD Price:</span>
                      <span className="font-medium">{formatCurrency(adminSettings.subscription_amount, 'USD')}</span>
                    </div>
                    
                    <div className="flex flex-col">
                      <span className="text-xs text-blue-700 dark:text-blue-400">ETB Price:</span>
                      <span className="font-medium">
                        {formatCurrency(
                          convertCurrency(adminSettings.subscription_amount, 'USD', 'ETB'), 
                          'ETB'
                        )}
                      </span>
                    </div>
                    
                    <div className="flex flex-col">
                      <span className="text-xs text-blue-700 dark:text-blue-400">Default Currency:</span>
                      <span className="font-medium">{adminSettings.default_currency}</span>
                    </div>
                    
                    <div className="flex flex-col">
                      <span className="text-xs text-blue-700 dark:text-blue-400">Bank Account Owner:</span>
                      <span className="font-medium">{adminSettings.bank_owner || 'Not set'}</span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Payment History Section */}
              {paymentHistory && paymentHistory.payments && paymentHistory.payments.length > 0 && (
                <>
                  <Separator />
                  
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      Payment History
                    </h3>
                    
                    <div className="rounded-md border overflow-hidden">
                      <table className="min-w-full divide-y divide-border">
                        <thead className="bg-muted/49">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Date</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Plan</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Amount</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border bg-background">
                          {paymentHistory.payments.map((payment: any) => (
                            <tr key={payment.id} className="hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-2 text-sm w-fit whitespace-nowrap">
                                {formatDate(new Date(payment.created_at * 1000), "PP")}
                              </td>
                              <td className="px-4 py-2 text-sm w-fit">
                                <Badge variant="outline" className={
                                  payment.subscription_plan === 'pro' 
                                    ? 'bg-blue-100 text-blue-800 w-fit border-blue-200' 
                                    : 'bg-gray-100 text-gray-800 w-fit border-gray-200'
                                }>
                                  {payment.subscription_plan}
                                </Badge>
                              </td>
                              <td className="px-4 py-2 text-sm w-fit font-medium">
                                {formatCurrency(payment.amount, payment.currency || 'USD')}
                              </td>
                              <td className="px-4 py-2 text-sm w-fit">
                                <Badge variant="outline" className={
                                  payment.status === 'approved' 
                                    ? 'bg-green-100 text-green-800 w-fit border-green-200' 
                                    : payment.status === 'pending'
                                    ? 'bg-amber-100 text-amber-800 w-fit border-amber-200'
                                    : 'bg-red-100 text-red-800 w-fit border-red-200'
                                }>
                                  {payment.status}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Mismatch Alert */}
                    {paymentHistory.needs_sync && (
                      <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-lg text-sm">
                        <div className="flex items-center mb-2">
                          <RefreshCw className="h-5 w-5 mr-2 text-amber-600 dark:text-amber-400" />
                          <strong className="text-amber-700 dark:text-amber-300">Subscription Mismatch Detected</strong>
                        </div>
                        <p className="text-amber-700 dark:text-amber-300">
                          The user's current subscription status doesn't match their payment records.
                          Use the "Sync from Payments" button to update the subscription based on their payment history.
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
              
              {paymentHistory && paymentHistory.payments && paymentHistory.payments.length === 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-4 mt-3">
                  <p className="text-sm text-blue-800 dark:text-blue-300 flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    No payment history found for this user. Their subscription may have been granted administratively.
                  </p>
                </div>
              )}
              
              {isLoadingPayments && (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin h-8 w-8 border-3 border-primary rounded-full border-t-transparent"></div>
                  <span className="ml-3 text-sm text-muted-foreground">Loading payment history...</span>
                </div>
              )}
              
              <Separator />
              
              <div className="space-y-4">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  Subscription Actions
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      grantProSubscription.mutate(selectedUser.id);
                    }}
                    className="flex items-center gap-2 h-auto py-2"
                  >
                    <Crown className="h-4 w-4 text-amber-600 shrink-0" />
                    <div className="text-left overflow-hidden">
                      <div className="text-sm font-medium truncate">Grant Pro</div>
                      <div className="text-xs text-muted-foreground truncate">29 day access</div>
                    </div>
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => {
                      resetGeminiUsage.mutate(selectedUser.id);
                    }}
                    className="flex items-center gap-2 h-auto py-2"
                  >
                    <RefreshCw className="h-4 w-4 text-green-600 shrink-0" />
                    <div className="text-left overflow-hidden">
                      <div className="text-sm font-medium truncate">Reset Usage</div>
                      <div className="text-xs text-muted-foreground truncate">API counters</div>
                    </div>
                  </Button>
                  
                  <Button
                    variant="destructive"
                    onClick={() => {
                      revokeSubscription.mutate(selectedUser.id);
                    }}
                    className="flex items-center gap-2 h-auto py-2"
                  >
                    <Ban className="h-4 w-4 shrink-0" />
                    <div className="text-left overflow-hidden">
                      <div className="text-sm font-medium truncate">Revoke Pro</div>
                      <div className="text-xs truncate">Remove access</div>
                    </div>
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => {
                      syncSubscription.mutate(selectedUser.id);
                    }}
                    className={cn(
                      "flex items-center gap-2 h-auto py-2",
                      selectedUser.needs_sync 
                        ? "bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300" 
                        : ""
                    )}
                  >
                    {selectedUser.needs_sync ? (
                      <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 shrink-0" />
                    )}
                    <div className="text-left overflow-hidden">
                      <div className="text-sm font-medium truncate">Sync Subscription</div>
                      <div className="text-xs text-muted-foreground truncate">From payment records</div>
                    </div>
                  </Button>
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="secondary" onClick={() => setShowSubscriptionModal(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
} 
 