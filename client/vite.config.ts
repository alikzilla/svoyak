import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwind()],
  resolve: {
    alias: {
      '@svoyak/shared': path.resolve(import.meta.dirname, '../shared/src/index.ts'),
    },
  },
  server: {
    host: true,
    port: 5173,
    // Через туннель Host-заголовок чужой, и Vite по умолчанию такие запросы отклоняет.
    allowedHosts: [
      'localhost',
      '.trycloudflare.com',
      '.ngrok-free.app',
      '.ngrok.io',
      '.loca.lt',
      ...(process.env['ALLOWED_HOSTS'] ?? '').split(',').filter((host) => host !== ''),
    ],
    proxy: {
      '/api': 'http://localhost:3001',
      '/uploads': 'http://localhost:3001',
      '/socket.io': { target: 'http://localhost:3001', ws: true },
    },
  },
});
