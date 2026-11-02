import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import {
  CLIENT_DIST,
  CLIENT_PORT,
  GAMES_DIR,
  HISTORY_DIR,
  PACKS_DIR,
  PORT,
  PUBLIC_URL,
  ROOMS_DIR,
  SERVE_CLIENT,
  UPLOADS_DIR,
} from './config.js';
import { printBanner } from './net/banner.js';
import { getLanAddress } from './net/lan.js';
import { packsRouter } from './http/packsApi.js';
import { gamesRouter } from './http/gamesApi.js';
import { mediaRouter } from './http/mediaApi.js';
import { serveClient } from './http/clientStatic.js';
import { RoomManager } from './room/RoomManager.js';
import { registerSocketHandlers } from './io/registerSocketHandlers.js';
import type { AppServer } from './io/types.js';

for (const dir of [PACKS_DIR, GAMES_DIR, ROOMS_DIR, HISTORY_DIR, UPLOADS_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/api', packsRouter());
app.use('/api', gamesRouter());
app.use('/api', mediaRouter());
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

if (SERVE_CLIENT) {
  if (!fs.existsSync(path.join(CLIENT_DIST, 'index.html'))) {
    console.error('Клиент не собран: запустите `npm start` из корня проекта — он соберёт его сам.');
    process.exit(1);
  }
  serveClient(app, CLIENT_DIST);
}

const httpServer = createServer(app);
const io: AppServer = new Server(httpServer, { cors: { origin: true } });

/** Ссылки для игроков ведут на клиент. Через туннель — на внешний адрес,
 *  иначе на адрес в локальной сети. */
const clientBaseUrl = (): string => {
  if (PUBLIC_URL !== '') return PUBLIC_URL;
  const lan = getLanAddress();
  return `http://${lan ?? 'localhost'}:${CLIENT_PORT}`;
};

const rooms = new RoomManager({ clientBaseUrl });
const restored = rooms.restoreFromDisk();

registerSocketHandlers(io, rooms);

// Порт занят или недоступен — продолжать бессмысленно: выходим явно, иначе
// последний рубеж ниже проглотил бы ошибку и сервер завис бы молча.
httpServer.on('error', (error) => {
  console.error(`Сервер не запустился на порту ${PORT}:`, error.message);
  process.exit(1);
});

// Последний рубеж. Обработчики сокетов ловят свои ошибки сами, но таймеры
// комнат и отложенная запись на диск живут вне их. Одна такая ошибка не должна
// гасить сервер посреди вечера: редьюсер чистый, и состояние комнаты при
// исключении остаётся прежним.
process.on('uncaughtException', (error) => {
  console.error('[server] необработанная ошибка:', error);
});
process.on('unhandledRejection', (reason) => {
  console.error('[server] необработанный отказ промиса:', reason);
});

httpServer.listen(PORT, '0.0.0.0', () => {
  printBanner(CLIENT_PORT, PORT, PUBLIC_URL === '' ? null : PUBLIC_URL);
  if (restored > 0) console.log(`  Восстановлено комнат после перезапуска: ${restored}\n`);
});

const shutdown = (): void => {
  rooms.flushAll();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
