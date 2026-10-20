import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  // ELK is ~1.5 MB; it is loaded from disk by the desktop app, not over the network.
  build: { chunkSizeWarningLimit: 2000 },
  // DOM tests (`// @vitest-environment happy-dom`) need Svelte's client build, not the server one.
  resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,
});
