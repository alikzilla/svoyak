import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, type RoomSettings, type RoomState } from '@svoyak/shared';
import { demoClassicPack } from '../packs/demo/classic.js';
import { createRoomState } from './createRoom.js';
import { reduce } from './reducer.js';
import { canBuzz } from './buzz.js';

const T0 = 100_000;
const LOCK = DEFAULT_SETTINGS.falseStartLockMs;
const PAUSE = DEFAULT_SETTINGS.readingMs;

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
const jump = (state: RoomState, playerId: string, at: number) =>
  reduce(state, { type: 'BUZZ', playerId, atServerTime: at, receivedAt: at });

const open = (state: RoomState, at: number): RoomState =>
  reduce(state, { type: 'OPEN_BUZZER', at }).state;

describe('наказание за фальстарт', () => {
  it('блокировка включается в момент нажатия, а не откладывается', () => {
    const pressAt = T0 + 200;

    const jumped = jump(reading(), 'p1', pressAt);

    expect(jumped.state.buzz.lockedUntil['p1']).toBe(pressAt + LOCK);
    expect(canBuzz(jumped.state, 'p1', pressAt + LOCK - 1)).toBe(false);
    expect(canBuzz(jumped.state, 'p1', pressAt + LOCK)).toBe(true);
  });

  it('нажавший сразу узнаёт о промахе', () => {
    const jumped = jump(reading(), 'p1', T0 + 200);

    expect(jumped.effects.some((effect) => effect.type === 'toast')).toBe(true);
    expect(jumped.state.log.at(-1)?.text).toContain('Фальстарт');
  });

  it('открытие кнопки не навешивает новую блокировку', () => {
    // Это и давало два фальстарта на одно нажатие: вторая запись при открытии.
    const pressAt = T0 + PAUSE - 200;
    const jumped = jump(reading(), 'p1', pressAt).state;
    const opensAt = T0 + PAUSE;

    const opened = open(jumped, opensAt);

    expect(opened.buzz.lockedUntil['p1']).toBe(pressAt + LOCK);
  });

  it('нажавший под самое открытие теряет остаток блокировки уже на открытой кнопке', () => {
    const pressAt = T0 + PAUSE - 200;
    const jumped = jump(reading(), 'p1', pressAt).state;
    const opensAt = T0 + PAUSE;

    const opened = open(jumped, opensAt);

    // Кнопка открыта всем, но нажавшему рано ещё 2.3 секунды нельзя.
    expect(opened.phase).toBe('buzzer_open');
    expect(canBuzz(opened, 'p1', opensAt)).toBe(false);
    expect(canBuzz(opened, 'p1', pressAt + LOCK - 1)).toBe(false);
    expect(canBuzz(opened, 'p1', pressAt + LOCK)).toBe(true);
    expect(canBuzz(opened, 'p2', opensAt)).toBe(true);
  });

  it('нажатие в самом начале паузы истекает до открытия — и это нормально', () => {
    const jumped = jump(reading(), 'p1', T0 + 100).state;
    const opensAt = T0 + PAUSE;

    const opened = open(jumped, opensAt);

    expect(canBuzz(opened, 'p1', opensAt)).toBe(true);
  });

  it('долбёжка по кнопке не продлевает блокировку', () => {
    let state = jump(reading(), 'p1', T0 + 200).state;
    for (const at of [T0 + 300, T0 + 400, T0 + 900, T0 + 1500]) {
      state = jump(state, 'p1', at).state;
    }

    expect(state.buzz.lockedUntil['p1']).toBe(T0 + 200 + LOCK);
  });

  it('лишние тычки не сыплют уведомлениями', () => {
    const first = jump(reading(), 'p1', T0 + 200);
    const second = jump(first.state, 'p1', T0 + 400);

    expect(second.effects).toEqual([]);
  });

  it('работает и когда кнопку открывает ведущий руками', () => {
    const pressAt = T0 + 200;
    const jumped = jump(reading({ autoOpenBuzzer: false }), 'p1', pressAt).state;

    const opened = open(jumped, pressAt + 1000);

    expect(canBuzz(opened, 'p1', pressAt + 1000)).toBe(false);
    expect(opened.buzz.lockedUntil['p1']).toBe(pressAt + LOCK);
  });

  it('на следующем вопросе блокировка не тянется', () => {
    let state = jump(reading(), 'p1', T0 + 200).state;
    state = open(state, T0 + PAUSE);
    state = reduce(state, { type: 'SKIP_QUESTION', at: T0 + 6000 }).state;
    state = reduce(state, { type: 'CONTINUE', at: T0 + 7000 }).state;
    state = reduce(state, {
      type: 'PICK_QUESTION',
      themeId: 'r1-kino',
      questionId: 'r1-kino-q4',
      at: T0 + 8000,
    }).state;

    expect(state.buzz.lockedUntil).toEqual({});
    expect(canBuzz(state, 'p1', T0 + 8000)).toBe(true);
  });
});
