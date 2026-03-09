'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type AppTheme = 'f1' | 'swiss';

interface ThemeContextValue {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'msp_theme';

function applyTheme(theme: AppTheme) {
  document.documentElement.setAttribute('data-theme', theme);
}

function getInitialTheme(): AppTheme {
  if (typeof window === 'undefined') return 'f1';
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'swiss' ? 'swiss' : 'f1';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>(getInitialTheme);

  if (typeof window !== 'undefined') {
    applyTheme(theme);
  }

  const setTheme = useCallback((nextTheme: AppTheme) => {
    setThemeState(nextTheme);
    localStorage.setItem(STORAGE_KEY, nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'f1' ? 'swiss' : 'f1');
  }, [theme, setTheme]);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
    }),
    [theme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return context;
}
