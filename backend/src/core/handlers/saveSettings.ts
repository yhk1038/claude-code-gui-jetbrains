import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { saveSettingToScope, readMergedSettings } from '../features/settings';
import { Claude } from '../claude';
import { MessageType } from '../../shared';

export async function saveSettingsHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  bridge: Bridge,
): Promise<void> {
  const key = message.payload?.key as string;
  const value = message.payload?.value;
  const scope = (message.payload?.scope as 'global' | 'project') || 'global';
  const workingDir = message.payload?.workingDir as string | undefined;

  const result = await saveSettingToScope(key, value, scope, workingDir);

  if (result.status === 'ok' && key === 'cliPath') {
    await Claude.refresh();
  }

  // Push the new hostMode to the IDE so Kotlin's cache stays in sync and chat windows
  // route to the chosen host immediately. The backend owns settings; Kotlin no longer
  // reads the file for hostMode (it diverges from the JVM home on WSL2 — issue #7).
  // Only the JetBrains bridge exposes pushHostMode; browser mode has no IDE to notify.
  if (result.status === 'ok' && key === 'hostMode' && typeof value === 'string') {
    const pushable = bridge as Bridge & { pushHostMode?: (hostMode: string) => void };
    pushable.pushHostMode?.(value);
  }

  // Broadcast merged settings after save
  if (result.status === 'ok') {
    const { settings, overrides } = await readMergedSettings(workingDir);
    connections.broadcastToAll(MessageType.SETTINGS_CHANGED, { settings, overrides });
  }

  connections.sendTo(connectionId, MessageType.ACK, {
    requestId: message.requestId,
    ...result,
  });
}
