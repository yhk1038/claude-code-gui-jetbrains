import { ConnectionManager } from './connection-manager';
import { MessageType } from '../shared';

/**
 * Push message type carrying the auto-tracked IDE selection to the webview.
 * Mirrors the EDITOR_CONTEXT_MESSAGE pattern in connection-manager.ts but for
 * the passive selection channel (no buffering — next selection event supersedes).
 */
export const IDE_SELECTION_MESSAGE = MessageType.IDE_SELECTION;

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
 * Unlike editor-context (which buffers for JCEF cold start), ide-selection is
 * an automatic, high-frequency signal — the next selection change will arrive
 * shortly, so we intentionally drop the payload when no webview is connected.
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

  // Do NOT buffer: auto-tracked selection fires frequently; next change supersedes.
  if (connections.getConnectionCount() > 0) {
    connections.broadcastToAll(IDE_SELECTION_MESSAGE, payload);
  }

  return { status: 200, body: { success: true } };
}
