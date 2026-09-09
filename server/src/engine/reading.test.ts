import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, type RoomSettings, type RoomState } from '@svoyak/shared';
import type { Pack } from '@svoyak/shared';
import { createRoomState } from './createRoom.js';
import { reduce } from './reducer.js';

const T0 = 100_000;

/** Маленький пак под этот тест: обычный вопрос и кот в первом же раунде. */
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

describe('таймер чтения', () => {
  it('после выбора обычного вопроса ставит таймер, который сам откроет кнопку', () => {
    const result = pick(started({ autoOpenBuzzer: true, readingMs: 5000 }));

    expect(result.state.phase).toBe('reading');
    const timer = result.effects.find((effect) => effect.type === 'setTimer');
    expect(timer).toEqual({
      type: 'setTimer',
      kind: 'reading',
      durationMs: 5000,
      onExpire: { type: 'OPEN_BUZZER', at: T0 + 5000 },
    });
  });

  it('без автостарта таймер чтения не ставится', () => {
    const result = pick(started({ autoOpenBuzzer: false }));

    expect(result.state.phase).toBe('reading');
    expect(result.effects.some((effect) => effect.type === 'setTimer')).toBe(false);
  });

  it('ведущий может открыть кнопку раньше: таймер чтения сменяется таймером кнопки', () => {
    const reading = pick(started({ autoOpenBuzzer: true, readingMs: 5000 })).state;

    const opened = reduce(reading, { type: 'OPEN_BUZZER', at: T0 + 1200 });

    expect(opened.state.phase).toBe('buzzer_open');
    expect(opened.state.buzz.openedAt).toBe(T0 + 1200);
    const timer = opened.effects.find((effect) => effect.type === 'setTimer');
    expect(timer).toMatchObject({ kind: 'buzz' });
  });

  it('кот в мешке идёт мимо таймера чтения: там своя фаза без кнопки', () => {
    const state = started({ autoOpenBuzzer: true });
    const withControl = reduce(state, { type: 'SET_CONTROL', playerId: 'p1' }).state;

    const result = pick(withControl, 'kino-q2');

    expect(result.state.phase).toBe('cat_transfer');
    expect(result.effects.some((effect) => effect.type === 'setTimer')).toBe(false);
  });

  it('нулевая пауза означает, что кнопка открывается сразу', () => {
    const result = pick(started({ autoOpenBuzzer: true, readingMs: 0 }));

    expect(result.state.phase).toBe('buzzer_open');
    expect(result.state.buzz.openedAt).toBe(T0);
  });
});
