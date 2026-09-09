import { Router } from 'express';
import type { ComposeRequest, Pack } from '@svoyak/shared';
import { validatePack } from '@svoyak/shared';
import { makeBlankPack } from '../packs/blank.js';
import { draftRecipe } from '../packs/compose.js';
import { deletePack, getPack, listPacks, savePack } from '../storage/packsRepo.js';

const MAX_TITLE = 80;

/** Границы состава: больше пяти раундов не влезает в вечер, меньше одной темы
 *  не бывает. Проверяем здесь, чтобы кривой запрос не дошёл до сборки. */
const LIMITS = {
  rounds: [1, 5],
  themesPerRound: [1, 8],
  finalThemes: [1, 8],
} as const;

const inRange = (value: unknown, [min, max]: readonly [number, number]): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

function readComposeRequest(body: unknown): ComposeRequest | string {
  if (typeof body !== 'object' || body === null) return 'Ожидается объект запроса';
  const raw = body as Record<string, unknown>;
  const packIds = raw['packIds'];
  if (!Array.isArray(packIds) || packIds.length === 0) return 'Выберите хотя бы один пак';
  if (!packIds.every((id): id is string => typeof id === 'string')) return 'Неверный список паков';
  if (!inRange(raw['rounds'], LIMITS.rounds)) return 'Раундов должно быть от 1 до 5';
  if (!inRange(raw['themesPerRound'], LIMITS.themesPerRound)) return 'Тем в раунде должно быть от 1 до 8';
  if (!inRange(raw['finalThemes'], LIMITS.finalThemes)) return 'Финальных тем должно быть от 1 до 8';
  const seed = raw['seed'];
  return {
    packIds,
    rounds: raw['rounds'],
    themesPerRound: raw['themesPerRound'],
    finalThemes: raw['finalThemes'],
    ...(typeof seed === 'number' ? { seed } : {}),
  };
}

/** REST для лобби и редактора: паки читаются и правятся без запущенной игры. */
export function packsRouter(): Router {
  const router = Router();

  router.get('/packs', (_req, res) => {
    res.json({ packs: listPacks() });
  });

  // Черновик состава игры. Собирает сервер: только он знает, какие паки лежат
  // на диске и хватает ли в них тем.
  router.post('/compose', (req, res) => {
    const request = readComposeRequest(req.body);
    if (typeof request === 'string') {
      res.status(400).json({ error: request });
      return;
    }
    try {
      res.json(draftRecipe(request, getPack));
    } catch (cause) {
      res.status(400).json({ error: cause instanceof Error ? cause.message : 'Не удалось собрать игру' });
    }
  });

  router.get('/packs/:id', (req, res) => {
    const pack = getPack(req.params.id);
    if (!pack) {
      res.status(404).json({ error: 'Пак не найден' });
      return;
    }
    res.json({ pack });
  });

  router.post('/packs', (req, res) => {
    const body: unknown = req.body;
    const title =
      typeof body === 'object' && body !== null && 'title' in body && typeof body.title === 'string'
        ? body.title.trim().slice(0, MAX_TITLE)
        : '';
    const pack = makeBlankPack(title === '' ? 'Новый пак' : title);
    savePack(pack);
    res.status(201).json({ pack });
  });

  router.put('/packs/:id', (req, res) => {
    const existing = getPack(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Пак не найден' });
      return;
    }

    const body: unknown = req.body;
    const incoming =
      typeof body === 'object' && body !== null && 'pack' in body
        ? (body.pack as Pack)
        : null;
    if (!incoming || typeof incoming !== 'object') {
      res.status(400).json({ error: 'Ожидается объект пака' });
      return;
    }

    if (!Array.isArray(incoming.rounds) || typeof incoming.final !== 'object' || incoming.final === null) {
      res.status(400).json({ error: 'Пак должен содержать раунды и финал' });
      return;
    }

    // Идентификатор берём из адреса: тело запроса не должно уметь писать в чужой файл.
    const pack: Pack = {
      ...incoming,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: Date.now(),
    };

    // Недоделанный пак сохраняем: правка идёт постепенно. Проблемы возвращаем,
    // чтобы редактор их показал, а играть таким паком не даст создание комнаты.
    savePack(pack);
    res.json({ pack, issues: validatePack(pack) });
  });

  router.delete('/packs/:id', (req, res) => {
    if (!getPack(req.params.id)) {
      res.status(404).json({ error: 'Пак не найден' });
      return;
    }
    deletePack(req.params.id);
    res.json({ ok: true });
  });

  return router;
}
