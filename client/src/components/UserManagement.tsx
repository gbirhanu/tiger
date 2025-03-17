import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { User } from '../../../shared/schema';
import { useAuth } from '../contexts/AuthContext';
import { formatDistanceToNow, formatRelative } from 'date-fns';
import { formatDate, getUserTimezone } from '@/lib/timezone';
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
import { toast } from "@/hooks/use-toast";
import { MoreHorizontal, UserCheck, UserX, Shield, ShieldAlert, RefreshCw, Search, UserPlus, Activity } from 'lucide-react';

// Create an axios instance with auth token
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Extended User type with additional fields for the UI
interface ExtendedUser extends User {
  lastLoginFormatted?: string;
}

// Interface for updating user status
interface UpdateUserStatusRequest {
  userId: number;
  status: 'active' | 'inactive' | 'suspended';
}

// Interface for updating user role
interface UpdateUserRoleRequest {
  userId: number;
  role: 'admin' | 'user';
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

// Format date to show both absolute time and relative time
const formatDateTime = (date: Date | number | string | null | undefined): React.ReactNode => {
  if (!date) return 'Never';
  
  try {
    const dateObj = typeof date === 'number' 
      ? new Date(date < 10000000000 ? date * 1000 : date) 
      : new Date(date);
    
    const absoluteTime = formatDate(dateObj, 'PPp');
    const relativeTime = formatDistanceToNow(dateObj, { addSuffix: true });
    
    return (
      <div className="text-xs" title={absoluteTime}>
        <span>{absoluteTime}</span>
        <div className="text-muted-foreground mt-0.5">({relativeTime})</div>
      </div>
    );
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid date';
  }
};

export default function UserManagement() {
  const { user: currentUser, sessionToken } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<ExtendedUser | null>(null);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<'active' | 'inactive' | 'suspended'>('active');
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user');
  const queryClient = useQueryClient();

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
          <TabsTrigger value="all">All Users</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="inactive">Inactive</TabsTrigger>
          <TabsTrigger value="admin">Admins</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-20 w-full" />
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
            />
          )}
        </TabsContent>
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

// User Table Component
interface UserTableProps {
  users: ExtendedUser[];
  currentUser: any;
  handleStatusChange: (user: ExtendedUser, status: 'active' | 'inactive' | 'suspended') => void;
  handleRoleChange: (user: ExtendedUser, role: 'admin' | 'user') => void;
  renderStatusBadge: (status: string) => React.ReactNode;
  renderRoleBadge: (role: string) => React.ReactNode;
  renderOnlineStatus: (isOnline: boolean) => React.ReactNode;
}

function UserTable({ 
  users, 
  currentUser, 
  handleStatusChange, 
  handleRoleChange,
  renderStatusBadge,
  renderRoleBadge,
  renderOnlineStatus
}: UserTableProps) {
  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead className="hidden md:table-cell">Status</TableHead>
            <TableHead className="hidden md:table-cell">Role</TableHead>
            <TableHead className="hidden md:table-cell">Last Login</TableHead>
            <TableHead className="hidden lg:table-cell">Login Info</TableHead>
            <TableHead className="hidden lg:table-cell">Created</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                No users found
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{user.name || 'Unnamed User'}</span>
                      {renderOnlineStatus(!!user.is_online)}
                    </div>
                    <span className="text-sm text-muted-foreground">{user.email}</span>
                    <div className="md:hidden mt-2 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Status:</span>
                        {renderStatusBadge(user.status || 'active')}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Role:</span>
                        {renderRoleBadge(user.role || 'user')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Last login: <span className="text-foreground">{formatDateTime(user.last_login)}</span>
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">{renderStatusBadge(user.status || 'active')}</TableCell>
                <TableCell className="hidden md:table-cell">{renderRoleBadge(user.role || 'user')}</TableCell>
                <TableCell className="hidden md:table-cell">
                  {formatDateTime(user.last_login)}
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <div className="flex flex-col gap-1">
                    <div className="text-xs">
                      <span className="font-medium">Count:</span> {user.login_count || 0}
                    </div>
                    {user.last_login_ip && (
                      <div className="text-xs">
                        <span className="font-medium">IP:</span> {user.last_login_ip}
                      </div>
                    )}
                    {user.user_location && (
                      <div className="text-xs">
                        <span className="font-medium">Location:</span> {user.user_location}
                      </div>
                    )}
                    {user.last_login_device && (
                      <div className="text-xs max-w-[200px] truncate" title={user.last_login_device}>
                        <span className="font-medium">Device:</span> {user.last_login_device}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {formatDateTime(user.created_at)}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      
                      {/* Status Actions */}
                      {user.status !== 'active' && (
                        <DropdownMenuItem 
                          onClick={() => handleStatusChange(user, 'active')}
                          disabled={user.id === currentUser?.id}
                        >
                          <UserCheck className="mr-2 h-4 w-4" />
                          <span>Activate</span>
                        </DropdownMenuItem>
                      )}
                      
                      {user.status !== 'inactive' && (
                        <DropdownMenuItem 
                          onClick={() => handleStatusChange(user, 'inactive')}
                          disabled={user.id === currentUser?.id}
                          title="Deactivate: User account is disabled but can be reactivated. User cannot log in."
                        >
                          <UserX className="mr-2 h-4 w-4" />
                          <span>Deactivate</span>
                        </DropdownMenuItem>
                      )}
                      
                      {user.status !== 'suspended' && (
                        <DropdownMenuItem 
                          onClick={() => handleStatusChange(user, 'suspended')}
                          disabled={user.id === currentUser?.id}
                          className="text-red-500 focus:text-red-500"
                          title="Suspend: User account is suspended due to policy violations. User cannot log in."
                        >
                          <UserX className="mr-2 h-4 w-4" />
                          <span>Suspend</span>
                        </DropdownMenuItem>
                      )}
                      
                      <DropdownMenuSeparator />
                      
                      {/* Role Actions */}
                      {user.role !== 'admin' && (
                        <DropdownMenuItem 
                          onClick={() => handleRoleChange(user, 'admin')}
                          disabled={user.id === currentUser?.id}
                        >
                          <ShieldAlert className="mr-2 h-4 w-4" />
                          <span>Make Admin</span>
                        </DropdownMenuItem>
                      )}
                      
                      {user.role !== 'user' && (
                        <DropdownMenuItem 
                          onClick={() => handleRoleChange(user, 'user')}
                          disabled={user.id === currentUser?.id}
                        >
                          <Shield className="mr-2 h-4 w-4" />
                          <span>Make Regular User</span>
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
} 