import { build } from 'esbuild';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));

// ─── Build-time env injection ───────────────────────────────────────────────
// Build-time injection is opt-in via a leading underscore: only root-.env keys
// named `_FOO` are baked into the bundle. scripts/build.sh (and the gradle
// buildNodeBackend task) collect those `_`-prefixed key names into
// BUILD_INJECT_KEYS, so esbuild replaces `process.env._FOO` with the literal
// value. Plain keys stay runtime-only; nothing unrelated (PATH etc.) is swept in.
const injectKeys = (process.env.BUILD_INJECT_KEYS ?? '')
  .split(/\s+/)
  .filter(Boolean);

const injectedDefine = Object.fromEntries(
  injectKeys.map((key) => [
    `process.env.${key}`,
    JSON.stringify(process.env[key] ?? ''),
  ]),
);

// Shared esbuild options. Both the WebSocket server and the standalone account
// CLI are bundled with the SAME platform/format/banner so the account helper —
// which imports the same account-manager code (keychain via child_process under
// ESM needs the createRequire shim) — runs identically to the backend.
const common = {
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
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
    // Prepended verbatim to the top of every bundle, so these run before any
    // bundled module body (including the MCP SDK → eventsource-parser code below).
    js: [
      `import { createRequire } from 'node:module';`,
      `const require = createRequire(import.meta.url);`,
      // Web Streams globals (TransformStream/Readable/Writable) are only guaranteed
      // on the global scope in newer Node runtimes; older or non-standard nodes that
      // the plugin may end up launching expose them only on `node:stream/web`. The
      // bundled MCP SDK pulls in eventsource-parser, whose `class extends
      // TransformStream` is evaluated at module load — a missing global there kills
      // the backend before it can even print its PORT line (#159). Pull them from
      // the module and fill any gap so the bundle loads on any Node >= 16.5.
      `import { TransformStream as __ccgTransformStream, ReadableStream as __ccgReadableStream, WritableStream as __ccgWritableStream } from 'node:stream/web';`,
      `globalThis.TransformStream ??= __ccgTransformStream;`,
      `globalThis.ReadableStream ??= __ccgReadableStream;`,
      `globalThis.WritableStream ??= __ccgWritableStream;`,
    ].join('\n'),
  },
};

// Main backend (WebSocket server). Name stays `backend.mjs` — cli/lib/runtime.sh
// keys the runtime cache off it.
await build({ ...common, entryPoints: ['src/server.ts'], outfile: 'dist/backend.mjs' });

// Terminal account-switch helper, shipped beside backend.mjs in the standalone
// runtime and invoked by `ccg account …`.
await build({ ...common, entryPoints: ['src/cli/account.ts'], outfile: 'dist/account-cli.mjs' });

console.log('Backend bundled successfully');
