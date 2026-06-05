import { ConnectionManager, EDITOR_CONTEXT_MESSAGE } from './connection-manager';

/**
 * Result of handling a POST /internal/editor-context request. The caller writes
 * `status` and JSON-serialized `body` back to the HTTP response.
 */
export interface EditorContextRouteResult {
  status: number;
  body: Record<string, unknown>;
}

/**
 * Validated editor-context payload pushed to the webview as EDITOR_CONTEXT.
 * Kotlin sends this when the user invokes "Add to Claude" on an editor selection.
 * `startLine`/`endLine` are null when the action fires without a selection.
 */
interface EditorContextPayload extends Record<string, unknown> {
  absolutePath: string;
  relativePath: string;
  startLine: number | null;
  endLine: number | null;
  workingDir: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeLine(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

/**
 * Parse + validate an editor-context request body and route it to the webview.
 *
 * If a webview is connected, the payload is broadcast immediately as
 * EDITOR_CONTEXT. Otherwise it is stashed (the action may fire during JCEF cold
 * start) and replayed to the first connection that arrives within the TTL.
 *
 * Extracted from the HTTP layer so the validation/routing logic is unit-testable
 * without spinning up a server.
 */
export function handleEditorContextRequest(
  connections: ConnectionManager,
  rawBody: string,
): EditorContextRouteResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { error: 'Invalid JSON body' } };
  }

  if (!isRecord(parsed)) {
    return { status: 400, body: { error: 'Body must be a JSON object' } };
  }

  const { absolutePath, relativePath } = parsed;
  if (typeof absolutePath !== 'string' || typeof relativePath !== 'string') {
    return {
      status: 400,
      body: { error: 'absolutePath and relativePath are required strings' },
    };
  }

  const payload: EditorContextPayload = {
    absolutePath,
    relativePath,
    startLine: normalizeLine(parsed.startLine),
    endLine: normalizeLine(parsed.endLine),
    workingDir: typeof parsed.workingDir === 'string' ? parsed.workingDir : '',
  };

  if (connections.getConnectionCount() > 0) {
    connections.broadcastToAll(EDITOR_CONTEXT_MESSAGE, payload);
  } else {
    connections.setPendingEditorContext(payload);
  }

  return { status: 200, body: { success: true } };
}
