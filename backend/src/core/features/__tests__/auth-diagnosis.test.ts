import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isAuthError, diagnoseAuthError } from '../auth-diagnosis';

// getEnvApiKeys를 mock
vi.mock('../claude-settings', () => ({
  getEnvApiKeys: vi.fn(),
}));

import { getEnvApiKeys } from '../claude-settings';

describe('auth-diagnosis', () => {
  describe('isAuthError()', () => {
    it('should detect "invalid api key" pattern', () => {
      expect(isAuthError('invalid api key')).toBe(true);
      expect(isAuthError('Invalid API Key provided')).toBe(true);
    });

    it('should detect "authentication" pattern', () => {
      expect(isAuthError('Authentication failed')).toBe(true);
    });

    it('should detect "unauthorized" pattern', () => {
      expect(isAuthError('Unauthorized access')).toBe(true);
    });

    it('should detect "401" pattern', () => {
      expect(isAuthError('HTTP 401 error')).toBe(true);
    });

    it('should detect "expired key" pattern', () => {
      expect(isAuthError('Your API key has expired')).toBe(true);
    });

    it('should detect "invalid x-api-key" pattern', () => {
      expect(isAuthError('invalid x-api-key provided')).toBe(true);
    });

    it('should detect "invalid token" pattern', () => {
      expect(isAuthError('invalid token received')).toBe(true);
    });

    it('should detect "could not validate credentials" pattern', () => {
      expect(isAuthError('could not validate credentials')).toBe(true);
    });

    it('should NOT detect unrelated errors', () => {
      expect(isAuthError('Connection timeout')).toBe(false);
      expect(isAuthError('Rate limit exceeded')).toBe(false);
      expect(isAuthError('Internal server error')).toBe(false);
    });

    it('should NOT match partial "401" inside longer numbers', () => {
      expect(isAuthError('error code 14010')).toBe(false);
    });
  });

  describe('diagnoseAuthError()', () => {
    let mockConnections: { broadcastToSession: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      vi.clearAllMocks();
      mockConnections = {
        broadcastToSession: vi.fn(),
      };
    });

    it('should broadcast AUTH_ERROR_DIAGNOSIS when auth error + env keys exist', async () => {
      vi.mocked(getEnvApiKeys).mockResolvedValue(['ANTHROPIC_API_KEY']);
      await diagnoseAuthError('session-1', 'invalid api key', mockConnections as never);
      expect(mockConnections.broadcastToSession).toHaveBeenCalledWith(
        'session-1',
        'AUTH_ERROR_DIAGNOSIS',
        expect.objectContaining({
          envApiKeys: ['ANTHROPIC_API_KEY'],
          message: expect.stringContaining('ANTHROPIC_API_KEY'),
        }),
      );
    });

    it('should NOT broadcast when error is not auth-related', async () => {
      await diagnoseAuthError('session-1', 'Connection timeout', mockConnections as never);
      expect(mockConnections.broadcastToSession).not.toHaveBeenCalled();
      expect(getEnvApiKeys).not.toHaveBeenCalled();
    });

    it('should NOT broadcast when no env API keys found', async () => {
      vi.mocked(getEnvApiKeys).mockResolvedValue([]);
      await diagnoseAuthError('session-1', 'invalid api key', mockConnections as never);
      expect(mockConnections.broadcastToSession).not.toHaveBeenCalled();
    });

    it('should include all found env keys in the message', async () => {
      vi.mocked(getEnvApiKeys).mockResolvedValue(['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY']);
      await diagnoseAuthError('session-1', 'Authentication failed', mockConnections as never);
      expect(mockConnections.broadcastToSession).toHaveBeenCalledWith(
        'session-1',
        'AUTH_ERROR_DIAGNOSIS',
        expect.objectContaining({
          envApiKeys: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'],
          message: expect.stringContaining('ANTHROPIC_API_KEY'),
        }),
      );
    });
  });
});
