import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, type RoomState } from '@svoyak/shared';
import { demoClassicPack } from '../packs/demo/classic.js';
import { createRoomState } from './createRoom.js';
import { reduce } from './reducer.js';

const T0 = 100_000;
const firstTheme = demoClassicPack.rounds[0]?.themes[0];
const firstQuestion = firstTheme?.questions[0];
if (!firstTheme || !firstQuestion) throw new Error('Пак demo-classic неожиданно пуст');

const score = (state: RoomState, playerId: string): number =>
  state.players.find((player) => player.id === playerId)?.score ?? 0;

/** Вася (300) открывает обмен, у Пети 1000. Объявлена как const-стрелка, а не
 *  как function: только так TypeScript проносит внутрь замыкания сужение
 *  firstQuestion/firstTheme до string | undefined, сделанное выше по модулю. */
const openedSwap = (): RoomState => {
  let state = createRoomState({
    code: '1234',
    pack: demoClassicPack,
    settings: DEFAULT_SETTINGS,
    hostToken: 'h',
    now: 1000,
    modifierCells: { [firstQuestion.id]: 'swap' },
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
  state = reduce(state, { type: 'SET_SCORE', playerId: 'p1', score: 300 }).state;
  state = reduce(state, { type: 'SET_SCORE', playerId: 'p2', score: 1000 }).state;
  return reduce(state, {
    type: 'PICK_QUESTION',
    themeId: firstTheme.id,
    questionId: firstQuestion.id,
    at: T0,
  }).state;
};

/** Тот же обмен, но в комнате только Вася — меняться не с кем. */
const openedSoloSwap = (): RoomState => {
  let state = createRoomState({
    code: '1234',
    pack: demoClassicPack,
    settings: DEFAULT_SETTINGS,
    hostToken: 'h',
    now: 1000,
    modifierCells: { [firstQuestion.id]: 'swap' },
  });
  state = reduce(state, {
    type: 'PLAYER_JOIN',
    playerId: 'p1',
    name: 'Вася',
    sessionToken: 't1',
    at: 2000,
  }).state;
  state = reduce(state, { type: 'START_GAME', at: 3000 }).state;
  state = reduce(state, { type: 'SET_SCORE', playerId: 'p1', score: 300 }).state;
  return reduce(state, {
    type: 'PICK_QUESTION',
    themeId: firstTheme.id,
    questionId: firstQuestion.id,
    at: T0,
  }).state;
};

describe('обмен счётом в комнате на одного', () => {
  it('не ждёт выбора цели: меняться не с кем', () => {
    const state = openedSoloSwap();
    expect(state.phase).toBe('modifier');
    // targetPlayerId указывает на самого открывшего — это сигнал «решено,
    // без обмена», а не «жду выбора» (null): настоящая цель никогда не
    // совпадает с открывшим (см. «на самого себя меняться нельзя» ниже).
    expect(state.modifier?.targetPlayerId).toBe('p1');
    expect(score(state, 'p1')).toBe(300);
  });

  it('заводит таймер сцены сразу, как пустышка — не зависает без кнопок', () => {
    const result = reduce(
      createRoomState({
        code: '1234',
        pack: demoClassicPack,
        settings: DEFAULT_SETTINGS,
        hostToken: 'h',
        now: 1000,
        modifierCells: { [firstQuestion.id]: 'swap' },
      }),
      { type: 'PLAYER_JOIN', playerId: 'p1', name: 'Вася', sessionToken: 't1', at: 2000 },
    );
    let state = reduce(result.state, { type: 'START_GAME', at: 3000 }).state;
    const opened = reduce(state, {
      type: 'PICK_QUESTION',
      themeId: firstTheme.id,
      questionId: firstQuestion.id,
      at: T0,
    });
    expect(opened.effects).toContainEqual({
      type: 'setTimer',
      kind: 'modifier',
      durationMs: DEFAULT_SETTINGS.modifierMs,
      onExpire: { type: 'TIMER_EXPIRED', kind: 'modifier', at: T0 + DEFAULT_SETTINGS.modifierMs },
    });
  });

  it('выбор цели отклоняется — обмен уже решён', () => {
    const result = reduce(openedSoloSwap(), {
      type: 'MODIFIER_TARGET',
      playerId: 'p1',
      targetPlayerId: 'p1',
      at: T0 + 1000,
    });
    expect(result.error).toBeDefined();
  });

  it('таймер сцены закрывает фазу без ответа игрока', () => {
    const state = reduce(openedSoloSwap(), {
      type: 'TIMER_EXPIRED',
      kind: 'modifier',
      at: T0 + DEFAULT_SETTINGS.modifierMs,
    }).state;
    expect(state.phase).not.toBe('modifier');
  });
});

describe('обмен счётом', () => {
  it('ждёт выбора цели, ничего не меняя', () => {
    const state = openedSwap();
    expect(state.phase).toBe('modifier');
    expect(state.modifier?.targetPlayerId).toBeNull();
    expect(score(state, 'p1')).toBe(300);
  });

  it('обменивает счета выбранного и открывшего', () => {
    const state = reduce(openedSwap(), {
      type: 'MODIFIER_TARGET',
      playerId: 'p1',
      targetPlayerId: 'p2',
      at: T0 + 1000,
    }).state;
    expect(score(state, 'p1')).toBe(1000);
    expect(score(state, 'p2')).toBe(300);
    expect(state.modifier?.targetPlayerId).toBe('p2');
  });

  it('после выбора заводит таймер сцены', () => {
    const result = reduce(openedSwap(), {
      type: 'MODIFIER_TARGET',
      playerId: 'p1',
      targetPlayerId: 'p2',
      at: T0 + 1000,
    });
    expect(result.effects).toContainEqual({
      type: 'setTimer',
      kind: 'modifier',
      durationMs: DEFAULT_SETTINGS.modifierMs,
      onExpire: {
        type: 'TIMER_EXPIRED',
        kind: 'modifier',
        at: T0 + 1000 + DEFAULT_SETTINGS.modifierMs,
      },
    });
  });

  it('выбирать может только открывший клетку', () => {
    const result = reduce(openedSwap(), {
      type: 'MODIFIER_TARGET',
      playerId: 'p2',
      targetPlayerId: 'p1',
      at: T0 + 1000,
    });
    expect(result.error).toBeDefined();
  });

  it('на самого себя меняться нельзя', () => {
    const result = reduce(openedSwap(), {
      type: 'MODIFIER_TARGET',
      playerId: 'p1',
      targetPlayerId: 'p1',
      at: T0 + 1000,
    });
    expect(result.error).toBeDefined();
  });

  it('на несуществующего игрока меняться нельзя', () => {
    const result = reduce(openedSwap(), {
      type: 'MODIFIER_TARGET',
      playerId: 'p1',
      targetPlayerId: 'призрак',
      at: T0 + 1000,
    });
    expect(result.error).toBeDefined();
  });

  it('выбрать дважды нельзя', () => {
    const once = reduce(openedSwap(), {
      type: 'MODIFIER_TARGET',
      playerId: 'p1',
      targetPlayerId: 'p2',
      at: T0 + 1000,
    }).state;
    const twice = reduce(once, {
      type: 'MODIFIER_TARGET',
      playerId: 'p1',
      targetPlayerId: 'p2',
      at: T0 + 2000,
    });
    expect(twice.error).toBeDefined();
  });
});
