import { execFileSync, execSync } from 'child_process';
import { selectKillablePids } from './core/port-utils';
import { startWebSocketServer, type BridgeMap } from './ws/ws-server';
import { BrowserBridge } from './bridge/browser-bridge';
import { JetBrainsBridge } from './bridge/jetbrains-bridge';
import { handleMessage } from './core/handlers/index';
import { initSettingsWatcher, stopSettingsWatcher } from './core/features/settings-watcher';
import { ensureProfile } from './core/features/profile';
import { trackEvent, trackError } from './core/features/telemetry';
import { getPluginVersion } from './core/handlers/getVersion';
import { release } from 'os';
import { restoreTunnelState } from './core/features/tunnel-manager';
import { restoreSleepGuardState } from './core/features/sleep-guard';
import { isJetBrainsMode, serverPort, webviewDir } from './config/environment';
import { initLogger, getLogger } from './logging';
import { LogWebSocketServer } from './logging/log-ws';
import { Claude } from './core/claude';
import { ClientEnv } from './shared';
import type { NativeDropEntry } from './core/types';

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
  // CRITICAL: only ever target processes *LISTENING* on the port. A plain
  // `lsof -ti :PORT` also returns processes merely connected to it — including the
  // IDE JVM's RPC WebSocket — and SIGKILLing those kills the entire IDE (exit 137).
  // Restricting to LISTEN sockets + filtering our own PID (selectKillablePids)
  // ensures we only reclaim the port from a stale backend, never the IDE.
  if (process.platform === 'win32') {
    try {
      const output = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, {
        encoding: 'utf8',
      }).trim();
      if (!output) return;
      // Last column of each netstat row is the PID.
      const rawPids = output
        .split('\n')
        .map((line) => line.trim().split(/\s+/).pop() ?? '')
        .join('\n');
      selectKillablePids(rawPids, process.pid).forEach((pid) => {
        try {
          execFileSync('taskkill', ['/F', '/PID', String(pid)]);
          console.error('[node-backend]', `Killed listening process ${pid} on port ${port}`);
        } catch {
          // Process may have already exited — ignore
        }
      });
    } catch {
      // netstat/findstr returns non-zero when no match — ignore
    }
  } else {
    try {
      // -sTCP:LISTEN restricts the query to listening sockets only.
      const raw = execFileSync('lsof', ['-ti', `:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' });
      selectKillablePids(raw, process.pid).forEach((pid) => {
        try {
          process.kill(pid, 'SIGKILL');
          console.error('[node-backend]', `Killed listening process ${pid} on port ${port}`);
        } catch {
          // Process may have already exited — ignore
        }
      });
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

/**
 * Validate NATIVE_DROP `params.entries` arriving over JSON-RPC. Kotlin builds
 * each entry as `{ path: string; type: "file" | "folder" }`, but the value lands
 * here as `unknown`, so we narrow it explicitly. Malformed elements are dropped
 * (not coerced) so a single bad path can't poison the stash.
 */
function parseNativeDropEntries(raw: unknown): NativeDropEntry[] {
  if (!Array.isArray(raw)) return [];
  const result: NativeDropEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const candidate = item as { path?: unknown; type?: unknown };
    if (typeof candidate.path !== 'string' || !candidate.path) continue;
    const type = candidate.type === 'folder' ? 'folder' : 'file';
    result.push({ path: candidate.path, type });
  }
  return result;
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

  // 설치 단위 가명 식별자(uuid)를 동의 여부와 무관하게 보장한다.
  await ensureProfile();

  // 예상 못한 전역 에러도 텔레메트리로 보고한다(보고·로깅만, 프로세스 동작은 기존 생존
  // 스타일을 유지 — 강제 종료/재throw하지 않는다). 전송은 fire-and-forget.
  process.on('uncaughtException', (err) => {
    console.error('[node-backend]', 'uncaughtException:', err);
    trackError(err, { origin: 'uncaughtException' });
  });
  process.on('unhandledRejection', (reason) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    console.error('[node-backend]', 'unhandledRejection:', err);
    trackError(err, { origin: 'unhandledRejection' });
  });

  // 동의(ACCEPTED)한 사용자에 한해 앱 시작(활성) 이벤트를 보낸다. 미동의면 내부에서 no-op.
  // 부팅을 막지 않도록 await하지 않는다(전송 실패도 내부에서 무시).
  void trackEvent('app_started', {
    pluginVersion: getPluginVersion(),
    os: process.platform,
    osVersion: release(),
  });

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

  // Stash native drop paths on drag-enter; the webview will flush them on its drop event.
  // The page's HTML5 `dataTransfer` doesn't expose absolute paths (browser security), so
  // Kotlin sends the paths it received from CefDragHandler over /rpc, and we hold them
  // against the panelId until the webview confirms the actual drop via NATIVE_DROP_FLUSH.
  // That ensures attach happens on release — not on hover — while still using the real
  // OS file paths.
  (bridges[ClientEnv.JETBRAINS] as JetBrainsBridge).onNotification('NATIVE_DROP', (_method, params) => {
    const panelId = typeof params.panelId === 'string' ? params.panelId : '';
    const entries = parseNativeDropEntries(params.entries);
    if (!panelId || entries.length === 0) return;
    const stashed = connections.setNativeDropStash(panelId, entries);
    if (!stashed) {
      console.error('[node-backend]', `[NATIVE_DROP] stash failed — no connection for panelId=${panelId}`);
    }
  });

  // 4. Logger에 LogWS 참조 설정
  logger.setLogWs(logWs);

  // PORT를 stdout 첫 줄에 출력. Wrapper(JetBrains 플러그인 또는 ccg standalone
  // 런처)가 이를 읽고 후속 연결을 시작한다. 사용자가 직접 `node backend.mjs`로
  // 실행하더라도 한 줄 noise일 뿐 부작용 없음.
  process.stdout.write(`PORT:${port}\n`);

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
