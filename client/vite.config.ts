import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  // One .env at the repo root; only the browser key and map ID are exposed to the client.
  envDir: path.resolve(here, '..'),
  envPrefix: ['VITE_', 'GOOGLE_MAPS_BROWSER_KEY', 'GOOGLE_MAPS_MAP_ID'],
  resolve: {
    alias: { '@locus/shared': path.resolve(here, '../shared/src/index.ts') },
  },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3001' },
  },
});
