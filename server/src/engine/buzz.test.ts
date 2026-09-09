import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, type RoomState } from '@svoyak/shared';
import { demoClassicPack } from '../packs/demo/classic.js';
import { createRoomState } from './createRoom.js';
import { reduce } from './reducer.js';
import { adjustBuzzTime } from './buzz.js';

const T0 = 100_000;

function readingState(): RoomState {
  let state = createRoomState({
    code: '1234',
    pack: demoClassicPack,
    settings: DEFAULT_SETTINGS,
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
  return reduce(state, {
    type: 'PICK_QUESTION',
    themeId: 'r1-kino',
    questionId: 'r1-kino-q3',
    at: T0,
  }).state;
}

const openState = (): RoomState =>
  reduce(readingState(), { type: 'OPEN_BUZZER', at: T0 + 3000 }).state;

/** Нажатие с уже приведённой к серверному времени меткой. */
const buzz = (state: RoomState, playerId: string, atServerTime: number, receivedAt: number) =>
  reduce(state, { type: 'BUZZ', playerId, atServerTime, receivedAt });

describe('adjustBuzzTime', () => {
  it('переводит метку клиента в серверное время по офсету', () => {
    expect(
      adjustBuzzTime({ clientTime: 1000, clockOffset: 500, minRtt: 40, receivedAt: 1520 }),
    ).toBe(1500);
  });

  it('метку из будущего зажимает моментом приёма пакета', () => {
    expect(
      adjustBuzzTime({ clientTime: 9000, clockOffset: 0, minRtt: 40, receivedAt: 1000 }),
    ).toBe(1000);
  });

  it('слишком старую метку зажимает правдоподобной границей', () => {
    const receivedAt = 10_000;
    const minRtt = 40;
    const result = adjustBuzzTime({ clientTime: 0, clockOffset: 0, minRtt, receivedAt });
    expect(result).toBeGreaterThan(receivedAt - 1000);
    expect(result).toBeLessThanOrEqual(receivedAt);
  });
});

describe('открытие кнопки', () => {
  it('ведущий открывает кнопку и с этого момента идёт общий бюджет времени', () => {
    const result = reduce(readingState(), { type: 'OPEN_BUZZER', at: T0 + 3000 });
    expect(result.state.phase).toBe('buzzer_open');
    expect(result.state.buzz.openedAt).toBe(T0 + 3000);
    expect(result.state.buzz.closesAt).toBe(T0 + 3000 + DEFAULT_SETTINGS.buzzOpenMs);
    expect(result.effects).toContainEqual({ type: 'sound', sound: 'buzz_open' });
  });
});

describe('фальстарт', () => {
  it('нажатие до открытия блокирует нажавшего', () => {
    const state = buzz(readingState(), 'p2', T0 + 500, T0 + 500).state;
    expect(state.buzz.lockedUntil['p2']).toBe(T0 + 500 + DEFAULT_SETTINGS.falseStartLockMs);
    expect(state.phase).toBe('reading');
  });

  it('блокирует только нажавшего', () => {
    const state = buzz(readingState(), 'p2', T0 + 500, T0 + 500).state;
    expect(state.buzz.lockedUntil['p3']).toBeUndefined();
  });

  it('заблокированный не попадает в кандидаты, пока идёт блокировка', () => {
    // Наказание отмеряется от открытия кнопки, а не от самого нажатия.
    let state = buzz(readingState(), 'p2', T0 + 2000, T0 + 2000).state;
    state = reduce(state, { type: 'OPEN_BUZZER', at: T0 + 3000 }).state;
    expect(state.buzz.lockedUntil['p2']).toBe(T0 + 3000 + DEFAULT_SETTINGS.falseStartLockMs);

    state = buzz(state, 'p2', T0 + 3100, T0 + 3100).state;
    expect(state.buzz.candidates).toHaveLength(0);
  });

  it('пока один заблокирован, остальные жмут и выигрывают', () => {
    let state = buzz(readingState(), 'p2', T0 + 2000, T0 + 2000).state;
    state = reduce(state, { type: 'OPEN_BUZZER', at: T0 + 3000 }).state;
    state = buzz(state, 'p2', T0 + 3100, T0 + 3100).state;
    state = buzz(state, 'p3', T0 + 3200, T0 + 3200).state;
    state = reduce(state, { type: 'BUZZ_WINDOW_CLOSED', at: T0 + 3350 }).state;
    expect(state.buzz.answeringPlayerId).toBe('p3');
  });

  it('после истечения блокировки нажатие снова считается', () => {
    let state = buzz(readingState(), 'p2', T0 + 2000, T0 + 2000).state;
    const openedAt = T0 + 3000;
    state = reduce(state, { type: 'OPEN_BUZZER', at: openedAt }).state;
    const afterLock = openedAt + DEFAULT_SETTINGS.falseStartLockMs + 1;
    state = buzz(state, 'p2', afterLock, afterLock).state;
    expect(state.buzz.candidates.map((candidate) => candidate.playerId)).toEqual(['p2']);
  });
});

describe('окно сбора нажатий', () => {
  it('первое нажатие открывает окно, а не назначает отвечающего сразу', () => {
    const result = buzz(openState(), 'p2', T0 + 3100, T0 + 3100);
    expect(result.state.buzz.answeringPlayerId).toBeNull();
    expect(result.state.buzz.graceClosesAt).toBe(T0 + 3100 + DEFAULT_SETTINGS.buzzGraceMs);
    expect(result.effects).toContainEqual({
      type: 'setTimer',
      kind: 'buzz',
      durationMs: DEFAULT_SETTINGS.buzzGraceMs,
      onExpire: { type: 'BUZZ_WINDOW_CLOSED', at: T0 + 3100 + DEFAULT_SETTINGS.buzzGraceMs },
    });
  });

  it('побеждает минимальная метка, а не первый пришедший пакет', () => {
    let state = openState();
    // Петя нажал позже, но его пакет пришёл первым.
    state = buzz(state, 'p2', T0 + 3120, T0 + 3130).state;
    state = buzz(state, 'p3', T0 + 3100, T0 + 3160).state;
    state = reduce(state, { type: 'BUZZ_WINDOW_CLOSED', at: T0 + 3270 }).state;

    expect(state.buzz.answeringPlayerId).toBe('p3');
    expect(state.phase).toBe('answering');
  });

  it('повторное нажатие того же игрока не создаёт второго кандидата', () => {
    let state = openState();
    state = buzz(state, 'p2', T0 + 3100, T0 + 3100).state;
    state = buzz(state, 'p2', T0 + 3110, T0 + 3110).state;
    expect(state.buzz.candidates).toHaveLength(1);
  });

  it('назначение отвечающего играет звук и снимает таймер: ждём вердикт ведущего', () => {
    let state = openState();
    state = buzz(state, 'p2', T0 + 3100, T0 + 3100).state;
    const result = reduce(state, { type: 'BUZZ_WINDOW_CLOSED', at: T0 + 3250 });

    expect(result.effects).toContainEqual({ type: 'sound', sound: 'buzz_hit' });
    expect(result.effects).toContainEqual({ type: 'clearTimer' });
    expect(result.effects.some((effect) => effect.type === 'setTimer')).toBe(false);
  });

  it('уже отвечавший на этот вопрос нажать не может', () => {
    let state = openState();
    state = {
      ...state,
      active: state.active ? { ...state.active, spentPlayerIds: ['p2'] } : null,
    };
    state = buzz(state, 'p2', T0 + 3100, T0 + 3100).state;
    expect(state.buzz.candidates).toHaveLength(0);
  });

  it('если время кнопки вышло и никто не нажал, ответ раскрывается', () => {
    const result = reduce(openState(), {
      type: 'TIMER_EXPIRED',
      kind: 'buzz',
      at: T0 + 3000 + DEFAULT_SETTINGS.buzzOpenMs,
    });
    expect(result.state.phase).toBe('answer_reveal');
    expect(result.state.active?.answerRevealed).toBe(true);
    expect(result.effects).toContainEqual({ type: 'sound', sound: 'time_up' });
  });

  it('право хода после пустого вопроса остаётся у прежнего игрока', () => {
    const result = reduce(openState(), {
      type: 'TIMER_EXPIRED',
      kind: 'buzz',
      at: T0 + 3000 + DEFAULT_SETTINGS.buzzOpenMs,
    });
    expect(result.state.controlPlayerId).toBe('p1');
  });
});
