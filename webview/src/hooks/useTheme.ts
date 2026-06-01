import { useCallback, useEffect, useState } from 'react';
import { ThemeMode } from '../types';
import { SettingKey } from '@/types/settings';
import { useSettings } from '@/contexts/SettingsContext';
import { isJetBrains, getIdeTheme, subscribeIdeTheme } from '@/config/environment';

interface UseThemeReturn {
  /** User-facing setting value (SYSTEM | LIGHT | DARK). */
  theme: ThemeMode;
  /** Persist the theme setting via SettingsContext. */
  setTheme: (theme: ThemeMode) => void;
  /** Convenience toggle between explicit LIGHT and DARK. */
  toggleTheme: () => void;
  /** Resolved boolean: true when `.dark` class is currently applied to <html>. */
  isDark: boolean;
}

/**
 * Theme hook backed by SettingsContext.
 *
 * The actual DOM class is owned by SettingsContext (single source of truth).
 * This hook returns the persisted ThemeMode plus a derived `isDark` that
 * reflects the currently rendered theme. For SYSTEM mode, `isDark` follows
 * the matchMedia query result and updates on system theme changes.
 */
export function useTheme(): UseThemeReturn {
  const { settings, updateSetting } = useSettings();
  const theme = settings[SettingKey.THEME];

  const [isDark, setIsDark] = useState<boolean>(() => {
    if (theme === ThemeMode.DARK) return true;
    if (theme === ThemeMode.LIGHT) return false;
    if (typeof window === 'undefined') return false;
    // SYSTEM: prefer IDE LAF hint when running inside JetBrains.
    if (isJetBrains()) {
      const ide = getIdeTheme();
      if (ide === 'dark') return true;
      if (ide === 'light') return false;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (theme === ThemeMode.DARK) {
      setIsDark(true);
      return;
    }
    if (theme === ThemeMode.LIGHT) {
      setIsDark(false);
      return;
    }

    const mq = window.matchMedia('(prefers-color-scheme: dark)');

    if (isJetBrains()) {
      const resolve = () => {
        const ide = getIdeTheme();
        if (ide === 'dark') return setIsDark(true);
        if (ide === 'light') return setIsDark(false);
        return setIsDark(mq.matches);
      };
      resolve();
      const mqHandler = (e: MediaQueryListEvent) => {
        // Only react to matchMedia when IDE hint is unavailable.
        if (getIdeTheme() !== null) return;
        setIsDark(e.matches);
      };
      mq.addEventListener('change', mqHandler);
      const unsubscribeIde = subscribeIdeTheme(resolve);
      return () => {
        mq.removeEventListener('change', mqHandler);
        unsubscribeIde();
      };
    }

    setIsDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = useCallback((next: ThemeMode) => {
    void updateSetting(SettingKey.THEME, next);
  }, [updateSetting]);

  const toggleTheme = useCallback(() => {
    setTheme(isDark ? ThemeMode.LIGHT : ThemeMode.DARK);
  }, [isDark, setTheme]);

  return {
    theme,
    setTheme,
    toggleTheme,
    isDark,
  };
}
