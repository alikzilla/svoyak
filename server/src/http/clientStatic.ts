import path from 'node:path';
import express, { type Express } from 'express';

/** Адреса, которые обслуживает сервер, а не приложение в браузере. */
const SERVER_PATHS = ['/api/', '/uploads/', '/socket.io/', '/assets/'];

/**
 * Собранный клиент с того же порта, что и API. Так игра идёт одним процессом
 * без Vite: телефон получает готовые чанки вместо сотен модулей дев-сервера,
 * а туннелю нужен один порт.
 *
 * Чанки с хэшем в имени кэшируются навсегда, index.html — нет: иначе после
 * пересборки телефон держался бы за старые чанки, которых уже нет.
 */
export function serveClient(app: Express, distDir: string): void {
  const indexHtml = path.join(distDir, 'index.html');

  app.use(
    express.static(distDir, {
      index: false,
      setHeaders: (res, filePath) => {
        const immutable = filePath.startsWith(path.join(distDir, 'assets') + path.sep);
        res.setHeader('Cache-Control', immutable ? 'public, max-age=31536000, immutable' : 'no-cache');
      },
    }),
  );

  // Остальные GET — экраны приложения: маршрутизация живёт в браузере.
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (SERVER_PATHS.some((prefix) => req.path.startsWith(prefix))) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexHtml);
  });
}
