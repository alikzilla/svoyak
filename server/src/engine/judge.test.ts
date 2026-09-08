import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, type RoomSettings, type RoomState } from '@svoyak/shared';
import { demoClassicPack } from '../packs/demo/classic.js';
import { createRoomState } from './createRoom.js';
import { reduce } from './reducer.js';

const T0 = 100_000;
const score = (state: RoomState, playerId: string): number =>
  state.players.find((player) => player.id === playerId)?.score ?? 0;

/** Комната, где на вопрос за 300 нажал и отвечает Петя. */
function answering(settings: Partial<RoomSettings> = {}): RoomState {
  let state = createRoomState({
    code: '1234',
    pack: demoClassicPack,
    settings: { ...DEFAULT_SETTINGS, ...settings },
    hostToken: 'h',
    now: 1000,
  });
  for (const [index, name] of ['Вася', 'Петя', 'Маша'].entries()) {
    state = reduce(state, {
      type: 'PLAYER_JOIN',
      playerId: `p${index + 1}`,
      name,
      sessionToken: `t${index + 1}`,
      at: 2000 + index,
    }).state;
  }
  state = reduce(state, { type: 'START_GAME', at: 3000 }).state;
  state = reduce(state, {
    type: 'PICK_QUESTION',
    themeId: 'r1-kino',
    questionId: 'r1-kino-q3',
    byPlayerId: 'p1',
    at: T0,
  }).state;
  state = reduce(state, { type: 'TIMER_EXPIRED', kind: 'reading', at: T0 + 3000 }).state;
  state = reduce(state, {
    type: 'BUZZ',
    playerId: 'p2',
    atServerTime: T0 + 3100,
    receivedAt: T0 + 3100,
  }).state;
  return reduce(state, { type: 'BUZZ_WINDOW_CLOSED', at: T0 + 3250 }).state;
}

describe('верный ответ', () => {
  it('добавляет стоимость и передаёт право хода ответившему', () => {
    const state = reduce(answering(), { type: 'JUDGE', verdict: 'correct', at: T0 + 5000 }).state;
    expect(score(state, 'p2')).toBe(300);
    expect(state.controlPlayerId).toBe('p2');
  });

  it('возвращает к выбору вопроса', () => {
    const state = reduce(answering(), { type: 'JUDGE', verdict: 'correct', at: T0 + 5000 }).state;
    expect(state.phase).toBe('picking');
    expect(state.active).toBeNull();
  });

  it('играет звук верного ответа', () => {
    const result = reduce(answering(), { type: 'JUDGE', verdict: 'correct', at: T0 + 5000 });
    expect(result.effects).toContainEqual({ type: 'sound', sound: 'correct' });
  });
});

describe('неверный ответ', () => {
  it('снимает стоимость, когда штраф включён', () => {
    const state = reduce(answering(), { type: 'JUDGE', verdict: 'wrong', at: T0 + 5000 }).state;
    expect(score(state, 'p2')).toBe(-300);
  });

  it('при выключенном штрафе счёт не меняется', () => {
    const state = reduce(answering({ penaltyOnWrong: false }), {
      type: 'JUDGE',
      verdict: 'wrong',
      at: T0 + 5000,
    }).state;
    expect(score(state, 'p2')).toBe(0);
  });

  it('при запрете минуса счёт не опускается ниже нуля', () => {
    const state = reduce(answering({ allowNegative: false }), {
      type: 'JUDGE',
      verdict: 'wrong',
      at: T0 + 5000,
    }).state;
    expect(score(state, 'p2')).toBe(0);
  });

  it('не передаёт право хода', () => {
    const state = reduce(answering(), { type: 'JUDGE', verdict: 'wrong', at: T0 + 5000 }).state;
    expect(state.controlPlayerId).toBe('p1');
  });

  it('снова открывает кнопку остальным на остаток времени', () => {
    const result = reduce(answering(), { type: 'JUDGE', verdict: 'wrong', at: T0 + 5000 });
    expect(result.state.phase).toBe('buzzer_open');
    expect(result.state.buzz.answeringPlayerId).toBeNull();

    const remaining = (result.state.buzz.closesAt ?? 0) - (T0 + 5000);
    expect(result.effects).toContainEqual({
      type: 'setTimer',
      kind: 'buzz',
      durationMs: remaining,
      onExpire: { type: 'TIMER_EXPIRED', kind: 'buzz', at: result.state.buzz.closesAt },
    });
  });

  it('ответивший неверно больше не может жать на этот вопрос', () => {
    let state = reduce(answering(), { type: 'JUDGE', verdict: 'wrong', at: T0 + 5000 }).state;
    expect(state.active?.spentPlayerIds).toContain('p2');

    state = reduce(state, {
      type: 'BUZZ',
      playerId: 'p2',
      atServerTime: T0 + 5100,
      receivedAt: T0 + 5100,
    }).state;
    expect(state.buzz.candidates).toHaveLength(0);
  });

  it('когда отвечать больше некому, раскрывается ответ', () => {
    let state = answering();
    state = { ...state, active: state.active ? { ...state.active, spentPlayerIds: ['p1', 'p3'] } : null };
    const result = reduce(state, { type: 'JUDGE', verdict: 'wrong', at: T0 + 5000 });
    expect(result.state.phase).toBe('answer_reveal');
    expect(result.state.active?.answerRevealed).toBe(true);
  });

  it('когда время кнопки уже вышло, раскрывается ответ', () => {
    const state = answering();
    const late = (state.buzz.closesAt ?? 0) + 1;
    const result = reduce(state, { type: 'JUDGE', verdict: 'wrong', at: late });
    expect(result.state.phase).toBe('answer_reveal');
  });
});

describe('таймер ответа', () => {
  it('истёкшее время засчитывается как неверный ответ', () => {
    const state = reduce(answering(), {
      type: 'TIMER_EXPIRED',
      kind: 'answer',
      at: T0 + 13_250,
    }).state;
    expect(score(state, 'p2')).toBe(-300);
    expect(state.active?.spentPlayerIds).toContain('p2');
  });
});

describe('ручные действия ведущего', () => {
  it('снятый вопрос не меняет счёт и раскрывает ответ', () => {
    const state = reduce(answering(), { type: 'SKIP_QUESTION', at: T0 + 5000 }).state;
    expect(score(state, 'p2')).toBe(0);
    expect(state.phase).toBe('answer_reveal');
    expect(state.active?.answerRevealed).toBe(true);
  });

  it('раскрытие ответа доступно ведущему в любой момент вопроса', () => {
    const state = reduce(answering(), { type: 'REVEAL_ANSWER', at: T0 + 5000 }).state;
    expect(state.active?.answerRevealed).toBe(true);
  });

  it('«дать ещё время» продлевает текущий таймер', () => {
    const result = reduce(answering(), { type: 'EXTEND_TIME', at: T0 + 5000 });
    expect(result.effects).toContainEqual({
      type: 'setTimer',
      kind: 'answer',
      durationMs: 5000,
      onExpire: { type: 'TIMER_EXPIRED', kind: 'answer', at: T0 + 10_000 },
    });
    expect(result.effects).toContainEqual({
      type: 'toast',
      to: 'all',
      text: 'Ведущий добавил времени',
      tone: 'info',
    });
  });
});
