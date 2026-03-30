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

function execFileAsync(cmd: string, args: string[], opts: { timeout: number }): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, opts, (err, stdout, stderr) => {
      if (err) return reject(err);
      resolve({ stdout: stdout?.toString() ?? '', stderr: stderr?.toString() ?? '' });
    });
  });
}

const CACHE_TTL_MS = 60_000;
let cachedUsage: CcbUsageResponse | null = null;
let cachedAt = 0;

export function resetUsageCache(): void {
  cachedUsage = null;
  cachedAt = 0;
}

async function runCcbUsage(): Promise<CcbUsageResponse> {
  const { stdout } = await execFileAsync('npx', ['ccb', 'oauth', 'usage', '--json'], { timeout: 15000 });
  const trimmed = stdout.trim();
  if (!trimmed) throw new Error('Empty response from ccb');
  return JSON.parse(trimmed);
}

export async function getUsageHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  if (cachedUsage !== null && Date.now() - cachedAt < CACHE_TTL_MS) {
    connections.sendTo(connectionId, 'ACK', {
      requestId: message.requestId,
      status: 'ok',
      usage: cachedUsage,
    });
    return;
  }

  try {
    const usage = await runCcbUsage();
    cachedUsage = usage;
    cachedAt = Date.now();

    connections.sendTo(connectionId, 'ACK', {
      requestId: message.requestId,
      status: 'ok',
      usage,
    });
  } catch (err) {
    connections.sendTo(connectionId, 'ACK', {
      requestId: message.requestId,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
