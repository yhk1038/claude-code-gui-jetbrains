// ── 빌드 환경 ──────────────────────────────────────────
export const isDev = () => process.env.NODE_ENV !== 'production';
export const isProd = () => process.env.NODE_ENV === 'production';

// ── 실행 환경 ──────────────────────────────────────────
export const isJetBrainsMode = process.env.JETBRAINS_MODE === 'true';

// ── 서버 설정 ──────────────────────────────────────────
const DEFAULT_PORT = 19836;
export const serverPort = parseInt(process.env.PORT ?? String(DEFAULT_PORT), 10);
export const webviewDir = isJetBrainsMode ? (process.env.WEBVIEW_DIR ?? undefined) : undefined;
