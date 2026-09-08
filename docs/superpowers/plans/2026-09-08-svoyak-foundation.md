# Свояк: фундамент (этапы 0–1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Поднять монорепо, в котором `npm run dev` запускает сервер и клиент, телефон подключается по QR из локальной сети, а все игровые типы описаны в `shared/` и проверены компилятором на реальном демо-паке.

**Architecture:** npm workspaces из трёх пакетов. `shared` подключается исходниками через tsconfig `paths` (сервер под tsx) и `resolve.alias` (Vite) — промежуточной сборки нет. Демо-паки авторятся как TypeScript и компилируются в JSON скриптом, поэтому модель пака проверяется компилятором, а не глазами.

**Tech Stack:** TypeScript 5, Node 24, Express 5, Socket.IO 4, React 19, Vite 7, Tailwind 4, Vitest 3, tsx, concurrently, qrcode-terminal.

**Spec:** `docs/superpowers/specs/2026-09-08-svoyak-design.md`

## Global Constraints

- TypeScript везде, `strict: true`, `any` запрещён в `shared/` и в публичных сигнатурах сервера.
- Интерфейс на русском языке.
- Порты: сервер 3001, клиент 5173. Vite проксирует `/api`, `/uploads`, `/socket.io` на 3001.
- Vite слушает на `0.0.0.0` (`server.host: true`), иначе телефон не подключится.
- Данные: `data/packs`, `data/rooms`, `data/history`, `uploads/` — в `.gitignore`, кроме `data/packs` с демо-паками.
- Коммит после каждой задачи.

---

### Task 1: Скелет монорепо и общий tsconfig

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `.gitignore`, `.nvmrc`
- Create: `shared/package.json`, `shared/tsconfig.json`, `shared/src/index.ts`

**Interfaces:**
- Produces: workspace `@svoyak/shared` с точкой входа `shared/src/index.ts`; алиас `@svoyak/shared` в `tsconfig.base.json` → `shared/src/index.ts`; корневые скрипты `dev`, `typecheck`, `test`.

- [ ] **Step 1: Корневой package.json**

```json
{
  "name": "svoyak",
  "private": true,
  "type": "module",
  "workspaces": ["shared", "server", "client"],
  "scripts": {
    "dev": "concurrently -n server,client -c cyan,magenta \"npm:dev:server\" \"npm:dev:client\"",
    "dev:server": "npm run dev -w server",
    "dev:client": "npm run dev -w client",
    "typecheck": "npm run typecheck -w shared && npm run typecheck -w server && npm run typecheck -w client",
    "test": "vitest run",
    "build:packs": "npm run build:packs -w server"
  }
}
```

- [ ] **Step 2: tsconfig.base.json с алиасом shared**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "verbatimModuleSyntax": true,
    "baseUrl": ".",
    "paths": { "@svoyak/shared": ["shared/src/index.ts"] }
  }
}
```

- [ ] **Step 3: .gitignore**

```
node_modules/
dist/
uploads/
data/rooms/
data/history/
*.log
.DS_Store
```

- [ ] **Step 4: Проверить установку**

Run: `npm install`
Expected: три workspace-пакета слинкованы, ошибок нет.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: скелет монорепо на npm workspaces"
```

---

### Task 2: Сервер-заглушка с health, LAN-IP и QR

**Files:**
- Create: `server/package.json`, `server/tsconfig.json`, `server/src/main.ts`, `server/src/net/lan.ts`
- Test: `server/src/net/lan.test.ts`

**Interfaces:**
- Produces: `getLanAddress(): string | null` из `server/src/net/lan.ts`; HTTP-эндпоинт `GET /api/health` → `{ ok: true }`; сервер слушает `0.0.0.0:3001`.

- [ ] **Step 1: Тест на выбор LAN-адреса**

```ts
import { describe, it, expect } from 'vitest';
import { pickLanAddress } from './lan.js';

describe('pickLanAddress', () => {
  it('выбирает внешний IPv4 и игнорирует loopback и internal', () => {
    expect(pickLanAddress({
      lo0: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
      en0: [{ address: '192.168.1.42', family: 'IPv4', internal: false }],
    })).toBe('192.168.1.42');
  });

  it('игнорирует IPv6 и возвращает null, если внешних IPv4 нет', () => {
    expect(pickLanAddress({
      lo0: [{ address: '::1', family: 'IPv6', internal: true }],
    })).toBeNull();
  });
});
```

- [ ] **Step 2: Запустить тест, убедиться что падает**

Run: `npx vitest run server/src/net/lan.test.ts`
Expected: FAIL — модуль `./lan.js` не найден.

- [ ] **Step 3: Реализация lan.ts**

```ts
import os from 'node:os';

export interface NetIface { address: string; family: string; internal: boolean }

export function pickLanAddress(ifaces: Record<string, NetIface[] | undefined>): string | null {
  for (const list of Object.values(ifaces)) {
    for (const i of list ?? []) {
      if (i.family === 'IPv4' && !i.internal) return i.address;
    }
  }
  return null;
}

export function getLanAddress(): string | null {
  return pickLanAddress(os.networkInterfaces() as Record<string, NetIface[] | undefined>);
}
```

- [ ] **Step 4: Тест зелёный**

Run: `npx vitest run server/src/net/lan.test.ts`
Expected: PASS

- [ ] **Step 5: main.ts — Express + Socket.IO + печать QR**

Express 5, `cors()` для дев-режима, `GET /api/health`, Socket.IO поверх http-сервера. После `listen` печатает в консоль локальную и LAN-ссылку на `http://<ip>:5173` и ASCII-QR через `qrcode-terminal`.

- [ ] **Step 6: Ручная проверка**

Run: `npm run dev:server`
Expected: в консоли адрес и QR; `curl localhost:3001/api/health` → `{"ok":true}`.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(server): заглушка сервера, LAN-адрес и QR при старте"
```

---

### Task 3: Клиент-заглушка на Vite + React + Tailwind

**Files:**
- Create: `client/package.json`, `client/tsconfig.json`, `client/vite.config.ts`, `client/index.html`, `client/src/main.tsx`, `client/src/App.tsx`, `client/src/index.css`, `client/src/routes/{Landing,Host,Join,Play,Board,Editor}.tsx`

**Interfaces:**
- Consumes: сервер на 3001 (Task 2).
- Produces: маршруты `/`, `/host`, `/join`, `/play`, `/board`, `/editor`; тёмная тема как базовый стиль в `index.css`.

- [ ] **Step 1: vite.config.ts с прокси и внешним хостом**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwind()],
  resolve: { alias: { '@svoyak/shared': path.resolve(import.meta.dirname, '../shared/src/index.ts') } },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/uploads': 'http://localhost:3001',
      '/socket.io': { target: 'http://localhost:3001', ws: true },
    },
  },
});
```

- [ ] **Step 2: index.html с мета для мобилки**

`<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">`, `lang="ru"`, тёмный `theme-color`.

- [ ] **Step 3: Маршруты-заглушки**

Каждая страница — экран с названием роли и ссылкой назад, чтобы можно было проверить навигацию с телефона.

- [ ] **Step 4: Ручная проверка**

Run: `npm run dev` из корня.
Expected: `http://localhost:5173` открывается, все шесть маршрутов рисуются, страница `/api/health` доступна через прокси, телефон по LAN-адресу видит то же самое.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(client): каркас на Vite/React/Tailwind с маршрутами ролей"
```

---

### Task 4: Типы предметной области в shared/

**Files:**
- Create: `shared/src/pack.ts`, `shared/src/settings.ts`, `shared/src/state.ts`, `shared/src/events.ts`
- Modify: `shared/src/index.ts` (реэкспорт)

**Interfaces:**
- Produces: `Pack`, `Round`, `Theme`, `Question`, `QuestionType`, `Media`, `FinalRound`, `FinalTheme` (`pack.ts`); `RoomSettings`, `DEFAULT_SETTINGS` (`settings.ts`); `RoomState`, `Phase`, `Player`, `BoardCell`, `HostView`, `PlayerView`, `BoardView` (`state.ts`); `ClientToServerEvents`, `ServerToClientEvents` (`events.ts`).

Содержание типов — раздел 3 спека. Ключевые требования:
`QuestionType = 'normal' | 'cat' | 'auction'`; `Question.altAnswers: string[]`;
`Phase` — union из раздела 3.4; вьюхи ролей — отдельные типы, а не `Partial<RoomState>`,
чтобы компилятор не дал случайно положить `answer` в `PlayerView`.

- [ ] **Step 1: Написать типы пака и настроек**
- [ ] **Step 2: Написать типы состояния и трёх проекций**
- [ ] **Step 3: Написать типы сокет-событий (без `any`)**
- [ ] **Step 4: Проверка**

Run: `npm run typecheck`
Expected: без ошибок.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(shared): типы пака, состояния комнаты и сокет-событий"
```

---

### Task 5: Демо-пак как TypeScript + сборка в JSON

**Files:**
- Create: `server/src/packs/demo/classic.ts`, `server/src/packs/buildDemoPacks.ts`
- Test: `server/src/packs/demo/classic.test.ts`

**Interfaces:**
- Consumes: `Pack` из `@svoyak/shared`.
- Produces: `demoClassicPack: Pack`; скрипт `npm run build:packs` пишет `data/packs/<id>.json`.

- [ ] **Step 1: Тест структуры демо-пака**

```ts
import { describe, it, expect } from 'vitest';
import { demoClassicPack } from './classic.js';

describe('демо-пак', () => {
  it('содержит два раунда и финал', () => {
    expect(demoClassicPack.rounds).toHaveLength(2);
    expect(demoClassicPack.final.themes.length).toBeGreaterThanOrEqual(4);
  });

  it('во втором раунде цены удвоены относительно первого', () => {
    const prices = (r: number) => demoClassicPack.rounds[r]!.themes[0]!.questions.map(q => q.price);
    expect(prices(1)).toEqual(prices(0).map(p => p * 2));
  });

  it('у каждого вопроса есть непустой ответ', () => {
    for (const round of demoClassicPack.rounds)
      for (const theme of round.themes)
        for (const q of theme.questions)
          expect(q.answer.trim()).not.toBe('');
  });
});
```

- [ ] **Step 2: Запустить, убедиться что падает**

Run: `npx vitest run server/src/packs/demo/classic.test.ts`
Expected: FAIL — модуля нет.

- [ ] **Step 3: Написать демо-пак**

Русский пак: 2 раунда по 4 темы × 5 вопросов (цены 100–500 и 200–1000), минимум один вопрос типа `cat` и один `auction`, финал из 5 тем.

- [ ] **Step 4: Тесты зелёные, JSON собирается**

Run: `npx vitest run server/src/packs/demo/classic.test.ts && npm run build:packs`
Expected: PASS, файл `data/packs/demo-classic.json` создан.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(packs): демо-пак и сборка паков в JSON"
```

---

## Проверка человеком после этапа

1. `npm install && npm run dev` — сервер печатает LAN-ссылку и QR.
2. С телефона в той же сети открыть QR — грузится страница `/join`.
3. `npm run typecheck` и `npm test` — зелёные.
4. `data/packs/demo-classic.json` открывается и читается.

Дальше — план на этапы 2–3 (комнаты, проекции, игровой цикл), пишется отдельно.
