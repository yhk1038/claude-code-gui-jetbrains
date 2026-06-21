import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

const backendPort = process.env.BACKEND_PORT ?? '19836';

// Only variables with these prefixes are exposed to client code via
// import.meta.env. An unprefixed value (e.g. a backend secret in the root .env)
// is never read here, so it can never reach the webview bundle. Prefix presence
// = browser exposure.
const ENV_PREFIX = ['VITE_', 'CCG_PUBLIC_'];

export default defineConfig(({ mode }) => {
  // build.sh exports BUILD_ENV and loads the root .env into process.env; loadEnv
  // picks up the prefixed keys from there. Falls back to vite's own mode when run
  // directly (e.g. `vite dev`). loadEnv only returns ENV_PREFIX vars.
  const effectiveMode = process.env.BUILD_ENV || mode;
  const env = loadEnv(effectiveMode, __dirname, ENV_PREFIX);

  return {
  envPrefix: ENV_PREFIX,
  define: {
    // Re-expose the prefix-filtered env as import.meta.env.* (vite's own mode is
    // left unchanged, so we inject explicitly).
    ...Object.fromEntries(
      Object.entries(env).map(([k, v]) => [`import.meta.env.${k}`, JSON.stringify(v)]),
    ),
  },
  plugins: [react()],
  base: '/',
  server: {
    host: true,
    port: 5173,
    allowedHosts: [
      '.trycloudflare.com',
    ],
    proxy: {
      // WebSocket 요청을 Node.js 백엔드로 프록시
      '/ws': {
        target: `ws://localhost:${backendPort}`,
        ws: true,
      },
      '/logs': {
        target: `ws://localhost:${backendPort}`,
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 10240,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        // JCEF 환경에서 dynamic chunk 로드 실패 방지: 단일 번들로 통합
        inlineDynamicImports: true,
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
  };
});
