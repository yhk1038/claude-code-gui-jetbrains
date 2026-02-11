import { useCallback, useEffect, useState } from 'react';
import { ThemeMode } from '../types';

interface UseThemeReturn {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  isDark: boolean;
}

export function useTheme(): UseThemeReturn {
  const [theme, setThemeState] = useState<ThemeMode>(ThemeMode.LIGHT);

  // Sync with IDE theme via CSS variables
  useEffect(() => {
    const detectTheme = () => {
      // Check for IDE-injected theme class
      const isDark = document.documentElement.classList.contains('dark') ||
                     getComputedStyle(document.documentElement)
                       .getPropertyValue('--ide-bg')
                       .trim()
                       .match(/^#[0-3]/); // Dark colors start with 0-3
      setThemeState(isDark ? ThemeMode.DARK : ThemeMode.LIGHT);
    };

    detectTheme();

    // Observe class changes for theme sync
    const observer = new MutationObserver(detectTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  const setTheme = useCallback((newTheme: ThemeMode) => {
    setThemeState(newTheme);
    if (newTheme === ThemeMode.DARK) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === ThemeMode.DARK ? ThemeMode.LIGHT : ThemeMode.DARK);
  }, [theme, setTheme]);

  const isDark = theme === ThemeMode.DARK;

  return {
    theme,
    setTheme,
    toggleTheme,
    isDark,
  };
}
