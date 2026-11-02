import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import path from 'node:path';

/** Сервер игры; порт тот же, что читает сам сервер. */
const SERVER_URL = `http://localhost:${process.env['PORT'] ?? 3001}`;

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
    // Host не подменяем (changeOrigin: false): по нему сервер отличает
    // домашнюю сеть от туннеля и не пускает чужих в редактор. Строковая
    // запись прокси в Vite подменяла бы его на localhost.
    proxy: {
      '/api': { target: SERVER_URL, changeOrigin: false },
      '/uploads': { target: SERVER_URL, changeOrigin: false },
      '/socket.io': { target: SERVER_URL, ws: true, changeOrigin: false },
    },
  },
});
