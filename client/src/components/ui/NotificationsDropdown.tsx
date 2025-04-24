import React, { useCallback, useMemo } from 'react';
import { Bell, Check, CheckCheck, Info, Calendar, Clock, X, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications } from '@/hooks/use-notifications';
import { Notification } from '@/contexts/NotificationsContext';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Maximum number of notifications to show at once for performance
const MAX_VISIBLE_NOTIFICATIONS = 50;

export function NotificationsDropdown() {
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    clearNotifications 
  } = useNotifications();
  const navigate = useNavigate();

  // Optimized notifications list - only show the most recent ones
  const visibleNotifications = useMemo(() => {
    // Always show unread notifications
    const unread = notifications.filter(notification => !notification.read);
    
    // If we have fewer unread than our limit, add some read ones
    if (unread.length < MAX_VISIBLE_NOTIFICATIONS) {
      const read = notifications
        .filter(notification => notification.read)
        .slice(0, MAX_VISIBLE_NOTIFICATIONS - unread.length);
      
      return [...unread, ...read];
    }
    
    // If we have more unread than our limit, just show the most recent ones
    return unread.slice(0, MAX_VISIBLE_NOTIFICATIONS);
  }, [notifications]);

  // Helper function to get the appropriate icon based on notification type
  const getNotificationIcon = useCallback((type: Notification['type']) => {
    switch (type) {
      case 'task':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'meeting':
        return <Calendar className="h-4 w-4 text-blue-500" />;
      case 'reminder':
        return <Clock className="h-4 w-4 text-amber-500" />;
      case 'system':
        return <Info className="h-4 w-4 text-purple-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  }, []);

  // Handle notification click
  const handleNotificationClick = useCallback((notification: Notification) => {
    markAsRead(notification.id);
    if (notification.link) {
      // Check if the link is for the TaskManager component
      if (notification.link === 'Tasks') {
        // Set the selectedNav state in localStorage and trigger a storage event
        localStorage.setItem('selectedNav', 'Tasks');
        window.dispatchEvent(new Event('storage'));
      } else {
        // For other links, use the router navigation
        navigate(notification.link);
      }
    }
  }, [markAsRead, navigate]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b sticky top-0 z-10 bg-background">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">Notifications</h3>
            {notifications.length > MAX_VISIBLE_NOTIFICATIONS && (
              <span className="text-xs text-muted-foreground">
                (Showing {visibleNotifications.length} of {notifications.length})
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={markAllAsRead}
              className="h-8 text-xs"
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Mark all as read
            </Button>
          )}
        </div>
        
        {notifications.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground">
            <div className="flex justify-center mb-2">
              <Bell className="h-10 w-10 text-muted-foreground/30" />
            </div>
            <p>No notifications</p>
          </div>
        ) : (
          <>
            <ScrollArea className="max-h-[60vh] overflow-y-auto" type="always">
              <div className="py-1">
                {visibleNotifications.map((notification, index) => (
                  <DropdownMenuItem 
                    key={notification.id}
                    className={`px-4 py-3 cursor-pointer ${!notification.read ? 'bg-muted/50' : ''} ${index !== visibleNotifications.length - 1 ? 'border-b border-muted' : ''}`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex gap-3 w-full">
                      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className={`text-sm font-medium ${!notification.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {notification.title}
                        </p>
                        <TooltipProvider delayDuration={300}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="text-xs text-muted-foreground whitespace-normal break-words max-h-20 overflow-y-auto">
                                {notification.message}
                              </p>
                            </TooltipTrigger>
                            <TooltipContent side="left" align="start" className="max-w-sm">
                              <p className="whitespace-pre-line">{notification.message}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <p className="text-xs text-muted-foreground/70">
                          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="flex-shrink-0 h-2 w-2 rounded-full bg-primary" />
                      )}
                    </div>
                  </DropdownMenuItem>
                ))}
                
                {notifications.length > MAX_VISIBLE_NOTIFICATIONS && (
                  <div className="px-4 py-2 text-center text-xs text-muted-foreground border-t">
                    Showing {visibleNotifications.length} of {notifications.length} notifications
                  </div>
                )}
              </div>
            </ScrollArea>
            <div className="p-2 border-t sticky bottom-0 z-10 bg-background">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full text-xs"
                onClick={clearNotifications}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Clear all
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 