import { describe, it, expect } from 'vitest';
import { toLocale, isRtlLanguage, SUPPORTED_LOCALES, RTL_LOCALES } from '../languageMap';

describe('languageMap', () => {
  it('registers fa/ar as supported locales', () => {
    expect(SUPPORTED_LOCALES).toContain('fa');
    expect(SUPPORTED_LOCALES).toContain('ar');
  });

  it('resolves persian/arabic setting values to fa/ar locales', () => {
    expect(toLocale('persian')).toBe('fa');
    expect(toLocale('arabic')).toBe('ar');
  });

  describe('isRtlLanguage', () => {
    it('returns true for RTL languages (persian, arabic)', () => {
      expect(isRtlLanguage('persian')).toBe(true);
      expect(isRtlLanguage('arabic')).toBe(true);
    });

    it('returns false for LTR languages', () => {
      expect(isRtlLanguage('english')).toBe(false);
      expect(isRtlLanguage('korean')).toBe(false);
      expect(isRtlLanguage('japanese')).toBe(false);
    });

    it('returns false for unknown/unset values (defaults to English/LTR)', () => {
      expect(isRtlLanguage(undefined)).toBe(false);
      expect(isRtlLanguage(null)).toBe(false);
      expect(isRtlLanguage('__NOT_SET__')).toBe(false);
      expect(isRtlLanguage('not-a-real-language')).toBe(false);
    });

    it('agrees with RTL_LOCALES for every supported locale', () => {
      for (const [setting, locale] of Object.entries({ persian: 'fa', arabic: 'ar', english: 'en' })) {
        expect(isRtlLanguage(setting)).toBe(RTL_LOCALES.includes(locale as (typeof RTL_LOCALES)[number]));
      }
    });
  });
});
