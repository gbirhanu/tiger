import React, { useState, useEffect } from 'react';
import { User, Mail, Calendar, Clock, Shield, Edit, Save, X, Upload, Camera } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';

export default function Profile() {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userInitials, setUserInitials] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [joinDate, setJoinDate] = useState('');
  
  // Notification preferences
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [desktopNotifications, setDesktopNotifications] = useState(true);
  const [taskReminders, setTaskReminders] = useState(true);
  const [meetingReminders, setMeetingReminders] = useState(true);
  
  // Get user data on component mount
  useEffect(() => {
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
      
      // Set avatar URL if available
      if (userData.avatar) {
        setAvatarUrl(userData.avatar);
      }
      
      // Set join date (fallback to current date if not available)
      setJoinDate(userData.joinDate || new Date().toISOString().split('T')[0]);
    } else {
      // Default values if no user data is available
      setUserName('User');
      setUserEmail('user@example.com');
      setUserInitials('U');
      setJoinDate(new Date().toISOString().split('T')[0]);
    }
    
    // Load notification preferences from localStorage
    const storedPreferences = localStorage.getItem('notificationPreferences');
    if (storedPreferences) {
      try {
        const preferences = JSON.parse(storedPreferences);
        setEmailNotifications(preferences.email ?? true);
        setDesktopNotifications(preferences.desktop ?? true);
        setTaskReminders(preferences.tasks ?? true);
        setMeetingReminders(preferences.meetings ?? true);
      } catch (error) {
        console.error('Failed to parse notification preferences', error);
      }
    }
  }, [user]);
  
  // Save profile changes
  const saveProfile = () => {
    // Create updated user object
    const updatedUser = {
      name: userName,
      email: userEmail,
      avatar: avatarUrl,
      joinDate: joinDate
    };
    
    // Save to localStorage
    localStorage.setItem('user', JSON.stringify(updatedUser));
    localStorage.setItem('userName', userName);
    
    // Save notification preferences
    const preferences = {
      email: emailNotifications,
      desktop: desktopNotifications,
      tasks: taskReminders,
      meetings: meetingReminders
    };
    localStorage.setItem('notificationPreferences', JSON.stringify(preferences));
    
    // Show success toast
    toast({
      title: "Profile Updated",
      description: "Your profile has been successfully updated.",
      variant: "default"
    });
    
    // Exit edit mode
    setIsEditing(false);
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
    
    toast({
      title: "Avatar Updated",
      description: "Your profile picture has been updated.",
      variant: "default"
    });
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Your Profile</h2>
        <p className="text-muted-foreground">
          Manage your account settings and preferences.
        </p>
      </div>
      
      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
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
                      {isEditing ? (
                        <Input 
                          id="email" 
                          type="email" 
                          value={userEmail} 
                          onChange={(e) => setUserEmail(e.target.value)} 
                          placeholder="Your email"
                        />
                      ) : (
                        <div className="flex items-center h-10 px-3 rounded-md border border-input bg-background">
                          <Mail className="h-4 w-4 text-muted-foreground mr-2" />
                          <span>{userEmail}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Member Since</Label>
                      <div className="flex items-center h-10 px-3 rounded-md border border-input bg-background">
                        <Calendar className="h-4 w-4 text-muted-foreground mr-2" />
                        <span>{new Date(joinDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Time Zone</Label>
                      <div className="flex items-center h-10 px-3 rounded-md border border-input bg-background">
                        <Clock className="h-4 w-4 text-muted-foreground mr-2" />
                        <span>{Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
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
                      {new Date(Date.now() - 3600000).toLocaleString()}
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
                      {new Date(Date.now() - 86400000).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-[25px_1fr] items-start pb-4 last:mb-0 last:pb-0">
                  <span className="flex h-2 w-2 translate-y-1 rounded-full bg-yellow-500" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">
                      Password changed
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(Date.now() - 604800000).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Choose how you want to be notified about activity.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive notifications via email.
                    </p>
                  </div>
                  <Switch 
                    checked={emailNotifications} 
                    onCheckedChange={setEmailNotifications} 
                  />
                </div>
                
                <Separator />
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Desktop Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive notifications on your desktop.
                    </p>
                  </div>
                  <Switch 
                    checked={desktopNotifications} 
                    onCheckedChange={setDesktopNotifications} 
                  />
                </div>
                
                <Separator />
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Task Reminders</Label>
                    <p className="text-sm text-muted-foreground">
                      Get reminders for upcoming and overdue tasks.
                    </p>
                  </div>
                  <Switch 
                    checked={taskReminders} 
                    onCheckedChange={setTaskReminders} 
                  />
                </div>
                
                <Separator />
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Meeting Reminders</Label>
                    <p className="text-sm text-muted-foreground">
                      Get reminders for upcoming meetings.
                    </p>
                  </div>
                  <Switch 
                    checked={meetingReminders} 
                    onCheckedChange={setMeetingReminders} 
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={saveProfile}>Save Preferences</Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>
                Manage your account security and privacy.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <Input id="current-password" type="password" placeholder="••••••••" />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input id="new-password" type="password" placeholder="••••••••" />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input id="confirm-password" type="password" placeholder="••••••••" />
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Two-Factor Authentication</Label>
                  <p className="text-sm text-muted-foreground">
                    Add an extra layer of security to your account.
                  </p>
                </div>
                <Button variant="outline">Set Up</Button>
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Data Privacy</Label>
                  <p className="text-sm text-muted-foreground">
                    Manage how your data is used and stored.
                  </p>
                </div>
                <Button variant="outline">Manage</Button>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" className="gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive">
                <Shield className="h-4 w-4" />
                Delete Account
              </Button>
              <Button>Save Changes</Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 