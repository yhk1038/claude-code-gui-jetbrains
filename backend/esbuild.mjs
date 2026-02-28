import { build } from 'esbuild';

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
});

console.log('Backend bundled successfully');
