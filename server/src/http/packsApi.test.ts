import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { createServer, type Server } from 'node:http';
import type { Pack, PackResponse, PacksListResponse } from '@svoyak/shared';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'svoyak-api-'));
process.env['DATA_DIR'] = tempDir;
process.env['UPLOADS_DIR'] = path.join(tempDir, 'uploads');
const { packsRouter } = await import('./packsApi.js');

let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api', packsRouter());
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  base = `http://localhost:${typeof address === 'object' && address ? address.port : 0}`;
});

afterAll(() => {
  server.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

const createPack = async (title = 'Мой пак'): Promise<Pack> => {
  const response = await fetch(`${base}/api/packs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  const body = (await response.json()) as PackResponse;
  return body.pack;
};

describe('REST редактора', () => {
  it('создаёт пак с заготовкой раунда и финала', async () => {
    const pack = await createPack('Новогодний');
    expect(pack.id).toMatch(/^[a-zA-Z0-9_-]+$/);
    expect(pack.title).toBe('Новогодний');
    expect(pack.rounds.length).toBeGreaterThan(0);
    expect(pack.final.themes.length).toBeGreaterThan(0);
  });

  it('созданный пак виден в списке', async () => {
    const pack = await createPack('В списке');
    const response = await fetch(`${base}/api/packs`);
    const body = (await response.json()) as PacksListResponse;
    expect(body.packs.some((candidate) => candidate.id === pack.id)).toBe(true);
  });

  it('сохраняет пак целиком и читает обратно', async () => {
    const pack = await createPack();
    const updated: Pack = { ...pack, title: 'Переименованный' };
    updated.rounds[0]!.themes[0]!.title = 'Космос';

    const save = await fetch(`${base}/api/packs/${pack.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pack: updated }),
    });
    expect(save.status).toBe(200);

    const read = await fetch(`${base}/api/packs/${pack.id}`);
    const body = (await read.json()) as PackResponse;
    expect(body.pack.title).toBe('Переименованный');
    expect(body.pack.rounds[0]?.themes[0]?.title).toBe('Космос');
  });

  it('недоделанный пак сохраняется, но в ответе перечислены проблемы', async () => {
    const pack = await createPack();

    const response = await fetch(`${base}/api/packs/${pack.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pack }),
    });
    expect(response.status).toBe(200);

    const body = (await response.json()) as { issues: Array<{ level: string; message: string }> };
    // У заготовки ещё нет текстов вопросов — это ожидаемые ошибки, а не отказ.
    expect(body.issues.some((issue) => issue.level === 'error')).toBe(true);
  });

  it('пак без раундов и финала не принимается вовсе', async () => {
    const pack = await createPack();
    const response = await fetch(`${base}/api/packs/${pack.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pack: { title: 'Мусор' } }),
    });
    expect(response.status).toBe(400);
  });

  it('идентификатор с обходом каталога отвергается', async () => {
    const response = await fetch(`${base}/api/packs/..%2F..%2Fetc%2Fpasswd`);
    expect(response.status).toBe(404);
  });

  it('нельзя сохранить пак под чужим идентификатором из тела запроса', async () => {
    const first = await createPack('Первый');
    const second = await createPack('Второй');

    await fetch(`${base}/api/packs/${first.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pack: { ...second, title: 'Подмена' } }),
    });

    const read = await fetch(`${base}/api/packs/${second.id}`);
    const body = (await read.json()) as PackResponse;
    expect(body.pack.title).toBe('Второй');
  });

  it('удаляет пак', async () => {
    const pack = await createPack();
    const removed = await fetch(`${base}/api/packs/${pack.id}`, { method: 'DELETE' });
    expect(removed.status).toBe(200);

    const read = await fetch(`${base}/api/packs/${pack.id}`);
    expect(read.status).toBe(404);
  });
});
