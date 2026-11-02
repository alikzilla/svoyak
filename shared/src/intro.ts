import type { Pack } from './pack.js';
import type { TimerView } from './state.js';

/** Заставки начала игры и раунда. Длительность считает сервер — по ней он сам
 *  переводит игру к табло, — а общий экран по тем же числам раскладывает
 *  анимацию, чтобы после перезагрузки продолжить с того же места. */

/** «Темы игры»: список плывёт снизу вверх с постоянной скоростью. */
export const GAME_INTRO_PER_THEME_MS = 800;
export const GAME_INTRO_MIN_MS = 6000;
export const GAME_INTRO_MAX_MS = 25000;

/** Заставка раунда: название, потом темы выскакивают по одной, потом пауза. */
export const ROUND_INTRO_TITLE_MS = 2200;
export const ROUND_INTRO_POP_MS = 700;
export const ROUND_INTRO_HOLD_MS = 1500;

/** Все темы пака одним списком: раунды по порядку, финал в конце. */
export function gameThemeTitles(pack: Pack): string[] {
  return [
    ...pack.rounds.flatMap((round) => round.themes.map((theme) => theme.title)),
    ...pack.final.themes.map((theme) => theme.title),
  ];
}

export function gameIntroMs(themeCount: number): number {
  return Math.min(GAME_INTRO_MAX_MS, Math.max(GAME_INTRO_MIN_MS, themeCount * GAME_INTRO_PER_THEME_MS));
}

export function roundIntroMs(themeCount: number): number {
  return ROUND_INTRO_TITLE_MS + themeCount * ROUND_INTRO_POP_MS + ROUND_INTRO_HOLD_MS;
}

/** Сколько заставки уже прошло к моменту `now` (серверное время). Без таймера
 *  заставки — например, после перезапуска сервера — считаем её доигранной:
 *  экран показывает всё сразу, а дальше ведущий жмёт «Пропустить». */
export function introElapsedMs(timer: TimerView | null, now: number): number {
  if (!timer || timer.kind !== 'intro') return Number.POSITIVE_INFINITY;
  const left = timer.remainingMs ?? timer.endsAt - now;
  return Math.min(timer.totalMs, Math.max(0, timer.totalMs - left));
}

export interface RoundIntroStage {
  /** Название отыграло и ушло наверх — пошли темы. */
  titleDone: boolean;
  /** Сколько тем уже выскочило. */
  shown: number;
}

export function roundIntroStage(elapsedMs: number, themeCount: number): RoundIntroStage {
  if (elapsedMs < ROUND_INTRO_TITLE_MS) return { titleDone: false, shown: 0 };
  const popped = Math.floor((elapsedMs - ROUND_INTRO_TITLE_MS) / ROUND_INTRO_POP_MS) + 1;
  return { titleDone: true, shown: Math.min(themeCount, popped) };
}
