import { build } from 'esbuild';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));

// ─── Build-time env injection ───────────────────────────────────────────────
// The root .env is the single source: every key it defines is baked into the
// bundle. scripts/build.sh loads the root .env, exports its keys, and passes
// their names via BUILD_INJECT_KEYS so we know exactly which keys to inject
// (without sweeping in unrelated ambient env like PATH).
const injectKeys = (process.env.BUILD_INJECT_KEYS ?? '')
  .split(/\s+/)
  .filter(Boolean);

const injectedDefine = Object.fromEntries(
  injectKeys.map((key) => [
    `process.env.${key}`,
    JSON.stringify(process.env[key] ?? ''),
  ]),
);

await build({
  entryPoints: ['src/server.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile: 'dist/backend.mjs',
  sourcemap: true,
  minify: false,
  external: [],
  define: {
    '__PLUGIN_VERSION__': JSON.stringify(pkg.version),
    // Keys defined in the root .env, injected at build time — never committed
    // as source constants.
    ...injectedDefine,
  },
  banner: {
    js: `import { createRequire } from 'node:module';\nconst require = createRequire(import.meta.url);`,
  },
});

console.log('Backend bundled successfully');
