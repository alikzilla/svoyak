import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(here, '../..');

export const PORT = Number(process.env['PORT'] ?? 3001);

/** `npm start`: сервер сам отдаёт собранный клиент, Vite не нужен. */
export const SERVE_CLIENT = process.env['NODE_ENV'] === 'production';
export const CLIENT_DIST = path.join(ROOT_DIR, 'client', 'dist');

/** Порт, на который ведут QR и ссылки: в дев-режиме — Vite, после сборки —
 *  сам сервер. */
export const CLIENT_PORT = Number(process.env['CLIENT_PORT'] ?? (SERVE_CLIENT ? PORT : 5173));

/** Внешний адрес клиента, если игра идёт через туннель: на него ведут ссылка и QR. */
export const PUBLIC_URL = (process.env['PUBLIC_URL'] ?? '').replace(/\/+$/, '');

export const DATA_DIR = process.env['DATA_DIR'] ?? path.join(ROOT_DIR, 'data');
export const PACKS_DIR = path.join(DATA_DIR, 'packs');
export const GAMES_DIR = path.join(DATA_DIR, 'games');
export const ROOMS_DIR = path.join(DATA_DIR, 'rooms');
export const HISTORY_DIR = path.join(DATA_DIR, 'history');
export const UPLOADS_DIR = process.env['UPLOADS_DIR'] ?? path.join(ROOT_DIR, 'uploads');
