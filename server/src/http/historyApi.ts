import { Router } from 'express';
import type { HistoryResponse } from '@svoyak/shared';
import { hallOfFame } from '../engine/history.js';
import { listResults } from '../storage/historyRepo.js';

/** «Зал славы»: сыгранные игры и игроки за все вечера. */
export function historyRouter(): Router {
  const router = Router();

  router.get('/history', (_req, res) => {
    const evenings = listResults();
    const body: HistoryResponse = { evenings, fame: hallOfFame(evenings) };
    res.json(body);
  });

  return router;
}
