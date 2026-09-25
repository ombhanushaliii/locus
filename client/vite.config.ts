import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  // One .env at the repo root; only VITE_* values reach the browser.
  envDir: path.resolve(here, '..'),
  resolve: {
    alias: { '@locus/shared': path.resolve(here, '../shared/src/index.ts') },
  },
  // MapLibre's worker is an ES module with its own imports; bundle it as one.
  worker: { format: 'es' },
  server: {
    port: 5173,
  },
});
