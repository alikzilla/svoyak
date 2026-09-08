import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, type RoomState } from '@svoyak/shared';
import { demoClassicPack } from '../packs/demo/classic.js';
import { createRoomState } from '../engine/createRoom.js';
import { reduce } from '../engine/reducer.js';
import { projectForBoard, projectForHost, projectForPlayer } from './projections.js';

const JOIN_URL = 'http://test/join';
const T0 = 100_000;

/** Финал с одной оставшейся темой «География» и сделанными ставками. */
function finalWithBets(): RoomState {
  let state = createRoomState({
    code: '1234',
    pack: demoClassicPack,
    settings: DEFAULT_SETTINGS,
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
  state = reduce(state, { type: 'SET_SCORE', playerId: 'p1', score: 500 }).state;
  state = reduce(state, { type: 'SET_SCORE', playerId: 'p2', score: 900 }).state;
  state = { ...state, roundIndex: demoClassicPack.rounds.length - 1, phase: 'round_end' };
  state = reduce(state, { type: 'NEXT_ROUND', at: T0 }).state;

  // Убираем все темы, кроме первой.
  for (let guard = 0; guard < 10; guard += 1) {
    const remaining = state.final!.themes.filter((theme) => theme.removedByPlayerId === null);
    if (remaining.length <= 1) break;
    state = reduce(state, {
      type: 'FINAL_REMOVE_THEME',
      playerId: state.final!.removalTurnPlayerId!,
      themeId: remaining[remaining.length - 1]!.id,
      at: T0 + guard,
    }).state;
  }

  state = reduce(state, { type: 'FINAL_BET', playerId: 'p1', bet: 500, at: T0 }).state;
  return state;
}

describe('проекции финала', () => {
  it('чужая ставка не видна игроку до вскрытия', () => {
    const state = finalWithBets();
    const view = projectForPlayer(state, 'p2');
    expect(view.final?.betPlacedIds).toContain('p1');
    expect(view.final?.revealed).toEqual([]);
    expect(JSON.stringify(view.final)).not.toContain('500');
  });

  it('свою ставку игрок видит', () => {
    const view = projectForPlayer(finalWithBets(), 'p1');
    expect(view.myFinalBet).toBe(500);
  });

  it('во время ставок текст вопроса скрыт, а тема известна', () => {
    const view = projectForPlayer(finalWithBets(), 'p1');
    expect(view.final?.themeTitle).toBe('География');
    expect(view.final?.questionText).toBeNull();
  });

  it('на общем экране во время ставок вопроса тоже нет', () => {
    const serialized = JSON.stringify(projectForBoard(finalWithBets(), JOIN_URL));
    expect(serialized).not.toContain('Самое глубокое озеро');
  });

  it('ведущему вопрос и ответ видны сразу', () => {
    const view = projectForHost(finalWithBets(), JOIN_URL);
    expect(view.final?.questionText).toContain('Самое глубокое озеро');
    expect(view.final?.answer).toBe('Байкал');
  });

  it('когда пора отвечать, вопрос появляется у игроков', () => {
    let state = finalWithBets();
    state = reduce(state, { type: 'FINAL_BET', playerId: 'p2', bet: 900, at: T0 }).state;
    expect(state.phase).toBe('final_answers');

    const view = projectForPlayer(state, 'p1');
    expect(view.final?.questionText).toContain('Самое глубокое озеро');
  });

  it('чужой ответ не виден до вскрытия', () => {
    let state = finalWithBets();
    state = reduce(state, { type: 'FINAL_BET', playerId: 'p2', bet: 900, at: T0 }).state;
    state = reduce(state, { type: 'FINAL_ANSWER', playerId: 'p1', answer: 'Каспий', at: T0 }).state;

    const serialized = JSON.stringify(projectForPlayer(state, 'p2').final);
    expect(serialized).not.toContain('Каспий');
  });

  it('вскрытые ответы появляются у всех', () => {
    let state = finalWithBets();
    state = reduce(state, { type: 'FINAL_BET', playerId: 'p2', bet: 900, at: T0 }).state;
    state = reduce(state, { type: 'FINAL_ANSWER', playerId: 'p1', answer: 'Каспий', at: T0 }).state;
    state = reduce(state, { type: 'FINAL_ANSWER', playerId: 'p2', answer: 'Байкал', at: T0 }).state;
    state = reduce(state, { type: 'FINAL_JUDGE', correct: false, at: T0 }).state;

    const view = projectForPlayer(state, 'p2');
    expect(view.final?.revealed[0]).toMatchObject({ playerId: 'p1', bet: 500, answer: 'Каспий', correct: false });
  });
});

describe('заголовок раунда', () => {
  it('в финале показывает «Финал», а не номер раунда', () => {
    expect(projectForHost(finalWithBets(), JOIN_URL).roundTitle).toBe('Финал');
  });
});
