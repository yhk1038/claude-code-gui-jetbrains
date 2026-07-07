import { describe, it, expect } from 'vitest';
import {
  resolveBootstrapTheme,
  resolveBootstrapDirection,
  resolveBootstrapLang,
  BOOTSTRAP_BG_DARK,
  BOOTSTRAP_BG_LIGHT,
} from '../bootstrapTheme';

// resolveBootstrapTheme is the pure FOUC-prevention logic shared (conceptually)
// with the inline <script> in webview/index.html. It decides 'dark' | 'light'
// from a `theme` query param (injected by Kotlin via the WebView URL) with a
// matchMedia(prefers-color-scheme: dark) fallback.

describe('resolveBootstrapTheme — explicit query param', () => {
  it('returns "dark" when themeParam is "dark"', () => {
    expect(resolveBootstrapTheme('dark', false)).toBe('dark');
  });

  it('returns "light" when themeParam is "light"', () => {
    expect(resolveBootstrapTheme('light', true)).toBe('light');
  });

  it('query param wins over prefers-dark', () => {
    expect(resolveBootstrapTheme('light', true)).toBe('light');
    expect(resolveBootstrapTheme('dark', false)).toBe('dark');
  });
});

describe('resolveBootstrapTheme — matchMedia fallback', () => {
  it('falls back to "dark" when param missing and prefersDark is true', () => {
    expect(resolveBootstrapTheme(null, true)).toBe('dark');
  });

  it('falls back to "light" when param missing and prefersDark is false', () => {
    expect(resolveBootstrapTheme(null, false)).toBe('light');
  });

  it('treats empty string param as missing', () => {
    expect(resolveBootstrapTheme('', true)).toBe('dark');
    expect(resolveBootstrapTheme('', false)).toBe('light');
  });

  it('treats unknown param value as missing and uses fallback', () => {
    expect(resolveBootstrapTheme('purple', true)).toBe('dark');
    expect(resolveBootstrapTheme('purple', false)).toBe('light');
  });
});

describe('resolveBootstrapDirection', () => {
  it('returns "rtl" when stored uiDirection is "rtl"', () => {
    expect(resolveBootstrapDirection('rtl')).toBe('rtl');
  });

  it('returns "ltr" when stored uiDirection is "ltr"', () => {
    expect(resolveBootstrapDirection('ltr')).toBe('ltr');
  });

  it('defaults to "ltr" when stored value is missing', () => {
    expect(resolveBootstrapDirection(null)).toBe('ltr');
    expect(resolveBootstrapDirection(undefined)).toBe('ltr');
  });

  it('defaults to "ltr" for an unknown value', () => {
    expect(resolveBootstrapDirection('vertical')).toBe('ltr');
  });
});

// resolveBootstrapLang mirrors the inline <script>'s uiLanguage → BCP-47
// locale mapping (index.html reads the 'claude-code-ui-language' localStorage
// entry written by I18nLocaleSync). It delegates to i18n/languageMap.ts's
// toLocale (the single source of truth for the mapping table).
describe('resolveBootstrapLang', () => {
  it('resolves a stored uiLanguage to its BCP-47 locale', () => {
    expect(resolveBootstrapLang('persian')).toBe('fa');
    expect(resolveBootstrapLang('arabic')).toBe('ar');
    expect(resolveBootstrapLang('korean')).toBe('ko');
  });

  it('defaults to "en" when the stored value is missing', () => {
    expect(resolveBootstrapLang(null)).toBe('en');
    expect(resolveBootstrapLang(undefined)).toBe('en');
  });

  it('defaults to "en" for an unknown value', () => {
    expect(resolveBootstrapLang('klingon')).toBe('en');
  });
});

describe('bootstrap background constants', () => {
  it('dark background matches --surface-base dark (#1A1A1A)', () => {
    expect(BOOTSTRAP_BG_DARK).toBe('#1A1A1A');
  });

  it('light background matches --surface-base light (#FFFFFF)', () => {
    expect(BOOTSTRAP_BG_LIGHT).toBe('#FFFFFF');
  });
});
