import { execFileSync, execSync } from 'child_process';
import { startWebSocketServer, type BridgeMap } from './ws/ws-server';
import { BrowserBridge } from './bridge/browser-bridge';
import { JetBrainsBridge } from './bridge/jetbrains-bridge';
import { handleMessage } from './core/handlers/index';
import { initSettingsWatcher, stopSettingsWatcher } from './core/features/settings-watcher';
import { restoreTunnelState } from './core/features/tunnel-manager';
import { restoreSleepGuardState } from './core/features/sleep-guard';
import { isJetBrainsMode, serverPort, webviewDir } from './config/environment';
import { initLogger, getLogger } from './logging';
import { LogWebSocketServer } from './logging/log-ws';
import { Claude } from './core/claude';
import { ClientEnv } from './shared';

/**
 * JetBrains 모드: JETBRAINS_MODE=true 환경변수로 감지
 * - Kotlin이 Node.js를 spawn할 때 이 환경변수를 설정
 * - WEBVIEW_DIR: WebView 정적 파일 경로 (Kotlin이 추출 후 전달)
 * - Node.js는 PORT:{n}\n을 stdout 첫 줄에 출력 (Kotlin이 읽음)
 * - IDE는 /rpc WebSocket 경로로 연결하여 JSON-RPC 통신
 * - stderr는 로그 출력
 *
 * Browser (standalone) 모드: 기본값
 * - 고정 포트(19836) 사용 (PORT 환경변수로 오버라이드 가능)
 * - BrowserBridge 사용 (Vite dev server가 정적 파일 제공)
 *
 * 부트스트랩 순서:
 * 1. JetBrainsBridge 생성 (WebSocket RPC 클라이언트 대기)
 * 2. WebSocket 서버 시작 (포트 확보)
 * 3. PORT:{port}\n 을 stdout에 출력 (Kotlin이 읽음)
 * 4. Kotlin이 /rpc WebSocket에 연결 → JSON-RPC 채널 수립
 * 5. Kotlin이 http://localhost:{port} 로 JCEF 로드 → /ws WebSocket 연결
 */

function killProcessOnPort(port: number): void {
  if (process.platform === 'win32') {
    try {
      // Find PIDs listening on the port via netstat, then parse the last column
      const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' }).trim();
      if (!output) return;
      const pids = new Set<number>();
      output.split('\n').forEach((line) => {
        const parts = line.trim().split(/\s+/);
        const pidStr = parts[parts.length - 1];
        const pid = parseInt(pidStr, 10);
        if (Number.isFinite(pid) && pid > 0) pids.add(pid);
      });
      pids.forEach((pid) => {
        try {
          execFileSync('taskkill', ['/F', '/PID', String(pid)]);
          console.error('[node-backend]', `Killed process ${pid} occupying port ${port}`);
        } catch {
          // Process may have already exited — ignore
        }
      });
    } catch {
      // netstat/findstr returns non-zero when no match — ignore
    }
  } else {
    try {
      const pids = execFileSync('lsof', ['-ti', `:${port}`], { encoding: 'utf8' }).trim();
      if (pids) {
        pids.split('\n').forEach((pidStr) => {
          const pid = parseInt(pidStr.trim(), 10);
          if (!Number.isFinite(pid) || pid <= 0) return;
          try {
            process.kill(pid, 'SIGKILL');
            console.error('[node-backend]', `Killed process ${pid} occupying port ${port}`);
          } catch {
            // Process may have already exited — ignore
          }
        });
      }
    } catch {
      // lsof returns non-zero when no process found — ignore
    }
  }
}

async function startServerWithRetry(
  bridges: BridgeMap,
  logWs?: LogWebSocketServer,
): Promise<Awaited<ReturnType<typeof startWebSocketServer>>> {
  try {
    return await startWebSocketServer(serverPort, bridges, handleMessage, webviewDir, logWs);
  } catch (err: unknown) {
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code !== 'EADDRINUSE') throw err;

    console.error('[node-backend]', `Port ${serverPort} already in use. Killing existing process and retrying...`);
    killProcessOnPort(serverPort);

    await new Promise((resolve) => setTimeout(resolve, 200));

    return await startWebSocketServer(serverPort, bridges, handleMessage, webviewDir, logWs);
  }
}

async function main() {
  // Survive parent process (Kotlin/JVM) shutdown.
  // When JVM exits, stdin/stdout/stderr pipes break. Without these handlers,
  // any console.error() call would crash the process with EPIPE.
  process.on('SIGPIPE', () => {}); // Ignore SIGPIPE signal
  process.stdout.on('error', () => {}); // Ignore stdout EPIPE
  process.stderr.on('error', () => {}); // Ignore stderr EPIPE

  // 1. Logger 즉시 초기화 (부트스트랩 로그도 파일에 기록)
  const logger = initLogger();
  await logger.init();
  logger.interceptConsole();

  // Load CLI path from settings before any handler can spawn claude
  await Claude.refresh();

  const bridges: BridgeMap = {
    [ClientEnv.BROWSER]: new BrowserBridge(),
    [ClientEnv.JETBRAINS]: new JetBrainsBridge(),
  };

  // 2. LogWebSocketServer 생성
  const logWs = new LogWebSocketServer((entries) => {
    logger.handleWebViewLogs(entries);
  });

  // 3. 서버 시작 (logWs 전달)
  const { port, close, connections } = await startServerWithRetry(bridges, logWs);

  // 4. Logger에 LogWS 참조 설정
  logger.setLogWs(logWs);

  if (isJetBrainsMode) {
    // PORT를 stdout 첫 줄에 출력 — Kotlin이 이를 읽고 /rpc WebSocket 연결 + JCEF 로드
    process.stdout.write(`PORT:${port}\n`);
  }

  console.error(
    '[node-backend]',
    `Server started on port ${port}`,
    `(mode: ${isJetBrainsMode ? 'JetBrains' : 'browser'})`,
    webviewDir ? `(webviewDir: ${webviewDir})` : '',
  );

  // Restore tunnel/sleep state from previous session
  restoreTunnelState();
  restoreSleepGuardState().catch(() => {});

  // Start watching all settings files for external changes
  const settingsWatcher = initSettingsWatcher((event, data) => {
    console.error('[node-backend]', `Broadcasting ${event} event`);
    connections.broadcastToAll(event, data);
  });
  settingsWatcher.startGlobalWatchers();

  async function shutdown(signal: string) {
    console.error('[node-backend]', `${signal} received, shutting down...`);
    stopSettingsWatcher();
    connections.shutdownAll();
    close();

    // 로그 스트림 flush 대기 (최대 5초)
    const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, 5000));
    await Promise.race([getLogger().close(), timeoutPromise]);

    process.exit(0);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[node-backend]', 'Fatal error:', err);
  process.exit(1);
});
