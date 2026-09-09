import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { createServer, type Server } from 'node:http';
import type { ComposeResponse, Pack, PackResponse, PacksListResponse } from '@svoyak/shared';

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

/** Наполняет пак темами: сборке игры нужно из чего выбирать. */
async function packWithThemes(title: string, themeTitles: string[]): Promise<Pack> {
  const created = await createPack(title);
  const filled: Pack = {
    ...created,
    rounds: [
      {
        id: `${created.id}-r1`,
        title: 'Первый раунд',
        themes: themeTitles.map((themeTitle, index) => ({
          id: `${created.id}-t${index + 1}`,
          title: themeTitle,
          questions: [100, 200, 300, 400, 500].map((price, questionIndex) => ({
            id: `${created.id}-t${index + 1}-q${questionIndex + 1}`,
            price,
            type: 'normal' as const,
            text: `вопрос ${questionIndex + 1}`,
            answer: `ответ ${questionIndex + 1}`,
            altAnswers: [],
          })),
        })),
      },
    ],
    final: {
      themes: [
        {
          id: `${created.id}-f1`,
          title: `Финал ${title}`,
          question: { id: `${created.id}-f1-q`, text: 'финал', answer: 'ответ', altAnswers: [] },
        },
      ],
    },
  };
  await fetch(`${base}/api/packs/${created.id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pack: filled }),
  });
  return filled;
}

const compose = async (body: unknown): Promise<Response> =>
  fetch(`${base}/api/compose`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('готовность пака к игре', () => {
  it('пустой пак помечен как непригодный, заполненный — как готовый', async () => {
    const blank = await createPack('Пустой');
    const ready = await packWithThemes('Готовый', ['Тема']);

    const list = (await (await fetch(`${base}/api/packs`)).json()) as PacksListResponse;
    const find = (id: string) => list.packs.find((pack) => pack.id === id);

    expect(find(blank.id)?.playable).toBe(false);
    expect(find(ready.id)?.playable).toBe(true);
  });
});

describe('сборка игры', () => {
  it('собирает состав из выбранных паков и возвращает названия тем', async () => {
    const first = await packWithThemes('Кино', ['Режиссёры', 'Оскар', 'Актёры']);
    const second = await packWithThemes('Музыка', ['Рок', 'Поп', 'Хип-хоп']);

    const response = await compose({
      packIds: [first.id, second.id],
      rounds: 2,
      themesPerRound: 3,
      finalThemes: 2,
      seed: 5,
    });
    const body = (await response.json()) as ComposeResponse;

    expect(response.status).toBe(200);
    expect(body.recipe.rounds).toHaveLength(2);
    expect(body.rounds[0]).toHaveLength(3);
    expect(body.final).toHaveLength(2);
    expect(body.rounds.flat().every((theme) => theme.title.length > 0)).toBe(true);
    expect(body.seed).toBe(5);
  });

  it('на тот же seed отдаёт тот же состав', async () => {
    const pack = await packWithThemes('Космос', ['Планеты', 'Звёзды', 'Луна', 'Марс']);
    const request = { packIds: [pack.id], rounds: 2, themesPerRound: 2, finalThemes: 1, seed: 99 };

    const first = (await (await compose(request)).json()) as ComposeResponse;
    const second = (await (await compose(request)).json()) as ComposeResponse;

    expect(second.recipe).toEqual(first.recipe);
  });

  it('объясняет нехватку тем понятным текстом', async () => {
    const pack = await packWithThemes('Мало', ['Одна']);

    const response = await compose({
      packIds: [pack.id],
      rounds: 3,
      themesPerRound: 4,
      finalThemes: 1,
    });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/не хватает тем/i);
  });

  it('отвергает запрос без паков', async () => {
    const response = await compose({ packIds: [], rounds: 2, themesPerRound: 3, finalThemes: 2 });
    expect(response.status).toBe(400);
  });

  it('отвергает бессмысленные числа', async () => {
    const pack = await packWithThemes('Числа', ['А', 'Б', 'В', 'Г']);
    const response = await compose({
      packIds: [pack.id],
      rounds: 0,
      themesPerRound: 3,
      finalThemes: 2,
    });
    expect(response.status).toBe(400);
  });
});
