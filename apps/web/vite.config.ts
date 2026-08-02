import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const alias = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@app': alias('./src/app'),
      '@pages': alias('./src/pages'),
      '@widgets': alias('./src/widgets'),
      '@features': alias('./src/features'),
      '@entities': alias('./src/entities'),
      '@shared': alias('./src/shared'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:3000',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/app/test/setup.ts'],
    restoreMocks: true,
    css: true,
  },
});
