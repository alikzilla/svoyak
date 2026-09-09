import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, type RoomSettings, type RoomState } from '@svoyak/shared';
import { demoClassicPack } from '../packs/demo/classic.js';
import { createRoomState } from './createRoom.js';
import { reduce } from './reducer.js';
import { canBuzz } from './buzz.js';

const T0 = 100_000;
const LOCK = DEFAULT_SETTINGS.falseStartLockMs;

function reading(settings: Partial<RoomSettings> = {}): RoomState {
  let state = createRoomState({
    code: '1234',
    pack: demoClassicPack,
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
  state = reduce(state, { type: 'START_GAME', at: 3000 }).state;
  return reduce(state, {
    type: 'PICK_QUESTION',
    themeId: 'r1-kino',
    questionId: 'r1-kino-q3',
    at: T0,
  }).state;
}

/** Нажатие раньше времени. */
const jump = (state: RoomState, playerId: string, at: number): RoomState =>
  reduce(state, {
    type: 'BUZZ',
    playerId,
    atServerTime: at,
    receivedAt: at,
  }).state;

const open = (state: RoomState, at: number): RoomState =>
  reduce(state, { type: 'OPEN_BUZZER', at }).state;

describe('наказание за фальстарт', () => {
  it('блокировка доживает до открытия кнопки, даже если пауза длиннее её', () => {
    // Пауза 5000, блокировка 2500: наказание не должно истечь раньше открытия.
    const jumped = jump(reading(), 'p1', T0 + 200);
    const opensAt = T0 + DEFAULT_SETTINGS.readingMs;

    const opened = open(jumped, opensAt);

    expect(canBuzz(opened, 'p1', opensAt)).toBe(false);
  });

  it('отсчёт наказания идёт от открытия кнопки, а не от нажатия', () => {
    const jumped = jump(reading(), 'p1', T0 + 200);
    const opensAt = T0 + DEFAULT_SETTINGS.readingMs;

    const opened = open(jumped, opensAt);

    expect(opened.buzz.lockedUntil['p1']).toBe(opensAt + LOCK);
    expect(canBuzz(opened, 'p1', opensAt + LOCK - 1)).toBe(false);
    expect(canBuzz(opened, 'p1', opensAt + LOCK)).toBe(true);
  });

  it('второй фальстарт в том же вопросе стоит вдвое дороже', () => {
    let state = jump(reading(), 'p1', T0 + 200);
    state = jump(state, 'p1', T0 + 3000);
    const opensAt = T0 + DEFAULT_SETTINGS.readingMs;

    const opened = open(state, opensAt);

    expect(opened.buzz.lockedUntil['p1']).toBe(opensAt + LOCK * 2);
  });

  it('долбёжка по кнопке во время блокировки не удлиняет наказание', () => {
    let state = jump(reading(), 'p1', T0 + 200);
    // Ещё три тычка, пока первая блокировка не истекла.
    for (const at of [T0 + 400, T0 + 800, T0 + 1200]) state = jump(state, 'p1', at);
    const opensAt = T0 + DEFAULT_SETTINGS.readingMs;

    const opened = open(state, opensAt);

    expect(opened.buzz.falseStarts['p1']).toBe(1);
    expect(opened.buzz.lockedUntil['p1']).toBe(opensAt + LOCK);
  });

  it('кто не жал раньше времени, тот на открытии свободен', () => {
    const jumped = jump(reading(), 'p1', T0 + 200);
    const opensAt = T0 + DEFAULT_SETTINGS.readingMs;

    const opened = open(jumped, opensAt);

    expect(canBuzz(opened, 'p2', opensAt)).toBe(true);
  });

  it('работает и когда кнопку открывает ведущий руками', () => {
    const jumped = jump(reading({ autoOpenBuzzer: false }), 'p1', T0 + 200);

    // Ведущий читал долго и открыл кнопку через полминуты.
    const opened = open(jumped, T0 + 30_000);

    expect(canBuzz(opened, 'p1', T0 + 30_000)).toBe(false);
    expect(opened.buzz.lockedUntil['p1']).toBe(T0 + 30_000 + LOCK);
  });

  it('нажавший сразу видит блокировку, не дожидаясь открытия', () => {
    const result = reduce(reading(), {
      type: 'BUZZ',
      playerId: 'p1',
      atServerTime: T0 + 200,
      receivedAt: T0 + 200,
    });

    expect(result.state.buzz.lockedUntil['p1']).toBe(T0 + 200 + LOCK);
    expect(result.effects.some((effect) => effect.type === 'toast')).toBe(true);
  });

  it('на следующем вопросе счётчик фальстартов обнуляется', () => {
    let state = jump(reading(), 'p1', T0 + 200);
    state = open(state, T0 + 5000);
    state = reduce(state, { type: 'SKIP_QUESTION', at: T0 + 6000 }).state;
    state = reduce(state, { type: 'CONTINUE', at: T0 + 7000 }).state;
    state = reduce(state, {
      type: 'PICK_QUESTION',
      themeId: 'r1-kino',
      questionId: 'r1-kino-q4',
      at: T0 + 8000,
    }).state;

    const opened = open(state, T0 + 13_000);

    expect(opened.buzz.falseStarts).toEqual({});
    expect(canBuzz(opened, 'p1', T0 + 13_000)).toBe(true);
  });
});
