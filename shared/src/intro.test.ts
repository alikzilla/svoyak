import { describe, it, expect } from 'vitest';
import type { Pack } from './pack.js';
import {
  GAME_INTRO_MAX_MS,
  GAME_INTRO_MIN_MS,
  GAME_INTRO_PER_THEME_MS,
  ROUND_INTRO_HOLD_MS,
  ROUND_INTRO_POP_MS,
  ROUND_INTRO_TITLE_MS,
  gameIntroMs,
  gameThemeTitles,
  introElapsedMs,
  roundIntroMs,
  roundIntroStage,
} from './intro.js';
import type { TimerView } from './state.js';

const theme = (id: string, title: string) => ({ id, title, questions: [] });
const finalTheme = (id: string, title: string) => ({
  id,
  title,
  question: { id: `${id}-q`, text: '', answer: '', altAnswers: [] },
});

const pack: Pack = {
  id: 'p',
  title: 'Пак',
  createdAt: 0,
  updatedAt: 0,
  rounds: [
    { id: 'r1', title: 'Первый', themes: [theme('a', 'Кино'), theme('b', 'Космос')] },
    { id: 'r2', title: 'Второй', themes: [theme('c', 'История')] },
  ],
  final: { themes: [finalTheme('f1', 'Литература'), finalTheme('f2', 'Спорт')] },
};

describe('темы игры', () => {
  it('идут раундами по порядку, финал — в конце', () => {
    expect(gameThemeTitles(pack)).toEqual(['Кино', 'Космос', 'История', 'Литература', 'Спорт']);
  });
});

describe('длительность заставки «Темы игры»', () => {
  it('растёт с числом тем', () => {
    expect(gameIntroMs(20)).toBe(20 * GAME_INTRO_PER_THEME_MS);
  });

  it('не короче минимума, даже если тем мало', () => {
    expect(gameIntroMs(1)).toBe(GAME_INTRO_MIN_MS);
  });

  it('не длиннее максимума, даже если тем очень много', () => {
    expect(gameIntroMs(500)).toBe(GAME_INTRO_MAX_MS);
  });
});

describe('длительность заставки раунда', () => {
  it('название, затем темы по одной, затем пауза', () => {
    expect(roundIntroMs(6)).toBe(ROUND_INTRO_TITLE_MS + 6 * ROUND_INTRO_POP_MS + ROUND_INTRO_HOLD_MS);
  });
});

describe('сколько заставки уже прошло', () => {
  const timer = (over: Partial<TimerView> = {}): TimerView => ({
    kind: 'intro',
    endsAt: 10_000,
    totalMs: 8000,
    remainingMs: null,
    ...over,
  });

  it('считается по серверному окончанию таймера', () => {
    expect(introElapsedMs(timer(), 5000)).toBe(3000);
  });

  it('на паузе — по замороженному остатку, часы не участвуют', () => {
    expect(introElapsedMs(timer({ remainingMs: 6000 }), 99_999)).toBe(2000);
  });

  it('не уходит за длительность и не бывает отрицательным', () => {
    expect(introElapsedMs(timer(), 50_000)).toBe(8000);
    expect(introElapsedMs(timer(), 0)).toBe(0);
  });

  it('без таймера заставка считается доигранной — показываем всё сразу', () => {
    expect(introElapsedMs(null, 5000)).toBe(Number.POSITIVE_INFINITY);
    expect(introElapsedMs(timer({ kind: 'announce' }), 5000)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('что видно на заставке раунда', () => {
  it('сначала только название раунда', () => {
    expect(roundIntroStage(0, 6)).toEqual({ titleDone: false, shown: 0 });
    expect(roundIntroStage(ROUND_INTRO_TITLE_MS - 1, 6)).toEqual({ titleDone: false, shown: 0 });
  });

  it('после названия темы появляются по одной', () => {
    expect(roundIntroStage(ROUND_INTRO_TITLE_MS, 6)).toEqual({ titleDone: true, shown: 1 });
    expect(roundIntroStage(ROUND_INTRO_TITLE_MS + ROUND_INTRO_POP_MS, 6)).toEqual({ titleDone: true, shown: 2 });
  });

  it('больше тем, чем есть, не показывает', () => {
    expect(roundIntroStage(Number.POSITIVE_INFINITY, 6)).toEqual({ titleDone: true, shown: 6 });
  });
});
