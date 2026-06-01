import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ThemeMode } from '../../types';
import { SettingKey } from '@/types/settings';
import { _resetRuntimeCache } from '@/config/environment';

// ---------------------------------------------------------------------------
// useSettings mock — controls the theme value returned to useTheme
// ---------------------------------------------------------------------------

let currentTheme: ThemeMode = ThemeMode.SYSTEM;
const updateSettingMock = vi.fn();

vi.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => ({
    settings: {
      [SettingKey.THEME]: currentTheme,
    },
    updateSetting: updateSettingMock,
  }),
}));

// Imported AFTER vi.mock so the mock is wired up first.
import { useTheme } from '../useTheme';

// ---------------------------------------------------------------------------
// matchMedia mock
// ---------------------------------------------------------------------------

interface MatchMediaState {
  matches: boolean;
  listeners: Array<(e: MediaQueryListEvent) => void>;
}

const matchMediaState: MatchMediaState = {
  matches: false,
  listeners: [],
};

function installMatchMediaMock(initialMatches: boolean) {
  matchMediaState.matches = initialMatches;
  matchMediaState.listeners = [];
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: matchMediaState.matches,
      media: query,
      onchange: null,
      addEventListener: (_event: string, listener: (e: MediaQueryListEvent) => void) => {
        matchMediaState.listeners.push(listener);
      },
      removeEventListener: (_event: string, listener: (e: MediaQueryListEvent) => void) => {
        matchMediaState.listeners = matchMediaState.listeners.filter(l => l !== listener);
      },
      addListener: () => { /* legacy */ },
      removeListener: () => { /* legacy */ },
      dispatchEvent: () => false,
    }),
  });
}

// ---------------------------------------------------------------------------
// Env helpers
// ---------------------------------------------------------------------------

function setJcefEnv(enabled: boolean) {
  if (enabled) {
    (window as unknown as { __JCEF__?: boolean }).__JCEF__ = true;
  } else {
    delete (window as unknown as { __JCEF__?: boolean }).__JCEF__;
  }
  _resetRuntimeCache();
}

function setIdeTheme(value: 'dark' | 'light' | null) {
  const w = window as unknown as { __IDE_THEME__?: string };
  if (value === null) {
    delete w.__IDE_THEME__;
  } else {
    w.__IDE_THEME__ = value;
  }
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  currentTheme = ThemeMode.SYSTEM;
  setJcefEnv(false);
  setIdeTheme(null);
  installMatchMediaMock(false);
});

afterEach(() => {
  setJcefEnv(false);
  setIdeTheme(null);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useTheme — SYSTEM mode in JetBrains', () => {
  it('isDark = true when __IDE_THEME__ is "dark"', () => {
    setJcefEnv(true);
    setIdeTheme('dark');
    currentTheme = ThemeMode.SYSTEM;

    const { result } = renderHook(() => useTheme());
    expect(result.current.isDark).toBe(true);
  });

  it('isDark = false when __IDE_THEME__ is "light"', () => {
    setJcefEnv(true);
    setIdeTheme('light');
    currentTheme = ThemeMode.SYSTEM;

    const { result } = renderHook(() => useTheme());
    expect(result.current.isDark).toBe(false);
  });

  it('responds to ide-theme-changed events', () => {
    setJcefEnv(true);
    setIdeTheme('light');
    currentTheme = ThemeMode.SYSTEM;

    const { result } = renderHook(() => useTheme());
    expect(result.current.isDark).toBe(false);

    act(() => {
      setIdeTheme('dark');
      window.dispatchEvent(new Event('ide-theme-changed'));
    });

    expect(result.current.isDark).toBe(true);
  });

  it('falls back to matchMedia when __IDE_THEME__ is missing', () => {
    setJcefEnv(true);
    setIdeTheme(null);
    installMatchMediaMock(true);
    currentTheme = ThemeMode.SYSTEM;

    const { result } = renderHook(() => useTheme());
    expect(result.current.isDark).toBe(true);
  });
});

describe('useTheme — SYSTEM mode in Standalone', () => {
  it('uses matchMedia (dark)', () => {
    setJcefEnv(false);
    installMatchMediaMock(true);
    currentTheme = ThemeMode.SYSTEM;

    const { result } = renderHook(() => useTheme());
    expect(result.current.isDark).toBe(true);
  });

  it('uses matchMedia (light)', () => {
    setJcefEnv(false);
    installMatchMediaMock(false);
    currentTheme = ThemeMode.SYSTEM;

    const { result } = renderHook(() => useTheme());
    expect(result.current.isDark).toBe(false);
  });
});

describe('useTheme — explicit modes', () => {
  it('DARK is dark regardless of env', () => {
    setJcefEnv(true);
    setIdeTheme('light');
    currentTheme = ThemeMode.DARK;

    const { result } = renderHook(() => useTheme());
    expect(result.current.isDark).toBe(true);
  });

  it('LIGHT is not dark regardless of env', () => {
    setJcefEnv(true);
    setIdeTheme('dark');
    currentTheme = ThemeMode.LIGHT;

    const { result } = renderHook(() => useTheme());
    expect(result.current.isDark).toBe(false);
  });
});
