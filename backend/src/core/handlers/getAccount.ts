import { exec } from 'child_process';
import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { getClaudeCredentials } from '../features/getClaudeCredentials';

interface ClaudeAuthStatus {
  loggedIn?: boolean;
  authMethod?: string;
  email?: string;
  subscriptionType?: string | null;
  orgId?: string | null;
  orgName?: string | null;
}

function runClaudeAuthStatus(): Promise<ClaudeAuthStatus | null> {
  return new Promise((resolve) => {
    exec('claude auth status', { timeout: 8000 }, (err, stdout) => {
      if (err || !stdout.trim()) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim()) as ClaudeAuthStatus);
      } catch {
        resolve(null);
      }
    });
  });
}

interface ProfileInfo {
  subscriptionType: string | null;
  rateLimitTier: string | null;
}

async function fetchProfileInfo(accessToken: string): Promise<ProfileInfo> {
  try {
    const res = await fetch('https://api.anthropic.com/api/claude_cli_profile', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) return { subscriptionType: null, rateLimitTier: null };
    const data = await res.json() as { organization?: { organization_type?: string; rate_limit_tier?: string } };
    const orgType = data.organization?.organization_type;
    let subscriptionType: string | null = null;
    switch (orgType) {
      case 'claude_max': subscriptionType = 'max'; break;
      case 'claude_pro': subscriptionType = 'pro'; break;
      case 'claude_enterprise': subscriptionType = 'enterprise'; break;
      case 'claude_team': subscriptionType = 'team'; break;
      default: subscriptionType = null;
    }
    return { subscriptionType, rateLimitTier: data.organization?.rate_limit_tier ?? null };
  } catch {
    return { subscriptionType: null, rateLimitTier: null };
  }
}

export async function getAccountHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  const [authStatus, credentials] = await Promise.all([
    runClaudeAuthStatus(),
    getClaudeCredentials(),
  ]);

  if (!authStatus && !credentials) {
    connections.sendTo(connectionId, 'ACK', {
      requestId: message.requestId,
      status: 'error',
      error: 'Claude Code credentials not found. Please log in with Claude Code CLI first.',
    });
    return;
  }

  // Try to get subscriptionType from API (non-fatal, Cursor does this too)
  const profileInfo = credentials ? await fetchProfileInfo(credentials.accessToken) : null;

  const account = {
    ...authStatus,
    subscriptionType: profileInfo?.subscriptionType ?? authStatus?.subscriptionType ?? null,
    rateLimitTier: profileInfo?.rateLimitTier ?? null,
  };

  connections.sendTo(connectionId, 'ACK', {
    requestId: message.requestId,
    status: 'ok',
    account,
  });
}
