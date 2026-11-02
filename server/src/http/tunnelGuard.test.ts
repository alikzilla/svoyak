import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http, { createServer, type Server } from 'node:http';
import express from 'express';
import { isHomeHost, tunnelGuard } from './tunnelGuard.js';

describe('isHomeHost', () => {
  it.each([
    'localhost:5173',
    '127.0.0.1:3001',
    '192.168.1.199:5173',
    '10.0.0.5',
    '172.20.1.1:3001',
    'macbook.local:5173',
    '[::1]:3001',
  ])('%s — домашняя сеть', (host) => {
    expect(isHomeHost(host)).toBe(true);
  });

  it.each([
    'random-words.trycloudflare.com',
    'abc.ngrok-free.app',
    '172.32.0.1',
    '8.8.8.8:80',
    'localhost.evil.com',
    undefined,
  ])('%s — чужой адрес', (host) => {
    expect(isHomeHost(host)).toBe(false);
  });
});

let server: Server;
let port: number;

beforeAll(async () => {
  const app = express();
  app.use('/api', tunnelGuard());
  app.all('/api/{*rest}', (_req, res) => {
    res.json({ reached: true });
  });
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  port = typeof address === 'object' && address ? address.port : 0;
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
    server.closeAllConnections();
  });
});

/** fetch не даёт подменить Host, а туннель приходит именно с чужим Host. */
function request(method: string, path: string, host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = http.request({ port, path, method, headers: { host } }, (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    });
    req.on('error', reject);
    req.end();
  });
}

const TUNNEL = 'random-words.trycloudflare.com';

describe('tunnelGuard', () => {
  it('через туннель паки и игры не меняются', async () => {
    expect(await request('PUT', '/api/packs/abc', TUNNEL)).toBe(403);
    expect(await request('DELETE', '/api/packs/abc', TUNNEL)).toBe(403);
    expect(await request('POST', '/api/packs/import-siq', TUNNEL)).toBe(403);
    expect(await request('POST', '/api/games', TUNNEL)).toBe(403);
  });

  it('через туннель пак с ответами не читается', async () => {
    expect(await request('GET', '/api/packs/abc', TUNNEL)).toBe(403);
  });

  it('через туннель безобидное чтение работает', async () => {
    expect(await request('GET', '/api/health', TUNNEL)).toBe(200);
    expect(await request('GET', '/api/packs', TUNNEL)).toBe(200);
  });

  it('из домашней сети можно всё', async () => {
    expect(await request('PUT', '/api/packs/abc', `localhost:${port}`)).toBe(200);
    expect(await request('GET', '/api/packs/abc', '192.168.1.199:5173')).toBe(200);
  });
});
