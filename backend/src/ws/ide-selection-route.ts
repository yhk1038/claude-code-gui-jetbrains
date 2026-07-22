import { ConnectionManager, IDE_SELECTION_MESSAGE } from './connection-manager';

// IDE_SELECTION_MESSAGE lives in connection-manager (alongside
// EDITOR_CONTEXT_MESSAGE) so addConnection can replay the last selection on
// connect — symmetric with the editor-context replay path.
export { IDE_SELECTION_MESSAGE };

/**
 * Result of handling a POST /internal/ide-selection request. The caller writes
 * `status` and JSON-serialized `body` back to the HTTP response.
 */
export interface IdeSelectionRouteResult {
  status: number;
  body: Record<string, unknown>;
}

/**
 * Validated ide-selection payload pushed to the webview as IDE_SELECTION.
 * Kotlin sends this automatically whenever the active editor selection changes.
 * `startLine`/`endLine`/`selectedText` are null when no selection is active.
 * `isGitignored` is true when the file is excluded by VCS ignore rules (e.g. .gitignore).
 */
interface IdeSelectionPayload extends Record<string, unknown> {
  absolutePath: string;
  relativePath: string;
  startLine: number | null;
  endLine: number | null;
  selectedText: string | null;
  workingDir: string;
  isGitignored: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeLine(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

function normalizeText(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/**
 * Parse + validate an ide-selection request body and route it to the webview.
 *
 * The payload is always stored as the last IDE selection (a persistent mirror of
 * the currently-focused editor) and, if a webview is connected, broadcast live as
 * IDE_SELECTION. When the tool window is later closed and reopened (webview
 * reload), addConnection replays this stored selection to the fresh connection so
 * the file context chip is restored immediately, without the user re-focusing the
 * file. This mirrors editor-context's replay-on-connect, but persists (not
 * consumed once) since it reflects ongoing editor state rather than a one-shot action.
 *
 * Extracted from the HTTP layer so the validation/routing logic is unit-testable
 * without spinning up a server.
 */
export function handleIdeSelectionRequest(
  connections: ConnectionManager,
  rawBody: string,
): IdeSelectionRouteResult {
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

  const payload: IdeSelectionPayload = {
    absolutePath,
    relativePath,
    startLine: normalizeLine(parsed.startLine),
    endLine: normalizeLine(parsed.endLine),
    selectedText: normalizeText(parsed.selectedText),
    workingDir: typeof parsed.workingDir === 'string' ? parsed.workingDir : '',
    isGitignored: typeof parsed.isGitignored === 'boolean' ? parsed.isGitignored : false,
  };

  // Always remember the latest selection so a webview that (re)connects later —
  // e.g. tool window reopened — is replayed this file context on connect.
  connections.setLastIdeSelection(payload);
  // Push live to any webview already connected: to the last-focused panel only
  // when it has a live connection, else fall back to broadcasting (safe default
  // when no panel focus is known yet or the focused panel disconnected).
  if (connections.getConnectionCount() > 0) {
    connections.routeToFocusedOrBroadcast(IDE_SELECTION_MESSAGE, payload);
  }

  return { status: 200, body: { success: true } };
}
