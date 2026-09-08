import { Router } from 'express';
import { getPack, listPacks } from '../storage/packsRepo.js';

/** REST для лобби и редактора: паки читаются без запущенной игры. */
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

  return router;
}
