import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { getClaudeAccessToken } from '../features/getClaudeCredentials';

const CACHE_TTL_MS = 30_000;
let cachedUsage: unknown = null;
let cachedAt = 0;

export async function getUsageHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  const accessToken = await getClaudeAccessToken();
  if (!accessToken) {
    connections.sendTo(connectionId, 'ACK', {
      requestId: message.requestId,
      status: 'error',
      error: 'Claude Code credentials not found. Please log in with Claude Code CLI first.',
    });
    return;
  }

  if (cachedUsage !== null && Date.now() - cachedAt < CACHE_TTL_MS) {
    connections.sendTo(connectionId, 'ACK', {
      requestId: message.requestId,
      status: 'ok',
      usage: cachedUsage,
    });
    return;
  }

  try {
    const response = await fetch('https://api.anthropic.com/api/oauth/usage', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'anthropic-beta': 'oauth-2025-04-20',
      },
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }

    const usage = await response.json();
    cachedUsage = usage;
    cachedAt = Date.now();

    connections.sendTo(connectionId, 'ACK', {
      requestId: message.requestId,
      status: 'ok',
      usage,
    });
  } catch (err) {
    connections.sendTo(connectionId, 'ACK', {
      requestId: message.requestId,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
