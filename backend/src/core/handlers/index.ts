import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { sendMessageHandler } from './sendMessage';
import { stopGenerationHandler } from './stopGeneration';
import { stopSessionHandler } from './stopSession';
import { startSessionHandler } from './startSession';
import { sessionChangeHandler } from './sessionChange';
import { toolResponseHandler } from './toolResponse';
import { getSessionsHandler } from './getSessions';
import { loadSessionHandler } from './loadSession';
import { deleteSessionHandler } from './deleteSession';
import { getSettingsHandler } from './getSettings';
import { saveSettingsHandler } from './saveSettings';
import { getProjectsHandler } from './getProjects';
import { getUsageHandler } from './getUsage';
import { openFileHandler } from './openFile';
import { openDiffHandler } from './openDiff';
import { applyDiffHandler } from './applyDiff';
import { rejectDiffHandler } from './rejectDiff';
import { newSessionHandler } from './newSession';
import { openSettingsHandler } from './openSettings';
import { getVersionHandler } from './getVersion';
import { getAccountHandler } from './getAccount';

export async function handleMessage(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  bridge: Bridge,
): Promise<void> {
  console.error('[node-backend]', `Received: ${message.type}`);

  switch (message.type) {
    case 'SEND_MESSAGE':
      await sendMessageHandler(connectionId, message, connections, bridge);
      break;
    case 'STOP_GENERATION':
      stopGenerationHandler(connectionId, message, connections, bridge);
      break;
    case 'STOP_SESSION':
      stopSessionHandler(connectionId, message, connections, bridge);
      break;
    case 'START_SESSION':
      await startSessionHandler(connectionId, message, connections, bridge);
      break;
    case 'SESSION_CHANGE':
      sessionChangeHandler(connectionId, message, connections, bridge);
      break;
    case 'TOOL_RESPONSE':
      toolResponseHandler(connectionId, message, connections, bridge);
      break;
    case 'GET_SESSIONS':
      await getSessionsHandler(connectionId, message, connections, bridge);
      break;
    case 'LOAD_SESSION':
      await loadSessionHandler(connectionId, message, connections, bridge);
      break;
    case 'DELETE_SESSION':
      await deleteSessionHandler(connectionId, message, connections, bridge);
      break;
    case 'GET_SETTINGS':
      await getSettingsHandler(connectionId, message, connections, bridge);
      break;
    case 'SAVE_SETTINGS':
      await saveSettingsHandler(connectionId, message, connections, bridge);
      break;
    case 'GET_PROJECTS':
      await getProjectsHandler(connectionId, message, connections, bridge);
      break;
    case 'GET_USAGE':
      await getUsageHandler(connectionId, message, connections, bridge);
      break;
    case 'OPEN_FILE':
      await openFileHandler(connectionId, message, connections, bridge);
      break;
    case 'OPEN_DIFF':
      await openDiffHandler(connectionId, message, connections, bridge);
      break;
    case 'APPLY_DIFF':
      await applyDiffHandler(connectionId, message, connections, bridge);
      break;
    case 'REJECT_DIFF':
      await rejectDiffHandler(connectionId, message, connections, bridge);
      break;
    case 'NEW_SESSION':
      await newSessionHandler(connectionId, message, connections, bridge);
      break;
    case 'OPEN_SETTINGS':
      await openSettingsHandler(connectionId, message, connections, bridge);
      break;
    case 'GET_VERSION':
      await getVersionHandler(connectionId, message, connections, bridge);
      break;
    case 'GET_ACCOUNT':
      await getAccountHandler(connectionId, message, connections, bridge);
      break;
    default:
      console.error('[node-backend]', `Unknown message type: ${message.type}`);
  }
}
