import { describe, it, expect } from 'vitest';
import { Route } from '@/router';
import { isAllowedRoute, isAllowedCommand, AnnouncementCommandId } from '../announcementActionWhitelist';

describe('isAllowedRoute', () => {
  it('허용된 Route 값은 통과한다', () => {
    expect(isAllowedRoute(Route.SETTINGS_GENERAL)).toBe(true);
    expect(isAllowedRoute(Route.NEW_SESSION)).toBe(true);
  });

  it('화이트리스트 밖 임의 문자열은 거부한다', () => {
    // Route.PROJECT_SELECTOR === '' 이므로 빈 문자열은 별도로 검증하지 않는다.
    expect(isAllowedRoute('settings/does-not-exist')).toBe(false);
    expect(isAllowedRoute('javascript:alert(1)')).toBe(false);
  });
});

describe('isAllowedCommand', () => {
  it('허용된 command id는 통과한다', () => {
    expect(isAllowedCommand(AnnouncementCommandId.HELP_DOCS)).toBe(true);
    expect(isAllowedCommand(AnnouncementCommandId.RESTART_PLUGIN)).toBe(true);
  });

  it('화이트리스트 밖 command id는 거부한다', () => {
    expect(isAllowedCommand('delete-everything')).toBe(false);
    expect(isAllowedCommand('')).toBe(false);
  });
});
