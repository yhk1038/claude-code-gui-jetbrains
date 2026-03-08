import { execSync } from 'child_process';
import { startWebSocketServer } from './ws/ws-server';
import { BrowserBridge } from './bridge/browser-bridge';
import { JetBrainsBridge } from './bridge/jetbrains-bridge';
import { handleMessage } from './core/handlers/index';

/**
 * JetBrains 모드: JETBRAINS_MODE=true 환경변수로 감지
 * - Kotlin이 Node.js를 spawn할 때 이 환경변수를 설정
 * - WEBVIEW_DIR: WebView 정적 파일 경로 (Kotlin이 추출 후 전달)
 * - Node.js는 PORT:{n}\n을 stdout 첫 줄에 출력 (Kotlin이 읽음)
 * - 이후 stdout은 JSON-RPC 전용 (Node.js → Kotlin IDE native 요청)
 * - stderr는 로그 출력
 *
 * Browser (standalone) 모드: 기본값
 * - 고정 포트(19836) 사용 (PORT 환경변수로 오버라이드 가능)
 * - BrowserBridge 사용 (Vite dev server가 정적 파일 제공)
 *
 * 안전한 stdout 사용 순서:
 * 1. KotlinBridge 생성 (이 시점에는 stdout에 아무것도 쓰지 않음)
 * 2. WebSocket 서버 시작 (포트 확보)
 * 3. PORT:{port}\n 을 stdout에 출력 (Kotlin이 읽음)
 * 4. Kotlin이 http://localhost:{port} 로 JCEF 로드 → WebSocketConnector가 WS에 연결
 * → 레이스 컨디션 없음
 */

const isJetBrainsMode = process.env.JETBRAINS_MODE === 'true';

// JetBrains, 브라우저 모두 동일한 고정 포트 사용
// PORT 환경변수로 오버라이드 가능
const DEFAULT_PORT = 19836;
const requestedPort = parseInt(process.env.PORT ?? String(DEFAULT_PORT), 10);

// JetBrains 모드: Node.js가 WebView 정적 파일도 제공
// Kotlin이 WEBVIEW_DIR 환경변수를 통해 추출된 WebView 파일 경로를 전달
const webviewDir = isJetBrainsMode ? (process.env.WEBVIEW_DIR ?? undefined) : undefined;

function killProcessOnPort(port: number): void {
  try {
    const pids = execSync(`lsof -ti :${port}`, { encoding: 'utf8' }).trim();
    if (pids) {
      pids.split('\n').forEach((pid) => {
        try {
          execSync(`kill -9 ${pid.trim()}`);
          console.error('[node-backend]', `Killed process ${pid.trim()} occupying port ${port}`);
        } catch {
          // 이미 종료된 프로세스면 무시
        }
      });
    }
  } catch {
    // lsof가 아무 결과도 없으면 비정상 종료 코드 반환 — 무시
  }
}

async function startServerWithRetry(
  bridge: InstanceType<typeof BrowserBridge> | InstanceType<typeof JetBrainsBridge>,
): Promise<Awaited<ReturnType<typeof startWebSocketServer>>> {
  try {
    return await startWebSocketServer(requestedPort, bridge, handleMessage, webviewDir);
  } catch (err: unknown) {
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code !== 'EADDRINUSE') throw err;

    console.error('[node-backend]', `Port ${requestedPort} already in use. Killing existing process and retrying...`);
    killProcessOnPort(requestedPort);

    await new Promise((resolve) => setTimeout(resolve, 200));

    return await startWebSocketServer(requestedPort, bridge, handleMessage, webviewDir);
  }
}

async function main() {
  const bridge = isJetBrainsMode
    ? new JetBrainsBridge(process.stdout, process.stdin)
    : new BrowserBridge();

  const { port, close, connections } = await startServerWithRetry(bridge);

  if (isJetBrainsMode) {
    // PORT를 stdout 첫 줄에 출력 — Kotlin이 이를 읽고 JCEF에 http://localhost:PORT 를 로드
    // 이 시점 이후 stdout은 KotlinBridge JSON-RPC 전용
    process.stdout.write(`PORT:${port}\n`);
  }

  console.error(
    '[node-backend]',
    `Server started in ${isJetBrainsMode ? 'JetBrains' : 'browser'} mode on port ${port}`,
    webviewDir ? `(webviewDir: ${webviewDir})` : '',
  );

  function shutdown(signal: string) {
    console.error('[node-backend]', `${signal} received, shutting down...`);
    connections.shutdownAll();
    close();
    process.exit(0);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[node-backend]', 'Fatal error:', err);
  process.exit(1);
});
