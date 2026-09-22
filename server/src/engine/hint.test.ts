import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, type RoomState } from '@svoyak/shared';
import { demoClassicPack } from '../packs/demo/classic.js';
import { createRoomState } from './createRoom.js';
import { reduce } from './reducer.js';

const T0 = 100_000;
const firstTheme = demoClassicPack.rounds[0]?.themes[0];
const firstQuestion = firstTheme?.questions[0];
if (!firstTheme || !firstQuestion) throw new Error('Пак demo-classic неожиданно пуст');

const hints = (state: RoomState, playerId: string): number =>
  state.players.find((player) => player.id === playerId)?.hints ?? 0;

/** Вася открыл клетку подсказки и получил жетон. Объявлена как const-стрелка,
 *  а не как function: только так TypeScript проносит внутрь замыкания сужение
 *  firstQuestion/firstTheme до string | undefined, сделанное выше по модулю. */
const withToken = (): RoomState => {
  let state = createRoomState({
    code: '1234',
    pack: demoClassicPack,
    settings: DEFAULT_SETTINGS,
    hostToken: 'h',
    now: 1000,
    modifierCells: { [firstQuestion.id]: 'hint' },
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
    themeId: firstTheme.id,
    questionId: firstQuestion.id,
    at: T0,
  }).state;
};

describe('жетон подсказки', () => {
  it('клетка подсказки выдаёт жетон открывшему', () => {
    expect(hints(withToken(), 'p1')).toBe(1);
  });

  it('ведущий тратит жетон', () => {
    const state = reduce(withToken(), { type: 'GIVE_HINT', playerId: 'p1', at: T0 + 5000 }).state;
    expect(hints(state, 'p1')).toBe(0);
  });

  it('трата пишется в журнал', () => {
    const state = reduce(withToken(), { type: 'GIVE_HINT', playerId: 'p1', at: T0 + 5000 }).state;
    expect(state.log.at(-1)?.text).toContain('подсказк');
  });

  it('без жетона подсказку не выдать', () => {
    const result = reduce(withToken(), { type: 'GIVE_HINT', playerId: 'p2', at: T0 + 5000 });
    expect(result.error).toBeDefined();
  });

  it('жетон переживает закрытие сцены и следующий вопрос', () => {
    const after = reduce(withToken(), { type: 'CONTINUE', at: T0 + 1000 }).state;
    expect(hints(after, 'p1')).toBe(1);
  });
});
