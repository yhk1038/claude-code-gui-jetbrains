import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { saveEnvVarToScope, readMergedSettings } from '../features/settings';
import { Claude } from '../claude';
import { MessageType } from '../../shared';

/**
 * Persist CLAUDE_CONFIG_DIR into the plugin settings `env` map at the requested scope,
 * then apply it to the CURRENT context (this settings screen's workingDir) so the change
 * takes effect immediately. An empty/blank value removes the override.
 *
 * This does not leak across the backend: process.env is a single shared slot, but every
 * other context re-resolves on its own load — the project picker resets to global, and a
 * chat applies its own workingDir. So a project-scoped save only sticks for that project.
 * (#123)
 */
export async function saveClaudeConfigDirHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  const raw = message.payload?.value;
  // Treat empty/blank as removal so the user can clear the override from the UI.
  const value = typeof raw === 'string' && raw.trim() !== '' ? raw : null;
  const scope = (message.payload?.scope as 'global' | 'project') || 'global';
  const workingDir = message.payload?.workingDir as string | undefined;

  const result = await saveEnvVarToScope('CLAUDE_CONFIG_DIR', value, scope, workingDir);

  if (result.status === 'ok') {
    await Claude.applyConfigDir(workingDir);
    const { settings, overrides } = await readMergedSettings(workingDir);
    connections.broadcastToAll(MessageType.SETTINGS_CHANGED, { settings, overrides });
  }

  connections.sendTo(connectionId, MessageType.ACK, {
    requestId: message.requestId,
    ...result,
  });
}
