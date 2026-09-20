# Игры и клетки-модификаторы — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать ведущему сохранять собранную игру как отдельную сущность и добавить на доску клетки-модификаторы, под которыми нет вопроса — только эффект.

**Architecture:** Игра — это именованный `GameRecipe` (указатели на темы в паках) плюс план модификаторов; лежит в `data/games/<id>.json` и резолвится в обычный `Pack` существующей функцией `buildPackFromRecipe`. Раскладка модификаторов считается один раз при создании комнаты и хранится в `RoomState.modifierCells` явной картой `questionId → ModifierKind`. Движок остаётся чистым редьюсером: новая фаза `'modifier'`, новые действия, ни одного таймера внутри.

**Tech Stack:** TypeScript (strict, `exactOptionalPropertyTypes`), Node + Express + socket.io на сервере, React + React Router + Tailwind на клиенте, vitest для тестов.

**Spec:** `docs/superpowers/specs/2026-09-21-games-and-modifiers-design.md`

## Global Constraints

- Комментарии, названия и любой текст в интерфейсе — по-русски, как во всём проекте. Комментарий объясняет **почему**, а не **что**.
- Тесты запускаются из корня: `npx vitest run <путь>`. Vitest видит только `server/src/**/*.test.ts` и `shared/src/**/*.test.ts` — **клиентских тестов в проекте нет**, клиентские задачи проверяются `npm run typecheck` и глазами в браузере.
- `tsconfig.base.json` включает `exactOptionalPropertyTypes`, поэтому необязательное поле добавляется через спред: `...(value !== undefined ? { key: value } : {})`, а не `key: value ?? undefined`.
- Движок — чистая функция `reduce(state, action) → { state, effects }`. Никаких таймеров, сети и `Date.now()` внутри редьюсера: время приходит в действии полем `at`.
- Правильный ответ и модификатор — секреты. Всё, что уходит клиенту, собирается в `server/src/room/projections.ts`; ни одно поле не попадает в проекцию само по себе.
- После каждой задачи: `npx vitest run` и `npm run typecheck` должны быть зелёными целиком, а не только по изменённым файлам.
- Коммит на каждую задачу, сообщение в стиле репозитория: `feat(games): ...`, `feat(modifiers): ...`, `fix(...)`.
- Граница `perRound` — от 0 до 5 включительно. Джекпот — ровно 2000. Ограбление и щедрость — ровно 500.

## Карта файлов

**shared/** — общие типы, одинаковые на сервере и клиенте.

| Файл | Ответственность |
| --- | --- |
| `shared/src/modifiers.ts` *(новый)* | `ModifierKind`, список `MODIFIER_KINDS`, русские названия и описания для интерфейса |
| `shared/src/game.ts` *(новый)* | `GameMeta`, `Game`, `GameSummary`, `ModifierPlan`, `GAME_LIMITS` |
| `shared/src/index.ts` | реэкспорт двух новых модулей |
| `shared/src/state.ts` | `BoardCell.modifier`, `ModifierState`, `ModifierView`, `RoomState.modifierCells`, `Player.hints`, `PlayerPublic.hints`, фаза `'modifier'`, `TimerKind` `'modifier'`, промпт `modifier_swap` |
| `shared/src/settings.ts` | `modifierMs` |
| `shared/src/events.ts` | `CreateRoomPayload.gameId`, `player:modifierTarget`, `host:giveHint`, типы ответов `/api/games` |

**server/**

| Файл | Ответственность |
| --- | --- |
| `server/src/config.ts` | `GAMES_DIR` |
| `server/src/storage/gamesRepo.ts` *(новый)* | чтение, запись, удаление и список игр; обнаружение висячих ссылок |
| `server/src/http/gamesApi.ts` *(новый)* | REST `/api/games` |
| `server/src/engine/modifiers.ts` *(новый)* | `planModifierCells` (раскладка) и `applyModifier` (эффекты) — две чистые функции |
| `server/src/engine/board.ts` | `buildBoard` проставляет `modifier` клеткам |
| `server/src/engine/createRoom.ts` | `modifierCells` в начальном состоянии |
| `server/src/engine/actions.ts` | `MODIFIER_TARGET`, `GIVE_HINT` |
| `server/src/engine/reducer.ts` | ветка модификатора в `PICK_QUESTION`, фаза `'modifier'`, обработка новых действий |
| `server/src/room/projections.ts` | `projectBoard` срезает секрет, `ModifierView`, промпт `modifier_swap` |
| `server/src/room/RoomManager.ts` | принимает `modifierCells` при создании комнаты |
| `server/src/io/registerSocketHandlers.ts` | резолв `gameId`, новые сокет-события |
| `server/src/main.ts` | монтирование `gamesRouter`, создание `GAMES_DIR` |

**client/**

| Файл | Ответственность |
| --- | --- |
| `client/src/games/api.ts` *(новый)* | fetch-обёртки над `/api/games` |
| `client/src/games/ModifierPicker.tsx` *(новый)* | степпер `perRound` и восемь галочек |
| `client/src/games/GameBuilder.tsx` *(новый)* | конструктор одной игры |
| `client/src/routes/Games.tsx` *(новый)* | список игр и переключение на конструктор |
| `client/src/ui/scenes/ModifierScene.tsx` *(новый)* | сцена модификатора на доске |
| `client/src/main.tsx` | маршрут `/games` |
| `client/src/routes/Host.tsx` | выбор сохранённой игры над мастером |
| `client/src/routes/Board.tsx`, `client/src/routes/Play.tsx`, `client/src/ui/host/HostGame.tsx` | показ модификатора, выбор цели, кнопка подсказки |
| `client/src/ui/host/SettingsPanel.tsx` | `modifierMs` |

---

# Фаза 1 — Игры

## Task 1: Типы игры и хранилище

**Files:**
- Create: `shared/src/modifiers.ts`
- Create: `shared/src/game.ts`
- Modify: `shared/src/index.ts`
- Modify: `server/src/config.ts`
- Create: `server/src/storage/gamesRepo.ts`
- Test: `server/src/storage/gamesRepo.test.ts`

**Interfaces:**
- Consumes: `GameRecipe`, `ThemeRef` из `shared/src/recipe.ts`; `Pack` из `shared/src/pack.ts`.
- Produces: `ModifierKind`, `MODIFIER_KINDS`, `MODIFIER_TITLES`, `ModifierPlan`, `Game`, `GameSummary`, `GAME_LIMITS`; `getGame(id): Game | null`, `saveGame(game): void`, `deleteGame(id): void`, `listGames(lookup): GameSummary[]`, `summarizeGame(game, lookup): GameSummary`, где `lookup: (packId: string) => Pack | null`.

- [ ] **Step 1: Написать общие типы**

`shared/src/modifiers.ts`:

```ts
/** Клетки-модификаторы. Под такой клеткой нет вопроса: игрок открывает её,
 *  эффект срабатывает, и он выбирает следующую. */
export type ModifierKind =
  | 'flip'
  | 'jackpot'
  | 'nothing'
  | 'robbery'
  | 'double'
  | 'generosity'
  | 'hint'
  | 'swap';

/** Порядок фиксирован: по нему рисуются галочки в конструкторе. */
export const MODIFIER_KINDS: readonly ModifierKind[] = [
  'flip',
  'jackpot',
  'nothing',
  'robbery',
  'double',
  'generosity',
  'hint',
  'swap',
];

export const MODIFIER_TITLES: Record<ModifierKind, string> = {
  flip: 'Перевёртыш',
  jackpot: 'Джекпот',
  nothing: 'Пустышка',
  robbery: 'Ограбление',
  double: 'Удвоение',
  generosity: 'Щедрость',
  hint: 'Подсказка',
  swap: 'Обмен',
};

export const MODIFIER_HINTS: Record<ModifierKind, string> = {
  flip: 'твой счёт меняет знак',
  jackpot: '+2000 на счёт',
  nothing: 'ничего не происходит',
  robbery: 'отнимаешь 500 у лидера',
  double: 'твой счёт удваивается',
  generosity: 'отдаёшь по 500 каждому',
  hint: 'жетон подсказки от ведущего',
  swap: 'меняешься счётом с кем захочешь',
};

/** Ровно столько даёт джекпот и столько ходит в ограблении и щедрости. */
export const JACKPOT_AMOUNT = 2000;
export const TRANSFER_AMOUNT = 500;
```

`shared/src/game.ts`:

```ts
import type { GameRecipe } from './recipe.js';
import type { ModifierKind } from './modifiers.js';

/** Сколько клеток-модификаторов класть в раунд и какие виды разрешены.
 *  Пустой `kinds` означает то же, что `perRound: 0`. */
export interface ModifierPlan {
  perRound: number;
  kinds: ModifierKind[];
}

export interface GameMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

/** Игра — это состав вечера: указатели на темы в паках плюс план модификаторов.
 *  Содержимое не копируется: единственный источник вопросов — пак. */
export interface Game extends GameMeta {
  recipe: GameRecipe;
  modifiers: ModifierPlan;
}

/** Карточка игры для списка. `missingRefs` — темы, которые больше не
 *  резолвятся: пак удалили или тему из него вырезали. */
export interface GameSummary extends GameMeta {
  roundsCount: number;
  themesCount: number;
  finalThemesCount: number;
  modifiersPerRound: number;
  missingRefs: number;
  playable: boolean;
}

export const GAME_LIMITS = {
  rounds: [1, 5],
  themesPerRound: [1, 8],
  finalThemes: [1, 8],
  modifiersPerRound: [0, 5],
} as const;

export const EMPTY_MODIFIER_PLAN: ModifierPlan = { perRound: 0, kinds: [] };
```

В `shared/src/index.ts` добавить две строки рядом с существующими:

```ts
export * from './modifiers.js';
export * from './game.js';
```

В `server/src/config.ts` рядом с `PACKS_DIR`:

```ts
export const GAMES_DIR = path.join(DATA_DIR, 'games');
```

- [ ] **Step 2: Написать падающий тест хранилища**

Создать `server/src/storage/gamesRepo.test.ts`. Важно: `DATA_DIR` читается на импорте `config.ts`, поэтому переменная окружения ставится **до** динамического импорта — так же, как в `packsApi.test.ts`.

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Game, Pack } from '@svoyak/shared';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'svoyak-games-'));
process.env['DATA_DIR'] = tempDir;
const { deleteGame, getGame, listGames, saveGame, summarizeGame } = await import('./gamesRepo.js');

beforeAll(() => {
  fs.mkdirSync(path.join(tempDir, 'games'), { recursive: true });
});

afterAll(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

/** Пак с одной темой: для проверки ссылок содержимое вопросов не важно. */
const pack = (id: string, themeIds: string[]): Pack => ({
  id,
  title: `Пак ${id}`,
  createdAt: 1,
  updatedAt: 1,
  rounds: [
    {
      id: `${id}-r1`,
      title: 'Первый раунд',
      themes: themeIds.map((themeId) => ({ id: themeId, title: themeId, questions: [] })),
    },
  ],
  final: { themes: [{ id: `${id}-f1`, title: 'Финал', question: { id: `${id}-fq`, text: 'т', answer: 'о', altAnswers: [] } }] },
});

const library: Record<string, Pack> = { alpha: pack('alpha', ['t1', 't2']) };
const lookup = (id: string): Pack | null => library[id] ?? null;

const game = (over: Partial<Game> = {}): Game => ({
  id: 'g1',
  title: 'Вечеринка',
  createdAt: 10,
  updatedAt: 10,
  recipe: {
    rounds: [[{ packId: 'alpha', themeId: 't1' }, { packId: 'alpha', themeId: 't2' }]],
    final: [{ packId: 'alpha', themeId: 'alpha-f1' }],
  },
  modifiers: { perRound: 2, kinds: ['flip', 'jackpot'] },
  ...over,
});

describe('хранилище игр', () => {
  it('сохранённая игра читается обратно', () => {
    saveGame(game());
    expect(getGame('g1')?.title).toBe('Вечеринка');
  });

  it('не выпускает идентификатор за пределы папки', () => {
    expect(getGame('../packs/demo-classic')).toBeNull();
  });

  it('удалённая игра больше не читается', () => {
    saveGame(game({ id: 'g2' }));
    deleteGame('g2');
    expect(getGame('g2')).toBeNull();
  });

  it('считает состав для карточки', () => {
    const summary = summarizeGame(game(), lookup);
    expect(summary.roundsCount).toBe(1);
    expect(summary.themesCount).toBe(2);
    expect(summary.finalThemesCount).toBe(1);
    expect(summary.modifiersPerRound).toBe(2);
    expect(summary.missingRefs).toBe(0);
    expect(summary.playable).toBe(true);
  });

  it('замечает ссылку на удалённый пак', () => {
    const broken = game({
      recipe: {
        rounds: [[{ packId: 'omega', themeId: 't1' }]],
        final: [{ packId: 'alpha', themeId: 'alpha-f1' }],
      },
    });
    const summary = summarizeGame(broken, lookup);
    expect(summary.missingRefs).toBe(1);
    expect(summary.playable).toBe(false);
  });

  it('замечает ссылку на вырезанную тему', () => {
    const broken = game({
      recipe: {
        rounds: [[{ packId: 'alpha', themeId: 'no-such-theme' }]],
        final: [{ packId: 'alpha', themeId: 'alpha-f1' }],
      },
    });
    expect(summarizeGame(broken, lookup).missingRefs).toBe(1);
  });

  it('список отдаёт карточки всех сохранённых игр', () => {
    saveGame(game({ id: 'g3', title: 'Корпоратив' }));
    const titles = listGames(lookup).map((item) => item.title);
    expect(titles).toContain('Корпоратив');
  });
});
```

- [ ] **Step 3: Убедиться, что тест падает**

Run: `npx vitest run server/src/storage/gamesRepo.test.ts`
Expected: FAIL — `Cannot find module './gamesRepo.js'`.

- [ ] **Step 4: Написать хранилище**

`server/src/storage/gamesRepo.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';
import type { Game, GameSummary, Pack, ThemeRef } from '@svoyak/shared';
import { GAMES_DIR } from '../config.js';
import { readJson, writeJsonAtomic } from './atomicWrite.js';

/** Где искать пак по идентификатору. Параметром, чтобы карточку игры можно
 *  было посчитать в тесте без файлов на диске. */
export type PackLookup = (packId: string) => Pack | null;

const gameFile = (id: string): string => path.join(GAMES_DIR, `${id}.json`);

export function getGame(id: string): Game | null {
  // Идентификатор приходит от клиента: не даём выйти за пределы папки игр.
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) return null;
  return readJson<Game>(gameFile(id));
}

export function saveGame(game: Game): void {
  fs.mkdirSync(GAMES_DIR, { recursive: true });
  writeJsonAtomic(gameFile(game.id), game);
}

export function deleteGame(id: string): void {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) return;
  fs.rmSync(gameFile(id), { force: true });
}

/** Резолвится ли ссылка: тема раунда ищется среди тем всех раундов пака,
 *  финальная — среди финальных. */
function resolves(ref: ThemeRef, lookup: PackLookup, final: boolean): boolean {
  const pack = lookup(ref.packId);
  if (!pack) return false;
  if (final) return pack.final.themes.some((theme) => theme.id === ref.themeId);
  return pack.rounds.some((round) => round.themes.some((theme) => theme.id === ref.themeId));
}

export function summarizeGame(game: Game, lookup: PackLookup): GameSummary {
  const roundRefs = game.recipe.rounds.flat();
  let missingRefs = 0;
  for (const ref of roundRefs) if (!resolves(ref, lookup, false)) missingRefs += 1;
  for (const ref of game.recipe.final) if (!resolves(ref, lookup, true)) missingRefs += 1;

  return {
    id: game.id,
    title: game.title,
    createdAt: game.createdAt,
    updatedAt: game.updatedAt,
    roundsCount: game.recipe.rounds.length,
    themesCount: roundRefs.length,
    finalThemesCount: game.recipe.final.length,
    modifiersPerRound: game.modifiers.perRound,
    missingRefs,
    // Играть можно только целой игрой: потерянную тему ведущий должен увидеть
    // до гостей, а не обнаружить пустую клетку на доске.
    playable: missingRefs === 0 && roundRefs.length > 0 && game.recipe.final.length > 0,
  };
}

export function listGames(lookup: PackLookup): GameSummary[] {
  if (!fs.existsSync(GAMES_DIR)) return [];
  const games: GameSummary[] = [];
  for (const file of fs.readdirSync(GAMES_DIR)) {
    if (!file.endsWith('.json')) continue;
    const game = readJson<Game>(path.join(GAMES_DIR, file));
    if (game?.id) games.push(summarizeGame(game, lookup));
  }
  return games.sort((a, b) => b.updatedAt - a.updatedAt);
}
```

- [ ] **Step 5: Убедиться, что тесты проходят**

Run: `npx vitest run server/src/storage/gamesRepo.test.ts`
Expected: PASS, 7 тестов.

- [ ] **Step 6: Проверить весь проект**

Run: `npx vitest run && npm run typecheck`
Expected: всё зелёное.

- [ ] **Step 7: Коммит**

```bash
git add shared/src/modifiers.ts shared/src/game.ts shared/src/index.ts server/src/config.ts server/src/storage/gamesRepo.ts server/src/storage/gamesRepo.test.ts
git commit -m "feat(games): игра как сохранённый состав из паков"
```

---

## Task 2: REST для игр

**Files:**
- Create: `server/src/http/gamesApi.ts`
- Test: `server/src/http/gamesApi.test.ts`
- Modify: `server/src/main.ts`
- Modify: `shared/src/events.ts`

**Interfaces:**
- Consumes: `getGame`, `saveGame`, `deleteGame`, `listGames`, `summarizeGame` из Task 1; `getPack` из `server/src/storage/packsRepo.ts`; `draftRecipe` из `server/src/packs/compose.ts`.
- Produces: `gamesRouter(): Router`; типы ответов `GamesListResponse = { games: GameSummary[] }` и `GameResponse = { game: Game }` в `shared/src/events.ts`.

- [ ] **Step 1: Добавить типы ответов**

В `shared/src/events.ts`, рядом с существующими `PacksListResponse`/`PackResponse` (если их нет — добавить в конец файла):

```ts
export interface GamesListResponse {
  games: GameSummary[];
}

export interface GameResponse {
  game: Game;
}
```

И импорт в шапке файла:

```ts
import type { Game, GameSummary } from './game.js';
```

- [ ] **Step 2: Написать падающий тест REST**

Создать `server/src/http/gamesApi.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { createServer, type Server } from 'node:http';
import type { Game, GameResponse, GamesListResponse } from '@svoyak/shared';

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

afterAll(() => {
  server.close();
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
});
```

- [ ] **Step 3: Убедиться, что тест падает**

Run: `npx vitest run server/src/http/gamesApi.test.ts`
Expected: FAIL — `Cannot find module './gamesApi.js'`.

- [ ] **Step 4: Написать роутер**

`server/src/http/gamesApi.ts`:

```ts
import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import type { Game, ModifierPlan } from '@svoyak/shared';
import { GAME_LIMITS, MODIFIER_KINDS } from '@svoyak/shared';
import { getPack } from '../storage/packsRepo.js';
import { deleteGame, getGame, listGames, saveGame } from '../storage/gamesRepo.js';

const MAX_TITLE = 80;

/** Проверяем план здесь, чтобы кривой запрос не дошёл до раскладки клеток. */
function readPlan(raw: unknown): ModifierPlan | string {
  if (typeof raw !== 'object' || raw === null) return 'Ожидается план модификаторов';
  const plan = raw as Record<string, unknown>;
  const perRound = plan['perRound'];
  const [min, max] = GAME_LIMITS.modifiersPerRound;
  if (typeof perRound !== 'number' || !Number.isInteger(perRound) || perRound < min || perRound > max) {
    return `Модификаторов на раунд должно быть от ${min} до ${max}`;
  }
  const kinds = plan['kinds'];
  if (!Array.isArray(kinds)) return 'Ожидается список видов модификаторов';
  for (const kind of kinds) {
    if (typeof kind !== 'string' || !MODIFIER_KINDS.includes(kind as never)) {
      return `Неизвестный модификатор: ${String(kind)}`;
    }
  }
  return { perRound, kinds: kinds as ModifierPlan['kinds'] };
}

/** REST игр. Игра живёт без запущенной комнаты, как и пак. */
export function gamesRouter(): Router {
  const router = Router();

  router.get('/games', (_req, res) => {
    res.json({ games: listGames(getPack) });
  });

  router.get('/games/:id', (req, res) => {
    const game = getGame(req.params.id);
    if (!game) {
      res.status(404).json({ error: 'Игра не найдена' });
      return;
    }
    res.json({ game });
  });

  router.post('/games', (req, res) => {
    const body: unknown = req.body;
    const title =
      typeof body === 'object' && body !== null && 'title' in body && typeof body.title === 'string'
        ? body.title.trim().slice(0, MAX_TITLE)
        : '';
    const now = Date.now();
    const game: Game = {
      id: `game-${randomUUID().slice(0, 8)}`,
      title: title === '' ? 'Новая игра' : title,
      createdAt: now,
      updatedAt: now,
      recipe: { rounds: [], final: [] },
      modifiers: { perRound: 0, kinds: [] },
    };
    saveGame(game);
    res.status(201).json({ game });
  });

  router.put('/games/:id', (req, res) => {
    const existing = getGame(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Игра не найдена' });
      return;
    }

    const body: unknown = req.body;
    const incoming =
      typeof body === 'object' && body !== null && 'game' in body ? (body.game as Game) : null;
    if (!incoming || typeof incoming !== 'object') {
      res.status(400).json({ error: 'Ожидается объект игры' });
      return;
    }
    if (typeof incoming.recipe !== 'object' || incoming.recipe === null) {
      res.status(400).json({ error: 'В игре нет состава' });
      return;
    }
    if (!Array.isArray(incoming.recipe.rounds) || !Array.isArray(incoming.recipe.final)) {
      res.status(400).json({ error: 'Состав должен содержать раунды и финал' });
      return;
    }
    if (incoming.recipe.rounds.length > GAME_LIMITS.rounds[1]) {
      res.status(400).json({ error: `Раундов не больше ${GAME_LIMITS.rounds[1]}` });
      return;
    }

    const plan = readPlan(incoming.modifiers);
    if (typeof plan === 'string') {
      res.status(400).json({ error: plan });
      return;
    }

    // Идентификатор берём из адреса: тело запроса не должно уметь писать в чужой файл.
    const game: Game = {
      ...incoming,
      id: existing.id,
      title: (incoming.title ?? '').trim().slice(0, MAX_TITLE) || existing.title,
      createdAt: existing.createdAt,
      updatedAt: Date.now(),
      modifiers: plan,
    };
    saveGame(game);
    res.json({ game });
  });

  router.delete('/games/:id', (req, res) => {
    if (!getGame(req.params.id)) {
      res.status(404).json({ error: 'Игра не найдена' });
      return;
    }
    deleteGame(req.params.id);
    res.json({ ok: true });
  });

  return router;
}
```

- [ ] **Step 5: Убедиться, что тесты проходят**

Run: `npx vitest run server/src/http/gamesApi.test.ts`
Expected: PASS, 8 тестов.

- [ ] **Step 6: Подключить роутер к приложению**

В `server/src/main.ts`: добавить `GAMES_DIR` в импорт из `./config.js` и в массив создаваемых папок, импортировать `gamesRouter` рядом с `packsRouter` и смонтировать его:

```ts
app.use('/api', gamesRouter());
```

- [ ] **Step 7: Проверить весь проект**

Run: `npx vitest run && npm run typecheck`
Expected: всё зелёное.

- [ ] **Step 8: Коммит**

```bash
git add shared/src/events.ts server/src/http/gamesApi.ts server/src/http/gamesApi.test.ts server/src/main.ts
git commit -m "feat(games): REST для сохранённых игр"
```

---

## Task 3: Создание комнаты по сохранённой игре

**Files:**
- Modify: `shared/src/events.ts:18-22` (`CreateRoomPayload`)
- Modify: `server/src/io/registerSocketHandlers.ts:111-123` (`room:create`)
- Test: `server/src/io/socket.integration.test.ts`

**Interfaces:**
- Consumes: `getGame` (Task 1), `buildPackFromRecipe` из `server/src/packs/compose.ts`, `getPack` из `packsRepo`.
- Produces: `room:create` принимает `{ gameId }`; комната создаётся из состава игры. План модификаторов на этом шаге **не применяется** — он подключается в Task 12.

- [ ] **Step 1: Расширить контракт**

В `shared/src/events.ts`:

```ts
export interface CreateRoomPayload {
  packId?: string;
  recipe?: GameRecipe;
  /** Сохранённая игра: сервер сам достанет из неё состав. */
  gameId?: string;
  settings?: Partial<RoomSettings>;
}
```

- [ ] **Step 2: Написать падающий тест**

В `server/src/io/socket.integration.test.ts` добавить тест в подходящий `describe`. Он использует уже имеющиеся в файле помощники подключения; если помощник называется иначе, взять тот, которым пользуются соседние тесты создания комнаты.

```ts
it('создаёт комнату по сохранённой игре', async () => {
  const { saveGame } = await import('../storage/gamesRepo.js');
  const { getPack } = await import('../storage/packsRepo.js');
  const pack = getPack('demo-classic');
  if (!pack) throw new Error('Для теста нужен пак demo-classic');
  const theme = pack.rounds[0]?.themes[0];
  const finalTheme = pack.final.themes[0];
  if (!theme || !finalTheme) throw new Error('Пак demo-classic неожиданно пуст');

  saveGame({
    id: 'game-test',
    title: 'Тестовая игра',
    createdAt: 1,
    updatedAt: 1,
    recipe: {
      rounds: [[{ packId: pack.id, themeId: theme.id }]],
      final: [{ packId: pack.id, themeId: finalTheme.id }],
    },
    modifiers: { perRound: 0, kinds: [] },
  });

  const host = connect();
  const created = await emit(host, 'room:create', { gameId: 'game-test' });
  expect(created.ok).toBe(true);

  const room = rooms.get(created.data.code);
  expect(room?.state.pack.rounds).toHaveLength(1);
  expect(room?.state.board[0]?.title).toBe(theme.title);
  host.disconnect();
});

it('отказывает по несуществующей игре', async () => {
  const host = connect();
  const created = await emit(host, 'room:create', { gameId: 'game-нет' });
  expect(created.ok).toBe(false);
  host.disconnect();
});
```

- [ ] **Step 3: Убедиться, что тест падает**

Run: `npx vitest run server/src/io/socket.integration.test.ts`
Expected: FAIL — комната создаётся из демо-пака целиком либо `room:create` отвечает ошибкой «не выбран пак».

- [ ] **Step 4: Научить `room:create` понимать `gameId`**

В `server/src/io/registerSocketHandlers.ts` найти функцию `resolvePack` (её вызывает обработчик `room:create` на строке 112) и добавить в неё ветку игры **первой**, до `recipe` и `packId`:

```ts
if (gameId !== undefined) {
  const game = getGame(gameId);
  if (!game) return 'Игра не найдена';
  const summary = summarizeGame(game, getPack);
  if (!summary.playable) return 'В игре потерялись темы: откройте её и почините состав';
  try {
    return buildPackFromRecipe(game.recipe, getPack);
  } catch (cause) {
    return cause instanceof Error ? cause.message : 'Не удалось собрать игру';
  }
}
```

Пробросить `gameId` из деструктуризации обработчика:

```ts
socket.on('room:create', ({ packId, recipe, gameId, settings }, ack) => {
  const pack = resolvePack({ packId, recipe, gameId });
```

и добавить импорты `getGame`, `summarizeGame` из `../storage/gamesRepo.js`.

- [ ] **Step 5: Убедиться, что тесты проходят**

Run: `npx vitest run server/src/io/socket.integration.test.ts`
Expected: PASS.

- [ ] **Step 6: Проверить весь проект**

Run: `npx vitest run && npm run typecheck`

- [ ] **Step 7: Коммит**

```bash
git add shared/src/events.ts server/src/io/registerSocketHandlers.ts server/src/io/socket.integration.test.ts
git commit -m "feat(games): комната создаётся по сохранённой игре"
```

---

## Task 4: Страница `/games` — список и конструктор

**Files:**
- Create: `client/src/games/api.ts`
- Create: `client/src/games/ModifierPicker.tsx`
- Create: `client/src/games/GameBuilder.tsx`
- Create: `client/src/routes/Games.tsx`
- Modify: `client/src/main.tsx`
- Modify: `client/src/routes/Landing.tsx`

**Interfaces:**
- Consumes: `GameSummary`, `Game`, `ModifierPlan`, `MODIFIER_KINDS`, `MODIFIER_TITLES`, `MODIFIER_HINTS`, `GAME_LIMITS` (Task 1); `composeGame` из `client/src/net/gameApi.ts`; `listPacks` из `client/src/editor/api.ts`.
- Produces: маршрут `/games`; компонент `ModifierPicker` — позже переиспользуется в мастере на `/host`.

**Проверка:** клиентских тестов в проекте нет. Задача считается сделанной, когда `npm run typecheck` зелёный и страница работает руками: создать игру, собрать состав, включить модификаторы, перезагрузить страницу, увидеть сохранённое.

- [ ] **Step 1: Написать клиент REST**

`client/src/games/api.ts`:

```ts
import type { Game, GameResponse, GamesListResponse } from '@svoyak/shared';

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => ({}));
    const message =
      typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string'
        ? body.error
        : `Ошибка ${response.status}`;
    throw new Error(message);
  }
  return (await response.json()) as T;
}

export const listGames = async (): Promise<GamesListResponse['games']> =>
  (await json<GamesListResponse>(await fetch('/api/games'))).games;

export const fetchGame = async (id: string): Promise<Game> =>
  (await json<GameResponse>(await fetch(`/api/games/${id}`))).game;

export const createGame = async (title: string): Promise<Game> =>
  (
    await json<GameResponse>(
      await fetch('/api/games', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title }),
      }),
    )
  ).game;

export const saveGame = async (game: Game): Promise<Game> =>
  (
    await json<GameResponse>(
      await fetch(`/api/games/${game.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ game }),
      }),
    )
  ).game;

export const removeGame = async (id: string): Promise<void> => {
  await json<{ ok: true }>(await fetch(`/api/games/${id}`, { method: 'DELETE' }));
};
```

- [ ] **Step 2: Написать выбор модификаторов**

`client/src/games/ModifierPicker.tsx`:

```tsx
import type { ModifierPlan } from '@svoyak/shared';
import { GAME_LIMITS, MODIFIER_HINTS, MODIFIER_KINDS, MODIFIER_TITLES } from '@svoyak/shared';

interface ModifierPickerProps {
  plan: ModifierPlan;
  onChange: (plan: ModifierPlan) => void;
}

const [MIN, MAX] = GAME_LIMITS.modifiersPerRound;

/** Сколько клеток-модификаторов в раунде и какие виды могут выпасть.
 *  Под такой клеткой нет вопроса, поэтому она съедает вопрос из раунда. */
export function ModifierPicker({ plan, onChange }: ModifierPickerProps) {
  const setPerRound = (next: number): void =>
    onChange({ ...plan, perRound: Math.min(MAX, Math.max(MIN, next)) });

  const toggle = (kind: (typeof MODIFIER_KINDS)[number]): void =>
    onChange({
      ...plan,
      kinds: plan.kinds.includes(kind)
        ? plan.kinds.filter((item) => item !== kind)
        : [...plan.kinds, kind],
    });

  return (
    <section className="ink-border bg-card text-ink grid gap-3 rounded-2xl p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="font-body text-sm font-bold">Модификаторов на раунд</span>
        <span className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Модификаторов меньше"
            onClick={() => setPerRound(plan.perRound - 1)}
            className="ink-border size-8 rounded-lg font-black"
          >
            −
          </button>
          <span className="font-pop w-6 text-center text-xl font-black tabular-nums">
            {plan.perRound}
          </span>
          <button
            type="button"
            aria-label="Модификаторов больше"
            onClick={() => setPerRound(plan.perRound + 1)}
            className="ink-border size-8 rounded-lg font-black"
          >
            +
          </button>
        </span>
      </div>

      {plan.perRound > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {MODIFIER_KINDS.map((kind) => (
            <label key={kind} className="font-body flex items-start gap-2 text-sm font-bold">
              <input
                type="checkbox"
                className="mt-1 size-4"
                checked={plan.kinds.includes(kind)}
                onChange={() => toggle(kind)}
              />
              <span>
                {MODIFIER_TITLES[kind]}
                <span className="block text-xs font-bold opacity-60">{MODIFIER_HINTS[kind]}</span>
              </span>
            </label>
          ))}
        </div>
      )}

      {plan.perRound > 0 && plan.kinds.length === 0 && (
        <p className="font-body text-bad text-xs font-bold">
          Ни один вид не включён — модификаторов не будет
        </p>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Написать конструктор игры**

`client/src/games/GameBuilder.tsx`. Состав набирается тем же вызовом `composeGame`, что и мастер на `/host`: сервер знает, какие паки лежат на диске.

```tsx
import { useCallback, useEffect, useState } from 'react';
import type { ComposeResponse, Game, PackSummary } from '@svoyak/shared';
import { composeGame } from '../net/gameApi.js';
import { saveGame } from './api.js';
import { ModifierPicker } from './ModifierPicker.js';

interface GameBuilderProps {
  game: Game;
  packs: PackSummary[];
  onSaved: (game: Game) => void;
  onClose: () => void;
}

/** Конструктор одной игры: паки → состав → модификаторы → сохранить. */
export function GameBuilder({ game, packs, onSaved, onClose }: GameBuilderProps) {
  const [title, setTitle] = useState(game.title);
  const [selected, setSelected] = useState<string[]>(() =>
    packs.filter((pack) => pack.playable).slice(0, 3).map((pack) => pack.id),
  );
  const [rounds, setRounds] = useState(Math.max(1, game.recipe.rounds.length || 2));
  const [themesPerRound, setThemesPerRound] = useState(
    Math.max(1, game.recipe.rounds[0]?.length ?? 4),
  );
  const [finalThemes, setFinalThemes] = useState(Math.max(1, game.recipe.final.length || 3));
  const [modifiers, setModifiers] = useState(game.modifiers);
  const [draft, setDraft] = useState<ComposeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const compose = useCallback(() => {
    if (selected.length === 0) {
      setDraft(null);
      setError('Выберите хотя бы один пак');
      return;
    }
    setBusy(true);
    composeGame({ packIds: selected, rounds, themesPerRound, finalThemes })
      .then((response) => {
        setDraft(response);
        setError(null);
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Не удалось собрать состав'),
      )
      .finally(() => setBusy(false));
  }, [selected, rounds, themesPerRound, finalThemes]);

  useEffect(compose, [compose]);

  const togglePack = (id: string): void =>
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );

  const save = (): void => {
    if (!draft) return;
    setBusy(true);
    saveGame({ ...game, title: title.trim() || 'Новая игра', recipe: draft.recipe, modifiers })
      .then(onSaved)
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Не удалось сохранить игру'),
      )
      .finally(() => setBusy(false));
  };

  return (
    <div className="grid gap-4">
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Название игры"
        className="ink-border bg-card text-ink font-pop rounded-2xl px-4 py-3 text-xl font-black"
      />

      <section className="ink-border bg-card text-ink grid gap-2 rounded-2xl p-4">
        <span className="font-body text-sm font-bold">Из каких паков</span>
        <div className="grid gap-1 sm:grid-cols-2">
          {packs.map((pack) => (
            <label key={pack.id} className="font-body flex items-center gap-2 text-sm font-bold">
              <input
                type="checkbox"
                className="size-4"
                disabled={!pack.playable}
                checked={selected.includes(pack.id)}
                onChange={() => togglePack(pack.id)}
              />
              <span className={pack.playable ? '' : 'opacity-40'}>{pack.title}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="ink-border bg-card text-ink grid gap-3 rounded-2xl p-4 sm:grid-cols-3">
        <label className="font-body grid gap-1 text-sm font-bold">
          <span>Раундов</span>
          <input
            type="number"
            min={1}
            max={5}
            value={rounds}
            onChange={(event) => setRounds(Number(event.target.value) || 1)}
            className="ink-border bg-paper rounded-xl px-3 py-2 tabular-nums"
          />
        </label>
        <label className="font-body grid gap-1 text-sm font-bold">
          <span>Тем в раунде</span>
          <input
            type="number"
            min={1}
            max={8}
            value={themesPerRound}
            onChange={(event) => setThemesPerRound(Number(event.target.value) || 1)}
            className="ink-border bg-paper rounded-xl px-3 py-2 tabular-nums"
          />
        </label>
        <label className="font-body grid gap-1 text-sm font-bold">
          <span>Тем в финале</span>
          <input
            type="number"
            min={1}
            max={8}
            value={finalThemes}
            onChange={(event) => setFinalThemes(Number(event.target.value) || 1)}
            className="ink-border bg-paper rounded-xl px-3 py-2 tabular-nums"
          />
        </label>
      </section>

      <ModifierPicker plan={modifiers} onChange={setModifiers} />

      {draft && (
        <section className="ink-border bg-card text-ink grid gap-2 rounded-2xl p-4">
          {draft.rounds.map((round, index) => (
            <p key={index} className="font-body text-sm font-bold">
              Раунд {index + 1}: {round.map((theme) => theme.title).join(', ')}
            </p>
          ))}
          <p className="font-body text-sm font-bold opacity-70">
            Финал: {draft.final.map((theme) => theme.title).join(', ')}
          </p>
        </section>
      )}

      {error && <p className="font-body text-bad text-sm font-bold">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={compose}
          disabled={busy}
          className="ink-border bg-card font-body rounded-2xl px-4 py-2 text-sm font-bold"
        >
          Пересобрать состав
        </button>
        <button
          type="button"
          onClick={save}
          disabled={busy || !draft}
          className="ink-border bg-gold font-body rounded-2xl px-4 py-2 text-sm font-bold"
        >
          Сохранить игру
        </button>
        <button
          type="button"
          onClick={onClose}
          className="font-body text-sm font-bold underline underline-offset-4 opacity-70"
        >
          закрыть
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Написать страницу со списком**

`client/src/routes/Games.tsx`:

```tsx
import { useEffect, useState } from 'react';
import type { Game, GameSummary, PackSummary } from '@svoyak/shared';
import { Screen } from '../ui/Screen.js';
import { listPacks } from '../editor/api.js';
import { createGame, fetchGame, listGames, removeGame } from '../games/api.js';
import { GameBuilder } from '../games/GameBuilder.js';

/** Игры: пак — это содержимое, игра — состав вечера, собранный из паков. */
export default function Games() {
  const [games, setGames] = useState<GameSummary[]>([]);
  const [packs, setPacks] = useState<PackSummary[]>([]);
  const [editing, setEditing] = useState<Game | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = (): void => {
    listGames().then(setGames).catch(() => setError('Не удалось загрузить игры'));
  };

  useEffect(() => {
    reload();
    listPacks().then(setPacks).catch(() => setError('Не удалось загрузить паки'));
  }, []);

  const add = (): void => {
    createGame('Новая игра').then(setEditing).catch(() => setError('Не удалось создать игру'));
  };

  return (
    <Screen>
      <div className="mx-auto grid w-full max-w-4xl gap-4 p-4">
        <h1 className="font-pop text-3xl font-black">Игры</h1>

        {editing ? (
          <GameBuilder
            game={editing}
            packs={packs}
            onSaved={() => {
              setEditing(null);
              reload();
            }}
            onClose={() => setEditing(null)}
          />
        ) : (
          <>
            {games.map((game) => (
              <article
                key={game.id}
                className="ink-border bg-card text-ink flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4"
              >
                <span>
                  <span className="font-pop block text-lg font-black">{game.title}</span>
                  <span className="font-body block text-xs font-bold opacity-60">
                    {game.roundsCount} раунда · {game.themesCount} тем ·{' '}
                    {game.modifiersPerRound > 0
                      ? `${game.modifiersPerRound} модификатора на раунд`
                      : 'без модификаторов'}
                  </span>
                  {!game.playable && (
                    <span className="font-body text-bad block text-xs font-bold">
                      потерялось тем: {game.missingRefs} — откройте и пересоберите состав
                    </span>
                  )}
                </span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fetchGame(game.id).then(setEditing)}
                    className="ink-border font-body rounded-xl px-3 py-1 text-sm font-bold"
                  >
                    открыть
                  </button>
                  <button
                    type="button"
                    onClick={() => removeGame(game.id).then(reload)}
                    className="font-body text-sm font-bold underline underline-offset-4 opacity-60"
                  >
                    удалить
                  </button>
                </span>
              </article>
            ))}

            <button
              type="button"
              onClick={add}
              className="ink-border bg-gold font-body justify-self-start rounded-2xl px-4 py-2 text-sm font-bold"
            >
              + собрать игру
            </button>
          </>
        )}

        {error && <p className="font-body text-bad text-sm font-bold">{error}</p>}
      </div>
    </Screen>
  );
}
```

- [ ] **Step 5: Добавить маршрут и ссылку**

В `client/src/main.tsx` — импорт и запись в роутер рядом с `/editor`:

```tsx
import Games from './routes/Games.js';
// ...
{ path: '/games', element: <Games /> },
```

В `client/src/routes/Landing.tsx` роли перечислены массивом `ROLES`, из которого рисуются карточки. Добавить в него запись после `/editor`:

```tsx
  { to: '/games', title: 'Игры', hint: 'собрать вечер из паков', tone: 'var(--color-p2)' },
```

- [ ] **Step 6: Проверить**

Run: `npm run typecheck`
Expected: зелёно.

Руками: `npm run dev`, открыть `http://localhost:5173/games`, создать игру, выбрать паки, включить два модификатора, сохранить, перезагрузить страницу — игра на месте с тем же составом.

- [ ] **Step 7: Коммит**

```bash
git add client/src/games client/src/routes/Games.tsx client/src/main.tsx client/src/routes/Landing.tsx
git commit -m "feat(games): страница игр с конструктором"
```

---

## Task 5: Выбор сохранённой игры на `/host`

**Files:**
- Modify: `client/src/routes/Host.tsx`
- Modify: `client/src/net/gameApi.ts`

**Interfaces:**
- Consumes: `listGames` из `client/src/games/api.ts`; `room:create` с `gameId` (Task 3).
- Produces: на `/host` над мастером появляется список сохранённых игр; выбор игры создаёт комнату одним запросом.

**Проверка:** `npm run typecheck` плюс руками — создать комнату из сохранённой игры и увидеть её темы на доске.

- [ ] **Step 1: Обобщить создание комнаты**

Комната создаётся не через `gameApi.ts`, а прямо в `client/src/routes/Host.tsx` функцией `createRoom` (строка ~34), которая шлёт `ask<CreateRoomResult>('room:create', { recipe, settings })`. Обобщить её так, чтобы она принимала любой из двух составов:

```tsx
const createRoom = async (payload: { recipe: GameRecipe } | { gameId: string }): Promise<void> => {
  setCreating(true);
  setError(null);
  const result = await ask<CreateRoomResult>('room:create', { ...payload, settings });
  setCreating(false);
  if (!result.ok) {
    setError(result.error);
    return;
  }
  saveSession({
    role: 'host',
    code: result.data.code,
    token: result.data.hostToken,
    playerId: null,
  });
};
```

и поправить существующий вызов кнопки мастера (строка ~100):

```tsx
onClick={() => {
  if (recipe) void createRoom({ recipe });
}}
```

- [ ] **Step 2: Показать список игр над мастером**

В `client/src/routes/Host.tsx` добавить импорты `GameSummary` из `@svoyak/shared` и `listGames` из `../games/api.js`, затем состояние и загрузку рядом с загрузкой паков:

```tsx
const [games, setGames] = useState<GameSummary[]>([]);
useEffect(() => {
  void listGames()
    .then(setGames)
    .catch(() => setGames([]));
}, []);
```

и над `<GameSetup packs={packs} onRecipeChange={setRecipe} />` — блок выбора:

```tsx
{games.length > 0 && (
  <section className="ink-border bg-card text-ink grid gap-2 rounded-2xl p-4">
    <span className="font-body text-sm font-bold">Сохранённые игры</span>
    {games.map((game) => (
      <button
        key={game.id}
        type="button"
        disabled={!game.playable}
        onClick={() => void createRoom({ gameId: game.id })}
        className="ink-border font-body flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm font-bold disabled:opacity-40"
      >
        <span>{game.title}</span>
        <span className="text-xs opacity-60">
          {game.playable
            ? `${game.roundsCount} раунда · ${game.themesCount} тем`
            : 'состав потерялся'}
        </span>
      </button>
    ))}
    <span className="font-body text-xs font-bold opacity-60">
      или соберите игру на ходу ниже
    </span>
  </section>
)}
```

Настройки темпа при этом берутся те же, что стоят в панели рядом: игра хранит состав, а не скорость.

- [ ] **Step 3: Проверить**

Run: `npm run typecheck`

Руками: сохранить игру на `/games`, открыть `/host`, нажать на неё — комната создаётся, на доске темы этой игры.

- [ ] **Step 4: Коммит**

```bash
git add client/src/routes/Host.tsx client/src/net/gameApi.ts
git commit -m "feat(games): выбор сохранённой игры на экране ведущего"
```

---

# Фаза 2 — Клетки-модификаторы

## Task 6: Раскладка клеток

**Files:**
- Create: `server/src/engine/modifiers.ts`
- Test: `server/src/engine/modifiers.placement.test.ts`

**Interfaces:**
- Consumes: `Pack`, `ModifierPlan`, `ModifierKind` (Task 1).
- Produces: `planModifierCells(pack: Pack, plan: ModifierPlan, random?: () => number): Record<string, ModifierKind>` — карта `questionId → ModifierKind` по всем раундам пака.

- [ ] **Step 1: Написать падающий тест**

`server/src/engine/modifiers.placement.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { Pack, Question } from '@svoyak/shared';
import { planModifierCells } from './modifiers.js';

const question = (id: string, over: Partial<Question> = {}): Question => ({
  id,
  price: 100,
  type: 'normal',
  text: 'вопрос',
  answer: 'ответ',
  altAnswers: [],
  ...over,
});

/** Пак с двумя раундами по одной теме: в первом пять клеток, во втором четыре. */
const pack: Pack = {
  id: 'p',
  title: 'Пак',
  createdAt: 1,
  updatedAt: 1,
  rounds: [
    {
      id: 'r1',
      title: 'Первый раунд',
      themes: [
        {
          id: 'r1-t1',
          title: 'Тема',
          questions: ['a1', 'a2', 'a3', 'a4', 'a5'].map((id) => question(id)),
        },
      ],
    },
    {
      id: 'r2',
      title: 'Второй раунд',
      themes: [
        {
          id: 'r2-t1',
          title: 'Тема',
          questions: ['b1', 'b2', 'b3', 'b4'].map((id) => question(id)),
        },
      ],
    },
  ],
  final: { themes: [{ id: 'f1', title: 'Финал', question: { id: 'fq', text: 'т', answer: 'о', altAnswers: [] } }] },
};

/** Предсказуемый «случай»: всегда берём первый элемент из оставшихся. */
const firstAlways = (): number => 0;

describe('раскладка модификаторов', () => {
  it('без плана клеток не появляется', () => {
    expect(planModifierCells(pack, { perRound: 0, kinds: ['flip'] })).toEqual({});
  });

  it('без включённых видов клеток не появляется', () => {
    expect(planModifierCells(pack, { perRound: 3, kinds: [] })).toEqual({});
  });

  it('кладёт ровно столько клеток в каждый раунд', () => {
    const cells = planModifierCells(pack, { perRound: 2, kinds: ['flip', 'jackpot'] }, firstAlways);
    const firstRound = ['a1', 'a2', 'a3', 'a4', 'a5'].filter((id) => id in cells);
    const secondRound = ['b1', 'b2', 'b3', 'b4'].filter((id) => id in cells);
    expect(firstRound).toHaveLength(2);
    expect(secondRound).toHaveLength(2);
  });

  it('берёт все клетки, если их меньше запрошенного, и это не ошибка', () => {
    const small: Pack = {
      ...pack,
      rounds: [{ id: 'r1', title: 'Раунд', themes: [{ id: 't', title: 'Тема', questions: [question('x1')] }] }],
    };
    const cells = planModifierCells(small, { perRound: 5, kinds: ['flip'] }, firstAlways);
    expect(Object.keys(cells)).toEqual(['x1']);
  });

  it('не занимает клетки кота и аукциона', () => {
    const special: Pack = {
      ...pack,
      rounds: [
        {
          id: 'r1',
          title: 'Раунд',
          themes: [
            {
              id: 't',
              title: 'Тема',
              questions: [
                question('c1', { type: 'cat', cat: { theme: 'Кот', price: 'nominal', canKeep: false } }),
                question('c2', { type: 'auction' }),
                question('c3'),
              ],
            },
          ],
        },
      ],
    };
    const cells = planModifierCells(special, { perRound: 3, kinds: ['flip'] }, firstAlways);
    expect(Object.keys(cells)).toEqual(['c3']);
  });

  it('использует все разрешённые виды, прежде чем повторяться', () => {
    const cells = planModifierCells(pack, { perRound: 3, kinds: ['flip', 'jackpot'] }, firstAlways);
    const kinds = Object.values(cells);
    expect(kinds).toContain('flip');
    expect(kinds).toContain('jackpot');
  });

  it('в финале модификаторов нет', () => {
    const cells = planModifierCells(pack, { perRound: 5, kinds: ['flip'] }, firstAlways);
    expect(cells['fq']).toBeUndefined();
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run server/src/engine/modifiers.placement.test.ts`
Expected: FAIL — `Cannot find module './modifiers.js'`.

- [ ] **Step 3: Написать раскладку**

`server/src/engine/modifiers.ts`:

```ts
import type { ModifierKind, ModifierPlan, Pack } from '@svoyak/shared';

/** Источник случайности параметром: раскладку надо уметь проверить тестом. */
export type Random = () => number;

/** Достаёт из массива случайный элемент, не меняя исходный. */
function drawFrom<T>(items: T[], random: Random): T | undefined {
  if (items.length === 0) return undefined;
  const index = Math.min(items.length - 1, Math.floor(random() * items.length));
  return items.splice(index, 1)[0];
}

/** Перемешанная колода видов: пока не кончилась, виды не повторяются. */
function shuffled(kinds: readonly ModifierKind[], random: Random): ModifierKind[] {
  const rest = [...kinds];
  const deck: ModifierKind[] = [];
  while (rest.length > 0) {
    const kind = drawFrom(rest, random);
    if (kind) deck.push(kind);
  }
  return deck;
}

/** Куда лягут клетки-модификаторы. Считается один раз при создании комнаты:
 *  карта хранится в состоянии, поэтому переживает сохранение и отмену хода.
 *  Кот и аукцион не трогаются — модификатор не должен съедать спецвопрос,
 *  который автор пака поставил осознанно. В финале модификаторов нет. */
export function planModifierCells(
  pack: Pack,
  plan: ModifierPlan,
  random: Random = Math.random,
): Record<string, ModifierKind> {
  if (plan.perRound <= 0 || plan.kinds.length === 0) return {};

  const cells: Record<string, ModifierKind> = {};
  let deck: ModifierKind[] = [];

  for (const round of pack.rounds) {
    const eligible = round.themes.flatMap((theme) =>
      theme.questions.filter((question) => question.type === 'normal').map((question) => question.id),
    );
    const take = Math.min(plan.perRound, eligible.length);
    for (let index = 0; index < take; index += 1) {
      const questionId = drawFrom(eligible, random);
      if (questionId === undefined) break;
      if (deck.length === 0) deck = shuffled(plan.kinds, random);
      const kind = deck.pop();
      if (kind) cells[questionId] = kind;
    }
  }

  return cells;
}
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npx vitest run server/src/engine/modifiers.placement.test.ts`
Expected: PASS, 7 тестов.

- [ ] **Step 5: Проверить весь проект и закоммитить**

```bash
npx vitest run && npm run typecheck
git add server/src/engine/modifiers.ts server/src/engine/modifiers.placement.test.ts
git commit -m "feat(modifiers): раскладка клеток по раундам"
```

---

## Task 7: Эффекты модификаторов

**Files:**
- Modify: `server/src/engine/modifiers.ts`
- Test: `server/src/engine/modifiers.effects.test.ts`

**Interfaces:**
- Consumes: `Player`, `RoomSettings`, `ModifierKind`.
- Produces: `clampScore(score: number, settings: RoomSettings): number` и `applyModifier(players: Player[], kind: ModifierKind, playerId: string, targetPlayerId: string | null, settings: RoomSettings): Player[]` — чистая функция над списком игроков, без обращения к состоянию комнаты.

- [ ] **Step 1: Написать падающий тест**

`server/src/engine/modifiers.effects.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, type Player, type RoomSettings } from '@svoyak/shared';
import { applyModifier } from './modifiers.js';

const player = (id: string, score: number): Player => ({
  id,
  name: id,
  score,
  connected: true,
  joinedAt: 0,
  sessionToken: `t-${id}`,
});

/** Вася открыл клетку, Петя ведёт, Маша в минусе. */
const table = (): Player[] => [player('p1', 300), player('p2', 1000), player('p3', -200)];

const scores = (players: Player[]): Record<string, number> =>
  Object.fromEntries(players.map((item) => [item.id, item.score]));

const run = (
  kind: Parameters<typeof applyModifier>[1],
  target: string | null = null,
  settings: RoomSettings = DEFAULT_SETTINGS,
  players: Player[] = table(),
): Record<string, number> => scores(applyModifier(players, kind, 'p1', target, settings));

describe('эффекты модификаторов', () => {
  it('перевёртыш меняет знак счёта открывшему', () => {
    expect(run('flip')['p1']).toBe(-300);
  });

  it('перевёртыш вытаскивает из минуса', () => {
    const players = [player('p1', -700), player('p2', 100)];
    expect(run('flip', null, DEFAULT_SETTINGS, players)['p1']).toBe(700);
  });

  it('джекпот добавляет ровно 2000', () => {
    expect(run('jackpot')['p1']).toBe(2300);
  });

  it('пустышка не меняет ничего', () => {
    expect(run('nothing')).toEqual({ p1: 300, p2: 1000, p3: -200 });
  });

  it('ограбление снимает 500 с лидера и отдаёт открывшему', () => {
    const after = run('robbery');
    expect(after['p2']).toBe(500);
    expect(after['p1']).toBe(800);
  });

  it('ограбление ищет лидера среди остальных, а не себя', () => {
    const players = [player('p1', 5000), player('p2', 100)];
    const after = run('robbery', null, DEFAULT_SETTINGS, players);
    expect(after['p1']).toBe(5500);
    expect(after['p2']).toBe(-400);
  });

  it('ограбление в одиночку ничего не делает', () => {
    const players = [player('p1', 300)];
    expect(run('robbery', null, DEFAULT_SETTINGS, players)).toEqual({ p1: 300 });
  });

  it('удвоение удваивает счёт', () => {
    expect(run('double')['p1']).toBe(600);
  });

  it('удвоение в минусе удваивает долг', () => {
    const players = [player('p1', -400), player('p2', 0)];
    expect(run('double', null, DEFAULT_SETTINGS, players)['p1']).toBe(-800);
  });

  it('щедрость раздаёт каждому по 500 за свой счёт', () => {
    const after = run('generosity');
    expect(after['p1']).toBe(-200);
    expect(after['p2']).toBe(1500);
    expect(after['p3']).toBe(300);
  });

  it('щедрость в одиночку ничего не делает', () => {
    const players = [player('p1', 300)];
    expect(run('generosity', null, DEFAULT_SETTINGS, players)).toEqual({ p1: 300 });
  });

  it('подсказка выдаёт жетон и не трогает счёт', () => {
    const after = applyModifier(table(), 'hint', 'p1', null, DEFAULT_SETTINGS);
    expect(after.find((item) => item.id === 'p1')?.hints).toBe(1);
    expect(after.find((item) => item.id === 'p1')?.score).toBe(300);
  });

  it('обмен меняет счета местами', () => {
    const after = run('swap', 'p2');
    expect(after['p1']).toBe(1000);
    expect(after['p2']).toBe(300);
  });

  it('обмен без цели ничего не делает', () => {
    expect(run('swap', null)).toEqual({ p1: 300, p2: 1000, p3: -200 });
  });

  it('обмен с самим собой ничего не делает', () => {
    expect(run('swap', 'p1')).toEqual({ p1: 300, p2: 1000, p3: -200 });
  });

  it('обмен с несуществующим игроком ничего не делает', () => {
    expect(run('swap', 'нет-такого')).toEqual({ p1: 300, p2: 1000, p3: -200 });
  });
});

describe('запрет минуса соблюдается всеми модификаторами', () => {
  const noNegative: RoomSettings = { ...DEFAULT_SETTINGS, allowNegative: false };

  it('перевёртыш не уводит в минус', () => {
    expect(run('flip', null, noNegative)['p1']).toBe(0);
  });

  it('удвоение не удваивает долг', () => {
    const players = [player('p1', -400), player('p2', 0)];
    expect(run('double', null, noNegative, players)['p1']).toBe(0);
  });

  it('обмен не приносит чужой минус', () => {
    const after = run('swap', 'p3', noNegative);
    expect(after['p1']).toBe(0);
    expect(after['p3']).toBe(300);
  });

  it('щедрость не опускает дарителя ниже нуля', () => {
    const players = [player('p1', 100), player('p2', 0)];
    expect(run('generosity', null, noNegative, players)['p1']).toBe(0);
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run server/src/engine/modifiers.effects.test.ts`
Expected: FAIL — `applyModifier is not a function`.

- [ ] **Step 3: Добавить `hints` в игрока**

В `shared/src/state.ts`, в интерфейс `Player`:

```ts
  /** Жетоны подсказки: тратит их ведущий по просьбе игрока вслух. */
  hints: number;
```

и в `PlayerPublic` — не секрет, видеть чужие жетоны полезно:

```ts
  hints: number;
```

В `server/src/engine/reducer.ts`, в обработке `PLAYER_JOIN`, где создаётся новый игрок, добавить `hints: 0`. В `server/src/room/projections.ts`, в `projectPlayers`, добавить `hints: player.hints ?? 0` — старые сохранённые комнаты поля не имеют.

- [ ] **Step 4: Написать эффекты**

Дописать в `server/src/engine/modifiers.ts`:

```ts
import type { ModifierKind, ModifierPlan, Pack, Player, RoomSettings } from '@svoyak/shared';
import { JACKPOT_AMOUNT, TRANSFER_AMOUNT } from '@svoyak/shared';

/** Настройка «не уходить в минус» должна соблюдаться одинаково всеми.
 *  Перевёртыш, удвоение и обмен — не дельты, поэтому `applyDelta` их не ловит. */
export function clampScore(score: number, settings: RoomSettings): number {
  return settings.allowNegative ? score : Math.max(0, score);
}

/** Эффект клетки-модификатора. Чистая функция над списком игроков: ни фаз,
 *  ни таймеров, ни доски — только счёт и жетоны. */
export function applyModifier(
  players: Player[],
  kind: ModifierKind,
  playerId: string,
  targetPlayerId: string | null,
  settings: RoomSettings,
): Player[] {
  const me = players.find((player) => player.id === playerId);
  if (!me) return players;

  const withScore = (player: Player, score: number): Player => ({
    ...player,
    score: clampScore(score, settings),
  });

  switch (kind) {
    case 'nothing':
      return players;

    case 'flip':
      return players.map((player) =>
        player.id === playerId ? withScore(player, -player.score) : player,
      );

    case 'jackpot':
      return players.map((player) =>
        player.id === playerId ? withScore(player, player.score + JACKPOT_AMOUNT) : player,
      );

    case 'double':
      return players.map((player) =>
        player.id === playerId ? withScore(player, player.score * 2) : player,
      );

    case 'hint':
      return players.map((player) =>
        player.id === playerId ? { ...player, hints: (player.hints ?? 0) + 1 } : player,
      );

    case 'robbery': {
      // Лидер ищется среди остальных: сам себя открывший не грабит.
      const others = players.filter((player) => player.id !== playerId);
      const leader = others.reduce<Player | null>(
        (best, player) => (best === null || player.score > best.score ? player : best),
        null,
      );
      if (!leader) return players;
      return players.map((player) => {
        if (player.id === leader.id) return withScore(player, player.score - TRANSFER_AMOUNT);
        if (player.id === playerId) return withScore(player, player.score + TRANSFER_AMOUNT);
        return player;
      });
    }

    case 'generosity': {
      const others = players.filter((player) => player.id !== playerId);
      if (others.length === 0) return players;
      return players.map((player) =>
        player.id === playerId
          ? withScore(player, player.score - TRANSFER_AMOUNT)
          : withScore(player, player.score + TRANSFER_AMOUNT),
      );
    }

    case 'swap': {
      if (targetPlayerId === null || targetPlayerId === playerId) return players;
      const target = players.find((player) => player.id === targetPlayerId);
      if (!target) return players;
      return players.map((player) => {
        if (player.id === playerId) return withScore(player, target.score);
        if (player.id === targetPlayerId) return withScore(player, me.score);
        return player;
      });
    }
  }
}
```

- [ ] **Step 5: Убедиться, что тесты проходят**

Run: `npx vitest run server/src/engine/modifiers.effects.test.ts`
Expected: PASS, 20 тестов.

- [ ] **Step 6: Проверить весь проект и закоммитить**

```bash
npx vitest run && npm run typecheck
git add server/src/engine/modifiers.ts server/src/engine/modifiers.effects.test.ts shared/src/state.ts server/src/engine/reducer.ts server/src/room/projections.ts
git commit -m "feat(modifiers): восемь эффектов и жетон подсказки"
```

---

## Task 8: Клетка в состоянии и срез секрета в проекции

**Files:**
- Modify: `shared/src/state.ts`
- Modify: `server/src/engine/board.ts`
- Modify: `server/src/engine/createRoom.ts`
- Modify: `server/src/room/projections.ts`
- Modify: `server/src/room/RoomManager.ts`
- Test: `server/src/room/modifierSecrecy.test.ts`

**Interfaces:**
- Consumes: `planModifierCells` (Task 6).
- Produces: `BoardCell.modifier?: ModifierKind`; `RoomState.modifierCells: Record<string, ModifierKind>`; `buildBoard(round, modifierCells)`; `createRoomState({ ..., modifierCells })`; `RoomManager.create(pack, settings, modifierCells)`; проекции больше не отдают `state.board` напрямую.

- [ ] **Step 1: Написать падающий тест секретности**

`server/src/room/modifierSecrecy.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, type RoomState } from '@svoyak/shared';
import { demoClassicPack } from '../packs/demo/classic.js';
import { createRoomState } from '../engine/createRoom.js';
import { reduce } from '../engine/reducer.js';
import { projectForBoard, projectForHost, projectForPlayer } from './projections.js';

/** Комната, где первая клетка первой темы — модификатор. */
function roomWithModifier(): RoomState {
  const firstTheme = demoClassicPack.rounds[0]?.themes[0];
  const firstQuestion = firstTheme?.questions[0];
  if (!firstTheme || !firstQuestion) throw new Error('Пак demo-classic неожиданно пуст');

  let state = createRoomState({
    code: '1234',
    pack: demoClassicPack,
    settings: DEFAULT_SETTINGS,
    hostToken: 'h',
    now: 1000,
    modifierCells: { [firstQuestion.id]: 'jackpot' },
  });
  for (const [index, name] of ['Вася', 'Петя'].entries()) {
    state = reduce(state, {
      type: 'PLAYER_JOIN',
      playerId: `p${index + 1}`,
      name,
      sessionToken: `t${index + 1}`,
      at: 2000 + index,
    }).state;
  }
  return reduce(state, { type: 'START_GAME', at: 3000 }).state;
}

describe('секретность модификатора', () => {
  it('клетка помечена в состоянии комнаты', () => {
    const state = roomWithModifier();
    const marked = state.board[0]?.cells[0];
    expect(marked?.modifier).toBe('jackpot');
  });

  it('игрок не видит модификатор до открытия клетки', () => {
    const state = roomWithModifier();
    const serialized = JSON.stringify(projectForPlayer(state, 'p1', Date.now()));
    expect(serialized).not.toContain('jackpot');
    expect(serialized).not.toContain('modifier');
  });

  it('общий экран не видит модификатор до открытия клетки', () => {
    const state = roomWithModifier();
    const serialized = JSON.stringify(projectForBoard(state, Date.now(), 'http://x'));
    expect(serialized).not.toContain('jackpot');
  });

  it('ведущий тоже не видит: он открывает клетку по просьбе игрока', () => {
    const state = roomWithModifier();
    const serialized = JSON.stringify(projectForHost(state, Date.now(), 'http://x'));
    expect(serialized).not.toContain('jackpot');
  });
});
```

Сигнатуры `projectForPlayer`, `projectForBoard`, `projectForHost` взять из `server/src/room/projections.ts` — тест обязан звать их ровно так, как они объявлены.

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run server/src/room/modifierSecrecy.test.ts`
Expected: FAIL — `createRoomState` не принимает `modifierCells`.

- [ ] **Step 3: Расширить типы состояния**

В `shared/src/state.ts`:

```ts
import type { ModifierKind } from './modifiers.js';
```

```ts
export interface BoardCell {
  questionId: string;
  price: number;
  played: boolean;
  /** Под клеткой не вопрос, а модификатор. В проекции срезается, пока клетка
   *  не открыта: снаружи она ничем не отличается от обычной. */
  modifier?: ModifierKind;
}
```

и в `RoomState`, рядом с `pack`:

```ts
  /** Куда легли клетки-модификаторы: questionId → вид. Считается один раз при
   *  создании комнаты, поэтому переживает сохранение и отмену хода. */
  modifierCells: Record<string, ModifierKind>;
```

- [ ] **Step 4: Проставлять клетки при сборке доски**

`server/src/engine/board.ts`:

```ts
import type { BoardTheme, ModifierKind, Round } from '@svoyak/shared';

/** Доска раунда: темы с клетками по цене вопроса. Клетка-модификатор помечается
 *  здесь, но наружу это поле не уходит — его срезает проекция. */
export function buildBoard(
  round: Round,
  modifierCells: Record<string, ModifierKind> = {},
): BoardTheme[] {
  return round.themes.map((theme) => ({
    id: theme.id,
    title: theme.title,
    cells: theme.questions.map((question) => {
      const modifier = modifierCells[question.id];
      return {
        questionId: question.id,
        price: question.price,
        played: false,
        ...(modifier !== undefined ? { modifier } : {}),
      };
    }),
  }));
}
```

В `server/src/engine/createRoom.ts` добавить поле в `CreateRoomArgs` и в состояние:

```ts
export interface CreateRoomArgs {
  code: string;
  pack: Pack;
  settings: RoomSettings;
  hostToken: string;
  now?: number;
  modifierCells?: Record<string, ModifierKind>;
}
```

```ts
  modifierCells = {},
```

```ts
    modifierCells,
    board: firstRound ? buildBoard(firstRound, modifierCells) : [],
```

В `server/src/engine/flow.ts`, в `advanceRound`, передать карту при сборке доски следующего раунда:

```ts
    board: buildBoard(nextRound, state.modifierCells),
```

В `server/src/room/RoomManager.ts` — третий аргумент `create`:

```ts
  create(
    pack: Pack,
    settings?: Partial<RoomSettings>,
    modifierCells: Record<string, ModifierKind> = {},
  ): { room: RoomRuntime; hostToken: string } {
```

и передать его в `createRoomState`.

- [ ] **Step 5: Срезать секрет в проекции**

В `server/src/room/projections.ts` добавить функцию и заменить `board: state.board` в `projectBase`:

```ts
/** Доска наружу. Модификатор виден только на уже открытой клетке: пока клетка
 *  закрыта, она обязана быть неотличима от обычной. */
function projectBoard(state: RoomState): BoardTheme[] {
  return state.board.map((theme) => ({
    ...theme,
    cells: theme.cells.map(({ questionId, price, played }) => ({ questionId, price, played })),
  }));
}
```

```ts
    board: projectBoard(state),
```

Добавить `BoardTheme` в импорт типов файла.

- [ ] **Step 6: Убедиться, что тесты проходят**

Run: `npx vitest run server/src/room/modifierSecrecy.test.ts`
Expected: PASS, 4 теста.

- [ ] **Step 7: Проверить весь проект и закоммитить**

```bash
npx vitest run && npm run typecheck
git add shared/src/state.ts server/src/engine/board.ts server/src/engine/createRoom.ts server/src/engine/flow.ts server/src/room/projections.ts server/src/room/RoomManager.ts server/src/room/modifierSecrecy.test.ts
git commit -m "feat(modifiers): клетка в состоянии и срез секрета в проекции"
```

---

## Task 9: Фаза модификатора в движке

**Files:**
- Modify: `shared/src/state.ts`
- Modify: `shared/src/settings.ts`
- Modify: `server/src/engine/flow.ts`
- Modify: `server/src/engine/reducer.ts:200-300` (`PICK_QUESTION`)
- Test: `server/src/engine/modifierFlow.test.ts`

**Interfaces:**
- Consumes: `applyModifier` (Task 7), `modifierCells` (Task 8).
- Produces: фаза `'modifier'`; `RoomState.modifier: ModifierState | null`; `TimerKind` `'modifier'`; настройка `modifierMs`; `CONTINUE` и `TIMER_EXPIRED{kind:'modifier'}` закрывают сцену.

- [ ] **Step 1: Написать падающий тест**

`server/src/engine/modifierFlow.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, type RoomSettings, type RoomState } from '@svoyak/shared';
import { demoClassicPack } from '../packs/demo/classic.js';
import { createRoomState } from './createRoom.js';
import { reduce } from './reducer.js';

const T0 = 100_000;

const firstTheme = demoClassicPack.rounds[0]?.themes[0];
const firstQuestion = firstTheme?.questions[0];
if (!firstTheme || !firstQuestion) throw new Error('Пак demo-classic неожиданно пуст');

const score = (state: RoomState, playerId: string): number =>
  state.players.find((player) => player.id === playerId)?.score ?? 0;

/** Комната, где первая клетка — модификатор указанного вида, ход у Васи. */
function room(kind: 'jackpot' | 'nothing' | 'flip', settings: Partial<RoomSettings> = {}): RoomState {
  let state = createRoomState({
    code: '1234',
    pack: demoClassicPack,
    settings: { ...DEFAULT_SETTINGS, ...settings },
    hostToken: 'h',
    now: 1000,
    modifierCells: { [firstQuestion.id]: kind },
  });
  for (const [index, name] of ['Вася', 'Петя'].entries()) {
    state = reduce(state, {
      type: 'PLAYER_JOIN',
      playerId: `p${index + 1}`,
      name,
      sessionToken: `t${index + 1}`,
      at: 2000 + index,
    }).state;
  }
  return reduce(state, { type: 'START_GAME', at: 3000 }).state;
}

const pick = (state: RoomState, at = T0): ReturnType<typeof reduce> =>
  reduce(state, {
    type: 'PICK_QUESTION',
    themeId: firstTheme.id,
    questionId: firstQuestion.id,
    at,
  });

describe('клетка-модификатор', () => {
  it('открывает сцену модификатора вместо вопроса', () => {
    const state = pick(room('jackpot')).state;
    expect(state.phase).toBe('modifier');
    expect(state.modifier?.kind).toBe('jackpot');
    expect(state.active).toBeNull();
  });

  it('эффект применяется сразу', () => {
    const state = pick(room('jackpot')).state;
    expect(score(state, 'p1')).toBe(2000);
  });

  it('клетка отмечается сыгранной', () => {
    const state = pick(room('nothing')).state;
    const cell = state.board
      .find((theme) => theme.id === firstTheme.id)
      ?.cells.find((item) => item.questionId === firstQuestion.id);
    expect(cell?.played).toBe(true);
  });

  it('право хода остаётся у открывшего', () => {
    const state = pick(room('flip')).state;
    expect(state.controlPlayerId).toBe('p1');
  });

  it('заводит таймер сцены', () => {
    const result = pick(room('nothing'));
    expect(result.effects).toContainEqual({
      type: 'setTimer',
      kind: 'modifier',
      durationMs: DEFAULT_SETTINGS.modifierMs,
      onExpire: { type: 'TIMER_EXPIRED', kind: 'modifier', at: T0 + DEFAULT_SETTINGS.modifierMs },
    });
  });

  it('при нулевой настройке сцену закрывает ведущий', () => {
    const result = pick(room('nothing', { modifierMs: 0 }));
    expect(result.state.phase).toBe('modifier');
    expect(result.effects.some((effect) => effect.type === 'setTimer')).toBe(false);
  });

  it('таймер возвращает к выбору клетки', () => {
    const opened = pick(room('nothing')).state;
    const after = reduce(opened, {
      type: 'TIMER_EXPIRED',
      kind: 'modifier',
      at: T0 + DEFAULT_SETTINGS.modifierMs,
    }).state;
    expect(after.phase).toBe('picking');
    expect(after.modifier).toBeNull();
  });

  it('ведущий закрывает сцену раньше таймера', () => {
    const opened = pick(room('nothing')).state;
    const after = reduce(opened, { type: 'CONTINUE', at: T0 + 1000 }).state;
    expect(after.phase).toBe('picking');
    expect(after.modifier).toBeNull();
  });

  it('пишет строку в журнал', () => {
    const state = pick(room('jackpot')).state;
    expect(state.log.at(-1)?.text).toContain('Джекпот');
  });

  it('последняя клетка раунда ведёт к концу раунда', () => {
    // Оставляем неразыгранной только клетку-модификатор.
    const base = room('nothing');
    const drained: RoomState = {
      ...base,
      board: base.board.map((theme) => ({
        ...theme,
        cells: theme.cells.map((cell) =>
          cell.questionId === firstQuestion.id ? cell : { ...cell, played: true },
        ),
      })),
    };
    const opened = pick(drained).state;
    const after = reduce(opened, { type: 'CONTINUE', at: T0 + 1000 }).state;
    expect(after.phase).toBe('round_end');
  });

  it('кнопка на сцене модификатора не работает', () => {
    const opened = pick(room('nothing')).state;
    const after = reduce(opened, {
      type: 'BUZZ',
      playerId: 'p2',
      atServerTime: T0 + 500,
      receivedAt: T0 + 500,
    }).state;
    expect(after.buzz.candidates).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run server/src/engine/modifierFlow.test.ts`
Expected: FAIL — `state.modifier` не существует, фаза `'reading'` вместо `'modifier'`.

- [ ] **Step 3: Расширить типы и настройки**

В `shared/src/state.ts`: добавить `'modifier'` в `Phase` (после `'picking'`) и в `TimerKind`; добавить состояние и проекцию:

```ts
/** Открытая клетка-модификатор. Вопроса под ней нет. */
export interface ModifierState {
  kind: ModifierKind;
  /** Кто открыл клетку: эффект действует на него. */
  playerId: string;
  /** Только для обмена: с кем меняемся. До выбора — null. */
  targetPlayerId: string | null;
}

export interface ModifierView {
  kind: ModifierKind;
  playerId: string;
  targetPlayerId: string | null;
}
```

В `RoomState` рядом с `cat`:

```ts
  modifier: ModifierState | null;
```

В `HostView`, `PlayerView` и `BoardView` рядом с `cat`:

```ts
  modifier: ModifierView | null;
```

В `shared/src/settings.ts`:

```ts
  /** Сколько держать сцену модификатора. Ноль — закрывает ведущий. */
  modifierMs: number;
```

и в `DEFAULT_SETTINGS`: `modifierMs: 6000,`.

- [ ] **Step 4: Завести фазу в движке**

В `server/src/engine/createRoom.ts` добавить `modifier: null` в начальное состояние.

В `server/src/engine/flow.ts`:
- добавить `'modifier'` в набор `QUESTION_PHASES` — на сцене модификатора стол занят, и `hasOpenQuestion` должен это видеть;
- в `closeQuestion` добавить `modifier: null`.

В `server/src/engine/reducer.ts`, в `case 'PICK_QUESTION'`, **сразу после** проверок темы и вопроса и **до** вычисления `phase`, вставить ветку:

```ts
      // Под клеткой-модификатором нет вопроса: эффект срабатывает сразу,
      // и открывший выбирает следующую клетку.
      const modifierKind = state.modifierCells[question.id];
      if (modifierKind !== undefined) {
        const playerId = state.controlPlayerId;
        if (!playerId) return reject(state, 'Некому открывать клетку');

        const players =
          modifierKind === 'swap'
            ? state.players
            : applyModifier(state.players, modifierKind, playerId, null, state.settings);

        const opened: RoomState = {
          ...state,
          phase: 'modifier',
          players,
          active: null,
          cat: null,
          auction: null,
          modifier: { kind: modifierKind, playerId, targetPlayerId: null },
          board: markPlayed(state.board, action.themeId, action.questionId),
          buzz: resetBuzz(),
          log: log(state, action.at, `${nameOf(state, playerId)}: ${MODIFIER_TITLES[modifierKind]}`),
        };

        // Обмену нужна цель: сцена ждёт выбора, а не таймера.
        if (modifierKind === 'swap') {
          return { state: opened, effects: [{ type: 'clearTimer' }, { type: 'persist' }] };
        }
        return { state: opened, effects: [...modifierEffects(state, action.at), { type: 'persist' }] };
      }
```

Рядом добавить два помощника — `markPlayed` выносится из существующего кода `PICK_QUESTION`, который сейчас строит `board` инлайном, и переиспользуется обеими ветками:

```ts
/** Отметить клетку сыгранной. Общее для вопросов и модификаторов. */
function markPlayed(
  board: RoomState['board'],
  themeId: string,
  questionId: string,
): RoomState['board'] {
  return board.map((theme) =>
    theme.id !== themeId
      ? theme
      : {
          ...theme,
          cells: theme.cells.map((cell) =>
            cell.questionId === questionId ? { ...cell, played: true } : cell,
          ),
        },
  );
}

const nameOf = (state: RoomState, playerId: string): string =>
  state.players.find((player) => player.id === playerId)?.name ?? 'Игрок';

/** Эффекты сцены модификатора: таймер, а при нулевой настройке — его отсутствие.
 *  Имя нарочно отличается от `enterReveal`: та сцена показывает ответ на вопрос,
 *  эта — выпавший модификатор, и путать их нельзя. */
function modifierEffects(state: RoomState, at: number): Effect[] {
  const durationMs = state.settings.modifierMs;
  if (durationMs <= 0) return [{ type: 'clearTimer' }];
  return [
    {
      type: 'setTimer',
      kind: 'modifier',
      durationMs,
      onExpire: { type: 'TIMER_EXPIRED', kind: 'modifier', at: at + durationMs },
    },
  ];
}
```

Заменить инлайновую сборку `board` в существующей ветке вопроса на `markPlayed(state.board, action.themeId, action.questionId)`.

Импортировать `applyModifier` из `./modifiers.js` и `MODIFIER_TITLES` из `@svoyak/shared`.

В `case 'CONTINUE'` добавить в начало:

```ts
      if (state.phase === 'modifier') {
        return {
          state: closeQuestion(state),
          effects: [{ type: 'clearTimer' }, { type: 'persist' }],
        };
      }
```

В `case 'TIMER_EXPIRED'` добавить рядом с веткой `'reveal'`:

```ts
      if (action.kind === 'modifier') {
        if (state.phase !== 'modifier') return { state, effects: [] };
        return {
          state: closeQuestion(state),
          effects: [{ type: 'clearTimer' }, { type: 'persist' }],
        };
      }
```

- [ ] **Step 5: Убедиться, что тесты проходят**

Run: `npx vitest run server/src/engine/modifierFlow.test.ts`
Expected: PASS, 11 тестов.

- [ ] **Step 6: Проверить отмену хода**

Отмена живёт не в редьюсере, а в `RoomRuntime` (снимок до действия + `undo()`), поэтому тест идёт в существующий `server/src/room/undo.test.ts` рядом с остальными. `PICK_QUESTION` уже числится в `UNDOABLE`, так что эффект модификатора обязан откатываться вместе с ним — это надо подтвердить, а не предположить.

Дописать в `server/src/room/undo.test.ts`:

```ts
it('возвращает счёт и клетку, съеденную модификатором', () => {
  const firstTheme = demoClassicPack.rounds[0]?.themes[0];
  const firstQuestion = firstTheme?.questions[0];
  if (!firstTheme || !firstQuestion) throw new Error('Пак demo-classic неожиданно пуст');

  const state = createRoomState({
    code: '1234',
    pack: demoClassicPack,
    settings: DEFAULT_SETTINGS,
    hostToken: 'host-token',
    now: 1000,
    modifierCells: { [firstQuestion.id]: 'jackpot' },
  });
  const room = new RoomRuntime(state, { persist: () => {}, joinUrlFor: () => 'url' });
  room.dispatch({ type: 'PLAYER_JOIN', playerId: 'p1', name: 'Вася', sessionToken: 't1', at: 2000 });
  room.dispatch({ type: 'START_GAME', at: 3000 });
  room.dispatch({
    type: 'PICK_QUESTION',
    themeId: firstTheme.id,
    questionId: firstQuestion.id,
    at: 4000,
  });
  expect(room.state.players[0]!.score).toBe(2000);

  expect(room.undo()).toBe(true);
  expect(room.state.players[0]!.score).toBe(0);
  expect(room.state.phase).toBe('picking');
  const cell = room.state.board
    .find((theme) => theme.id === firstTheme.id)
    ?.cells.find((item) => item.questionId === firstQuestion.id);
  expect(cell?.played).toBe(false);
});
```

Run: `npx vitest run server/src/room/undo.test.ts`
Expected: PASS.

- [ ] **Step 7: Проверить весь проект**

Run: `npx vitest run && npm run typecheck`

Ожидаемая починка: тесты, которые перечисляют поля `RoomState` целиком или строят состояние руками, могут потребовать `modifier: null` и `modifierCells: {}`. Это ожидаемая правка, а не поломка поведения.

- [ ] **Step 8: Коммит**

```bash
git add shared/src/state.ts shared/src/settings.ts server/src/engine server/src/room
git commit -m "feat(modifiers): фаза сцены модификатора"
```

---

## Task 10: Обмен счётом — выбор цели

**Files:**
- Modify: `shared/src/state.ts` (`PlayerPrompt`)
- Modify: `shared/src/events.ts`
- Modify: `server/src/engine/actions.ts`
- Modify: `server/src/engine/reducer.ts`
- Modify: `server/src/room/projections.ts`
- Test: `server/src/engine/modifierSwap.test.ts`

**Interfaces:**
- Consumes: фаза `'modifier'` (Task 9), `applyModifier` (Task 7).
- Produces: действие `{ type: 'MODIFIER_TARGET'; playerId: string; targetPlayerId: string; at: number }`; промпт `{ kind: 'modifier_swap'; candidates: Array<{ id: string; name: string }> }`; событие `player:modifierTarget`.

- [ ] **Step 1: Написать падающий тест**

`server/src/engine/modifierSwap.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, type RoomState } from '@svoyak/shared';
import { demoClassicPack } from '../packs/demo/classic.js';
import { createRoomState } from './createRoom.js';
import { reduce } from './reducer.js';

const T0 = 100_000;
const firstTheme = demoClassicPack.rounds[0]?.themes[0];
const firstQuestion = firstTheme?.questions[0];
if (!firstTheme || !firstQuestion) throw new Error('Пак demo-classic неожиданно пуст');

const score = (state: RoomState, playerId: string): number =>
  state.players.find((player) => player.id === playerId)?.score ?? 0;

/** Вася (300) открывает обмен, у Пети 1000. */
function openedSwap(): RoomState {
  let state = createRoomState({
    code: '1234',
    pack: demoClassicPack,
    settings: DEFAULT_SETTINGS,
    hostToken: 'h',
    now: 1000,
    modifierCells: { [firstQuestion.id]: 'swap' },
  });
  for (const [index, name] of ['Вася', 'Петя'].entries()) {
    state = reduce(state, {
      type: 'PLAYER_JOIN',
      playerId: `p${index + 1}`,
      name,
      sessionToken: `t${index + 1}`,
      at: 2000 + index,
    }).state;
  }
  state = reduce(state, { type: 'START_GAME', at: 3000 }).state;
  state = reduce(state, { type: 'SET_SCORE', playerId: 'p1', score: 300 }).state;
  state = reduce(state, { type: 'SET_SCORE', playerId: 'p2', score: 1000 }).state;
  return reduce(state, {
    type: 'PICK_QUESTION',
    themeId: firstTheme.id,
    questionId: firstQuestion.id,
    at: T0,
  }).state;
}

describe('обмен счётом', () => {
  it('ждёт выбора цели, ничего не меняя', () => {
    const state = openedSwap();
    expect(state.phase).toBe('modifier');
    expect(state.modifier?.targetPlayerId).toBeNull();
    expect(score(state, 'p1')).toBe(300);
  });

  it('обменивает счета выбранного и открывшего', () => {
    const state = reduce(openedSwap(), {
      type: 'MODIFIER_TARGET',
      playerId: 'p1',
      targetPlayerId: 'p2',
      at: T0 + 1000,
    }).state;
    expect(score(state, 'p1')).toBe(1000);
    expect(score(state, 'p2')).toBe(300);
    expect(state.modifier?.targetPlayerId).toBe('p2');
  });

  it('после выбора заводит таймер сцены', () => {
    const result = reduce(openedSwap(), {
      type: 'MODIFIER_TARGET',
      playerId: 'p1',
      targetPlayerId: 'p2',
      at: T0 + 1000,
    });
    expect(result.effects).toContainEqual({
      type: 'setTimer',
      kind: 'modifier',
      durationMs: DEFAULT_SETTINGS.modifierMs,
      onExpire: {
        type: 'TIMER_EXPIRED',
        kind: 'modifier',
        at: T0 + 1000 + DEFAULT_SETTINGS.modifierMs,
      },
    });
  });

  it('выбирать может только открывший клетку', () => {
    const result = reduce(openedSwap(), {
      type: 'MODIFIER_TARGET',
      playerId: 'p2',
      targetPlayerId: 'p1',
      at: T0 + 1000,
    });
    expect(result.error).toBeDefined();
  });

  it('на самого себя меняться нельзя', () => {
    const result = reduce(openedSwap(), {
      type: 'MODIFIER_TARGET',
      playerId: 'p1',
      targetPlayerId: 'p1',
      at: T0 + 1000,
    });
    expect(result.error).toBeDefined();
  });

  it('на несуществующего игрока меняться нельзя', () => {
    const result = reduce(openedSwap(), {
      type: 'MODIFIER_TARGET',
      playerId: 'p1',
      targetPlayerId: 'призрак',
      at: T0 + 1000,
    });
    expect(result.error).toBeDefined();
  });

  it('выбрать дважды нельзя', () => {
    const once = reduce(openedSwap(), {
      type: 'MODIFIER_TARGET',
      playerId: 'p1',
      targetPlayerId: 'p2',
      at: T0 + 1000,
    }).state;
    const twice = reduce(once, {
      type: 'MODIFIER_TARGET',
      playerId: 'p1',
      targetPlayerId: 'p2',
      at: T0 + 2000,
    });
    expect(twice.error).toBeDefined();
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run server/src/engine/modifierSwap.test.ts`
Expected: FAIL — действие `MODIFIER_TARGET` неизвестно.

- [ ] **Step 3: Добавить действие и промпт**

В `server/src/engine/actions.ts`, рядом с `CAT_TRANSFER`:

```ts
  /** Обмен счётом: открывший клетку выбирает, с кем меняется. */
  | { type: 'MODIFIER_TARGET'; playerId: string; targetPlayerId: string; at: number }
```

и в набор `UNDOABLE` — `'MODIFIER_TARGET'`.

В `shared/src/state.ts`, в `PlayerPrompt`:

```ts
  | { kind: 'modifier_swap'; candidates: Array<{ id: string; name: string }> }
```

В `shared/src/events.ts`:

```ts
export interface ModifierTargetPayload {
  targetPlayerId: string;
}
```

и в интерфейс клиентских событий рядом с передачей кота:

```ts
  'player:modifierTarget': (payload: ModifierTargetPayload, ack: Ack<null>) => void;
```

- [ ] **Step 4: Обработать действие**

В `server/src/engine/reducer.ts` добавить кейс:

```ts
    case 'MODIFIER_TARGET': {
      const modifier = state.modifier;
      if (state.phase !== 'modifier' || !modifier) return reject(state, 'Сейчас нечего менять');
      if (modifier.kind !== 'swap') return reject(state, 'Этот модификатор не меняет счёт');
      if (modifier.targetPlayerId !== null) return reject(state, 'Обмен уже состоялся');
      if (modifier.playerId !== action.playerId) return reject(state, 'Выбирает тот, кто открыл клетку');
      if (action.targetPlayerId === action.playerId) return reject(state, 'С самим собой меняться нельзя');
      const target = state.players.find((player) => player.id === action.targetPlayerId);
      if (!target) return reject(state, 'Игрок не найден');

      const players = applyModifier(
        state.players,
        'swap',
        action.playerId,
        action.targetPlayerId,
        state.settings,
      );

      return {
        state: {
          ...state,
          players,
          modifier: { ...modifier, targetPlayerId: action.targetPlayerId },
          log: log(state, action.at, `${nameOf(state, action.playerId)} меняется счётом с ${target.name}`),
        },
        effects: [...modifierEffects(state, action.at), { type: 'persist' }],
      };
    }
```

- [ ] **Step 5: Отдать промпт и проекцию**

В `server/src/room/projections.ts`:

- добавить `projectModifier(state)`, отдающий `ModifierView | null` из `state.modifier`, и подставить его в host-, player- и board-проекции рядом с `cat`;
- в функции, которая считает `PlayerPrompt`, добавить ветку **перед** `wait`:

```ts
  if (
    state.phase === 'modifier' &&
    state.modifier?.kind === 'swap' &&
    state.modifier.targetPlayerId === null &&
    state.modifier.playerId === playerId
  ) {
    return {
      kind: 'modifier_swap',
      candidates: state.players
        .filter((player) => player.id !== playerId)
        .map((player) => ({ id: player.id, name: player.name })),
    };
  }
```

- [ ] **Step 6: Добавить сокет-обработчик**

В `server/src/io/registerSocketHandlers.ts`, рядом с обработчиком передачи кота:

```ts
    socket.on('player:modifierTarget', ({ targetPlayerId }, ack) => {
      const { room, playerId } = requirePlayer(socket, ack);
      if (!room || !playerId) return;
      const result = room.dispatch({
        type: 'MODIFIER_TARGET',
        playerId,
        targetPlayerId,
        at: Date.now(),
      });
      if (!result.ok) {
        ack({ ok: false, error: result.error });
        return;
      }
      ack({ ok: true, data: null });
      broadcast(room.state.code);
    });
```

Точные имена помощников (`requirePlayer`, `broadcast`) взять из соседнего обработчика `player:catTransfer` в том же файле.

- [ ] **Step 7: Убедиться, что тесты проходят, и закоммитить**

```bash
npx vitest run server/src/engine/modifierSwap.test.ts
npx vitest run && npm run typecheck
git add shared/src server/src
git commit -m "feat(modifiers): обмен счётом с выбором игрока"
```

---

## Task 11: Жетон подсказки у ведущего

**Files:**
- Modify: `server/src/engine/actions.ts`
- Modify: `server/src/engine/reducer.ts`
- Modify: `shared/src/events.ts`
- Modify: `server/src/io/registerSocketHandlers.ts`
- Test: `server/src/engine/hint.test.ts`

**Interfaces:**
- Consumes: `Player.hints` (Task 7), модификатор `'hint'` (Task 7).
- Produces: действие `{ type: 'GIVE_HINT'; playerId: string; at: number }`; событие `host:giveHint`.

- [ ] **Step 1: Написать падающий тест**

`server/src/engine/hint.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, type RoomState } from '@svoyak/shared';
import { demoClassicPack } from '../packs/demo/classic.js';
import { createRoomState } from './createRoom.js';
import { reduce } from './reducer.js';

const T0 = 100_000;
const firstTheme = demoClassicPack.rounds[0]?.themes[0];
const firstQuestion = firstTheme?.questions[0];
if (!firstTheme || !firstQuestion) throw new Error('Пак demo-classic неожиданно пуст');

const hints = (state: RoomState, playerId: string): number =>
  state.players.find((player) => player.id === playerId)?.hints ?? 0;

/** Вася открыл клетку подсказки и получил жетон. */
function withToken(): RoomState {
  let state = createRoomState({
    code: '1234',
    pack: demoClassicPack,
    settings: DEFAULT_SETTINGS,
    hostToken: 'h',
    now: 1000,
    modifierCells: { [firstQuestion.id]: 'hint' },
  });
  for (const [index, name] of ['Вася', 'Петя'].entries()) {
    state = reduce(state, {
      type: 'PLAYER_JOIN',
      playerId: `p${index + 1}`,
      name,
      sessionToken: `t${index + 1}`,
      at: 2000 + index,
    }).state;
  }
  state = reduce(state, { type: 'START_GAME', at: 3000 }).state;
  return reduce(state, {
    type: 'PICK_QUESTION',
    themeId: firstTheme.id,
    questionId: firstQuestion.id,
    at: T0,
  }).state;
}

describe('жетон подсказки', () => {
  it('клетка подсказки выдаёт жетон открывшему', () => {
    expect(hints(withToken(), 'p1')).toBe(1);
  });

  it('ведущий тратит жетон', () => {
    const state = reduce(withToken(), { type: 'GIVE_HINT', playerId: 'p1', at: T0 + 5000 }).state;
    expect(hints(state, 'p1')).toBe(0);
  });

  it('трата пишется в журнал', () => {
    const state = reduce(withToken(), { type: 'GIVE_HINT', playerId: 'p1', at: T0 + 5000 }).state;
    expect(state.log.at(-1)?.text).toContain('подсказк');
  });

  it('без жетона подсказку не выдать', () => {
    const result = reduce(withToken(), { type: 'GIVE_HINT', playerId: 'p2', at: T0 + 5000 });
    expect(result.error).toBeDefined();
  });

  it('жетон переживает закрытие сцены и следующий вопрос', () => {
    const after = reduce(withToken(), { type: 'CONTINUE', at: T0 + 1000 }).state;
    expect(hints(after, 'p1')).toBe(1);
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run server/src/engine/hint.test.ts`
Expected: FAIL — действие `GIVE_HINT` неизвестно.

- [ ] **Step 3: Добавить действие**

В `server/src/engine/actions.ts`:

```ts
  /** Ведущий тратит жетон подсказки игрока: сам текст он говорит вслух. */
  | { type: 'GIVE_HINT'; playerId: string; at: number }
```

и в `UNDOABLE` — `'GIVE_HINT'`.

В `server/src/engine/reducer.ts`:

```ts
    case 'GIVE_HINT': {
      const player = state.players.find((candidate) => candidate.id === action.playerId);
      if (!player) return reject(state, 'Игрок не найден');
      if ((player.hints ?? 0) <= 0) return reject(state, 'У игрока нет жетона подсказки');

      return {
        state: {
          ...state,
          players: state.players.map((candidate) =>
            candidate.id === action.playerId
              ? { ...candidate, hints: (candidate.hints ?? 0) - 1 }
              : candidate,
          ),
          log: log(state, action.at, `${player.name} получает подсказку от ведущего`),
        },
        effects: [{ type: 'persist' }],
      };
    }
```

- [ ] **Step 4: Добавить сокет-событие**

В `shared/src/events.ts`:

```ts
export interface GiveHintPayload {
  playerId: string;
}
```

```ts
  'host:giveHint': (payload: GiveHintPayload, ack: Ack<null>) => void;
```

В `server/src/io/registerSocketHandlers.ts` добавить обработчик по образцу `host:setScore` (он тоже адресуется конкретному игроку):

```ts
    socket.on('host:giveHint', ({ playerId }, ack) => {
      const room = requireHost(socket, ack);
      if (!room) return;
      const result = room.dispatch({ type: 'GIVE_HINT', playerId, at: Date.now() });
      if (!result.ok) {
        ack({ ok: false, error: result.error });
        return;
      }
      ack({ ok: true, data: null });
      broadcast(room.state.code);
    });
```

- [ ] **Step 5: Убедиться, что тесты проходят, и закоммитить**

```bash
npx vitest run server/src/engine/hint.test.ts
npx vitest run && npm run typecheck
git add shared/src/events.ts server/src/engine/actions.ts server/src/engine/reducer.ts server/src/engine/hint.test.ts server/src/io/registerSocketHandlers.ts
git commit -m "feat(modifiers): ведущий тратит жетон подсказки"
```

---

## Task 12: Раскладка при создании комнаты из игры

**Files:**
- Modify: `server/src/io/registerSocketHandlers.ts`
- Test: `server/src/io/socket.integration.test.ts`

**Interfaces:**
- Consumes: `planModifierCells` (Task 6), `getGame` (Task 1), `RoomManager.create(pack, settings, modifierCells)` (Task 8).
- Produces: комната, созданная по `gameId`, получает раскладку модификаторов из плана игры.

- [ ] **Step 1: Написать падающий тест**

Добавить в `server/src/io/socket.integration.test.ts`:

```ts
it('раскладывает модификаторы из плана игры', async () => {
  const { saveGame } = await import('../storage/gamesRepo.js');
  const { getPack } = await import('../storage/packsRepo.js');
  const pack = getPack('demo-classic');
  if (!pack) throw new Error('Для теста нужен пак demo-classic');
  const theme = pack.rounds[0]?.themes[0];
  const finalTheme = pack.final.themes[0];
  if (!theme || !finalTheme) throw new Error('Пак demo-classic неожиданно пуст');

  saveGame({
    id: 'game-mods',
    title: 'С модификаторами',
    createdAt: 1,
    updatedAt: 1,
    recipe: {
      rounds: [[{ packId: pack.id, themeId: theme.id }]],
      final: [{ packId: pack.id, themeId: finalTheme.id }],
    },
    modifiers: { perRound: 2, kinds: ['jackpot', 'nothing'] },
  });

  const host = connect();
  const created = await emit(host, 'room:create', { gameId: 'game-mods' });
  const room = rooms.get(created.data.code);
  expect(Object.keys(room?.state.modifierCells ?? {})).toHaveLength(2);
  host.disconnect();
});

it('без плана модификаторов клетки не появляются', async () => {
  const host = connect();
  const created = await emit(host, 'room:create', { packId: 'demo-classic' });
  const room = rooms.get(created.data.code);
  expect(room?.state.modifierCells).toEqual({});
  host.disconnect();
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run server/src/io/socket.integration.test.ts`
Expected: FAIL — `modifierCells` пуст, хотя план просит две клетки.

- [ ] **Step 3: Прокинуть план в создание комнаты**

В `server/src/io/registerSocketHandlers.ts` изменить `resolvePack` так, чтобы он возвращал не только пак, но и раскладку. Проще всего — отдельная функция рядом:

```ts
/** Пак и раскладка модификаторов. Раскладка считается один раз здесь: дальше
 *  она живёт в состоянии комнаты и не пересчитывается никогда. */
function resolveGameSetup(
  payload: CreateRoomPayload,
): { pack: Pack; modifierCells: Record<string, ModifierKind> } | string {
  const pack = resolvePack(payload);
  if (typeof pack === 'string') return pack;
  if (payload.gameId === undefined) return { pack, modifierCells: {} };
  const game = getGame(payload.gameId);
  if (!game) return 'Игра не найдена';
  return { pack, modifierCells: planModifierCells(pack, game.modifiers) };
}
```

и в обработчике:

```ts
    socket.on('room:create', (payload, ack) => {
      const setup = resolveGameSetup(payload);
      if (typeof setup === 'string') {
        ack({ ok: false, error: setup });
        return;
      }
      const { room, hostToken } = rooms.create(setup.pack, payload.settings, setup.modifierCells);
      // ...дальше как было
```

- [ ] **Step 4: Убедиться, что тесты проходят, и закоммитить**

```bash
npx vitest run && npm run typecheck
git add server/src/io/registerSocketHandlers.ts server/src/io/socket.integration.test.ts
git commit -m "feat(modifiers): раскладка клеток при создании комнаты по игре"
```

---

## Task 13: Экраны модификатора

**Files:**
- Create: `client/src/ui/scenes/ModifierScene.tsx`
- Modify: `client/src/routes/Board.tsx`
- Modify: `client/src/routes/Play.tsx`
- Modify: `client/src/ui/host/HostGame.tsx`
- Modify: `client/src/ui/host/SettingsPanel.tsx`
- Modify: `client/src/net/gameApi.ts`

**Interfaces:**
- Consumes: `ModifierView` (Task 9), промпт `modifier_swap` (Task 10), события `player:modifierTarget` (Task 10) и `host:giveHint` (Task 11).
- Produces: сцена модификатора на всех трёх экранах.

**Проверка:** `npm run typecheck` плюс руками — партия с включёнными модификаторами; проверить сцену на доске, выбор цели для обмена на телефоне, кнопку подсказки у ведущего.

- [ ] **Step 1: Написать сцену**

`client/src/ui/scenes/ModifierScene.tsx`:

```tsx
import { motion } from 'framer-motion';
import type { ModifierView, PlayerPublic } from '@svoyak/shared';
import { MODIFIER_HINTS, MODIFIER_TITLES } from '@svoyak/shared';
import { RoughFrame } from '../../design/rough.js';

interface ModifierSceneProps {
  modifier: ModifierView;
  players: PlayerPublic[];
}

/** Под клеткой оказался не вопрос, а модификатор. Показываем, что выпало
 *  и кому: счёт уже изменился, табло рядом покажет цифры. */
export function ModifierScene({ modifier, players }: ModifierSceneProps) {
  const name = (id: string | null): string =>
    players.find((player) => player.id === id)?.name ?? '—';

  return (
    <RoughFrame
      fill="var(--color-card)"
      seed={17}
      contentClassName="text-ink grid gap-4 px-8 py-10 text-center"
    >
      <p className="font-body text-ink/60 text-sm font-bold">вместо вопроса</p>
      <motion.p
        initial={{ scale: 0.6, rotate: -6, opacity: 0 }}
        animate={{ scale: 1, rotate: -2, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 16 }}
        className="font-pop text-[clamp(2.5rem,7vw,5rem)] font-black"
      >
        {MODIFIER_TITLES[modifier.kind]}
      </motion.p>
      <p className="font-body text-[clamp(1.2rem,2.5vw,2rem)] font-bold">
        {MODIFIER_HINTS[modifier.kind]}
      </p>
      <p className="font-body text-lg font-bold opacity-70">
        {modifier.kind === 'swap' && modifier.targetPlayerId === null
          ? `${name(modifier.playerId)} выбирает, с кем меняться`
          : modifier.kind === 'swap'
            ? `${name(modifier.playerId)} ↔ ${name(modifier.targetPlayerId)}`
            : name(modifier.playerId)}
      </p>
    </RoughFrame>
  );
}
```

- [ ] **Step 2: Показать сцену на доске**

В `client/src/routes/Board.tsx`, внутри `<AnimatePresence mode="wait">`, добавить ветку **первой** — до кота и аукциона:

```tsx
{view.modifier && view.phase === 'modifier' ? (
  <motion.div key="modifier" initial={{ scale: 0.92 }} animate={{ scale: 1 }}>
    <ModifierScene modifier={view.modifier} players={view.players} />
  </motion.div>
) : view.cat && (view.phase === 'cat_transfer' || view.phase === 'cat_answer') ? (
```

и импорт `ModifierScene`.

- [ ] **Step 3: Показать модификатор игроку**

В `client/src/routes/Play.tsx` добавить подпись фазы в существующий словарь (рядом с `answer_reveal: 'Раскрывают ответ'`):

```tsx
  modifier: 'Клетка с сюрпризом',
```

Выбор игрока для обмена — отдельный компонент. `CatPick` переиспользовать нельзя: он требует `theme`, `price` и `canKeep`, которых у обмена нет. Создать `client/src/ui/SwapPick.tsx`:

```tsx
import { motion } from 'framer-motion';
import { Avatar, colorForIndex } from '../design/Avatar.js';

interface SwapPickProps {
  candidates: Array<{ id: string; name: string }>;
  onPick: (playerId: string) => void;
}

/** Обмен счётом: открывший клетку выбирает, с кем меняется. */
export function SwapPick({ candidates, onPick }: SwapPickProps) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-4 overflow-y-auto">
      <p className="font-pop text-center text-2xl font-black">С кем меняешься счётом?</p>
      <ul className="grid gap-2">
        {candidates.map((candidate, index) => (
          <li key={candidate.id}>
            <motion.button
              onClick={() => onPick(candidate.id)}
              whileTap={{ scale: 0.96, x: 4, y: 5, boxShadow: '0px 0px 0 #1a1a1a' }}
              style={{ boxShadow: '6px 6px 0 #1a1a1a' }}
              className="ink-border bg-card text-ink flex w-full items-center gap-3 rounded-3xl px-4 py-3"
            >
              <Avatar seed={candidate.name} color={colorForIndex(index)} size={44} />
              <span className="font-pop text-2xl font-black">{candidate.name}</span>
            </motion.button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

В `Play.tsx`, рядом с веткой промпта `cat_pick`, добавить ветку обмена:

```tsx
{view.prompt.kind === 'modifier_swap' && (
  <SwapPick
    candidates={view.prompt.candidates}
    onPick={(targetPlayerId) => void send('player:modifierTarget', { targetPlayerId })}
  />
)}
```

и, когда выбор уже не нужен, показать, что выпало:

```tsx
{view.phase === 'modifier' && view.modifier && view.prompt.kind !== 'modifier_swap' && (
  <div className="px-4">
    <ModifierScene modifier={view.modifier} players={view.players} />
  </div>
)}
```

Имя функции отправки (`send`) взять из соседних веток того же файла — там она уже используется для `player:catTransfer`.

- [ ] **Step 4: Панель ведущего**

В `client/src/ui/host/HostGame.tsx` добавить ветку фазы модификатора. Она самостоятельная: вопроса нет, поэтому «Показать ответ» и «Снять вопрос» в ней не показываются.

```tsx
{view.phase === 'modifier' && view.modifier ? (
  <RoughFrame fill="var(--color-card)" seed={13} contentClassName="text-ink grid gap-3 p-6 text-center">
    <p className="font-body text-ink/60 text-sm font-bold">вместо вопроса выпало</p>
    <p className="font-pop text-3xl font-black">{MODIFIER_TITLES[view.modifier.kind]}</p>
    <p className="font-body text-sm font-bold opacity-70">
      {MODIFIER_HINTS[view.modifier.kind]} —{' '}
      {view.players.find((player) => player.id === view.modifier?.playerId)?.name ?? '—'}
    </p>
    {view.modifier.kind === 'swap' && view.modifier.targetPlayerId === null && (
      <p className="font-body text-sm font-bold opacity-70">ждём выбора игрока на телефоне</p>
    )}
    <DoodleButton tone="p1" className="justify-self-center" onClick={() => send('host:continue')}>
      Дальше
    </DoodleButton>
  </RoughFrame>
) : (
  /* существующая разметка вопроса остаётся здесь без изменений */
)}
```

В списке игроков — значок жетона и кнопка траты:

```tsx
{player.hints > 0 && (
  <button
    type="button"
    onClick={() => send('host:giveHint', { playerId: player.id })}
    className="ink-border bg-gold font-body rounded-xl px-2 py-1 text-xs font-bold"
    title="Подсказка: скажите её вслух, жетон спишется"
  >
    подсказка ×{player.hints}
  </button>
)}
```

Добавить импорт `MODIFIER_HINTS`, `MODIFIER_TITLES` из `@svoyak/shared`.

- [ ] **Step 5: Настройка длительности сцены**

В `client/src/ui/host/SettingsPanel.tsx`, в раскрывающемся блоке рядом с «Показ ответа, мс»:

```tsx
<NumberField
  label="Сцена модификатора, мс"
  hint="0 — закрывает ведущий"
  step={1000}
  value={settings.modifierMs}
  onChange={(modifierMs) => onChange({ modifierMs })}
/>
```

- [ ] **Step 6: Проверить**

Run: `npm run typecheck`

Руками: собрать игру с `perRound: 3` и всеми восемью видами, начать партию вдвоём, открывать клетки до появления модификаторов. Проверить: доска показывает сцену, счёт меняется, право хода остаётся, обмен просит выбрать игрока на телефоне, подсказка даёт значок у ведущего и тратится по кнопке.

- [ ] **Step 7: Коммит**

```bash
git add client/src
git commit -m "feat(modifiers): сцена модификатора на доске, телефоне и у ведущего"
```

---

## Task 14: Документация

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Дописать раздел про игры**

После раздела «Свои вопросы» добавить раздел «Игры» с объяснением: пак — это содержимое, игра — состав вечера; конструктор живёт на `/games`; сохранённая игра выбирается на `/host`; игра хранит указатели на темы, поэтому правка пака подтягивается, а удаление пака игра честно показывает как поломку.

- [ ] **Step 2: Дописать раздел про модификаторы**

После раздела «Спецвопросы» добавить «Модификаторы» с таблицей из восьми видов и их эффектов, и тремя правилами: под клеткой нет вопроса, клетка неотличима от обычной до открытия, право хода остаётся у открывшего.

- [ ] **Step 3: Дополнить таблицу настроек**

В таблицу «Настройки комнаты» добавить строки `answerRevealMs` (10000 — сколько держать ответ на экране, 0 — закрывает ведущий) и `modifierMs` (6000 — сколько держать сцену модификатора, 0 — закрывает ведущий).

- [ ] **Step 4: Коммит**

```bash
git add README.md
git commit -m "docs: игры и модификаторы в README"
```
