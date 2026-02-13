import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { SettingsState, DEFAULT_SETTINGS } from '@/types/settings';
import { useBridge } from '@/hooks/useBridge';

interface SettingsContextValue {
  settings: SettingsState;
  isLoading: boolean;
  updateSetting: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => Promise<void>;
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

  // Bridge에서 설정 로드
  const loadFromBridge = useCallback(async (): Promise<boolean> => {
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await send('GET_SETTINGS', {});
        if (response?.settings) {
          setSettings(response.settings as SettingsState);
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
  }, [send]);

  // localStorage에서 설정 로드
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

  // 초기: localStorage에서 즉시 로드 (flash 방지)
  useEffect(() => {
    loadFromLocalStorage();
    setIsLoading(false);
  }, [loadFromLocalStorage]);

  // Bridge 연결 시: Kotlin 설정으로 덮어씀
  useEffect(() => {
    if (isConnected) {
      setIsLoading(true);
      loadFromBridge().finally(() => setIsLoading(false));
    }
  }, [isConnected, loadFromBridge]);

  // 개별 설정 업데이트
  const updateSetting = useCallback(async <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    const previousSettings = settings;
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings); // optimistic update

    try {
      if (isConnected) {
        const response = await send('SAVE_SETTINGS', { key, value });
        if (response?.status === 'error') {
          throw new Error(response.error || 'Save failed');
        }
        // Bridge 성공 시 localStorage에도 동기화 (다음 로드 시 빠른 복원용)
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
        } catch { /* ignore localStorage error */ }
        return;
      }
    } catch (error) {
      console.warn('Failed to save setting via bridge, falling back to localStorage:', error);
      // Bridge 실패 시 localStorage에라도 저장 (optimistic update 유지)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
      } catch { /* ignore */ }
      return;
    }

    // Bridge 미연결: localStorage fallback
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
    } catch (error) {
      console.warn('Failed to save settings to localStorage');
      setSettings(previousSettings);
    }
  }, [settings, isConnected, send]);

  // 설정 새로고침
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
