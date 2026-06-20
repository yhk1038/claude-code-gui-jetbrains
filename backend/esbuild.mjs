import { build } from 'esbuild';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));

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
    // Telemetry API key injected at build time — never committed as a source constant.
    'process.env.CCG_RYBBIT_API_KEY': JSON.stringify(process.env.CCG_RYBBIT_API_KEY ?? ''),
  },
  banner: {
    js: `import { createRequire } from 'node:module';\nconst require = createRequire(import.meta.url);`,
  },
});

console.log('Backend bundled successfully');
