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
import { createSessionHandler } from './createSession';
import { openNewTabHandler } from './openNewTab';
import { openSettingsHandler } from './openSettings';
import { openTerminalHandler } from './openTerminal';
import { getVersionHandler } from './getVersion';
import { getAccountHandler } from './getAccount';
import { reclaimSessionHandler } from './reclaimSession';
import { getSlashCommandsHandler } from './getSlashCommands';
import { loginHandler } from './login';
import { openUrlHandler } from './openUrl';
import { getAvailableTerminalsHandler } from './getAvailableTerminals';
import { getDetectedCliPathHandler } from './getDetectedCliPath';
import { pickFilesHandler } from './pickFiles';
import { getPluginUpdatesHandler } from './getPluginUpdates';
import { updatePluginHandler } from './updatePlugin';
import { getClaudeSettingsHandler } from './getClaudeSettings';
import { saveClaudeSettingsHandler } from './saveClaudeSettings';
import { setModelHandler } from './setModel';
import { getWorkingDirHandler } from './getWorkingDir';
import { tunnelStartHandler } from './tunnelStart';
import { tunnelStopHandler } from './tunnelStop';
import { getTunnelStatusHandler } from './getTunnelStatus';
import { sleepGuardEnableHandler } from './sleepGuardEnable';
import { sleepGuardDisableHandler } from './sleepGuardDisable';
import { listProjectFilesHandler } from './listProjectFiles';

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
    case 'CREATE_SESSION':
      await createSessionHandler(connectionId, message, connections, bridge);
      break;
    case 'OPEN_NEW_TAB':
      await openNewTabHandler(connectionId, message, connections, bridge);
      break;
    case 'OPEN_SETTINGS':
      await openSettingsHandler(connectionId, message, connections, bridge);
      break;
    case 'OPEN_TERMINAL':
      await openTerminalHandler(connectionId, message, connections, bridge);
      break;
    case 'GET_VERSION':
      await getVersionHandler(connectionId, message, connections, bridge);
      break;
    case 'GET_ACCOUNT':
      await getAccountHandler(connectionId, message, connections, bridge);
      break;
    case 'RECLAIM_SESSION':
      await reclaimSessionHandler(connectionId, message, connections, bridge);
      break;
    case 'GET_SLASH_COMMANDS':
      await getSlashCommandsHandler(connectionId, message, connections, bridge);
      break;
    case 'LOGIN':
      await loginHandler(connectionId, message, connections, bridge);
      break;
    case 'OPEN_URL':
      await openUrlHandler(connectionId, message, connections, bridge);
      break;
    case 'GET_AVAILABLE_TERMINALS':
      await getAvailableTerminalsHandler(connectionId, message, connections, bridge);
      break;
    case 'GET_DETECTED_CLI_PATH':
      await getDetectedCliPathHandler(connectionId, message, connections, bridge);
      break;
    case 'PICK_FILES':
      await pickFilesHandler(connectionId, message, connections, bridge);
      break;
    case 'GET_PLUGIN_UPDATES':
      await getPluginUpdatesHandler(connectionId, message, connections, bridge);
      break;
    case 'UPDATE_PLUGIN':
      await updatePluginHandler(connectionId, message, connections, bridge);
      break;
    case 'GET_CLAUDE_SETTINGS':
      await getClaudeSettingsHandler(connectionId, message, connections, bridge);
      break;
    case 'SAVE_CLAUDE_SETTINGS':
      await saveClaudeSettingsHandler(connectionId, message, connections, bridge);
      break;
    case 'SET_MODEL':
      setModelHandler(connectionId, message, connections, bridge);
      break;
    case 'GET_WORKING_DIR':
      getWorkingDirHandler(connectionId, message, connections, bridge);
      break;
    case 'TUNNEL_START':
      await tunnelStartHandler(connectionId, message, connections, bridge);
      break;
    case 'TUNNEL_STOP':
      await tunnelStopHandler(connectionId, message, connections, bridge);
      break;
    case 'GET_TUNNEL_STATUS':
      await getTunnelStatusHandler(connectionId, message, connections, bridge);
      break;
    case 'SLEEP_GUARD_ENABLE':
      await sleepGuardEnableHandler(connectionId, message, connections, bridge);
      break;
    case 'SLEEP_GUARD_DISABLE':
      await sleepGuardDisableHandler(connectionId, message, connections, bridge);
      break;
    case 'LIST_PROJECT_FILES':
      await listProjectFilesHandler(connectionId, message, connections, bridge);
      break;
    default:
      console.error('[node-backend]', `Unknown message type: ${message.type}`);
  }
}
