import { rmSync } from 'fs';

/**
 * Best-effort removal of the temp directories that the JetBrains plugin extracted
 * from its JAR for this backend instance (#120):
 *   - {tmpdir}/claude-code-webview-{instanceTag}  (static webview assets)
 *   - {tmpdir}/claude-code-backend-{instanceTag}  (this running backend.mjs)
 *
 * Called from `process.on('exit')`, so it MUST stay fully synchronous (no async
 * APIs are honored after exit begins) — hence `rmSync`.
 *
 * Safety contract:
 *   - Only the exact directories passed in are removed; we never scan tmpdir for
 *     sibling instanceTag folders (a concurrent project's active dir must survive).
 *   - Empty / undefined entries are skipped (callers pass env values that may be unset).
 *   - Each removal is independent: a failure on one dir (e.g. Windows self-lock on the
 *     directory holding the running backend.mjs) is swallowed so the remaining dirs —
 *     notably the webview assets — are still cleaned. `force: true` also ignores a
 *     missing path.
 */
export function cleanupExtractedTempDirs(dirs: Array<string | undefined>): void {
  for (const dir of dirs) {
    if (!dir) continue;
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch (err) {
      // Swallow — exit-time cleanup is best-effort and must never throw.
      console.error('[node-backend]', `temp cleanup failed for ${dir}:`, err);
    }
  }
}
