import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { User, Subscription } from '../../../shared/schema';
import { useAuth } from '../contexts/AuthContext';
import { useMarketingSettings } from '@/lib/hooks/useMarketingSettings';
import { getUserPaymentHistory, grantProSubscription as grantProApi, 
  resetGeminiUsage as resetGeminiApi, revokeSubscription as revokeApi,
  syncUserSubscription } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Skeleton } from './ui/skeleton';
import { MoreHorizontal, UserCheck, UserX, Shield, ShieldAlert, RefreshCw, Search, UserPlus, Activity, CreditCard, User2Icon, UserIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Separator } from './ui/separator';
import { UseMutationResult } from '@tanstack/react-query';
import { UserTable } from './UserTable';

// Create an axios instance with auth token
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Interface for updating user role
interface UpdateUserRoleRequest {
  userId: number;
  role: 'admin' | 'user';
}

// Interface for updating user status
interface UpdateUserStatusRequest {
  userId: number;
  status: 'active' | 'inactive' | 'suspended';
}

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
    subscription_end_date?: number;
  };
}



// Status Explanation Component
function StatusExplanation() {
  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">User Status Types</CardTitle>
        <CardDescription>Understanding the different user status options</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/50">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800">
                Active
              </Badge>
            </div>
            <p className="text-sm text-green-800 dark:text-green-300">
              User has full access to the system and can log in normally.
            </p>
          </div>
          
          <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/50">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800">
                Inactive
              </Badge>
            </div>
            <p className="text-sm text-amber-800 dark:text-amber-300">
              User account is temporarily disabled. Used for accounts that are not currently in use but may be reactivated later. User cannot log in.
            </p>
          </div>
          
          <div className="p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800">
                Suspended
              </Badge>
            </div>
            <p className="text-sm text-red-800 dark:text-red-300">
              User account is suspended due to policy violations or security concerns. More severe than inactive. User cannot log in.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


export default function UserManagement() {
  const { user: currentUser, sessionToken } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<ExtendedUser | null>(null);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [newStatus, setNewStatus] = useState<'active' | 'inactive' | 'suspended'>('active');
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user');
  const queryClient = useQueryClient();
  // Add pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Get marketing settings
  const { showSubscriptionFeatures } = useMarketingSettings();

  // Update API interceptor to use the current sessionToken
  useEffect(() => {
    // Create a request interceptor
    const interceptor = api.interceptors.request.use((config) => {
      // Use the sessionToken from auth context if available
      if (sessionToken) {
        config.headers.Authorization = `Bearer ${sessionToken}`;
      }
      return config;
    });

    // Clean up interceptor when component unmounts
    return () => {
      api.interceptors.request.eject(interceptor);
    };
  }, [sessionToken]);

  // Fetch all users
  const { data: users, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/users');
      
      // Return users without additional formatting since we'll use formatDateTime directly
      return response.data.users;
    },
  });

  // Filter users based on search term
  const filteredUsers = users?.filter((user: ExtendedUser) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      user.name?.toLowerCase().includes(searchLower) ||
      user.email.toLowerCase().includes(searchLower) ||
      user.role.toLowerCase().includes(searchLower) ||
      user.status?.toLowerCase().includes(searchLower)
    );
  });

  // Update user status mutation
  const updateUserStatus = useMutation({
    mutationFn: async (data: UpdateUserStatusRequest) => {
      const response = await api.put(`/users/${data.userId}/status`, { status: data.status });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({
        title: "Status updated",
        description: `User status has been updated to ${newStatus}`,
      });
      setIsStatusDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error updating status",
        description: error.response?.data?.error || "An error occurred",
        variant: "destructive",
      });
    },
  });

  // Update user role mutation
  const updateUserRole = useMutation({
    mutationFn: async (data: UpdateUserRoleRequest) => {
      const response = await api.put(`/users/${data.userId}/role`, { role: data.role });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({
        title: "Role updated",
        description: `User role has been updated to ${newRole}`,
      });
      setIsRoleDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error updating role",
        description: error.response?.data?.error || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const handleStatusChange = (user: ExtendedUser, status: 'active' | 'inactive' | 'suspended') => {
    setSelectedUser(user);
    setNewStatus(status);
    setIsStatusDialogOpen(true);
  };

  const handleRoleChange = (user: ExtendedUser, role: 'admin' | 'user') => {
    setSelectedUser(user);
    setNewRole(role);
    setIsRoleDialogOpen(true);
  };

  const confirmStatusChange = () => {
    if (selectedUser) {
      updateUserStatus.mutate({
        userId: selectedUser.id,
        status: newStatus
      });
    }
  };

  const confirmRoleChange = () => {
    if (selectedUser) {
      updateUserRole.mutate({
        userId: selectedUser.id,
        role: newRole
      });
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="outline" className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800">Active</Badge>;
      case 'inactive':
        return <Badge variant="outline" className="bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800">Inactive</Badge>;
      case 'suspended':
        return <Badge variant="outline" className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800">Suspended</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const renderRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge variant="outline" className="bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800">Admin</Badge>;
      case 'user':
        return <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800">User</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const renderOnlineStatus = (isOnline: boolean) => {
    return isOnline ? (
      <Badge variant="outline" className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800 text-xs py-0 px-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1"></div>
        Online
      </Badge>
    ) : (
      <Badge variant="outline" className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 text-xs py-0 px-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-gray-400 mr-1"></div>
        Offline
      </Badge>
    );
  };

  // Add mutations for managing a user's subscription
  const grantProSubscription = useMutation({
    mutationFn: async (userId: number) => {
      return await grantProApi(userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({
        title: "Subscription granted",
        description: "User has been upgraded to Pro for 30 days",
      });
      // Close the subscription modal if it exists
      setShowSubscriptionModal(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error granting subscription",
        description: error.message || "Authentication required. Please refresh the page and try again.",
        variant: "destructive",
      });
    }
  });

  const revokeSubscription = useMutation({
    mutationFn: async (userId: number) => {
      return await revokeApi(userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({
        title: "Subscription revoked",
        description: "User has been downgraded to Free plan",
      });
      // Close the subscription modal if it exists
      setShowSubscriptionModal(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error revoking subscription",
        description: error.message || "Authentication required. Please refresh the page and try again.",
        variant: "destructive",
      });
    }
  });

  const resetGeminiUsage = useMutation({
    mutationFn: async (userId: number) => {
      return await resetGeminiApi(userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({
        title: "API usage reset",
        description: "Gemini API usage count has been reset",
      });
      // Close the subscription modal if it exists
      setShowSubscriptionModal(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error resetting API usage",
        description: error.message || "Authentication required. Please refresh the page and try again.",
        variant: "destructive",
      });
    }
  });

  // Add mutation for syncing a user's subscription
  const syncSubscription = useMutation({
    mutationFn: async (userId: number) => {
      // Pass the sessionToken directly to the API function
      return await syncUserSubscription(userId);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({
        title: "Subscription synced",
        description: `User subscription updated to ${data.subscription_plan}`,
      });
      // Close the subscription modal if it exists
      setShowSubscriptionModal(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error syncing subscription",
        description: error.message || "Authentication required. Please refresh the page and try again.",
        variant: "destructive",
      });
    }
  });

  // Add query to fetch payment history for a user
  const fetchPaymentHistory = async (userId: number) => {
    try {
      // Import the API function dynamically to avoid circular dependencies
      const { getUserPaymentHistory } = await import('@/lib/api');
      return await getUserPaymentHistory(userId);
    } catch (error) {
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
    queryKey: ['paymentHistory', selectedUser?.id],
    queryFn: () => selectedUser?.id ? fetchPaymentHistory(selectedUser.id) : null,
    enabled: !!selectedUser?.id && showSubscriptionModal,
  });

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 mb-4">
          <h3 className="text-red-800 dark:text-red-300 font-medium">Error loading users</h3>
          <p className="text-red-700 dark:text-red-400 text-sm mt-1">
            {(error as any).response?.data?.error || "An error occurred while loading users."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">User Management 
            <Badge variant="outline" className="bg-blue-100 ml-2 dark:bg-blue-900 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800 text-xs py-0 px-1.5">{users?.length || 0} Users</Badge>
          </h2> 
          <p className="text-muted-foreground">
            Manage user accounts, roles, and permissions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search users..."
              className="pl-8 w-full sm:w-[250px]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" className="gap-1" disabled>
            <UserPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Add User</span>
          </Button>
        </div>
      </div>

      <StatusExplanation />

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">
            All Users
            {filteredUsers?.length > 0 && (
              <Badge variant="secondary" className="ml-2 px-1 py-0 text-xs">
                {filteredUsers.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="active">
            Active
            {filteredUsers?.filter((user: ExtendedUser) => user.status === 'active').length > 0 && (
              <Badge variant="secondary" className="ml-2 px-1 py-0 text-xs">
                {filteredUsers.filter((user: ExtendedUser) => user.status === 'active').length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="inactive">
            Inactive
            {filteredUsers?.filter((user: ExtendedUser) => user.status === 'inactive' || user.status === 'suspended').length > 0 && (
              <Badge variant="secondary" className="ml-2 px-1 py-0 text-xs">
                {filteredUsers.filter((user: ExtendedUser) => user.status === 'inactive' || user.status === 'suspended').length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="admin">
            Admins
            {filteredUsers?.filter((user: ExtendedUser) => user.role === 'admin').length > 0 && (
              <Badge variant="secondary" className="ml-2 px-1 py-0 text-xs">
                {filteredUsers.filter((user: ExtendedUser) => user.role === 'admin').length}
              </Badge>
            )}
          </TabsTrigger>
          {/* Only show the Pro Users tab if subscription features are enabled */}
          {showSubscriptionFeatures && (
            <TabsTrigger value="pro">
              Pro Users
              {filteredUsers?.filter((user: ExtendedUser) => 
                user.settings?.is_pro
              ).length > 0 && (
                <Badge variant="secondary" className="ml-2 px-1 py-0 text-xs">
                  {filteredUsers.filter((user: ExtendedUser) => 
                    user.settings?.is_pro
                  ).length}
                </Badge>
              )}
            </TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="all" className="mt-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <UserTable 
              users={filteredUsers || []} 
              currentUser={currentUser}
              handleStatusChange={handleStatusChange}
              handleRoleChange={handleRoleChange}
              renderStatusBadge={renderStatusBadge}
              renderRoleBadge={renderRoleBadge}
              renderOnlineStatus={renderOnlineStatus}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              itemsPerPage={itemsPerPage}
              setItemsPerPage={setItemsPerPage}
              grantProSubscription={grantProSubscription}
              resetGeminiUsage={resetGeminiUsage}
              revokeSubscription={revokeSubscription}
              syncSubscription={syncSubscription}
            />
          )}
        </TabsContent>
        <TabsContent value="active" className="mt-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <UserTable 
              users={(filteredUsers || []).filter((user: ExtendedUser) => user.status === 'active')} 
              currentUser={currentUser}
              handleStatusChange={handleStatusChange}
              handleRoleChange={handleRoleChange}
              renderStatusBadge={renderStatusBadge}
              renderRoleBadge={renderRoleBadge}
              renderOnlineStatus={renderOnlineStatus}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              itemsPerPage={itemsPerPage}
              setItemsPerPage={setItemsPerPage}
              grantProSubscription={grantProSubscription}
              resetGeminiUsage={resetGeminiUsage}
              revokeSubscription={revokeSubscription}
              syncSubscription={syncSubscription}
            />
          )}
        </TabsContent>
        <TabsContent value="inactive" className="mt-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <UserTable 
              users={(filteredUsers || []).filter((user: ExtendedUser) => user.status === 'inactive' || user.status === 'suspended')} 
              currentUser={currentUser}
              handleStatusChange={handleStatusChange}
              handleRoleChange={handleRoleChange}
              renderStatusBadge={renderStatusBadge}
              renderRoleBadge={renderRoleBadge}
              renderOnlineStatus={renderOnlineStatus}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              itemsPerPage={itemsPerPage}
              setItemsPerPage={setItemsPerPage}
              grantProSubscription={grantProSubscription}
              resetGeminiUsage={resetGeminiUsage}
              revokeSubscription={revokeSubscription}
              syncSubscription={syncSubscription}
            />
          )}
        </TabsContent>
        <TabsContent value="admin" className="mt-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <UserTable 
              users={(filteredUsers || []).filter((user: ExtendedUser) => user.role === 'admin')} 
              currentUser={currentUser}
              handleStatusChange={handleStatusChange}
              handleRoleChange={handleRoleChange}
              renderStatusBadge={renderStatusBadge}
              renderRoleBadge={renderRoleBadge}
              renderOnlineStatus={renderOnlineStatus}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              itemsPerPage={itemsPerPage}
              setItemsPerPage={setItemsPerPage}
              grantProSubscription={grantProSubscription}
              resetGeminiUsage={resetGeminiUsage}
              revokeSubscription={revokeSubscription}
              syncSubscription={syncSubscription}
            />
          )}
        </TabsContent>
        {/* Only render the Pro tab content if subscription features are enabled */}
        {showSubscriptionFeatures && (
          <TabsContent value="pro" className="mt-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : (
              <UserTable 
                users={(filteredUsers || []).filter((user: ExtendedUser) => {
                  // Consider a user as Pro if they have is_pro set to true in their settings
                  return user.settings?.is_pro === true;
                })} 
                currentUser={currentUser}
                handleStatusChange={handleStatusChange}
                handleRoleChange={handleRoleChange}
                renderStatusBadge={renderStatusBadge}
                renderRoleBadge={renderRoleBadge}
                renderOnlineStatus={renderOnlineStatus}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                itemsPerPage={itemsPerPage}
                setItemsPerPage={setItemsPerPage}
                grantProSubscription={grantProSubscription}
                resetGeminiUsage={resetGeminiUsage}
                revokeSubscription={revokeSubscription}
                syncSubscription={syncSubscription}
              />
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* Status Change Confirmation Dialog */}
      <AlertDialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change User Status</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to change the status of <strong>{selectedUser?.name || selectedUser?.email}</strong> to <strong>{newStatus}</strong>?
              {newStatus === 'inactive' && (
                <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded text-sm">
                  <strong>Note:</strong> Deactivating a user will prevent them from logging in. This is reversible.
                </div>
              )}
              {newStatus === 'suspended' && (
                <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded text-sm">
                  <strong>Warning:</strong> Suspending a user is a serious action typically used for policy violations. The user will be unable to log in.
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStatusChange}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Role Change Confirmation Dialog */}
      <AlertDialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change User Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to change the role of <strong>{selectedUser?.name || selectedUser?.email}</strong> to <strong>{newRole}</strong>?
              {newRole === 'admin' && (
                <div className="mt-2 p-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded text-sm">
                  <strong>Note:</strong> Admin users have full access to all features, including user management.
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRoleChange}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}



