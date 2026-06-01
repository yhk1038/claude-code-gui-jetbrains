import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { SettingsState, DEFAULT_SETTINGS, SettingKey, ThemeMode } from '@/types/settings';
import { useBridgeContext } from '@/contexts/BridgeContext';
import { useWorkingDir } from '@/contexts/WorkingDirContext';
import { isJetBrains, getIdeTheme, subscribeIdeTheme } from '@/config/environment';

interface SettingsContextValue {
  settings: SettingsState;
  scopeSettings: Partial<SettingsState>;
  isLoading: boolean;
  overrides: string[];
  scope: 'global' | 'project';
  setScope: (scope: 'global' | 'project') => void;
  updateSetting: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => Promise<void>;
  updateSettingWithScope: <K extends keyof SettingsState>(key: K, value: SettingsState[K], targetScope: 'global' | 'project') => Promise<void>;
  resetToGlobal: <K extends keyof SettingsState>(key: K) => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

const STORAGE_KEY = 'claude-code-settings';

interface SettingsProviderProps {
  children: ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [overrides, setOverrides] = useState<string[]>([]);
  const [scopeSettings, setScopeSettings] = useState<Partial<SettingsState>>({});
  const [scope, setScope] = useState<'global' | 'project'>('global');
  const { isConnected, send, subscribe } = useBridgeContext();
  const { workingDirectory } = useWorkingDir();

  // Load settings from bridge
  const loadFromBridge = useCallback(async (): Promise<boolean> => {
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await send('GET_SETTINGS', { workingDir: workingDirectory });
        if (response?.settings) {
          setSettings(response.settings as SettingsState);
          if (response?.overrides) {
            setOverrides(response.overrides as string[]);
          }
          return true;
        }
      } catch (error) {
        if (attempt < maxRetries - 1) {
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        } else {
          console.warn('Failed to load settings from bridge after retries');
        }
      }
    }
    return false;
  }, [send, workingDirectory]);

  // Load settings from localStorage
  const loadFromLocalStorage = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch (error) {
      console.warn('Failed to load settings from localStorage');
    }
  }, []);

  // Load scope-specific (raw) settings for settings page display
  const loadScopeSettings = useCallback(async (targetScope: 'global' | 'project') => {
    try {
      const response = await send('GET_SETTINGS', {
        workingDir: workingDirectory,
        scope: targetScope,
      });
      if (response?.settings) {
        setScopeSettings(response.settings as Partial<SettingsState>);
      }
    } catch (error) {
      console.warn('Failed to load scope settings:', error);
    }
  }, [send, workingDirectory]);

  // Initial: load from localStorage immediately (prevent flash)
  useEffect(() => {
    loadFromLocalStorage();
    setIsLoading(false);
  }, [loadFromLocalStorage]);

  // On bridge connection: override with bridge settings
  useEffect(() => {
    if (isConnected) {
      setIsLoading(true);
      loadFromBridge().finally(() => setIsLoading(false));
    }
  }, [isConnected, loadFromBridge]);

  // Reload scope-specific settings when scope changes or connection established
  useEffect(() => {
    if (isConnected) {
      loadScopeSettings(scope);
    }
  }, [isConnected, scope, loadScopeSettings]);

  // Apply font size to root element so rem-based sizes scale globally
  useEffect(() => {
    const fontSize = settings[SettingKey.FONT_SIZE];
    if (typeof fontSize === 'number' && Number.isFinite(fontSize)) {
      document.documentElement.style.fontSize = `${fontSize}px`;
    }
  }, [settings]);

  // Apply theme to <html> element. Toggles `.dark` class based on theme setting.
  // - LIGHT: explicit light, no `.dark` class
  // - DARK: explicit dark, `.dark` class on
  // - SYSTEM:
  //     * JetBrains: follow IDE LAF (window.__IDE_THEME__) and 'ide-theme-changed' event.
  //       Fall back to matchMedia when LAF hint is missing (e.g. before Kotlin injects it).
  //     * Standalone: follow prefers-color-scheme as before.
  useEffect(() => {
    const theme = settings[SettingKey.THEME];
    const applyDark = () => document.documentElement.classList.add('dark');
    const applyLight = () => document.documentElement.classList.remove('dark');

    if (theme === ThemeMode.DARK) {
      applyDark();
      return;
    }
    if (theme === ThemeMode.LIGHT) {
      applyLight();
      return;
    }

    // SYSTEM mode
    const mq = window.matchMedia('(prefers-color-scheme: dark)');

    if (isJetBrains()) {
      // JetBrains: prefer IDE LAF hint, fall back to matchMedia when missing.
      const resolve = () => {
        const ide = getIdeTheme();
        if (ide === 'dark') return applyDark();
        if (ide === 'light') return applyLight();
        return mq.matches ? applyDark() : applyLight();
      };
      resolve();
      const mqHandler = (e: MediaQueryListEvent) => {
        // Only react to matchMedia when IDE hint is unavailable.
        if (getIdeTheme() !== null) return;
        e.matches ? applyDark() : applyLight();
      };
      mq.addEventListener('change', mqHandler);
      const unsubscribeIde = subscribeIdeTheme(resolve);
      return () => {
        mq.removeEventListener('change', mqHandler);
        unsubscribeIde();
      };
    }

    // Standalone: detect prefers-color-scheme and subscribe to changes
    if (mq.matches) applyDark(); else applyLight();
    const handler = (e: MediaQueryListEvent) => (e.matches ? applyDark() : applyLight());
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [settings]);

  // Subscribe to external settings changes from backend
  useEffect(() => {
    if (!isConnected) return;
    const unsubscribe = subscribe('SETTINGS_CHANGED', (message) => {
      const payload = message.payload as Record<string, unknown>;
      const newSettings = payload?.settings as SettingsState | undefined;
      const newOverrides = payload?.overrides as string[] | undefined;
      if (newSettings) setSettings(newSettings);
      if (newOverrides) setOverrides(newOverrides);
      loadScopeSettings(scope);
    });
    return unsubscribe;
  }, [isConnected, subscribe, scope, loadScopeSettings]);

  // Update individual setting using current scope
  const updateSetting = useCallback(async <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    const previousSettings = settings;
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings); // optimistic update

    try {
      if (isConnected) {
        const response = await send('SAVE_SETTINGS', { key, value, scope, workingDir: workingDirectory });
        if (response?.status === 'error') {
          throw new Error(response.error || 'Save failed');
        }
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
        } catch { /* ignore localStorage error */ }
        loadScopeSettings(scope);
        return;
      }
    } catch (error) {
      console.warn('Failed to save setting via bridge, falling back to localStorage:', error);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
      } catch { /* ignore */ }
      return;
    }

    // Bridge not connected: localStorage fallback
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
    } catch (error) {
      console.warn('Failed to save settings to localStorage');
      setSettings(previousSettings);
    }
  }, [settings, isConnected, send, scope, workingDirectory, loadScopeSettings]);

  // Update individual setting with explicit scope
  const updateSettingWithScope = useCallback(async <K extends keyof SettingsState>(
    key: K, value: SettingsState[K], targetScope: 'global' | 'project'
  ) => {
    const previousSettings = settings;
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    try {
      if (!isConnected) throw new Error('Not connected');
      const response = await send('SAVE_SETTINGS', { key, value, scope: targetScope, workingDir: workingDirectory });
      if (response?.status === 'error') throw new Error(response.error || 'Save failed');
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings)); } catch { /* ignore */ }
    } catch (error) {
      console.warn('Failed to save setting:', error);
      setSettings(previousSettings);
    }
  }, [settings, isConnected, send, workingDirectory]);

  // Remove a project override, reverting to global value
  const resetToGlobal = useCallback(async <K extends keyof SettingsState>(key: K) => {
    if (!isConnected || !workingDirectory) return;
    try {
      await send('SAVE_SETTINGS', { key, value: null, scope: 'project', workingDir: workingDirectory });
      await loadFromBridge();
      await loadScopeSettings(scope);
    } catch (error) {
      console.warn('Failed to reset setting to global:', error);
    }
  }, [isConnected, send, workingDirectory, loadFromBridge, scope, loadScopeSettings]);

  // Refresh settings
  const refreshSettings = useCallback(async () => {
    setIsLoading(true);
    if (isConnected) {
      await loadFromBridge();
    } else {
      loadFromLocalStorage();
    }
    setIsLoading(false);
  }, [isConnected, loadFromBridge, loadFromLocalStorage]);

  return (
    <SettingsContext.Provider value={{
      settings,
      scopeSettings,
      isLoading,
      overrides,
      scope,
      setScope,
      updateSetting,
      updateSettingWithScope,
      resetToGlobal,
      refreshSettings,
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

export { SettingsContext };
