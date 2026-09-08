import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, type RoomSettings, type RoomState } from '@svoyak/shared';
import { demoClassicPack } from '../packs/demo/classic.js';
import { createRoomState } from './createRoom.js';
import { reduce } from './reducer.js';

const T0 = 100_000;
const score = (state: RoomState, playerId: string): number =>
  state.players.find((player) => player.id === playerId)?.score ?? 0;

/** Комната перед самым финалом: три игрока с разным счётом. */
function beforeFinal(
  scores: [number, number, number] = [500, 1500, 900],
  settings: Partial<RoomSettings> = {},
): RoomState {
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
  for (const [index, value] of scores.entries()) {
    state = reduce(state, { type: 'SET_SCORE', playerId: `p${index + 1}`, score: value }).state;
  }
  return { ...state, roundIndex: demoClassicPack.rounds.length - 1, phase: 'round_end' };
}

const enterFinal = (state = beforeFinal()): RoomState =>
  reduce(state, { type: 'NEXT_ROUND', at: T0 }).state;

/** Убрать все темы, кроме одной, по очереди. */
function removeUntilOne(state: RoomState): RoomState {
  let current = state;
  for (let guard = 0; guard < 20; guard += 1) {
    const remaining = current.final?.themes.filter((theme) => theme.removedByPlayerId === null) ?? [];
    if (remaining.length <= 1) break;
    const turn = current.final?.removalTurnPlayerId;
    if (!turn) break;
    current = reduce(current, {
      type: 'FINAL_REMOVE_THEME',
      playerId: turn,
      themeId: remaining[0]!.id,
      at: T0 + guard,
    }).state;
  }
  return current;
}

describe('вход в финал', () => {
  it('после последнего раунда игра уходит в финал, а не в результаты', () => {
    const state = enterFinal();
    expect(state.phase).toBe('final_theme_removal');
    expect(state.final?.themes).toHaveLength(demoClassicPack.final.themes.length);
  });

  it('в финал не проходят игроки с нулём и минусом', () => {
    const state = enterFinal(beforeFinal([0, 1500, -200]));
    expect(state.final?.participantIds).toEqual(['p2']);
  });

  it('при выключенной настройке в финал проходят все', () => {
    const state = enterFinal(beforeFinal([0, 1500, -200], { finalRequiresPositive: false }));
    expect(state.final?.participantIds).toHaveLength(3);
  });

  it('если участников не осталось, сразу результаты', () => {
    const state = enterFinal(beforeFinal([0, -100, -200]));
    expect(state.phase).toBe('results');
  });

  it('первым убирает тему игрок с меньшим счётом', () => {
    const state = enterFinal();
    expect(state.final?.removalTurnPlayerId).toBe('p1');
  });
});

describe('снятие тем', () => {
  it('убирать можно только в свой ход', () => {
    const state = enterFinal();
    const themeId = state.final!.themes[0]!.id;
    const result = reduce(state, { type: 'FINAL_REMOVE_THEME', playerId: 'p2', themeId, at: T0 });
    expect(result.error).toBeDefined();
  });

  it('уже убранную тему убрать нельзя', () => {
    let state = enterFinal();
    const themeId = state.final!.themes[0]!.id;
    state = reduce(state, {
      type: 'FINAL_REMOVE_THEME',
      playerId: 'p1',
      themeId,
      at: T0,
    }).state;
    const again = reduce(state, {
      type: 'FINAL_REMOVE_THEME',
      playerId: state.final!.removalTurnPlayerId!,
      themeId,
      at: T0 + 1,
    });
    expect(again.error).toBeDefined();
  });

  it('ход переходит следующему участнику по кругу', () => {
    let state = enterFinal();
    const themeId = state.final!.themes[0]!.id;
    state = reduce(state, { type: 'FINAL_REMOVE_THEME', playerId: 'p1', themeId, at: T0 }).state;
    expect(state.final?.removalTurnPlayerId).toBe('p3');
  });

  it('когда осталась одна тема, начинаются ставки', () => {
    const state = removeUntilOne(enterFinal());
    expect(state.phase).toBe('final_bets');
    expect(state.final?.themes.filter((theme) => theme.removedByPlayerId === null)).toHaveLength(1);
  });
});

describe('ставки и ответы', () => {
  const atBets = (): RoomState => removeUntilOne(enterFinal());

  it('ставка меньше единицы отклоняется', () => {
    expect(reduce(atBets(), { type: 'FINAL_BET', playerId: 'p1', bet: 0, at: T0 }).error).toBeDefined();
  });

  it('ставка больше своего счёта отклоняется', () => {
    expect(
      reduce(atBets(), { type: 'FINAL_BET', playerId: 'p1', bet: 501, at: T0 }).error,
    ).toBeDefined();
  });

  it('когда все поставили, начинается написание ответов', () => {
    let state = atBets();
    for (const [playerId, bet] of [['p1', 500], ['p2', 1000], ['p3', 300]] as const) {
      state = reduce(state, { type: 'FINAL_BET', playerId, bet, at: T0 }).state;
    }
    expect(state.phase).toBe('final_answers');
  });

  it('когда все ответили, начинается вскрытие от меньшего счёта', () => {
    let state = atBets();
    for (const [playerId, bet] of [['p1', 500], ['p2', 1000], ['p3', 300]] as const) {
      state = reduce(state, { type: 'FINAL_BET', playerId, bet, at: T0 }).state;
    }
    for (const playerId of ['p1', 'p2', 'p3']) {
      state = reduce(state, { type: 'FINAL_ANSWER', playerId, answer: 'Байкал', at: T0 }).state;
    }
    expect(state.phase).toBe('final_reveal');
    expect(state.final?.revealOrder).toEqual(['p1', 'p3', 'p2']);
  });
});

describe('вскрытие и результаты', () => {
  function atReveal(): RoomState {
    let state = removeUntilOne(enterFinal());
    for (const [playerId, bet] of [['p1', 500], ['p2', 1000], ['p3', 300]] as const) {
      state = reduce(state, { type: 'FINAL_BET', playerId, bet, at: T0 }).state;
    }
    for (const playerId of ['p1', 'p2', 'p3']) {
      state = reduce(state, { type: 'FINAL_ANSWER', playerId, answer: 'Ответ', at: T0 }).state;
    }
    return state;
  }

  it('верный ответ прибавляет ставку, неверный вычитает', () => {
    let state = atReveal();
    state = reduce(state, { type: 'FINAL_JUDGE', correct: true, at: T0 }).state;
    expect(score(state, 'p1')).toBe(1000);

    state = reduce(state, { type: 'FINAL_JUDGE', correct: false, at: T0 }).state;
    expect(score(state, 'p3')).toBe(600);
  });

  it('после последнего вскрытия игра переходит к результатам', () => {
    let state = atReveal();
    for (let index = 0; index < 3; index += 1) {
      state = reduce(state, { type: 'FINAL_JUDGE', correct: true, at: T0 }).state;
    }
    expect(state.phase).toBe('results');
  });

  it('ведущий может двинуть фазу вручную: недостающие ставки минимальные', () => {
    let state = removeUntilOne(enterFinal());
    state = reduce(state, { type: 'FINAL_BET', playerId: 'p2', bet: 1000, at: T0 }).state;
    state = reduce(state, { type: 'CONTINUE', at: T0 + 100 }).state;

    expect(state.phase).toBe('final_answers');
    expect(state.final?.bets['p1']).toBe(1);
    expect(state.final?.bets['p2']).toBe(1000);
  });
});
