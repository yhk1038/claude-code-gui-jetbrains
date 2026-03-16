import { spawn, type ChildProcess } from 'child_process';
import { existsSync, mkdirSync, chmodSync, openSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { resolve } from 'path';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import { arch, platform, tmpdir } from 'os';
import http from 'http';
import https from 'https';

const execAsync = promisify(execCallback);

export interface TunnelStatus {
  enabled: boolean;
  url: string | null;
}

let tunnelProcess: ChildProcess | null = null;
let tunnelUrl: string | null = null;
const TUNNEL_LOG_FILE = resolve(tmpdir(), 'cloudflared-tunnel.log');
const TUNNEL_PID_FILE = resolve(tmpdir(), 'cloudflared-tunnel.pid');

function getLocalBinPath(): string {
  return resolve(process.cwd(), '.local', 'bin', getLocalBinName());
}

function getDownloadUrl(): string | null {
  const os = platform();
  const cpuArch = arch();

  if (os === 'darwin') {
    if (cpuArch === 'arm64') return 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64.tgz';
    if (cpuArch === 'x64') return 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64.tgz';
  } else if (os === 'linux') {
    if (cpuArch === 'x64') return 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64';
    if (cpuArch === 'arm64') return 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64';
  } else if (os === 'win32') {
    if (cpuArch === 'x64') return 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe';
    if (cpuArch === 'arm64') return 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-arm64.exe';
  }

  return null;
}

function getLocalBinName(): string {
  return platform() === 'win32' ? 'cloudflared.exe' : 'cloudflared';
}

async function installCloudflared(): Promise<string> {
  const localBin = getLocalBinPath();
  const localBinDir = resolve(localBin, '..');
  const os = platform();

  // Try package manager first
  if (os === 'darwin') {
    try {
      await execAsync('which brew');
      console.error('[node-backend]', 'Installing cloudflared via Homebrew...');
      await execAsync('brew install cloudflared');
      const { stdout } = await execAsync('which cloudflared');
      return stdout.trim();
    } catch {
      // brew not available or install failed, fall through
    }
  } else if (os === 'win32') {
    try {
      await execAsync('where winget');
      console.error('[node-backend]', 'Installing cloudflared via winget...');
      await execAsync('winget install --id Cloudflare.cloudflared --accept-source-agreements --accept-package-agreements');
      const { stdout } = await execAsync('where cloudflared');
      return stdout.trim().split('\n')[0];
    } catch {
      // winget not available or install failed, fall through
    }
  }

  // Direct binary download
  const url = getDownloadUrl();
  if (!url) {
    throw new Error(`Unsupported OS/architecture: ${os}/${arch()}. Install cloudflared manually: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/`);
  }

  console.error('[node-backend]', `Downloading cloudflared from ${url}...`);
  mkdirSync(localBinDir, { recursive: true });

  if (url.endsWith('.tgz')) {
    await execAsync(`curl -fsSL "${url}" | tar -xz -C "${localBinDir}"`);
  } else if (os === 'win32') {
    // Windows: use PowerShell for download
    await execAsync(`powershell -Command "Invoke-WebRequest -Uri '${url}' -OutFile '${localBin}'"`, { timeout: 60_000 });
  } else {
    await execAsync(`curl -fsSL -o "${localBin}" "${url}"`);
  }

  if (os !== 'win32') {
    chmodSync(localBin, 0o755);
  }

  console.error('[node-backend]', 'cloudflared installed successfully');
  return localBin;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function savePidFile(pid: number): void {
  try {
    writeFileSync(TUNNEL_PID_FILE, String(pid), 'utf-8');
  } catch {
    // ignore
  }
}

function removePidFile(): void {
  try {
    if (existsSync(TUNNEL_PID_FILE)) unlinkSync(TUNNEL_PID_FILE);
  } catch {
    // ignore
  }
}

/**
 * Restore tunnel state from previous session.
 * Called on backend startup to recover from backend restart
 * while cloudflared (detached) is still running.
 */
export function restoreTunnelState(): void {
  try {
    if (!existsSync(TUNNEL_PID_FILE) || !existsSync(TUNNEL_LOG_FILE)) return;

    const pid = parseInt(readFileSync(TUNNEL_PID_FILE, 'utf-8').trim(), 10);
    if (isNaN(pid) || !isProcessAlive(pid)) {
      removePidFile();
      return;
    }

    const log = readFileSync(TUNNEL_LOG_FILE, 'utf-8');
    const URL_PATTERN = /https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/;
    const match = URL_PATTERN.exec(log);
    if (!match) {
      removePidFile();
      return;
    }

    // Process is alive and URL was found — restore state
    tunnelUrl = match[0];
    // We don't have the ChildProcess reference, but we track the PID
    // getTunnelStatus will use tunnelUrl to determine enabled state
    console.error('[node-backend]', `Restored tunnel state: pid=${pid} url=${tunnelUrl}`);
  } catch {
    // ignore restore errors
  }
}

/**
 * Poll the tunnel URL until it returns HTTP 200, indicating
 * the Cloudflare edge has fully registered the tunnel.
 */
async function waitForTunnelReady(url: string, timeoutMs = 30_000, intervalMs = 1_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const ok = await new Promise<boolean>((resolve) => {
      const req = https.get(url, { timeout: 5_000 }, (res) => {
        resolve(res.statusCode === 200);
        res.resume();
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    });

    if (ok) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  console.error('[node-backend]', `Tunnel URL did not become ready within ${timeoutMs / 1000}s, proceeding anyway`);
}

async function findOrInstallCloudflared(): Promise<string> {
  // 1. Try system PATH
  const whichCmd = platform() === 'win32' ? 'where cloudflared' : 'which cloudflared';
  try {
    const { stdout } = await execAsync(whichCmd);
    const binPath = stdout.trim().split('\n')[0];
    if (binPath) return binPath;
  } catch {
    // not in PATH
  }

  // 2. Try project-local binary
  const localBin = getLocalBinPath();
  if (existsSync(localBin)) {
    return localBin;
  }

  // 3. Auto-install
  return installCloudflared();
}

export function startTunnel(port: number): Promise<string> {
  return new Promise(async (resolvePromise, rejectPromise) => {
    if (tunnelProcess) {
      if (tunnelUrl) {
        resolvePromise(tunnelUrl);
        return;
      }
      rejectPromise(new Error('Tunnel process already running but URL not yet available'));
      return;
    }

    let binaryPath: string;
    try {
      binaryPath = await findOrInstallCloudflared();
    } catch (err) {
      rejectPromise(new Error(`Failed to locate or install cloudflared: ${String(err)}`));
      return;
    }

    const args = ['tunnel', '--protocol', 'http2', '--url', `http://localhost:${port}`];

    // tunnel.sh 방식: 로그 파일로 리다이렉트 후 polling으로 URL 추출
    const logFd = openSync(TUNNEL_LOG_FILE, 'w');
    const proc = spawn(binaryPath, args, {
      stdio: ['ignore', logFd, logFd],
      detached: true,
    });

    tunnelProcess = proc;

    const URL_PATTERN = /https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/;
    let resolved = false;

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        rejectPromise(new Error('Timed out waiting for cloudflared tunnel URL (15s)'));
        stopTunnel();
      }
    }, 15_000);

    // 0.5초 간격으로 로그 파일에서 URL 추출 (최대 30회 = 15초)
    const pollId = setInterval(() => {
      try {
        const log = readFileSync(TUNNEL_LOG_FILE, 'utf-8');
        const match = URL_PATTERN.exec(log);
        if (match && !resolved) {
          resolved = true;
          clearInterval(pollId);
          clearTimeout(timeoutId);
          const foundUrl = match[0];
          tunnelUrl = foundUrl;
          if (proc.pid) savePidFile(proc.pid);
          waitForTunnelReady(foundUrl)
            .then(() => resolvePromise(foundUrl))
            .catch(() => resolvePromise(foundUrl));
        }
      } catch {
        // file not ready yet
      }
    }, 500);

    proc.on('error', (err) => {
      console.error('[node-backend]', 'cloudflared process error:', err);
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        rejectPromise(err);
      }
      tunnelProcess = null;
      tunnelUrl = null;
    });

    proc.on('exit', (code, signal) => {
      console.error('[node-backend]', `cloudflared exited with code=${code} signal=${signal}`);
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        rejectPromise(new Error(`cloudflared exited unexpectedly (code=${code})`));
      }
      tunnelProcess = null;
      tunnelUrl = null;
    });
  });
}

export function stopTunnel(): void {
  if (tunnelProcess) {
    try {
      tunnelProcess.kill('SIGTERM');
    } catch (err) {
      console.error('[node-backend]', 'Failed to kill cloudflared process:', err);
    }
    tunnelProcess = null;
  } else {
    // Restored state: no ChildProcess reference, use PID file
    try {
      if (existsSync(TUNNEL_PID_FILE)) {
        const pid = parseInt(readFileSync(TUNNEL_PID_FILE, 'utf-8').trim(), 10);
        if (!isNaN(pid) && isProcessAlive(pid)) {
          process.kill(pid, 'SIGTERM');
        }
      }
    } catch {
      // ignore
    }
  }
  tunnelUrl = null;
  removePidFile();
}

/**
 * Verify tunnel process is still alive. If it died without
 * notification (e.g. restored-from-PID-file session), clean up
 * stale state so callers get accurate status.
 *
 * @returns true if state was corrected (was stale → now cleaned up)
 */
export function validateTunnelStatus(): boolean {
  if (tunnelUrl === null) return false;

  // ChildProcess reference exists — Node's 'exit' event handles cleanup
  if (tunnelProcess) return false;

  // Restored state: check PID file
  try {
    if (existsSync(TUNNEL_PID_FILE)) {
      const pid = parseInt(readFileSync(TUNNEL_PID_FILE, 'utf-8').trim(), 10);
      if (!isNaN(pid) && isProcessAlive(pid)) return false;
    }
  } catch {
    // read error — treat as dead
  }

  // Process is gone — clean up stale state
  console.error('[node-backend]', 'Tunnel process no longer alive, cleaning up stale state');
  tunnelUrl = null;
  removePidFile();
  return true;
}

export function getTunnelStatus(): TunnelStatus {
  return {
    enabled: tunnelUrl !== null,
    url: tunnelUrl,
  };
}

// Kill cloudflared when backend exits
process.on('exit', () => {
  stopTunnel();
});

process.on('SIGTERM', () => {
  stopTunnel();
});
