import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import type { Game, ModifierPlan } from '@svoyak/shared';
import { GAME_LIMITS, MODIFIER_KINDS } from '@svoyak/shared';
import { getPack } from '../storage/packsRepo.js';
import { resolveRecipe } from '../packs/compose.js';
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
    if (typeof kind !== 'string' || !(MODIFIER_KINDS as readonly string[]).includes(kind)) {
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

  // Подписанный состав уже сохранённой игры — без пересборки. Открытие игры
  // для правки не должно перебрасывать её темы: мастер использует /api/compose
  // отдельно, и только когда хост сам об этом просит.
  router.get('/games/:id/composition', (req, res) => {
    const game = getGame(req.params.id);
    if (!game) {
      res.status(404).json({ error: 'Игра не найдена' });
      return;
    }
    res.json({ resolution: resolveRecipe(game.recipe, getPack) });
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

    // Заголовок мог прийти чем угодно — тело не типизировано до этой точки.
    // Нестроковый заголовок ведём себя как отсутствующий: откатываемся к прежнему,
    // а не падаем на .trim() чужого типа.
    const title = typeof incoming.title === 'string' ? incoming.title.trim().slice(0, MAX_TITLE) : '';

    // Идентификатор берём из адреса: тело запроса не должно уметь писать в чужой файл.
    const game: Game = {
      ...incoming,
      id: existing.id,
      title: title || existing.title,
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
