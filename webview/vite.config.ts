import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { devBridgePlugin } from './dev-bridge';

export default defineConfig({
  plugins: [react(), devBridgePlugin()],
  base: './',
  server: {
    hmr: false
  },
  build: {
    outDir: '../src/main/resources/webview',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
});
