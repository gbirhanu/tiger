import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import TaskManager from "./TaskManager";
import NotesBoard from "./NotesBoard";
import PomodoroTimer from "./PomodoroTimer";
import Calendar from "./Calendar";
import Appointments from "./Appointments";
import {
  LayoutGrid, CheckSquare, StickyNote, Timer, CalendarDays, Video, 
  Settings as SettingsIcon, Flame, LogOut, Moon, Sun, ChevronRight, 
  Home, Clock, Search, Bell, MapPin, User as UserIcon, HelpCircle, Menu, X, 
  NotebookIcon, Calendar as CalendarIcon, Users, BarChart as BarChartIcon,
  ListTodo as ListTodoIcon, CheckCircle as CheckCircleIcon, 
  ListChecks as ListChecksIcon,
  Github
} from "lucide-react";
import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, addDays, isBefore, isAfter, startOfDay, endOfDay } from "date-fns";
import {
  BarChart,
  Bar, 
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
  RadialBarChart,
  RadialBar,
  PieChart,
  Pie,
} from "recharts";
import Meetings from "./Meetings";
import { Settings } from "./Settings";
import Profile from "./Profile";
import Help from "./Help";
import { useAuth } from "@/contexts/AuthContext";
import { getAppointments, getNotes, getPomodoroSettings, getTasks, getMeetings, getTasksWithSubtasks, getSubtasks, getUserSettings } from "@/lib/api";
import { ProfileDropdown } from "./ui/ProfileDropdown";

import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "@/hooks/use-toast";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { NotificationsDropdown } from "./ui/NotificationsDropdown";
import { TaskReminderService } from "./TaskReminderService";

import LongNotesBoard from "./LongNotesBoard";
import UserManagement from "./UserManagement";
import type { Task, Subtask, TaskWithSubtasks, User as UserType } from "../../../shared/schema";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { DashboardOverview } from "./DashboardOverview";
import { useMarketingSettings } from "@/lib/hooks/useMarketingSettings";
import { FirstTimeLoginDialog } from "./first-time-login";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";

// Define extended user type that includes subscription
interface ExtendedUser extends UserType {
  subscription?: {
    id?: number;
    plan?: string;
    status?: string;
    start_date?: number;
    end_date?: number;
    auto_renew?: boolean;
  };
}

export default function Dashboard() {
  // Use localStorage to persist the selected navigation item
  const [selectedNav, setSelectedNav] = React.useState<string>(() => {
    // Try to get the saved navigation from localStorage
    const savedNav = localStorage.getItem('selectedNav');
    // Return the saved nav or default to "Dashboard"
    return savedNav || "Dashboard";
  });
  const { logout, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const [isMobileView, setIsMobileView] = React.useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  
  // Get marketing settings to determine if subscription features should be shown
  const { showSubscriptionFeatures } = useMarketingSettings();

  // Define navItems inside the component to access user
  const navItems = React.useMemo(() => {
    // Base navigation items that all users can see
    const baseItems = [
      {
        title: "Dashboard",
        icon: <LayoutGrid className="h-4 w-4" />,
        component: <DashboardOverview />,
      },
      {
        title: "Tasks",
        icon: <CheckSquare className="h-4 w-4" />,
        component: React.createElement(TaskManager),
      },
      {
        title: "Sticky Notes",
        icon: <StickyNote className="h-4 w-4" />,
        component: <NotesBoard />,
      },
      {
        title: "Long Notes",
        icon: <NotebookIcon className="h-4 w-4" />,
        component: <LongNotesBoard />,
      },
      {
        title: "Pomodoro",
        icon: <Timer className="h-4 w-4" />,
        component: <PomodoroTimer />,
      },
      {
        title: "Calendar",
        icon: <CalendarDays className="h-4 w-4" />,
        component: <Calendar />,
      },
      {
        title: "Appointments",
        icon: <CalendarIcon className="h-4 w-4" />,
        component: <Appointments />,
      },
      {
        title: "Meetings",
        icon: <Video className="h-4 w-4" />,
        component: <Meetings />,
      },
      {
        title: "Profile",
        icon: <UserIcon className="h-4 w-4" />,
        component: <Profile />,
      },
      {
        title: "Settings",
        icon: <SettingsIcon className="h-4 w-4" />,
        component: <Settings user={user} />,
      },
    ];
    
    // Add admin-only items
    if (user?.role === 'admin') {
      baseItems.push({
        title: "User Management",
        icon: <Users className="h-4 w-4" />,
        component: <UserManagement />,
      });
    }
    
    return baseItems;
  }, [user?.role]);

  // Update localStorage when navigation changes
  React.useEffect(() => {
    localStorage.setItem('selectedNav', selectedNav);
  }, [selectedNav]);

  // Check URL hash on mount for deep linking
  React.useEffect(() => {
    const hash = window.location.hash;

    if (hash === "#settings-notifications") {
      // Set the main sidebar navigation to 'Settings'
      setSelectedNav("Settings");
      // Set the specific tab within Settings component via localStorage
      localStorage.setItem("settings-active-tab", "notifications");

      if (window.history.replaceState) {
        // Modern browsers: remove hash without page reload
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      } else {
        // Fallback for older browsers (might cause a jump)
        window.location.hash = '';
      }
    }
  }, []); // Run only once on component mount

  // Check if we're in mobile view
  React.useEffect(() => {
    const checkMobileView = () => {
      setIsMobileView(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };

    // Initial check
    checkMobileView();

    // Add event listener for window resize
    window.addEventListener('resize', checkMobileView);

    // Cleanup
    return () => window.removeEventListener('resize', checkMobileView);
  }, []);

  // Add an effect to log when Dashboard mounts
 

  // Add an explicit state to track the dialog visibility
  const [showFirstTimeDialog, setShowFirstTimeDialog] = useState(true);

  // Redirect to auth page if user is not logged in
  useEffect(() => {
    // Check if user object exists and is not null
    if (user === null) { 
      // Using window.location for redirection as router context isn't available here
      // Consider using useNavigate() from react-router-dom if available
      window.location.href = '/auth';
    }
  }, [user]); // Re-run effect if user status changes

  // Optionally, show a loading state while checking auth or redirecting
  // This prevents rendering the dashboard briefly before redirect
  if (user === null) { 
    return (
      <div className="h-screen flex items-center justify-center">
        {/* You can replace this with a proper loading spinner component */}
        <p>Loading...</p> 
      </div>
    ); 
  }

  return (
    <NotificationsProvider>
      <TaskReminderService />
      
      {/* First Time Login Dialog - ensure it appears at the root level */}
      <FirstTimeLoginDialog />
      
      {/* Mobile menu button - only visible on small screens */}
      {isMobileView && (
        <div className="fixed top-4 left-4 z-50">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm border border-border shadow-md"
          >
            {isSidebarOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>
      )}

      {/* Mobile view */}
      {isMobileView ? (
        <div className="h-screen flex flex-col">
          {/* Sidebar for mobile - conditionally shown */}
          <div 
            className={cn(
              "bg-[hsl(var(--background))] flex flex-col shadow-md z-40 fixed inset-y-0 left-0 w-[280px] transition-transform duration-300 ease-in-out",
              isSidebarOpen ? "translate-x-0" : "-translate-x-full"
            )}
          >
            {/* Sidebar content */}
            {renderSidebarContent()}
          </div>

          {/* Overlay for mobile */}
          {isSidebarOpen && (
            <div 
              className="fixed inset-0 bg-black/50 z-30 backdrop-blur-sm"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}

          {/* Main content for mobile */}
          <div className="flex-1 bg-[hsl(var(--background))] h-screen flex flex-col overflow-hidden">
            <ScrollArea className="flex-1 thin-scrollbar">
              <div className="p-4 md:p-6">
                {renderMainContent()}
              </div>
            </ScrollArea>
          </div>
        </div>
      ) : (
        /* Desktop view with resizable panels */
        <ResizablePanelGroup
          direction="horizontal"
          className="h-screen items-stretch"
        >
          {/* Resizable sidebar */}
          <ResizablePanel 
            defaultSize={22} 
            minSize={15} 
            maxSize={30} 
            className="bg-[hsl(var(--background))] flex flex-col h-screen shadow-sm"
          >
            {renderSidebarContent()}
          </ResizablePanel>

          <ResizableHandle withHandle className="w-2 bg-[hsl(var(--border))]" />

          {/* Main content area */}
          <ResizablePanel 
            defaultSize={78} 
            minSize={70} 
            maxSize={85} 
            className="bg-[hsl(var(--background))] h-screen flex flex-col"
          >
            <ScrollArea className="flex-1 thin-scrollbar">
              <div className="p-6">
                {renderMainContent()}
              </div>
            </ScrollArea>
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
    </NotificationsProvider>
  );

  // Helper function to render sidebar content
  function renderSidebarContent() {
    return (
      <>
        {/* App branding - now clickable */}
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div 
              className="flex items-center gap-2.5 cursor-pointer justify-center group" 
              onClick={() => {
                setSelectedNav("Dashboard");
                if (isMobileView) setIsSidebarOpen(false);
              }}
            >
              <div className="flex items-center justify-center
                rounded-full
                bg-gradient-to-br from-yellow-500 to-amber-700
                p-1
                shadow-lg
                group-hover:from-yellow-400 group-hover:to-amber-600
                transition-all
                duration-300
                transform group-hover:scale-105
                border-2 border-yellow-400/40
              ">
                <img 
                  src="/assets/tiger_logo.png" 
                  alt="Tiger" 
                  className="h-8 w-8 drop-shadow-md" 
                />
              </div>
              <div className="flex items-center">
                <h2 className="text-xl
                  font-extrabold
                  bg-gradient-to-r from-yellow-500 to-amber-700
                  bg-clip-text text-transparent
                  group-hover:from-yellow-400 group-hover:to-amber-600
                  transition-colors
                  duration-300
                  cursor-pointer
                ">Tiger</h2>
                <span className="text-xs text-amber-500 ml-0.5">
                  <sup className="font-semibold">TM</sup>
                </span>
              </div>
            </div>
            
            {/* Add a theme toggle button and Help/Github button */}
            <div className="flex items-center gap-1">
              {theme === "dark" ? (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setTheme("light")}
                  className="h-8 w-8 rounded-full hover:bg-yellow-100/10 transition-colors duration-200"
                >
                  <Sun className="h-4 w-4 text-yellow-400" />
                </Button>
              ) : (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setTheme("dark")}
                  className="h-8 w-8 rounded-full hover:bg-slate-200 transition-colors duration-200"
                >
                  <Moon className="h-4 w-4 text-slate-700" />
                </Button>
              )}
              {/* GitHub Help Dialog */} 
              <Dialog open={showHelpDialog} onOpenChange={setShowHelpDialog}>
                <DialogTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-8 w-8 rounded-full hover:bg-gray-500/10 dark:hover:bg-gray-700/50 transition-colors duration-200"
                  >
                    <Github className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[525px]">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Github className="h-5 w-5" />
                      Contribute & Get Help
                      </DialogTitle>
                    <DialogDescription className="pt-2">
                      Found an issue or have an idea? Want to contribute?
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4 text-sm">
                    <p>
                      We appreciate your help in making Tiger App better! Here's how you can get involved:
                    </p>
                    <ul className="list-disc space-y-2 pl-5">
                      <li>
                        <strong>Report Issues:</strong> If you encounter a bug or unexpected behavior, please 
                        <a 
                          href="https://github.com/gbirhanu/tiger/issues" 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-primary underline hover:text-primary/80 font-medium px-1"
                        >
                          create an issue
                        </a> 
                        on our GitHub repository. Describe the problem clearly, including steps to reproduce it if possible.
                      </li>
                      <li>
                        <strong>Suggest Features:</strong> Have an idea for a new feature? Feel free to open an issue with the label "enhancement".
                      </li>
                      <li>
                        <strong>Contribute Code:</strong> If you'd like to contribute code, please fork the repository, make your changes on a separate branch, and submit a Pull Request. Follow the contribution guidelines in the repository (if available).
                      </li>
                    </ul>
                    <p className="pt-2">
                      Visit the main repository here:
                      <a 
                        href="https://github.com/gbirhanu/tiger.git" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-primary underline hover:text-primary/80 font-medium pl-1"
                      >
                        Tiger Repository on GitHub
                      </a>
                    </p>
                  </div>
                  <DialogFooter>
                     <DialogClose asChild>
                      <Button type="button" variant="secondary">
                        Close
                      </Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
        {/* Enhanced divider with gradient and shadow */}
        <div className="px-3 py-1">
          <div className={theme === "light" 
            ? "h-[2px] rounded-full bg-gradient-to-r from-transparent via-gray-200 to-transparent shadow-sm" 
            : "h-[2px] rounded-full bg-gradient-to-r from-transparent via-gray-700 to-transparent shadow-sm"
          } />
        </div>
        {/* User Profile Section */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <ProfileDropdown />
            {/* Enhanced vertical divider with gradient */}
            <div className="px-1">
              <div className={theme === "light" 
                ? "w-[2px] h-10 rounded-full bg-gradient-to-b from-transparent via-gray-200 to-transparent shadow-sm" 
                : "w-[2px] h-10 rounded-full bg-gradient-to-b from-transparent via-gray-700 to-transparent shadow-sm"
              } />
            </div>
            <NotificationsDropdown />
          </div>
          
          {/* Display subscription badge if user has pro plan AND marketing is enabled */}
          {showSubscriptionFeatures && 
           ((user as ExtendedUser)?.subscription?.plan === 'pro' && 
            (user as ExtendedUser)?.subscription?.status === 'active') && (
            <div className="mt-2 flex items-center justify-center">
              <div className="text-xs px-2 py-0.5 rounded-full 
                bg-gradient-to-r from-amber-200 to-amber-500 
                text-amber-900 font-medium border border-amber-300
                flex items-center gap-1.5 shadow-sm">
                <Flame className="w-3 h-3" />
                PRO
              </div>
            </div>
          )}
        </div>
        {/* Enhanced divider with gradient and shadow */}
        <div className="px-3 py-1">
          <div className={theme === "light" 
            ? "h-[2px] rounded-full bg-gradient-to-r from-transparent via-gray-200 to-transparent shadow-sm" 
            : "h-[2px] rounded-full bg-gradient-to-r from-transparent via-gray-700 to-transparent shadow-sm"
          } />
        </div>
        {/* Navigation - independently scrollable */}
        <ScrollArea className="flex-1 thin-scrollbar px-3">
          <div className="space-y-1.5 py-4">
            {navItems.map((item) => (
              <Button
                key={item.title}
                variant={selectedNav === item.title ? "default" : "ghost"}
                size="sm"
                className={cn(
                  "w-full justify-start gap-3 mb-1 px-3 py-5 font-medium transition-all duration-300 rounded-lg",
                  {
                    "bg-gradient-to-r from-primary/90 to-primary text-primary-foreground shadow-md": selectedNav === item.title,
                    "hover:bg-[hsl(var(--primary)/0.08)] hover:text-primary hover:translate-x-1": selectedNav !== item.title,
                  }
                )}
                onClick={() => {
                  setSelectedNav(item.title);
                  if (isMobileView) setIsSidebarOpen(false);
                }}
              >
                <div className={cn(
                  "w-9 h-9 flex items-center justify-center rounded-md transition-all duration-300",
                  selectedNav === item.title 
                    ? "bg-[hsl(var(--primary-foreground)/0.3)] text-primary-foreground shadow-inner" 
                    : "bg-[hsl(var(--muted)/0.5)] text-muted-foreground"
                )}>
                  {item.icon}
                </div>
                <span className="truncate font-medium">{item.title}</span>
                {selectedNav === item.title && (
                  <ChevronRight className="ml-auto h-4 w-4 text-primary-foreground/70" />
                )}
              </Button>
            ))}
          </div>
        </ScrollArea>
        
        {/* Fixed logout button at bottom */}
        <div className="p-4">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-3 px-3 py-5 font-medium transition-all duration-300 bg-gradient-to-r hover:from-red-500/10 hover:to-red-600/10 hover:text-red-600 hover:border-red-200 rounded-lg group"
            onClick={() => logout()}
          >
            <div className="w-9 h-9 flex items-center justify-center rounded-md bg-red-50 text-red-500 group-hover:bg-red-100 transition-colors duration-300">
              <LogOut className="h-4 w-4" />
            </div>
            <span className="font-medium">Logout</span>
          </Button>
        </div>
      </>
    );
  }

  // Helper function to render main content
  function renderMainContent() {
    
    
    // Find the matching nav item
    const navItem = navItems.find(item => item.title === selectedNav);
    
    
    // If we found a matching nav item, render its component
    if (navItem) {
      return (
        <div className="w-full">
          {navItem.component}
        </div>
      );
    }
    
    // Fallback to Dashboard if no matching nav item
    return <DashboardOverview />;
  }
}

