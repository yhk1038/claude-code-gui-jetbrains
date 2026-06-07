import { execFile } from 'child_process';
import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';

interface UsageBucket {
  utilization: number;
  resets_at: string;
}

interface ExtraUsage {
  is_enabled: boolean;
  monthly_limit: number | null;
  used_credits: number | null;
  utilization: number | null;
}

interface CcbUsageResponse {
  five_hour: UsageBucket | null;
  seven_day: UsageBucket | null;
  seven_day_oauth_apps: UsageBucket | null;
  seven_day_sonnet: UsageBucket | null;
  seven_day_opus: UsageBucket | null;
  seven_day_cowork: UsageBucket | null;
  iguana_necktie: UsageBucket | null;
  extra_usage: ExtraUsage | null;
}

type UsageErrorKind = 'ccb_missing' | 'npm_missing' | 'auth' | 'network' | 'unknown';

interface UsageErrorInfo {
  kind: UsageErrorKind;
  message: string;
}

function classifyError(raw: string): UsageErrorInfo {
  if (/npm[^a-z].*(?:command not found|not recognized)|(?:command not found|not recognized).*npm/i.test(raw)) {
    return { kind: 'npm_missing', message: 'Node.js / npm not found in PATH' };
  }

  if (/spawn .*ENOENT|ENOENT/i.test(raw) || /could not determine executable to run/i.test(raw) || /command not found.*ccb|ccb.*not found|ccb.*not recognized/i.test(raw)) {
    return { kind: 'ccb_missing', message: 'claude-code-battery CLI is not installed' };
  }

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.error?.message) {
        return { kind: 'auth', message: parsed.error.message };
      }
    } catch { /* not JSON, fall through */ }
  }

  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|getaddrinfo/i.test(raw)) {
    return { kind: 'network', message: 'Network error reaching Anthropic API' };
  }

  const cleaned = raw
    .split('\n')
    .filter((line) => !/^npm (warn|WARN)\b/.test(line))
    .join('\n')
    .trim();
  return { kind: 'unknown', message: cleaned || raw };
}

function execFileAsync(cmd: string, args: string[], opts: { timeout: number }): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, opts, (err, stdout, stderr) => {
      if (err) return reject(err);
      resolve({ stdout: stdout?.toString() ?? '', stderr: stderr?.toString() ?? '' });
    });
  });
}

export function shellInvocation(command: string): { shell: string; args: string[] } {
  if (process.platform === 'win32') {
    return {
      shell: process.env.ComSpec || 'cmd.exe',
      args: ['/c', command],
    };
  }
  const userShell = process.env.SHELL || '/bin/sh';
  // fish does not support the `-i` flag; fall back to a POSIX-compatible shell
  const isFish = /\/fish$/.test(userShell);
  const shell = isFish ? '/bin/sh' : userShell;
  return {
    shell,
    args: ['-l', '-i', '-c', command],
  };
}

const CACHE_TTL_MS = 90_000;
let cachedUsage: CcbUsageResponse | null = null;
let cachedAt = 0;
let inflightPromise: Promise<CcbUsageResponse> | null = null;
let lastErrorInfo: UsageErrorInfo | null = null;

export function resetUsageCache(): void {
  cachedUsage = null;
  cachedAt = 0;
  lastErrorInfo = null;
}

async function runCcbUsage(): Promise<CcbUsageResponse> {
  const { shell, args } = shellInvocation('ccb oauth usage --json');
  const { stdout } = await execFileAsync(shell, args, { timeout: 15000 });
  // Interactive login shells (`-l -i`) source startup files like .bashrc, which on
  // Linux often emit control sequences such as printf "\e[?2004l" (disable bracketed
  // paste) to stdout before our output. trim() cannot strip the ESC char, so extract
  // the JSON object itself rather than parsing the raw stdout. (issue #62)
  const match = stdout.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Empty response from ccb');
  return JSON.parse(match[0]);
}

export async function getUsageHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  const force = (message.payload as { force?: boolean })?.force === true;

  if (!force && Date.now() - cachedAt < CACHE_TTL_MS && (cachedUsage !== null || lastErrorInfo !== null)) {
    if (cachedUsage !== null) {
      connections.sendTo(connectionId, 'ACK', {
        requestId: message.requestId,
        status: 'ok',
        usage: cachedUsage,
      });
    } else {
      connections.sendTo(connectionId, 'ACK', {
        requestId: message.requestId,
        status: 'error',
        usage: null,
        error: lastErrorInfo?.message ?? null,
        error_kind: lastErrorInfo?.kind ?? null,
      });
    }
    return;
  }

  if (force) {
    inflightPromise = null;
  }

  try {
    if (!force && inflightPromise !== null) {
      try {
        await inflightPromise;
      } catch {
        // absorb inflight rejection; respond based on cachedUsage
      }
      if (cachedUsage !== null) {
        connections.sendTo(connectionId, 'ACK', {
          requestId: message.requestId,
          status: 'ok',
          usage: cachedUsage,
        });
      } else {
        connections.sendTo(connectionId, 'ACK', {
          requestId: message.requestId,
          status: 'error',
          usage: null,
          error: lastErrorInfo?.message ?? null,
          error_kind: lastErrorInfo?.kind ?? null,
        });
      }
      return;
    }

    const runPromise = (async () => {
      const usage = await runCcbUsage();
      cachedUsage = usage;
      cachedAt = Date.now();
      lastErrorInfo = null;
      return usage;
    })();

    if (!force) {
      inflightPromise = runPromise;
    }

    const usage = await runPromise;

    connections.sendTo(connectionId, 'ACK', {
      requestId: message.requestId,
      status: 'ok',
      usage,
    });
  } catch (err) {
    const info = classifyError(err instanceof Error ? err.message : String(err));
    lastErrorInfo = info;
    cachedAt = Date.now();
    connections.sendTo(connectionId, 'ACK', {
      requestId: message.requestId,
      status: 'error',
      usage: cachedUsage,
      error: info.message,
      error_kind: info.kind,
    });
  } finally {
    if (!force) {
      inflightPromise = null;
    }
  }
}
