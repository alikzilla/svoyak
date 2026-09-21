import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { createServer, type Server } from 'node:http';
import type { Game, GameResponse, GamesListResponse } from '@svoyak/shared';
import { GAME_LIMITS } from '@svoyak/shared';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'svoyak-games-api-'));
process.env['DATA_DIR'] = tempDir;
const { gamesRouter } = await import('./gamesApi.js');

let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use('/api', gamesRouter());
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  base = `http://localhost:${typeof address === 'object' && address ? address.port : 0}`;
});

afterAll(async () => {
  // close() ждёт живые соединения бесконечно; fetch держит keep-alive сокет
  // открытым, так что без closeAllConnections() и ожидания коллбэка хендл
  // сервера переживает тест и копится вместе с хендлами соседних файлов.
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
    server.closeAllConnections();
  });
  fs.rmSync(tempDir, { recursive: true, force: true });
});

const createGame = async (title = 'Вечеринка'): Promise<Game> => {
  const response = await fetch(`${base}/api/games`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  return ((await response.json()) as GameResponse).game;
};

describe('REST игр', () => {
  it('создаёт пустую игру с заголовком', async () => {
    const game = await createGame('Корпоратив');
    expect(game.title).toBe('Корпоратив');
    expect(game.recipe.rounds).toEqual([]);
    expect(game.modifiers).toEqual({ perRound: 0, kinds: [] });
  });

  it('созданная игра попадает в список', async () => {
    const game = await createGame('В списке');
    const response = await fetch(`${base}/api/games`);
    const body = (await response.json()) as GamesListResponse;
    expect(body.games.some((item) => item.id === game.id)).toBe(true);
  });

  it('сохраняет состав и план модификаторов', async () => {
    const game = await createGame();
    const updated: Game = {
      ...game,
      recipe: { rounds: [[{ packId: 'alpha', themeId: 't1' }]], final: [{ packId: 'alpha', themeId: 'f1' }] },
      modifiers: { perRound: 3, kinds: ['flip', 'swap'] },
    };
    const response = await fetch(`${base}/api/games/${game.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ game: updated }),
    });
    const body = (await response.json()) as GameResponse;
    expect(body.game.modifiers.perRound).toBe(3);
    expect(body.game.recipe.rounds[0]).toHaveLength(1);
  });

  it('не даёт телу запроса переписать идентификатор', async () => {
    const game = await createGame();
    const response = await fetch(`${base}/api/games/${game.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ game: { ...game, id: 'подделка' } }),
    });
    const body = (await response.json()) as GameResponse;
    expect(body.game.id).toBe(game.id);
  });

  it('отклоняет слишком много модификаторов на раунд', async () => {
    const game = await createGame();
    const response = await fetch(`${base}/api/games/${game.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ game: { ...game, modifiers: { perRound: 99, kinds: ['flip'] } } }),
    });
    expect(response.status).toBe(400);
  });

  it('отклоняет неизвестный вид модификатора', async () => {
    const game = await createGame();
    const response = await fetch(`${base}/api/games/${game.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ game: { ...game, modifiers: { perRound: 1, kinds: ['телепортация'] } } }),
    });
    expect(response.status).toBe(400);
  });

  it('удаляет игру', async () => {
    const game = await createGame();
    const removed = await fetch(`${base}/api/games/${game.id}`, { method: 'DELETE' });
    expect(removed.status).toBe(200);
    const missing = await fetch(`${base}/api/games/${game.id}`);
    expect(missing.status).toBe(404);
  });

  it('на несуществующую игру отвечает 404', async () => {
    const response = await fetch(`${base}/api/games/нет-такой`);
    expect(response.status).toBe(404);
  });

  it('нестроковый заголовок не роняет сервер, а откатывается к прежнему', async () => {
    const game = await createGame('Прежнее название');
    const response = await fetch(`${base}/api/games/${game.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ game: { ...game, title: 123 } }),
    });
    expect(response.status).not.toBe(500);
    expect(response.status).toBe(200);
    const body = (await response.json()) as GameResponse;
    expect(body.game.title).toBe('Прежнее название');
  });

  it('тело без объекта игры отклоняется с понятным текстом', async () => {
    const game = await createGame();
    const response = await fetch(`${base}/api/games/${game.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe('Ожидается объект игры');
  });

  it('отсутствующий состав отклоняется с понятным текстом', async () => {
    const game = await createGame();
    const response = await fetch(`${base}/api/games/${game.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ game: { ...game, recipe: null } }),
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe('В игре нет состава');
  });

  it('состав без массивов раундов и финала отклоняется с понятным текстом', async () => {
    const game = await createGame();
    const response = await fetch(`${base}/api/games/${game.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ game: { ...game, recipe: { rounds: 'не массив', final: [] } } }),
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe('Состав должен содержать раунды и финал');
  });

  it('слишком много раундов отклоняется с понятным текстом', async () => {
    const game = await createGame();
    const tooManyRounds = Array.from({ length: GAME_LIMITS.rounds[1] + 1 }, () => []);
    const response = await fetch(`${base}/api/games/${game.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ game: { ...game, recipe: { rounds: tooManyRounds, final: [] } } }),
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe(`Раундов не больше ${GAME_LIMITS.rounds[1]}`);
  });
});
