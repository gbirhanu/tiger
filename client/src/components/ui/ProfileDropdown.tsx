import React, { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { 
  User, 
  Settings, 
  LogOut, 
  HelpCircle,
  Moon, 
  Sun, 
  Crown
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useTheme } from "@/contexts/ThemeContext";
import { Badge } from "../ui/badge";
import { useQuery } from "@tanstack/react-query";
import { getSubscriptionStatus } from "@/lib/api";
import { useMarketingSettings } from "@/lib/hooks/useMarketingSettings";

export function ProfileDropdown() {
  const { user, logout } = useAuth();
  const { setTheme, theme } = useTheme();
  const [userName, setUserName] = useState('User');
  const [userInitials, setUserInitials] = useState('U');
  const [userEmail, setUserEmail] = useState('');
  
  // Get marketing settings to determine if subscription features should be shown
  const { showSubscriptionFeatures } = useMarketingSettings();
  
  // Fetch subscription status
  const { data: subscriptionData } = useQuery({
    queryKey: ['subscription-status'],
    queryFn: getSubscriptionStatus,
    enabled: !!user
  });
  
  const isPro = subscriptionData?.is_pro && !subscriptionData?.is_expired;
  const showProBadge = showSubscriptionFeatures && isPro;
  
  // Get user data on component mount
  useEffect(() => {
    if (user) {
      // Set user name
      if (user.name) {
        setUserName(user.name);
        
        // Get initials
        const initials = user.name
          .split(' ')
          .map(name => name[0])
          .join('')
          .toUpperCase();
        setUserInitials(initials);
      }
      
      // Set email
      if (user.email) {
        setUserEmail(user.email);
      }
    }
  }, [user]);
  
  // Updated navigation handler that works with the app's navigation structure
  const handleNavigation = (path: string) => {
    if (path === '/settings') {
      // Set the selected nav item in localStorage to Settings
      localStorage.setItem('selectedNav', 'Settings');
      
      // Refresh the page to apply the nav change
      window.location.reload();
    } 
    else if (path === '/profile') {
      // Set the selected nav item in localStorage to Profile
      localStorage.setItem('selectedNav', 'Profile');
      
      // Refresh the page to apply the nav change
      window.location.reload();
    }
  };
  
  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };
  
  // Get user's first name
  const firstName = userName?.split(' ')[0] || 'User';
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="pl-2 pr-3 py-2 h-auto">
          <div className="flex items-center gap-2">
            <Avatar className="h-7 w-7 border border-border flex-shrink-0">
              <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary border-0">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start">
              <div className="flex items-center">
                <span className="text-sm font-medium">{firstName}</span>
                {showProBadge && (
                  <Badge 
                    variant="outline" 
                    className="ml-1.5 py-0 px-1.5 h-4 text-[10px] bg-gradient-to-r from-amber-200/80 to-yellow-500/80 text-amber-900 border-amber-300/80"
                  >
                    <Crown className="h-2.5 w-2.5 mr-0.5 stroke-[3px]" />
                    PRO
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">{userName}</p>
            <p className="text-xs text-muted-foreground break-all">{userEmail}</p>
            {showProBadge && (
              <Badge 
                variant="outline" 
                className="w-fit mt-1.5 bg-gradient-to-r from-amber-200/80 to-yellow-500/80 text-amber-900 border-amber-300/80"
              >
                <Crown className="h-3 w-3 mr-1 stroke-[3px]" />
                Pro Subscription
              </Badge>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => handleNavigation('/profile')} className="gap-2 cursor-pointer">
            <User className="h-4 w-4" />
            <span>Profile</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleNavigation('/settings')} className="gap-2 cursor-pointer">
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => logout()} className="gap-2 cursor-pointer">
          <LogOut className="h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
