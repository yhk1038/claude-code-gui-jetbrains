import { existsSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

// ── Rybbit 텔레메트리 설정 ──────────────────────────────
// HOST/SITE_ID는 비밀이 아니다 — 브라우저 추적 스크립트에도 그대로 노출되는
// 공개 식별자라 소스 상수로 둔다. API 키만 비밀이라 빌드 타임에 박제한다.
export const RYBBIT_HOST = 'https://ccg-telemetry.01republic.io';
export const RYBBIT_SITE_ID = '2a8b407c8941';
// 빌드 타임 박제 (.env의 `_` prefix 키): `_`로 시작하는 .env 키만 빌드 시
// esbuild define으로 번들에 리터럴 값으로 박힌다(런타임 process.env가 아니라
// 빌드 산출물에 치환). 언더스코어를 뗀 이름으로 export한다. esbuild가 치환하려면
// 반드시 `process.env._KEY`를 정적으로 직접 참조해야 한다(구조분해/동적 접근 X).
export const CCG_RYBBIT_API_KEY = process.env._CCG_RYBBIT_API_KEY ?? '';

// ── 빌드 환경 ──────────────────────────────────────────
export const isDev = () => process.env.NODE_ENV !== 'production';
export const isProd = () => process.env.NODE_ENV === 'production';

// ── 실행 환경 (런타임 주입) ─────────────────────────────
// 실행 주체(JetBrains=Kotlin spawn, standalone=ccg)가 주입한다. 이 키들은
// .env에 넣지 않는다 — `_`를 붙여 빌드 박제로 만들면 런타임 주입이 무력화된다.
export const isJetBrainsMode = process.env.JETBRAINS_MODE === 'true';
export const ccgClientInfo = process.env.CCG_CLIENT_INFO ?? '';

// ── 서버 설정 ──────────────────────────────────────────
const DEFAULT_PORT = 19836;
export const serverPort = parseInt(process.env.PORT ?? String(DEFAULT_PORT), 10);

// ── 재기동 신호 ─────────────────────────────────────────
// "플러그인 재기동"의 통일 신호. 프론트엔드 실행환경(브라우저 환경/JetBrains)이나
// 백엔드 관리 주체(Kotlin/ccg)와 무관하게, Node가 이 종료코드로 스스로 exit하면
// 그 Node를 spawn한 관리 주체가 같은 포트로 respawn한다. 분기 없는 단일 규칙.
//   - JetBrains: NodeProcessManager가 proc.waitFor()==이 값을 감지해 BackendInstance.restart()
//   - ccg standalone: cli/lib/spawn/foreground.sh가 wait 종료코드==이 값에서 respawn
//   - dev(be-dev, `node --watch`): self-exit는 자동 재시작하지 않으므로(파일 변경 시에만
//     재시작) 재기동은 best-effort다 — 개발 전용 한계이며 고객 경로(JetBrains/ccg)는 무관.
// 이 값을 바꾸면 cli/lib/spawn/foreground.sh의 동일 리터럴도 함께 바꿔야 한다.
export const RESTART_EXIT_CODE = 75;

function resolveWebviewDir(): string | undefined {
  if (process.env.WEBVIEW_DIR) return process.env.WEBVIEW_DIR;
  if (isJetBrainsMode) return undefined;

  // Browser 모드: backend/dist/backend.mjs 기준 ../../webview/dist
  const currentFile = fileURLToPath(import.meta.url);
  // backend/dist/backend.mjs → ../../webview/dist (루트 기준)
  const candidate = resolve(currentFile, '..', '..', '..', 'webview', 'dist');
  return existsSync(resolve(candidate, 'index.html')) ? candidate : undefined;
}

export const webviewDir = resolveWebviewDir();
