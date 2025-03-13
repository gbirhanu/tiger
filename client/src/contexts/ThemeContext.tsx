import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getUserSettings } from '@/lib/api';
import { type UserSettings } from '@shared/schema';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  // Fetch user settings from the server
  const { data: settings } = useQuery<UserSettings>({
    queryKey: ['user-settings'],
    queryFn: getUserSettings,
  });

  // Apply theme from settings when they load
  useEffect(() => {
    if (settings?.theme && ['light', 'dark', 'system'].includes(settings.theme)) {
      setTheme(settings.theme as Theme);
    }
  }, [settings]);

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
      
      // Save to localStorage as well
      localStorage.setItem('theme', theme);
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
