import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { Claude } from '../claude';
import { MessageType } from '../../shared';

interface ClaudeAuthStatus {
  loggedIn?: boolean;
  authMethod?: string;
  email?: string;
  subscriptionType?: string | null;
  orgId?: string | null;
  orgName?: string | null;
}

async function runClaudeAuthStatus(workingDir?: string): Promise<ClaudeAuthStatus | null> {
  try {
    // execAuthed so the reported login state reflects the same credentials the chat spawn
    // uses (inherited OAuth tokens stripped identically); env-provided API keys are kept.
    const { stdout } = await Claude.execAuthed(['auth', 'status'], workingDir, { timeout: 8000 });
    if (!stdout.trim()) return null;
    return JSON.parse(stdout.trim()) as ClaudeAuthStatus;
  } catch {
    return null;
  }
}

export async function getAccountHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  // Resolve this context's CLAUDE_CONFIG_DIR onto process.env so `auth status` reports
  // the profile for the active workingDir (project > global), matching chat. Only when a
  // workingDir is supplied — otherwise keep the already-active context. (#123)
  const workingDir = (message.payload as { workingDir?: string })?.workingDir;
  if (workingDir) await Claude.applyConfigDir(workingDir);

  const authStatus = await runClaudeAuthStatus(workingDir);

  if (!authStatus) {
    connections.sendTo(connectionId, MessageType.ACK, {
      requestId: message.requestId,
      status: 'error',
      error: 'Claude Code credentials not found. Please log in with Claude Code CLI first.',
    });
    return;
  }

  connections.sendTo(connectionId, MessageType.ACK, {
    requestId: message.requestId,
    status: 'ok',
    account: authStatus,
  });
}
