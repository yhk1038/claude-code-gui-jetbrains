import { getEnvApiKeys } from './claude-settings';
import type { ConnectionManager } from '../ws/connection-manager';

const AUTH_ERROR_PATTERNS = [
  /invalid.?api.?key/i,
  /authentication/i,
  /unauthorized/i,
  /\b401\b/,
  /invalid.?x-api-key/i,
  /permission.?denied.*api/i,
  /expired.*key|key.*expired/i,
  /invalid.*token/i,
  /could not validate credentials/i,
];

/**
 * Returns true if the given message looks like an authentication error.
 */
export function isAuthError(message: string): boolean {
  return AUTH_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Check if error is auth-related and env has API keys.
 * If so, broadcast AUTH_ERROR_DIAGNOSIS event to the session.
 * Silently no-ops if the error is not auth-related or no env API keys are found.
 */
export async function diagnoseAuthError(
  sessionId: string,
  errorMessage: string,
  connections: ConnectionManager,
): Promise<void> {
  if (!isAuthError(errorMessage)) return;

  const envApiKeys = await getEnvApiKeys();
  if (envApiKeys.length === 0) return;

  connections.broadcastToSession(sessionId, 'AUTH_ERROR_DIAGNOSIS', {
    envApiKeys,
    message: `Authentication error detected. The following API keys are set in ~/.claude/settings.json env: ${envApiKeys.join(', ')}. These keys may be expired or invalid.`,
  });
}
