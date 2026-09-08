import { Router } from 'express';
import type { Pack } from '@svoyak/shared';
import { validatePack } from '@svoyak/shared';
import { makeBlankPack } from '../packs/blank.js';
import { deletePack, getPack, listPacks, savePack } from '../storage/packsRepo.js';

const MAX_TITLE = 80;

/** REST для лобби и редактора: паки читаются и правятся без запущенной игры. */
export function packsRouter(): Router {
  const router = Router();

  router.get('/packs', (_req, res) => {
    res.json({ packs: listPacks() });
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
