import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { saveSettingToFile } from '../features/settings';
import { Claude } from '../claude';

export async function saveSettingsHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  const key = message.payload?.key as string;
  const value = message.payload?.value;
  const result = await saveSettingToFile(key, value);

  if (result.status === 'ok' && key === 'cliPath') {
    await Claude.refresh();
  }

  connections.sendTo(connectionId, 'ACK', {
    requestId: message.requestId,
    ...result,
  });
}
