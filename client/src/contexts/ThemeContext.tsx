import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUserSettings, updateUserSettings } from '@/lib/api';
import { type UserSettings } from '@shared/schema';
import { QUERY_KEYS } from '@/lib/queryClient';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Initialize from localStorage if available
    const savedTheme = localStorage.getItem('theme') as Theme | null;
    return savedTheme && ['light', 'dark', 'system'].includes(savedTheme) 
      ? savedTheme as Theme 
      : 'system';
  });
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const queryClient = useQueryClient();

  // Fetch user settings from the server
  const { data: settings, isLoading } = useQuery<UserSettings>({
    queryKey: [QUERY_KEYS.SETTINGS],
    queryFn: getUserSettings,
  });

  // Apply theme from settings when they load
  useEffect(() => {
    if (settings?.theme && ['light', 'dark', 'system'].includes(settings.theme)) {
      setThemeState(settings.theme as Theme);
    }
  }, [settings]);

  // Mutation to update theme in settings
  const updateThemeMutation = useMutation({
    mutationFn: (newTheme: Theme) => {
      return updateUserSettings({ theme: newTheme });
    },
    onMutate: async (newTheme) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.SETTINGS] });
      
      // Snapshot the previous value
      const previousSettings = queryClient.getQueryData<UserSettings>([QUERY_KEYS.SETTINGS]);
      
      // Optimistically update to the new value
      if (previousSettings) {
        queryClient.setQueryData<UserSettings>([QUERY_KEYS.SETTINGS], {
          ...previousSettings,
          theme: newTheme
        });
      }
      
      return { previousSettings };
    },
    onError: (_error, _newTheme, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousSettings) {
        queryClient.setQueryData<UserSettings>([QUERY_KEYS.SETTINGS], context.previousSettings);
      }
    }
  });

  // Function to set theme and update settings
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Only update settings if we're authenticated and have settings
    if (settings) {
      updateThemeMutation.mutate(newTheme);
    }
  };

  useEffect(() => {
    // Function to set the theme based on user preference or system setting
    const applyTheme = () => {
      const root = document.documentElement;
      
      let newResolvedTheme: 'light' | 'dark';
      
      if (theme === 'system') {
        // Check system preference
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        newResolvedTheme = systemPrefersDark ? 'dark' : 'light';
      } else {
        newResolvedTheme = theme;
      }
      
      setResolvedTheme(newResolvedTheme);
      
      // Remove both classes and add the correct one
      root.classList.remove('light', 'dark');
      root.classList.add(newResolvedTheme);
    };

    applyTheme();

    // Listen for system preference changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        applyTheme();
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const contextValue = {
    theme,
    setTheme,
    resolvedTheme,
    isLoading
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
