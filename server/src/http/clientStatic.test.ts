import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { createServer, type Server } from 'node:http';
import { serveClient } from './clientStatic.js';

const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'svoyak-dist-'));
fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>svoyak-index</title>');
fs.mkdirSync(path.join(dist, 'assets'));
fs.writeFileSync(path.join(dist, 'assets', 'Play-abc123.js'), 'console.log(1)');

let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });
  serveClient(app, dist);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  base = `http://localhost:${typeof address === 'object' && address ? address.port : 0}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
    server.closeAllConnections();
  });
  fs.rmSync(dist, { recursive: true, force: true });
});

describe('собранный клиент с того же порта', () => {
  it('любой экран приложения отдаёт index.html — маршруты живут в браузере', async () => {
    const response = await fetch(`${base}/play`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('svoyak-index');
    expect(response.headers.get('cache-control')).toContain('no-cache');
  });

  it('чанки с хэшем в имени кэшируются навсегда', async () => {
    const response = await fetch(`${base}/assets/Play-abc123.js`);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('immutable');
  });

  it('API по-прежнему отвечает само', async () => {
    expect(await (await fetch(`${base}/api/health`)).json()).toEqual({ ok: true });
  });

  it('несуществующий адрес API, медиа или чанка — 404, а не страница приложения', async () => {
    for (const url of ['/api/nope', '/uploads/pack/missing.png', '/assets/gone-123.js']) {
      const response = await fetch(`${base}${url}`);
      expect(response.status, url).toBe(404);
      expect(await response.text(), url).not.toContain('svoyak-index');
    }
  });
});
