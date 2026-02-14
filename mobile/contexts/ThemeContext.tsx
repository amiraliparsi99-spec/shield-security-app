import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useColorScheme, Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeColors {
  background: string;
  surface: string;
  surfaceElevated: string;
  text: string;
  textMuted: string;
  textSecondary: string;
  accent: string;
  accentSoft: string;
  accentMuted: string;
  border: string;
  borderMuted: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  error: string;
  errorSoft: string;
  primaryBtn: string;
}

const darkColors: ThemeColors = {
  background: '#0a0a0f',
  surface: '#12121a',
  surfaceElevated: '#1a1a24',
  text: '#ffffff',
  textMuted: '#8a8a9a',
  textSecondary: '#b0b0c0',
  accent: '#00d4aa',
  accentSoft: 'rgba(0, 212, 170, 0.15)',
  accentMuted: 'rgba(0, 212, 170, 0.3)',
  border: '#2a2a3a',
  borderMuted: '#1f1f2a',
  success: '#22c55e',
  successSoft: 'rgba(34, 197, 94, 0.15)',
  warning: '#f59e0b',
  warningSoft: 'rgba(245, 158, 11, 0.15)',
  error: '#ef4444',
  errorSoft: 'rgba(239, 68, 68, 0.15)',
  primaryBtn: '#1f1f2f',
};

const lightColors: ThemeColors = {
  background: '#f8fafc',
  surface: '#ffffff',
  surfaceElevated: '#f1f5f9',
  text: '#0f172a',
  textMuted: '#64748b',
  textSecondary: '#475569',
  accent: '#0d9488',
  accentSoft: 'rgba(13, 148, 136, 0.1)',
  accentMuted: 'rgba(13, 148, 136, 0.2)',
  border: '#e2e8f0',
  borderMuted: '#f1f5f9',
  success: '#16a34a',
  successSoft: 'rgba(22, 163, 74, 0.1)',
  warning: '#d97706',
  warningSoft: 'rgba(217, 119, 6, 0.1)',
  error: '#dc2626',
  errorSoft: 'rgba(220, 38, 38, 0.1)',
  primaryBtn: '#f1f5f9',
};

interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const THEME_STORAGE_KEY = 'shield-theme-mode';

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>('system');
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved theme preference
  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((saved) => {
      if (saved && ['dark', 'light', 'system'].includes(saved)) {
        setMode(saved as ThemeMode);
      }
      setIsLoaded(true);
    });
  }, []);

  // Determine if dark mode based on mode and system preference
  const isDark = useMemo(() => {
    if (mode === 'system') {
      return systemColorScheme === 'dark';
    }
    return mode === 'dark';
  }, [mode, systemColorScheme]);

  // Get colors based on theme
  const colors = useMemo(() => {
    return isDark ? darkColors : lightColors;
  }, [isDark]);

  // Set theme mode
  const setThemeMode = async (newMode: ThemeMode) => {
    setMode(newMode);
    await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode);
  };

  // Toggle between dark and light (skips system)
  const toggleTheme = () => {
    const newMode = isDark ? 'light' : 'dark';
    setThemeMode(newMode);
  };

  // Don't render until theme is loaded to prevent flash
  if (!isLoaded) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ mode, isDark, colors, setThemeMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Hook to get current theme colors (can be used without context for static values)
export function useThemeColors() {
  const context = useContext(ThemeContext);
  if (context) {
    return context.colors;
  }
  // Fallback to dark theme
  return darkColors;
}

export { darkColors, lightColors };
export type { ThemeColors, ThemeMode };
