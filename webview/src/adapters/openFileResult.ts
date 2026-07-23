/**
 * The backend acks an OPEN_FILE request with `{ ok, reason? }` so the webview can
 * tell a successful open from a failed one (e.g. the path is not on disk). Throw
 * on failure — carrying the path and reason — so the click handler can surface a
 * toast instead of the open silently doing nothing.
 */
export interface OpenFileError extends Error {
  filePath: string;
  reason: string;
}

export function assertFileOpened(res: unknown, filePath: string): void {
  const result = res as { ok?: boolean; reason?: string } | undefined;
  if (result?.ok === false) {
    const reason = result.reason ?? 'open-failed';
    const err = new Error(`Failed to open ${filePath} (${reason})`) as OpenFileError;
    err.filePath = filePath;
    err.reason = reason;
    throw err;
  }
}
