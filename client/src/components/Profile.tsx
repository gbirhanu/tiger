import React, { useState, useEffect } from 'react';
import { User, Mail, Calendar, Clock, Shield, Edit, Save, X, Upload, Camera, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { getUserTimezone } from '@/lib/timezone';
import { formatDistanceToNow, format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { useQuery } from '@tanstack/react-query';
import { getUserSettings, getAuthToken } from '@/lib/api';
import { QUERY_KEYS, apiRequest } from '@/lib/queryClient';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useNavigate } from 'react-router-dom';

// Interface to represent full user data
interface FullUserData {
  id: number;
  email: string;
  name: string;
  created_at: number;
  updated_at: number;
  last_login: number;
  login_count: number;
  last_login_device?: string;
  last_login_ip?: string;
  role: string;
  status: string;
  is_online: boolean;
}

// Helper function to convert any timestamp to milliseconds
const normalizeTimestamp = (timestamp: number): number => {
  // If timestamp is in seconds (10 digits or less), convert to milliseconds
  if (timestamp < 10000000000) {
    return timestamp * 1000;
  }
  // Already in milliseconds
  return timestamp;
};

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userInitials, setUserInitials] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [joinDate, setJoinDate] = useState<number | string>('');
  const [fullUserData, setFullUserData] = useState<FullUserData | null>(null);
  
  // Delete account states
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  
  // Password update states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  
  // Track the current tab and persist it
  const [activeTab, setActiveTab] = useState('profile');
  
  // Get user settings for timezone
  const { data: userSettings } = useQuery({
    queryKey: [QUERY_KEYS.USER_SETTINGS],
    queryFn: getUserSettings
  });
  
  // Get the user's timezone - either from settings or auto-detected
  const userTimezone = userSettings?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  // Fetch full user data on component mount
  useEffect(() => {
    const fetchFullUserData = async () => {
      if (!user?.id) return;
      
      try {
        const response = await apiRequest(
          'GET',
          `/api/users/${user.id}`,
          null
        );
        
        if (!response.ok) {
          console.error('Failed to fetch complete user data');
          return;
        }
        
        const data = await response.json();
        setFullUserData(data.user);
        
        // Update joinDate with real created_at
        if (data.user.created_at) {
          // Make sure created_at is a valid timestamp (not 0)
          if (data.user.created_at > 1000000) { // Some reasonable minimum timestamp (after 1970)
            setJoinDate(data.user.created_at);
          } else {
            // If timestamp is invalid, set it to a reasonable default
            console.warn('Invalid created_at timestamp:', data.user.created_at);
            setJoinDate(Date.now() - 86400000); // Yesterday as a fallback
          }
        }
      } catch (error) {
        console.error('Error fetching user details:', error);
      }
    };
    
    fetchFullUserData();
  }, [user?.id]);
  
  // Load the active tab from localStorage on component mount
  useEffect(() => {
    const savedTab = localStorage.getItem('profileActiveTab');
    if (savedTab) {
      setActiveTab(savedTab);
    }
  }, []);
  
  // Save the active tab to localStorage when it changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    localStorage.setItem('profileActiveTab', value);
  };
  
  // Get user data on component mount
  useEffect(() => {
    // Check for dedicated avatar storage first
    const storedAvatar = localStorage.getItem('userAvatar');
    if (storedAvatar) {
      setAvatarUrl(storedAvatar);
    }
    
    // Try to get user data from localStorage if not available in context
    const storedUser = localStorage.getItem('user');
    const userData = user || (storedUser ? JSON.parse(storedUser) : null);
    
    if (userData) {
      // Set user name (fallback to "User" if not available)
      const name = userData.name || userData.username || 'User';
      setUserName(name);
      
      // Set user email (fallback to "user@example.com" if not available)
      setUserEmail(userData.email || 'user@example.com');
      
      // Generate initials from name
      const initials = name
        .split(' ')
        .map((part: string) => part[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
      setUserInitials(initials);
      
      // Set avatar URL if available and not already set from dedicated storage
      if (userData.avatar && !storedAvatar) {
        setAvatarUrl(userData.avatar);
        
        // Ensure we update the auth user with the avatar if it's coming from localStorage
        if (user && userData.avatar) {
          // Type assertion to treat user as a generic object
          const userObj = user as Record<string, any>;
          const shouldUpdateUser = !userObj.avatar;
          
          if (shouldUpdateUser) {
            // Update the user object in context with the avatar from localStorage
            const updatedUserData = { ...userObj, avatar: userData.avatar };
            localStorage.setItem('user', JSON.stringify(updatedUserData));
          }
        }
        
        // Also save to the dedicated avatar storage for better persistence
        localStorage.setItem('userAvatar', userData.avatar);
      }
      
      // Set join date (use created_at timestamp if available)
      if (!fullUserData?.created_at) {
        setJoinDate(userData.created_at || userData.joinDate || Date.now());
      }
    } else {
      // Default values if no user data is available
      setUserName('User');
      setUserEmail('user@example.com');
      setUserInitials('U');
      setJoinDate(Date.now());
    }
  }, [user, fullUserData?.created_at]);
  
  // Format the join date in a human-readable format
  const formattedJoinDate = React.useMemo(() => {
    if (!joinDate) return 'Unknown';
    
    try {
      // Convert to number if it's a timestamp as string
      const timestamp = typeof joinDate === 'string' ? parseInt(joinDate, 10) : joinDate;
      
      // Validate timestamp - if invalid, use a fallback
      if (timestamp <= 1000000) { // Invalid or very early Unix timestamp
        console.warn('Invalid joinDate timestamp:', timestamp);
        const fallbackDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
        return `About a month ago (${formatInTimeZone(fallbackDate, userTimezone, 'MMMM d, yyyy')})`;
      }
      
      // Normalize timestamp to milliseconds
      const timestampMs = normalizeTimestamp(timestamp);
      
      // Create date object from milliseconds
      const dateObj = new Date(timestampMs);
      
      // Check if date is valid before formatting
      if (isNaN(dateObj.getTime())) {
        console.warn('Invalid date object from timestamp:', timestamp);
        return 'Unknown date';
      }
      
      // Format as "X time ago (actual date)"
      return `${formatDistanceToNow(dateObj, { addSuffix: true })} (${formatInTimeZone(dateObj, userTimezone, 'MMMM d, yyyy')})`;
    } catch (error) {
      console.error('Error formatting join date:', error);
      return 'Unknown date';
    }
  }, [joinDate, userTimezone]);
  
  // Save profile changes
  const saveProfile = async () => {
    try {
      // First, update in the database via API
      const response = await apiRequest(
        'PATCH',
        '/auth/update-profile',
        {
          name: userName
        }
      );
      
      if (!response.ok) {
        const data = await response.json();
        toast({
          title: "Error Updating Profile",
          description: data.error || "Failed to update profile in database",
          variant: "destructive"
        });
        return;
      }
      
      // Get the updated user data from the response
      const userData = await response.json();
      
      // Create updated user object for local storage
      const updatedUser = {
        ...user,
        name: userName,
        avatar: avatarUrl
      };
      
      // Save to localStorage - both user object and dedicated avatar storage
      localStorage.setItem('user', JSON.stringify(updatedUser));
      localStorage.setItem('userName', userName);
      
      // Save avatar to dedicated storage for better persistence
      if (avatarUrl) {
        localStorage.setItem('userAvatar', avatarUrl);
      }
      
      
      // Show success toast
      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated.",
        variant: "default"
      });
      
      // Exit edit mode
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error Updating Profile",
        description: "An unexpected error occurred while updating your profile.",
        variant: "destructive"
      });
    }
  };
  
  // Cancel editing
  const cancelEditing = () => {
    // Reset form to current values
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const userData = JSON.parse(storedUser);
      setUserName(userData.name || 'User');
      setUserEmail(userData.email || 'user@example.com');
      setAvatarUrl(userData.avatar || '');
    }
    
    // Exit edit mode
    setIsEditing(false);
  };
  
  // Handle avatar upload (mock implementation)
  const handleAvatarUpload = () => {
    // In a real implementation, this would open a file picker and upload the image
    // For demo purposes, we'll just set a random avatar
    const randomAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random().toString(36).substring(7)}`;
    setAvatarUrl(randomAvatar);
    
    // Ensure we update both the localStorage user and the auth context user
    
    // Update localStorage user
    const storedUser = localStorage.getItem('user');
    let updatedUser;
    
    if (storedUser) {
      const userData = JSON.parse(storedUser);
      updatedUser = {
        ...userData,
        avatar: randomAvatar
      };
    } else {
      // Create a new user object if none exists
      updatedUser = {
        name: userName,
        email: userEmail,
        avatar: randomAvatar,
        joinDate: joinDate
      };
    }
    
    // Save to localStorage (both in the 'user' object and as a separate 'userAvatar' key for redundancy)
    localStorage.setItem('user', JSON.stringify(updatedUser));
    localStorage.setItem('userAvatar', randomAvatar);
    
    
    toast({
      title: "Avatar Updated",
      description: "Your profile picture has been updated and saved.",
      variant: "default"
    });
  };
  
  // Handle delete account
  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    setDeleteError('');
    
    try {
      const response = await apiRequest(
        'POST',
        '/auth/delete-account',
        { password: deletePassword }
      );
      
      if (!response.ok) {
        const data = await response.json();
        setDeleteError(data.error || 'Failed to delete account');
        setIsDeleting(false);
        return;
      }
      
      // Success - clear everything and redirect
      toast({
        title: "Account Deleted",
        description: "Your account has been successfully deleted.",
      });
      
      // Logout the user
      logout();
      
      // Redirect to home page
      navigate('/');
    } catch (error) {
      console.error('Error deleting account:', error);
      setDeleteError('An unexpected error occurred');
      setIsDeleting(false);
    }
  };
  
  // Handle password update
  const handleUpdatePassword = async () => {
    // Reset error state
    setPasswordError('');
    
    // Validate inputs
    if (!currentPassword) {
      setPasswordError('Current password is required');
      return;
    }
    
    if (!newPassword) {
      setPasswordError('New password is required');
      return;
    }
    
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    
    // Set loading state
    setIsUpdatingPassword(true);
    
    try {
      // Call the API to update password using apiRequest utility
      const response = await apiRequest(
        'POST',
        '/auth/update-password',
        {
          currentPassword,
          newPassword
        }
      );
      
      if (!response.ok) {
        const data = await response.json();
        setPasswordError(data.error || 'Failed to update password');
        setIsUpdatingPassword(false);
        return;
      }
      
      // Success - clear form and show toast
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      toast({
        title: "Password Updated",
        description: "Your password has been successfully changed.",
      });
      
      // End loading state
      setIsUpdatingPassword(false);
    } catch (error) {
      console.error('Error updating password:', error);
      setPasswordError('An unexpected error occurred');
      setIsUpdatingPassword(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Your Profile</h2>
        <p className="text-muted-foreground">
          Manage your account settings and preferences.
        </p>
      </div>
      
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>
        
        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>
                    Update your personal details and profile picture.
                  </CardDescription>
                </div>
                {!isEditing ? (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setIsEditing(true)}
                    className="gap-1"
                  >
                    <Edit className="h-4 w-4" />
                    Edit Profile
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={cancelEditing}
                      className="gap-1"
                    >
                      <X className="h-4 w-4" />
                      Cancel
                    </Button>
                    <Button 
                      variant="default" 
                      size="sm" 
                      onClick={saveProfile}
                      className="gap-1"
                    >
                      <Save className="h-4 w-4" />
                      Save
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex flex-col items-center space-y-3">
                  <Avatar className="h-24 w-24 border-2 border-muted">
                    <AvatarImage src={avatarUrl} alt={userName} />
                    <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  
                  {isEditing && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleAvatarUpload}
                      className="gap-1"
                    >
                      <Camera className="h-4 w-4" />
                      Change Picture
                    </Button>
                  )}
                </div>
                
                <div className="flex-1 space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      {isEditing ? (
                        <Input 
                          id="name" 
                          value={userName} 
                          onChange={(e) => setUserName(e.target.value)} 
                          placeholder="Your name"
                        />
                      ) : (
                        <div className="flex items-center h-10 px-3 rounded-md border border-input bg-background">
                          <User className="h-4 w-4 text-muted-foreground mr-2" />
                          <span>{userName}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <div className="flex items-center h-10 px-3 rounded-md border border-input bg-background">
                        <Mail className="h-4 w-4 text-muted-foreground mr-2" />
                        <span>{userEmail}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Email cannot be changed as it is used for login.
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Member Since</Label>
                      <div className="flex items-center h-10 px-3 rounded-md border border-input bg-background">
                        <Calendar className="h-4 w-4 text-muted-foreground mr-2" />
                        <span className="text-sm">{formattedJoinDate}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Time Zone</Label>
                      <div className="flex items-center h-10 px-3 rounded-md border border-input bg-background">
                        <Clock className="h-4 w-4 text-muted-foreground mr-2" />
                        <span className="text-sm">{userTimezone}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Account Activity</CardTitle>
              <CardDescription>
                Recent activity on your account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-[25px_1fr] items-start pb-4 last:mb-0 last:pb-0">
                  <span className="flex h-2 w-2 translate-y-1 rounded-full bg-green-500" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">
                      Logged in from new device
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {fullUserData?.last_login ? (
                        formatInTimeZone(new Date(normalizeTimestamp(fullUserData.last_login)), userTimezone, 'MMM dd, yyyy h:mm a')
                      ) : (
                        formatInTimeZone(new Date(Date.now() - 3600000), userTimezone, 'MMM dd, yyyy h:mm a')
                      )}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-[25px_1fr] items-start pb-4 last:mb-0 last:pb-0">
                  <span className="flex h-2 w-2 translate-y-1 rounded-full bg-blue-500" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">
                      Profile updated
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {fullUserData?.updated_at ? (
                        formatInTimeZone(new Date(normalizeTimestamp(fullUserData.updated_at)), userTimezone, 'MMM dd, yyyy h:mm a')
                      ) : (
                        formatInTimeZone(new Date(Date.now() - 86400000), userTimezone, 'MMM dd, yyyy h:mm a')
                      )}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-[25px_1fr] items-start pb-4 last:mb-0 last:pb-0">
                  <span className="flex h-2 w-2 translate-y-1 rounded-full bg-yellow-500" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">
                      Total logins
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {fullUserData?.login_count ? `${fullUserData.login_count} times` : 'First login'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>
                Manage your account security and password.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <Input 
                  id="current-password" 
                  type="password" 
                  placeholder="••••••••" 
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input 
                  id="new-password" 
                  type="password" 
                  placeholder="••••••••" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input 
                  id="confirm-password" 
                  type="password" 
                  placeholder="••••••••" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              
              {passwordError && (
                <div className="text-sm text-destructive mt-1">
                  {passwordError}
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button 
                variant="outline" 
                className="gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setIsDeleteDialogOpen(true)}
              >
                <Shield className="h-4 w-4" />
                Delete Account
              </Button>
              <Button 
                onClick={handleUpdatePassword}
                disabled={isUpdatingPassword}
                className="gap-1"
              >
                {isUpdatingPassword ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <span>Update Password</span>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Delete Account Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> 
              Delete Account
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. All your data will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              To confirm, please enter your password:
            </p>
            
            <div className="space-y-2">
              <Label htmlFor="delete-password" className="sr-only">Password</Label>
              <Input
                id="delete-password"
                type="password"
                placeholder="Enter your password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
              />
              
              {deleteError && (
                <p className="text-sm text-destructive mt-1">{deleteError}</p>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={!deletePassword || isDeleting}
              className="gap-1"
            >
              {isDeleting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete Account
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 