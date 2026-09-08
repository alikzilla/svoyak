# Свояк: редактор паков (этап 4) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Собрать свой пак без запущенной игры: раунды, темы, вопросы с медиа и спецтипами, быстрая вставка темы текстом, экспорт-импорт JSON, предупреждения о недоделках.

**Architecture:** Редактор работает поверх REST (`/api/packs`), а не сокетов — игра для него не нужна. Валидация и разбор текста живут в `shared/`, потому что нужны и клиенту (подсветка на лету), и серверу (не принимать мусор). Пак сохраняется целиком: он маленький, а частичные патчи — источник рассинхрона.

**Tech Stack:** Express 5, multer, React 19, @dnd-kit, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-09-08-svoyak-design.md`

## Global Constraints

- Идентификатор пака приходит от клиента — путь к файлу собирается только после проверки по `^[a-zA-Z0-9_-]+$`.
- Загрузка медиа ограничена 50 МБ и типами image/audio/video.
- Автосохранение с дебаунсом 800 мс; на экране всегда видно состояние («сохранено» / «сохраняем»).
- Редактирование пака не влияет на идущую игру: комната держит свою копию.

---

### Task 1: Валидация пака

**Files:**
- Create: `shared/src/validate.ts`
- Test: `shared/src/validate.test.ts`

**Interfaces:**
- Produces: `validatePack(pack: Pack): PackIssue[]`;
  `interface PackIssue { level: 'error' | 'warning'; message: string; path: { roundId?: string; themeId?: string; questionId?: string } }`.

- [ ] **Step 1: Тесты**

```ts
it('пустой ответ — ошибка');
it('пустой текст вопроса — ошибка');
it('тема без вопросов — предупреждение');
it('разное число вопросов в темах раунда — предупреждение');
it('повторяющиеся цены внутри темы — предупреждение');
it('кот в мешке без спецификации — ошибка');
it('финал без тем — ошибка');
it('корректный демо-пак не даёт ошибок');
```

- [ ] **Step 2: Падают** → **Step 3: Реализовать** → **Step 4: Зелёные**
- [ ] **Step 5: Commit** — `feat(shared): валидация пака`

---

### Task 2: Разбор темы из текста

**Files:**
- Create: `shared/src/parseTheme.ts`
- Test: `shared/src/parseTheme.test.ts`

**Interfaces:**
- Produces: `parseThemeText(text: string): { title: string | null; rows: ParsedRow[]; errors: string[] }`,
  где `ParsedRow = { price: number; text: string; answer: string; altAnswers: string[] }`.

Формат:

```
Тема: Название темы
100 | вопрос | ответ
200 | вопрос | ответ | альтернативный ответ; ещё один
```

- [ ] **Step 1: Тесты**

```ts
it('читает название темы и строки вопросов');
it('работает без строки «Тема:» — тогда название пустое');
it('принимает альтернативные ответы через точку с запятой в четвёртой колонке');
it('пропускает пустые строки и сообщает о строках без разделителей');
it('нечисловая цена — ошибка с номером строки');
it('лишние пробелы вокруг разделителей срезаются');
```

- [ ] **Step 2: Падают** → **Step 3: Реализовать** → **Step 4: Зелёные**
- [ ] **Step 5: Commit** — `feat(shared): разбор темы из текста`

---

### Task 3: REST редактора и загрузка медиа

**Files:**
- Modify: `server/src/http/packsApi.ts`
- Create: `server/src/http/mediaApi.ts`
- Test: `server/src/http/packsApi.test.ts`

**Interfaces:**
- Produces: `POST /api/packs` (создать пустой пак), `PUT /api/packs/:id` (сохранить целиком),
  `DELETE /api/packs/:id`, `POST /api/packs/:id/media` (multipart, поле `file`) → `{ media: Media }`.

- [ ] **Step 1: Тесты через настоящий HTTP** — поднять express на случайном порту и ходить `fetch`.

```ts
it('создаёт пак и возвращает его идентификатор');
it('сохраняет пак целиком и читает обратно');
it('отклоняет пак с ошибками валидации');
it('идентификатор с ../ не даёт выйти за пределы папки паков');
it('удаляет пак');
```

- [ ] **Step 2: Падают** → **Step 3: Реализовать** → **Step 4: Зелёные**
- [ ] **Step 5: Commit** — `feat(server): REST редактора паков и загрузка медиа`

---

### Task 4: Список паков и создание

**Files:**
- Create: `client/src/routes/Editor.tsx` (переписать), `client/src/editor/api.ts`
- Create: `client/src/editor/PackList.tsx`

- [ ] **Step 1: Список паков** — карточки с названием, числом вопросов, датой правки.
- [ ] **Step 2: Создать пак, дублировать, удалить** (удаление с подтверждением в две ступени).
- [ ] **Step 3: Импорт JSON файлом и экспорт скачиванием.**
- [ ] **Step 4: Commit** — `feat(editor): список паков, создание и импорт`

---

### Task 5: Правка пака

**Files:**
- Create: `client/src/editor/PackEditor.tsx`, `client/src/editor/QuestionForm.tsx`, `client/src/editor/ThemeCard.tsx`
- Create: `client/src/editor/useAutosave.ts`

- [ ] **Step 1: Дерево пака** — раунды, темы, вопросы; сворачивание тем.
- [ ] **Step 2: Форма вопроса** — текст, ответ, альтернативы, комментарий ведущего, цена, тип; для кота — тема, цена и «можно оставить себе».
- [ ] **Step 3: Дублирование и удаление темы и вопроса.**
- [ ] **Step 4: Автосохранение с индикатором.**
- [ ] **Step 5: Панель предупреждений** — список проблем с переходом к нужному вопросу.
- [ ] **Step 6: Commit** — `feat(editor): правка раундов, тем и вопросов`

---

### Task 6: Быстрая вставка, медиа и сортировка

**Files:**
- Create: `client/src/editor/QuickPaste.tsx`, `client/src/editor/MediaField.tsx`

- [ ] **Step 1: Быстрая вставка темы текстом** с предпросмотром разобранных строк.
- [ ] **Step 2: Загрузка медиа** для вопроса и для ответа, с проигрыванием.
- [ ] **Step 3: Перетаскивание** тем внутри раунда и вопросов внутри темы (@dnd-kit).
- [ ] **Step 4: Commit** — `feat(editor): быстрая вставка, медиа и перетаскивание`

---

## Проверка человеком после этапа

1. Создать пак, добавить тему быстрой вставкой, поправить пару вопросов.
2. Загрузить картинку в вопрос и проверить, что она видна игрокам в игре.
3. Экспортировать пак в JSON, удалить, импортировать обратно.
4. Сыграть этим паком.
