import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  Settings, 
  LogOut, 
  HelpCircle, 
  Moon, 
  Sun 
} from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

export function ProfileDropdown() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  
  const [userInitials, setUserInitials] = useState('');
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  
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
    } else {
      // Default values if no user data is available
      setUserName('User');
      setUserEmail('user@example.com');
      setUserInitials('U');
    }
  }, [user]);
  
  // Handle navigation to different pages
  const handleNavigation = (path: string) => {
    // For internal navigation, update the selectedNav in localStorage
    if (path === '/profile') {
      localStorage.setItem('selectedNav', 'Profile');
      window.location.reload();
    } else if (path === '/settings') {
      localStorage.setItem('selectedNav', 'Settings');
      window.location.reload();
    } else if (path === '/help') {
      localStorage.setItem('selectedNav', 'Help');
      window.location.reload();
    } else {
      // For external links, use navigate
      navigate(path);
    }
  };
  
  // Toggle theme between light and dark
  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="flex items-center space-x-3 cursor-pointer">
          <Avatar>
            <AvatarImage src={avatarUrl} alt={userName} />
            <AvatarFallback className="bg-primary text-primary-foreground">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-medium">{userName}</span>
            <span className="text-xs text-muted-foreground truncate max-w-[120px]">
              {userEmail}
            </span>
          </div>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{userName}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {userEmail}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => handleNavigation('/profile')}>
            <User className="mr-2 h-4 w-4" />
            <span>Profile</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleNavigation('/settings')}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={toggleTheme}>
            {theme === 'dark' ? (
              <>
                <Sun className="mr-2 h-4 w-4" />
                <span>Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="mr-2 h-4 w-4" />
                <span>Dark Mode</span>
              </>
            )}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleNavigation('/help')}>
          <HelpCircle className="mr-2 h-4 w-4" />
          <span>Help</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
