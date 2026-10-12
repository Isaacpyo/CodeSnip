import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  // One .env at the repo root serves both Vite and docker compose.
  envDir: '../..',
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    sourcemap: true,
    // Monaco is lazy-loaded into its own chunk; it is big by nature.
    chunkSizeWarningLimit: 5000,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    restoreMocks: true,
  },
});
