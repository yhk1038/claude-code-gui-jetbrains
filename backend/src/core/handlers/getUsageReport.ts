import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { Claude } from '../claude';
import { MessageType } from '../../shared';

const REPORT_TIMEOUT_MS = 25_000;
// `/usage` itself consumes usage (it spawns the CLI, which hits the API), so we
// cache the report briefly to avoid re-running it every time the modal opens.
const CACHE_TTL_MS = 60_000;

let cachedReport: string | null = null;
let cachedAt = 0;

export function resetUsageReportCache(): void {
  cachedReport = null;
  cachedAt = 0;
}

/**
 * Run `claude --no-session-persistence -p "/usage"` and resolve its raw stdout.
 *
 * The text is returned to the webview UNPARSED — the frontend owns parsing
 * (original-data preservation). This is exactly what a user gets by typing
 * `/usage` in the terminal, so it stays aligned with the CLI and depends on no
 * SDK or undocumented protocol.
 */
export function runUsageReport(workingDir?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = Claude.spawn(['-p', '/usage', '--no-session-persistence'], {
      cwd: workingDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { TERM: 'dumb', CI: 'true', CLAUDECODE: undefined },
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    const settle = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      fn();
    };

    proc.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });
    proc.on('error', (err) => settle(() => reject(err)));
    proc.on('close', (code) => settle(() => {
      if (stdout.trim()) resolve(stdout);
      else reject(new Error(stderr.trim() || `claude /usage exited with code ${code}`));
    }));

    setTimeout(() => settle(() => {
      // Windows spawn() runs through a shell, so the real claude is a grandchild;
      // killTree tears down the whole tree instead of orphaning it.
      Claude.killTree(proc);
      reject(new Error('claude /usage timed out'));
    }), REPORT_TIMEOUT_MS);
  });
}

export async function getUsageReportHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  const force = (message.payload as { force?: boolean })?.force === true;
  const workingDir = (message.payload as { workingDir?: string })?.workingDir;

  if (!force && cachedReport !== null && Date.now() - cachedAt < CACHE_TTL_MS) {
    connections.sendTo(connectionId, MessageType.ACK, {
      requestId: message.requestId,
      status: 'ok',
      report: cachedReport,
    });
    return;
  }

  try {
    // Read credentials from the same profile as chat when a workingDir is given (#123).
    if (workingDir) await Claude.applyConfigDir(workingDir);
    const report = await runUsageReport(workingDir);
    cachedReport = report;
    cachedAt = Date.now();
    connections.sendTo(connectionId, MessageType.ACK, {
      requestId: message.requestId,
      status: 'ok',
      report,
    });
  } catch (err) {
    connections.sendTo(connectionId, MessageType.ACK, {
      requestId: message.requestId,
      status: 'error',
      report: cachedReport,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
