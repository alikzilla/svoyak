# Свояк: комнаты и синхронизация (этап 2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ведущий создаёт комнату с кодом и QR, игроки заходят с телефонов, все видят согласованный список участников и счёт; комната переживает перезагрузку страницы у любого участника и перезапуск сервера.

**Architecture:** Игровая логика — чистый редьюсер `reduce(state, action) → {state, effects}` без I/O и таймеров. Побочные действия описываются эффектами и исполняются `RoomRuntime`, который также держит стек undo, дебаунсит автосохранение и рассылает проекции. Сокет-слой только переводит события в действия и проверяет права.

**Tech Stack:** Node 24, Socket.IO 4, Vitest 5, React 19.

**Spec:** `docs/superpowers/specs/2026-09-08-svoyak-design.md`

## Global Constraints

- Правильные ответы и `sessionToken` не покидают сервер в проекции игрока — проверяется тестом.
- Действия применяются только к своей роли: игрок не может вызвать `host:*`.
- Все сокет-обработчики отвечают через `Ack<T>`; ошибки — это `{ ok: false, error }`, а не исключения.
- Автосохранение комнаты — дебаунс 200 мс, атомарная запись.
- Комнаты старше 24 часов при загрузке с диска отбрасываются.

---

### Task 1: Инициализация комнаты и доска раунда

**Files:**
- Create: `server/src/engine/createRoom.ts`, `server/src/engine/board.ts`
- Test: `server/src/engine/createRoom.test.ts`

**Interfaces:**
- Produces: `buildBoard(round: Round): BoardTheme[]`;
  `createRoomState(args: { code: string; pack: Pack; settings: RoomSettings; hostToken: string }): RoomState`.

- [ ] **Step 1: Тест доски и начального состояния**

```ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS } from '@svoyak/shared';
import { demoClassicPack } from '../packs/demo/classic.js';
import { createRoomState } from './createRoom.js';

const room = () =>
  createRoomState({ code: '1234', pack: demoClassicPack, settings: DEFAULT_SETTINGS, hostToken: 'h' });

describe('createRoomState', () => {
  it('стартует в лобби без игроков и без права хода', () => {
    const state = room();
    expect(state.phase).toBe('lobby');
    expect(state.players).toEqual([]);
    expect(state.controlPlayerId).toBeNull();
  });

  it('строит доску первого раунда с ценами пака и непройденными клетками', () => {
    const state = room();
    expect(state.board).toHaveLength(4);
    expect(state.board[0]!.cells.map((c) => c.price)).toEqual([100, 200, 300, 400, 500]);
    expect(state.board.every((t) => t.cells.every((c) => !c.played))).toBe(true);
  });
});
```

- [ ] **Step 2: Запустить тест, убедиться что падает**

Run: `npx vitest run server/src/engine/createRoom.test.ts` → FAIL, модуля нет.

- [ ] **Step 3: Реализовать `buildBoard` и `createRoomState`**
- [ ] **Step 4: Тест зелёный**
- [ ] **Step 5: Commit** — `feat(engine): начальное состояние комнаты и доска раунда`

---

### Task 2: Редьюсер лобби — вход, переподключение, счёт, кик

**Files:**
- Create: `server/src/engine/actions.ts`, `server/src/engine/reducer.ts`, `server/src/engine/players.ts`
- Test: `server/src/engine/reducer.lobby.test.ts`

**Interfaces:**
- Produces:
  `type GameAction` — union действий; на этом этапе: `PLAYER_JOIN`, `PLAYER_RECONNECT`, `PLAYER_DISCONNECT`, `PLAYER_KICK`, `SET_SCORE`, `SET_SETTINGS`, `HOST_PRESENCE`.
  `type Effect = { type: 'persist' } | { type: 'sound'; sound: SoundId } | { type: 'toast'; ... }`.
  `reduce(state: RoomState, action: GameAction): { state: RoomState; effects: Effect[] }` — чистая функция, новый объект состояния.

- [ ] **Step 1: Тесты поведения лобби**

```ts
it('вход добавляет игрока с нулевым счётом', ...);
it('имя занято другим подключённым игроком — вход отклоняется', ...);
it('переподключение по токену сохраняет счёт и не создаёт второго игрока', ...);
it('отключение помечает игрока, но не удаляет и не сбрасывает счёт', ...);
it('кик удаляет игрока', ...);
it('правка счёта ставит точное значение', ...);
it('при allowNegative=false счёт не опускается ниже нуля', ...);
```

- [ ] **Step 2: Запустить, убедиться что падают**
- [ ] **Step 3: Реализовать редьюсер**
- [ ] **Step 4: Тесты зелёные**
- [ ] **Step 5: Commit** — `feat(engine): редьюсер лобби`

---

### Task 3: Проекции ролей и запрет утечки ответа

**Files:**
- Create: `server/src/room/projections.ts`
- Test: `server/src/room/projections.test.ts`

**Interfaces:**
- Produces: `projectForHost(state, joinUrl): HostView`; `projectForPlayer(state, playerId): PlayerView`; `projectForBoard(state, joinUrl): BoardView`.

- [ ] **Step 1: Тест безопасности проекции**

Собрать состояние с активным вопросом (заполнить `state.active` вручную) и проверить, что
`JSON.stringify(projectForPlayer(...))` не содержит ни текста правильного ответа, ни
`hostComment`, ни `sessionToken`, а `projectForHost` их содержит. После раскрытия ответа
(`active.answerRevealed = true`) ответ появляется и у игрока.

- [ ] **Step 2: Запустить, убедиться что падает**
- [ ] **Step 3: Реализовать проекции**
- [ ] **Step 4: Тесты зелёные**
- [ ] **Step 5: Commit** — `feat(room): проекции ролей`

---

### Task 4: Undo, таймеры и автосохранение — RoomRuntime

**Files:**
- Create: `server/src/room/RoomRuntime.ts`, `server/src/room/undo.ts`, `server/src/storage/roomsRepo.ts`
- Test: `server/src/room/undo.test.ts`

**Interfaces:**
- Produces: `cloneState(state: RoomState): RoomState` — глубокая копия изменяемой части, `pack` переиспользуется по ссылке;
  `class RoomRuntime { dispatch(action): void; undo(): boolean; view(role, playerId?): AnyView; onChange(cb): void }`;
  `saveRoom(state): void`, `loadRooms(maxAgeMs: number): RoomState[]`.

- [ ] **Step 1: Тест undo**

```ts
it('undo возвращает счёт к значению до правки', ...);
it('undo пустого стека возвращает false и не меняет состояние', ...);
it('глубина стека ограничена 50 снимками', ...);
```

- [ ] **Step 2: Запустить, убедиться что падают**
- [ ] **Step 3: Реализовать**
- [ ] **Step 4: Тесты зелёные**
- [ ] **Step 5: Commit** — `feat(room): undo, таймеры и автосохранение`

---

### Task 5: Менеджер комнат и коды

**Files:**
- Create: `server/src/room/RoomManager.ts`, `server/src/room/roomCode.ts`
- Test: `server/src/room/roomCode.test.ts`

**Interfaces:**
- Produces: `generateRoomCode(taken: Set<string>): string` — 4 цифры, при исчерпании — 5;
  `class RoomManager { create(packId, settings): RoomRuntime; get(code): RoomRuntime | undefined; restoreFromDisk(): void }`.

- [ ] **Step 1: Тест генерации кода** — код из 4 цифр, не совпадает с занятыми, при полном заполнении переходит на 5 цифр.
- [ ] **Step 2: Падает**
- [ ] **Step 3: Реализовать**
- [ ] **Step 4: Зелёный**
- [ ] **Step 5: Commit** — `feat(room): менеджер комнат и генерация кодов`

---

### Task 6: Сокет-слой и синхронизация часов

**Files:**
- Create: `server/src/io/registerSocketHandlers.ts`, `server/src/io/clock.ts`
- Modify: `server/src/main.ts`
- Create: `server/src/http/packsApi.ts` (`GET /api/packs`, `GET /api/packs/:id`)

**Interfaces:**
- Consumes: `RoomManager`, проекции.
- Produces: типизированный `Server<ClientToServerEvents, ServerToClientEvents>`; обработчики `clock:ping`, `room:create`, `room:join`, `room:rejoin`, `room:watch`, `host:adjustScore`, `host:kick`, `host:undo`, `host:updateSettings`.

- [ ] **Step 1: Реализовать обработчики** — роль и права проверяются по данным сокета, а не по присланным полям.
- [ ] **Step 2: Ручная проверка** — два браузера, `state:sync` приходит обоим.
- [ ] **Step 3: Commit** — `feat(io): сокет-слой комнат и синхронизация часов`

---

### Task 7: Экраны ведущего, игрока и табло

**Files:**
- Create: `client/src/net/socket.ts`, `client/src/net/useRoom.ts`, `client/src/net/useClock.ts`, `client/src/ui/QrCode.tsx`, `client/src/ui/PlayerList.tsx`
- Modify: `client/src/routes/{Host,Join,Play,Board}.tsx`

**Interfaces:**
- Produces: `useRoom()` — подписка на `state:sync` с типами по роли; `useClock()` — офсет часов и минимальный RTT для честной кнопки.

- [ ] **Step 1: Транспорт и хуки** — токены в `localStorage`, автоматический `room:rejoin` при загрузке страницы.
- [ ] **Step 2: Экран ведущего** — выбор пака, создание комнаты, код и QR крупно, список игроков, правка счёта, кик, undo.
- [ ] **Step 3: Экран игрока** — вход по коду и имени, свой счёт и счёт остальных, статус ожидания.
- [ ] **Step 4: Табло** — код, QR, список игроков со счётом.
- [ ] **Step 5: Ручная проверка** — телефон заходит по QR, F5 не теряет игрока, перезапуск сервера сохраняет комнату.
- [ ] **Step 6: Commit** — `feat(client): экраны лобби`

---

## Проверка человеком после этапа

1. Открыть `/host`, создать комнату — появляются код и QR.
2. Зайти с двух телефонов по QR, ввести имена — оба видны у ведущего и на `/board`.
3. Обновить страницу на телефоне — игрок вернулся с тем же счётом.
4. Поправить счёт игроку, нажать undo — счёт вернулся.
5. Перезапустить сервер — комната и игроки на месте.
