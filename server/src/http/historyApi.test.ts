import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { createServer, type Server } from 'node:http';
import type { HistoryResponse } from '@svoyak/shared';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'svoyak-history-api-'));
process.env['DATA_DIR'] = tempDir;
const { historyRouter } = await import('./historyApi.js');
const { saveResult } = await import('../storage/historyRepo.js');

let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use('/api', historyRouter());
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
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('GET /api/history', () => {
  it('пустая история — пустые списки', async () => {
    const body = (await (await fetch(`${base}/api/history`)).json()) as HistoryResponse;
    expect(body).toEqual({ evenings: [], fame: [] });
  });

  it('отдаёт вечера и зал славы', async () => {
    saveResult({
      id: '1-1111',
      code: '1111',
      packTitle: 'Коваль #1',
      startedAt: 1,
      finishedAt: 2,
      players: [
        { name: 'Аня', score: 900 },
        { name: 'Боря', score: 100 },
      ],
    });
    const body = (await (await fetch(`${base}/api/history`)).json()) as HistoryResponse;
    expect(body.evenings.map((evening) => evening.packTitle)).toEqual(['Коваль #1']);
    expect(body.fame[0]).toEqual({ name: 'Аня', games: 1, wins: 1, bestScore: 900 });
  });
});
