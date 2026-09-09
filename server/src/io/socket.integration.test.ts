import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer, type Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { io as createClient, type Socket as ClientSocket } from 'socket.io-client';
import type {
  Ack,
  ClientToServerEvents,
  HostView,
  PlayerView,
  Result,
  ServerToClientEvents,
} from '@svoyak/shared';
import { demoClassicPack } from '../packs/demo/classic.js';

// Хранилище берёт пути из окружения на импорте — подменяем до загрузки модулей.
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'svoyak-io-'));
fs.mkdirSync(path.join(tempDir, 'packs'), { recursive: true });
fs.writeFileSync(
  path.join(tempDir, 'packs', 'demo-classic.json'),
  JSON.stringify(demoClassicPack),
  'utf8',
);
process.env['DATA_DIR'] = tempDir;

const { RoomManager } = await import('../room/RoomManager.js');
type AppServer = import('./types.js').AppServer;
const { registerSocketHandlers } = await import('./registerSocketHandlers.js');
const { saveRoom } = await import('../storage/roomsRepo.js');

type Client = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

let httpServer: HttpServer;
let port: number;
let rooms: InstanceType<typeof RoomManager>;

beforeAll(async () => {
  httpServer = createServer();
  const server: AppServer = new Server(httpServer);
  rooms = new RoomManager({ clientBaseUrl: () => 'http://test:5173' });
  registerSocketHandlers(server, rooms);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const address = httpServer.address();
  port = typeof address === 'object' && address ? address.port : 0;
});

afterAll(() => {
  httpServer.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function connect(): Promise<Client> {
  const socket: Client = createClient(`http://localhost:${port}`, { transports: ['websocket'] });
  return new Promise((resolve) => socket.on('connect', () => resolve(socket)));
}

/** Промис, который резолвится следующей присланной проекцией. */
function nextView<T>(socket: Client): Promise<T> {
  return new Promise((resolve) => socket.once('state:sync', (view) => resolve(view as T)));
}

/** Ждёт проекцию, удовлетворяющую условию. Проекций на одно действие может
 *  прилететь несколько, и «следующая» — не обязательно нужная. */
function viewWhere<T>(socket: Client, matches: (view: T) => boolean): Promise<T> {
  return new Promise((resolve) => {
    const listener = (view: unknown): void => {
      if (!matches(view as T)) return;
      socket.off('state:sync', listener);
      resolve(view as T);
    };
    socket.on('state:sync', listener);
  });
}

function emit<K extends keyof ClientToServerEvents, T>(
  socket: Client,
  event: K,
  payload?: Parameters<ClientToServerEvents[K]>[0],
): Promise<Result<T>> {
  return new Promise((resolve) => {
    const ack: Ack<T> = (result) => resolve(result);
    // События без параметров принимают только колбэк — лишний undefined съел бы его место.
    const send = socket.emit.bind(socket) as unknown as (e: K, ...args: unknown[]) => void;
    if (payload === undefined) send(event, ack);
    else send(event, payload, ack);
  });
}

describe('сокет-слой', () => {
  it('ведущий создаёт комнату и получает код', async () => {
    const host = await connect();
    const result = await emit<'room:create', { code: string; hostToken: string }>(
      host,
      'room:create',
      { packId: 'demo-classic' },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.code).toMatch(/^\d{4}$/);
    host.disconnect();
  });

  it('создание с несуществующим паком отклоняется', async () => {
    const host = await connect();
    const result = await emit(host, 'room:create', { packId: 'нет-такого' });
    expect(result).toEqual({ ok: false, error: 'Пак не найден' });
    host.disconnect();
  });

  it('игрок входит по коду и виден ведущему', async () => {
    const host = await connect();
    const created = await emit<'room:create', { code: string; hostToken: string }>(
      host,
      'room:create',
      { packId: 'demo-classic' },
    );
    if (!created.ok) throw new Error('комната не создана');

    const hostView = viewWhere<HostView>(host, (view) => view.players.length > 0);
    const player = await connect();
    const joined = await emit<'room:join', { playerId: string; sessionToken: string }>(
      player,
      'room:join',
      { code: created.data.code, name: 'Вася' },
    );
    expect(joined.ok).toBe(true);

    const view = await hostView;
    expect(view.players.map((p) => p.name)).toEqual(['Вася']);
    host.disconnect();
    player.disconnect();
  });

  it('комнату нельзя создать на недоделанном паке', async () => {
    const brokenPath = path.join(tempDir, 'packs', 'broken.json');
    fs.writeFileSync(
      brokenPath,
      JSON.stringify({
        ...demoClassicPack,
        id: 'broken',
        rounds: [
          {
            id: 'r1',
            title: 'Раунд',
            themes: [
              {
                id: 't1',
                title: 'Тема',
                questions: [
                  { id: 'q1', price: 100, type: 'normal', text: 'Вопрос?', answer: '', altAnswers: [] },
                ],
              },
            ],
          },
        ],
      }),
      'utf8',
    );

    const host = await connect();
    const result = await emit(host, 'room:create', { packId: 'broken' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('не готов');
    host.disconnect();
  });

  it('игрок не может выполнить действие ведущего', async () => {
    const host = await connect();
    const created = await emit<'room:create', { code: string; hostToken: string }>(
      host,
      'room:create',
      { packId: 'demo-classic' },
    );
    if (!created.ok) throw new Error('комната не создана');

    const player = await connect();
    const joined = await emit<'room:join', { playerId: string; sessionToken: string }>(
      player,
      'room:join',
      { code: created.data.code, name: 'Петя' },
    );
    if (!joined.ok) throw new Error('игрок не вошёл');

    const attempt = await emit(player, 'host:adjustScore', {
      playerId: joined.data.playerId,
      score: 999999,
    });
    expect(attempt).toEqual({ ok: false, error: 'Это действие доступно только ведущему' });

    const room = rooms.get(created.data.code);
    expect(room?.state.players[0]?.score).toBe(0);
    host.disconnect();
    player.disconnect();
  });

  it('игрок возвращается по токену со своим счётом после обрыва связи', async () => {
    const host = await connect();
    const created = await emit<'room:create', { code: string; hostToken: string }>(
      host,
      'room:create',
      { packId: 'demo-classic' },
    );
    if (!created.ok) throw new Error('комната не создана');
    const { code } = created.data;

    const player = await connect();
    const joined = await emit<'room:join', { playerId: string; sessionToken: string }>(
      player,
      'room:join',
      { code, name: 'Маша' },
    );
    if (!joined.ok) throw new Error('игрок не вошёл');

    await emit(host, 'host:adjustScore', { playerId: joined.data.playerId, score: 400 });
    player.disconnect();

    const again = await connect();
    // Подписка вешается до запроса: рассылка уходит сразу после подтверждения.
    const viewPromise = nextView<PlayerView>(again);
    const rejoin = await emit<'room:rejoin', { playerId: string | null; role: string }>(
      again,
      'room:rejoin',
      { code, token: joined.data.sessionToken, role: 'player' },
    );
    expect(rejoin.ok).toBe(true);

    const view = await viewPromise;
    expect(view.myScore).toBe(400);
    expect(view.meId).toBe(joined.data.playerId);
    host.disconnect();
    again.disconnect();
  });

  it('игрок не может судить и не может начать игру', async () => {
    const host = await connect();
    const created = await emit<'room:create', { code: string; hostToken: string }>(
      host,
      'room:create',
      { packId: 'demo-classic' },
    );
    if (!created.ok) throw new Error('комната не создана');

    const player = await connect();
    const joined = await emit<'room:join', { playerId: string; sessionToken: string }>(
      player,
      'room:join',
      { code: created.data.code, name: 'Судья' },
    );
    if (!joined.ok) throw new Error('игрок не вошёл');

    const judged = await emit(player, 'host:judge', { verdict: 'correct' });
    expect(judged).toEqual({ ok: false, error: 'Это действие доступно только ведущему' });
    host.disconnect();
    player.disconnect();
  });

  it('нажатие игрока доходит до сервера и определяет отвечающего', async () => {
    const host = await connect();
    const created = await emit<'room:create', { code: string; hostToken: string }>(
      host,
      'room:create',
      { packId: 'demo-classic' },
    );
    if (!created.ok) throw new Error('комната не создана');
    const { code } = created.data;

    const player = await connect();
    const joined = await emit<'room:join', { playerId: string; sessionToken: string }>(
      player,
      'room:join',
      { code, name: 'Быстрый' },
    );
    if (!joined.ok) throw new Error('игрок не вошёл');

    await emit(host, 'host:startGame');
    await emit(host, 'host:pickQuestion', { themeId: 'r1-kino', questionId: 'r1-kino-q1' });
    await emit(host, 'host:openBuzzer');

    const buzzed = await emit(player, 'player:buzz', {
      clientTime: Date.now(),
      clockOffset: 0,
      minRtt: 10,
    });
    expect(buzzed).toEqual({ ok: true, data: null });

    // Ждём закрытия окна сбора нажатий.
    await new Promise((resolve) => setTimeout(resolve, 400));
    const room = rooms.get(code);
    expect(room?.state.phase).toBe('answering');
    expect(room?.state.buzz.answeringPlayerId).toBe(joined.data.playerId);

    host.disconnect();
    player.disconnect();
  });

  it('верный ответ начисляет стоимость и передаёт право хода', async () => {
    const host = await connect();
    const created = await emit<'room:create', { code: string; hostToken: string }>(
      host,
      'room:create',
      { packId: 'demo-classic' },
    );
    if (!created.ok) throw new Error('комната не создана');
    const { code } = created.data;

    const player = await connect();
    const joined = await emit<'room:join', { playerId: string; sessionToken: string }>(
      player,
      'room:join',
      { code, name: 'Знаток' },
    );
    if (!joined.ok) throw new Error('игрок не вошёл');

    await emit(host, 'host:startGame');
    await emit(host, 'host:pickQuestion', { themeId: 'r1-kino', questionId: 'r1-kino-q3' });
    await emit(host, 'host:openBuzzer');
    await emit(player, 'player:buzz', { clientTime: Date.now(), clockOffset: 0, minRtt: 10 });
    await new Promise((resolve) => setTimeout(resolve, 400));

    const judged = await emit(host, 'host:judge', { verdict: 'correct' });
    expect(judged).toEqual({ ok: true, data: null });

    const room = rooms.get(code);
    expect(room?.state.players[0]?.score).toBe(300);
    expect(room?.state.controlPlayerId).toBe(joined.data.playerId);
    expect(room?.state.phase).toBe('picking');

    host.disconnect();
    player.disconnect();
  });

  it('игрок не получает правильный ответ по сети до раскрытия', async () => {
    const host = await connect();
    const created = await emit<'room:create', { code: string; hostToken: string }>(
      host,
      'room:create',
      { packId: 'demo-classic' },
    );
    if (!created.ok) throw new Error('комната не создана');

    const player = await connect();
    const views: string[] = [];
    player.on('state:sync', (view) => views.push(JSON.stringify(view)));
    await emit(player, 'room:join', { code: created.data.code, name: 'Слушатель' });

    await emit(host, 'host:startGame');
    await emit(host, 'host:pickQuestion', { themeId: 'r1-kino', questionId: 'r1-kino-q3' });
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(views.length).toBeGreaterThan(0);
    expect(views.join(' ')).not.toContain('Коппола');

    host.disconnect();
    player.disconnect();
  });

  it('комната восстанавливается с диска после перезапуска сервера', async () => {
    const host = await connect();
    const created = await emit<'room:create', { code: string; hostToken: string }>(
      host,
      'room:create',
      { packId: 'demo-classic' },
    );
    if (!created.ok) throw new Error('комната не создана');
    const { code } = created.data;

    const player = await connect();
    const joined = await emit<'room:join', { playerId: string; sessionToken: string }>(
      player,
      'room:join',
      { code, name: 'Гриша' },
    );
    if (!joined.ok) throw new Error('игрок не вошёл');
    await emit(host, 'host:adjustScore', { playerId: joined.data.playerId, score: 800 });

    const live = rooms.get(code);
    if (!live) throw new Error('комнаты нет в памяти');
    saveRoom(live.state);

    const restarted = new RoomManager({ clientBaseUrl: () => 'http://test:5173' });
    const count = restarted.restoreFromDisk();
    expect(count).toBeGreaterThan(0);

    const restoredRoom = restarted.get(code);
    expect(restoredRoom?.state.players[0]).toMatchObject({ name: 'Гриша', score: 800 });
    host.disconnect();
    player.disconnect();
  });
});

describe('состав игры', () => {
  const recipeOf = (themeIds: string[][], finalIds: string[]) => ({
    rounds: themeIds.map((round) => round.map((themeId) => ({ packId: 'demo-classic', themeId }))),
    final: finalIds.map((themeId) => ({ packId: 'demo-classic', themeId })),
  });

  it('создаёт комнату по рецепту, а не по целому паку', async () => {
    const host = await connect();
    const hostView = nextView<HostView>(host);
    const created = await emit<'room:create', { code: string; hostToken: string }>(
      host,
      'room:create',
      { recipe: recipeOf([['r1-kino', 'r2-history']], ['f-geo']) },
    );
    expect(created.ok).toBe(true);

    const view = await hostView;
    expect(view.board.map((theme) => theme.title)).toEqual(['Кино', 'История']);
    // Цены выровнены по сетке первого раунда, хотя «История» пришла из второго.
    expect(view.board[1]?.cells.map((cell) => cell.price)).toEqual([100, 200, 300, 400, 500]);
    host.disconnect();
  });

  it('рецепт с несуществующей темой отклоняется', async () => {
    const host = await connect();
    const result = await emit(host, 'room:create', {
      recipe: recipeOf([['нет-такой']], ['f-geo']),
    });
    expect(result.ok).toBe(false);
    host.disconnect();
  });

  it('ведущий меняет состав в лобби', async () => {
    const host = await connect();
    await emit(host, 'room:create', { recipe: recipeOf([['r1-kino']], ['f-geo']) });

    const hostView = viewWhere<HostView>(host, (view) => view.board.length === 2);
    const changed = await emit(host, 'host:setRecipe', {
      recipe: recipeOf([['r1-space', 'r1-food']], ['f-sport']),
    });

    expect(changed.ok).toBe(true);
    const view = await hostView;
    expect(view.board.map((theme) => theme.title)).toEqual(['Космос', 'Еда']);
    host.disconnect();
  });

  it('после старта состав менять нельзя', async () => {
    const host = await connect();
    const created = await emit<'room:create', { code: string; hostToken: string }>(
      host,
      'room:create',
      { recipe: recipeOf([['r1-kino']], ['f-geo']) },
    );
    if (!created.ok) throw new Error('комната не создалась');
    const player = await connect();
    await emit(player, 'room:join', { code: created.data.code, name: 'Вася' });
    await emit(host, 'host:startGame');

    const changed = await emit(host, 'host:setRecipe', {
      recipe: recipeOf([['r1-space']], ['f-sport']),
    });

    expect(changed).toEqual({ ok: false, error: 'Состав можно менять только до начала игры' });
    host.disconnect();
    player.disconnect();
  });

  it('игрок состав менять не может', async () => {
    const host = await connect();
    const created = await emit<'room:create', { code: string; hostToken: string }>(
      host,
      'room:create',
      { recipe: recipeOf([['r1-kino']], ['f-geo']) },
    );
    if (!created.ok) throw new Error('комната не создалась');
    const player = await connect();
    await emit(player, 'room:join', { code: created.data.code, name: 'Вася' });

    const changed = await emit(player, 'host:setRecipe', {
      recipe: recipeOf([['r1-space']], ['f-sport']),
    });

    expect(changed.ok).toBe(false);
    host.disconnect();
    player.disconnect();
  });
});
