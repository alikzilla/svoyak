import type { TimerView } from './state.js';

export interface TimerLeft {
  /** Сколько осталось, мс. */
  ms: number;
  /** Доля оставшегося времени, 0…1 — для полосы. */
  progress: number;
  /** Целые секунды для подписи: 0.3 с ещё показываются как 1. */
  seconds: number;
}

/**
 * Остаток таймера на момент `now`. Пока таймер идёт, сервер шлёт только момент
 * окончания, поэтому остаток надо пересчитывать каждый кадр; на паузе сервер
 * присылает готовый остаток, и часы клиента в расчёте не участвуют.
 */
export function timerLeft(timer: TimerView, now: number): TimerLeft {
  const ms = timer.remainingMs ?? Math.max(0, timer.endsAt - now);
  const progress = timer.totalMs > 0 ? Math.min(1, ms / timer.totalMs) : 0;
  return { ms, progress, seconds: Math.ceil(ms / 1000) };
}
