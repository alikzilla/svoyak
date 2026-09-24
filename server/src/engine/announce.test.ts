import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, type RoomSettings, type RoomState } from '@svoyak/shared';
import type { Pack } from '@svoyak/shared';
import { createRoomState } from './createRoom.js';
import { reduce } from './reducer.js';

const T0 = 100_000;

/** Маленький пак: обычный вопрос и кот в первом же раунде. */
const pack: Pack = {
  id: 'test',
  title: 'Тестовый',
  createdAt: 1,
  updatedAt: 1,
  rounds: [
    {
      id: 'r1',
      title: 'Первый раунд',
      themes: [
        {
          id: 'kino',
          title: 'Кино',
          questions: [
            { id: 'kino-q1', price: 100, type: 'normal', text: 'вопрос', answer: 'ответ', altAnswers: [] },
            {
              id: 'kino-q2',
              price: 200,
              type: 'cat',
              text: 'кот',
              answer: 'ответ кота',
              altAnswers: [],
              cat: { theme: 'Звери', price: 'nominal', canKeep: false },
            },
          ],
        },
      ],
    },
  ],
  final: {
    themes: [
      {
        id: 'f1',
        title: 'Финал',
        question: { id: 'f1-q', text: 'финал', answer: 'ответ', altAnswers: [] },
      },
    ],
  },
};

function started(settings: Partial<RoomSettings> = {}): RoomState {
  let state = createRoomState({
    code: '1234',
    pack,
    settings: { ...DEFAULT_SETTINGS, ...settings },
    hostToken: 'h',
    now: 1000,
  });
  for (const [index, name] of ['Вася', 'Петя'].entries()) {
    state = reduce(state, {
      type: 'PLAYER_JOIN',
      playerId: `p${index + 1}`,
      name,
      sessionToken: `t${index + 1}`,
      at: 2000 + index,
    }).state;
  }
  return reduce(state, { type: 'START_GAME', at: 3000 }).state;
}

const pick = (state: RoomState, questionId = 'kino-q1') =>
  reduce(state, { type: 'PICK_QUESTION', themeId: 'kino', questionId, at: T0 });

const ANNOUNCE = DEFAULT_SETTINGS.announceMs;

describe('объявление темы и цены', () => {
  it('после выбора обычного вопроса сначала объявляет тему и цену', () => {
    const result = pick(started());

    expect(result.state.phase).toBe('announce');
    expect(result.state.active).toMatchObject({ themeTitle: 'Кино', price: 100 });
    expect(result.state.board[0]?.cells[0]?.played).toBe(true);
    expect(result.effects).toContainEqual({
      type: 'setTimer',
      kind: 'announce',
      durationMs: ANNOUNCE,
      onExpire: { type: 'TIMER_EXPIRED', kind: 'announce', at: T0 + ANNOUNCE },
    });
  });

  it('пауза на чтение начинается только после объявления', () => {
    const announced = pick(started({ autoOpenBuzzer: true, readingMs: 5000 })).state;

    const result = reduce(announced, { type: 'TIMER_EXPIRED', kind: 'announce', at: T0 + ANNOUNCE });

    expect(result.state.phase).toBe('reading');
    expect(result.effects).toContainEqual({
      type: 'setTimer',
      kind: 'reading',
      durationMs: 5000,
      onExpire: { type: 'OPEN_BUZZER', at: T0 + ANNOUNCE + 5000 },
    });
  });

  it('без автостарта после объявления кнопку ждёт ведущего', () => {
    const announced = pick(started({ autoOpenBuzzer: false })).state;

    const result = reduce(announced, { type: 'TIMER_EXPIRED', kind: 'announce', at: T0 + ANNOUNCE });

    expect(result.state.phase).toBe('reading');
    expect(result.effects.some((effect) => effect.type === 'setTimer')).toBe(false);
  });

  it('ведущий может не ждать конца объявления', () => {
    const announced = pick(started({ autoOpenBuzzer: true, readingMs: 5000 })).state;

    const result = reduce(announced, { type: 'CONTINUE', at: T0 + 800 });

    expect(result.state.phase).toBe('reading');
    expect(result.state.active).not.toBeNull();
    expect(result.effects).toContainEqual(
      expect.objectContaining({ type: 'setTimer', kind: 'reading', durationMs: 5000 }),
    );
  });

  it('опоздавший таймер объявления ничего не ломает', () => {
    const announced = pick(started()).state;
    const skipped = reduce(announced, { type: 'CONTINUE', at: T0 + 800 }).state;

    const result = reduce(skipped, { type: 'TIMER_EXPIRED', kind: 'announce', at: T0 + ANNOUNCE });

    expect(result.state).toBe(skipped);
    expect(result.effects).toEqual([]);
  });

  it('нажатие во время объявления — не фальстарт', () => {
    const announced = pick(started()).state;

    const result = reduce(announced, {
      type: 'BUZZ',
      playerId: 'p1',
      atServerTime: T0 + 500,
      receivedAt: T0 + 500,
    });

    expect(result.state.buzz.lockedUntil['p1']).toBeUndefined();
  });

  it('вопрос можно снять прямо во время объявления', () => {
    const announced = pick(started()).state;

    const result = reduce(announced, { type: 'SKIP_QUESTION', at: T0 + 500 });

    expect(result.state.phase).toBe('answer_reveal');
  });

  it('нулевая длительность — вопрос открывается сразу, как раньше', () => {
    const result = pick(started({ announceMs: 0, autoOpenBuzzer: true, readingMs: 5000 }));

    expect(result.state.phase).toBe('reading');
    expect(result.effects).toContainEqual(
      expect.objectContaining({ type: 'setTimer', kind: 'reading' }),
    );
  });

  it('кот в мешке не объявляется: у него своя сцена и своя тема', () => {
    const withControl = reduce(started(), { type: 'SET_CONTROL', playerId: 'p1' }).state;

    const result = pick(withControl, 'kino-q2');

    expect(result.state.phase).toBe('cat_transfer');
    expect(result.effects.some((effect) => effect.type === 'setTimer')).toBe(false);
  });
});
