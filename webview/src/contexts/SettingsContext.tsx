import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { SettingKey, SettingsState, DEFAULT_SETTINGS } from '@/types/settings';
import { useBridge } from '@/hooks/useBridge';

interface SettingsContextValue {
  settings: SettingsState;
  isLoading: boolean;
  updateSetting: <K extends SettingKey>(key: K, value: SettingsState[K]) => Promise<void>;
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
  const { isConnected, send } = useBridge();

  // 설정 로드
  const loadSettings = useCallback(async () => {
    try {
      // Kotlin 브릿지 시도
      if (isConnected) {
        const response = await send('GET_SETTINGS', {});
        if (response?.settings) {
          setSettings(response.settings as SettingsState);
          return;
        }
      }
    } catch (error) {
      console.warn('Failed to load settings from bridge, using localStorage fallback');
    }

    // Fallback: localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch (error) {
      console.warn('Failed to load settings from localStorage');
    }
  }, [isConnected, send]);

  // 초기 로드
  useEffect(() => {
    loadSettings().finally(() => setIsLoading(false));
  }, [loadSettings]);

  // 개별 설정 업데이트
  const updateSetting = useCallback(async <K extends SettingKey>(key: K, value: SettingsState[K]) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    try {
      // Kotlin 브릿지 시도
      if (isConnected) {
        await send('SAVE_SETTINGS', { key, value });
        return;
      }
    } catch (error) {
      console.warn('Failed to save setting to bridge, using localStorage fallback');
    }

    // Fallback: localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
    } catch (error) {
      console.warn('Failed to save settings to localStorage');
    }
  }, [settings, isConnected, send]);

  // 설정 새로고침
  const refreshSettings = useCallback(async () => {
    setIsLoading(true);
    await loadSettings();
    setIsLoading(false);
  }, [loadSettings]);

  return (
    <SettingsContext.Provider value={{ settings, isLoading, updateSetting, refreshSettings }}>
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
