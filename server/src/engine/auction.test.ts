import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, type RoomState } from '@svoyak/shared';
import { demoClassicPack } from '../packs/demo/classic.js';
import { createRoomState } from './createRoom.js';
import { reduce } from './reducer.js';

const T0 = 100_000;
const score = (state: RoomState, playerId: string): number =>
  state.players.find((player) => player.id === playerId)?.score ?? 0;

/** В демо-паке аукцион лежит в «Истории» за 600 во втором раунде. */
const AUCTION_THEME = 'r2-history';
const AUCTION_QUESTION = 'r2-history-q3';

/** Три игрока с разным счётом: у Васи право хода. */
function roomBeforeAuction(scores: [number, number, number] = [2000, 1500, 400]): RoomState {
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
  for (const [index, value] of scores.entries()) {
    state = reduce(state, { type: 'SET_SCORE', playerId: `p${index + 1}`, score: value }).state;
  }
  state = { ...state, phase: 'round_end' };
  return reduce(state, { type: 'NEXT_ROUND', at: 3500 }).state;
}

const openAuction = (state = roomBeforeAuction()): RoomState =>
  reduce(state, {
    type: 'PICK_QUESTION',
    themeId: AUCTION_THEME,
    questionId: AUCTION_QUESTION,
    at: T0,
  }).state;

const bid = (state: RoomState, playerId: string, amount: number | 'all-in' | 'pass') =>
  reduce(state, { type: 'BID', playerId, amount, at: T0 + 1000 });

describe('аукцион', () => {
  it('начинается ставкой номинала от открывшего', () => {
    const state = openAuction();
    expect(state.phase).toBe('auction_bidding');
    expect(state.auction).toMatchObject({ currentBid: 600, leaderId: 'p1', turnPlayerId: 'p2' });
  });

  it('поднять можно минимум на шаг', () => {
    const state = openAuction();
    expect(bid(state, 'p2', 650).error).toBeDefined();
    expect(bid(state, 'p2', 700).error).toBeUndefined();
  });

  it('ставка выше своего счёта отклоняется', () => {
    const state = openAuction();
    expect(bid(state, 'p2', 5000).error).toBeDefined();
  });

  it('ходить может только тот, чья очередь', () => {
    const state = openAuction();
    expect(bid(state, 'p3', 700).error).toBeDefined();
  });

  it('ва-банк ставит весь счёт', () => {
    const state = bid(openAuction(), 'p2', 'all-in').state;
    expect(state.auction).toMatchObject({ currentBid: 1500, leaderId: 'p2' });
  });

  it('пас необратим и убирает игрока из торгов', () => {
    let state = bid(openAuction(), 'p2', 'pass').state;
    expect(state.auction?.passedIds).toContain('p2');
    expect(bid(state, 'p2', 900).error).toBeDefined();
  });

  it('игрок, которому нечем перебить, пропускается автоматически', () => {
    // У Маши 400 при номинале 600 — её очередь не наступает.
    const state = bid(openAuction(), 'p2', 700).state;
    expect(state.auction?.turnPlayerId).toBe('p1');
    expect(state.auction?.passedIds).toContain('p3');
  });

  it('когда все спасовали, играет лидер по своей ставке', () => {
    let state = bid(openAuction(), 'p2', 900).state;
    state = bid(state, 'p1', 'pass').state;

    expect(state.phase).toBe('auction_answer');
    expect(state.active?.soloPlayerId).toBe('p2');
    expect(state.active?.price).toBe(900);
  });

  it('если все пасуют сразу, вопрос играет открывший по номиналу', () => {
    let state = bid(openAuction(roomBeforeAuction([2000, 1500, 400])), 'p2', 'pass').state;
    expect(state.phase).toBe('auction_answer');
    expect(state.active?.soloPlayerId).toBe('p1');
    expect(state.active?.price).toBe(600);
  });

  it('кнопка в аукционе не работает', () => {
    let state = bid(openAuction(), 'p2', 900).state;
    state = bid(state, 'p1', 'pass').state;
    const buzzed = reduce(state, {
      type: 'BUZZ',
      playerId: 'p3',
      atServerTime: T0 + 5000,
      receivedAt: T0 + 5000,
    });
    expect(buzzed.state.buzz.candidates).toHaveLength(0);
  });

  it('верный ответ начисляет ставку, а не номинал', () => {
    let state = bid(openAuction(), 'p2', 900).state;
    state = bid(state, 'p1', 'pass').state;
    state = reduce(state, { type: 'JUDGE', verdict: 'correct', at: T0 + 9000 }).state;

    expect(score(state, 'p2')).toBe(1500 + 900);
    expect(state.controlPlayerId).toBe('p2');
  });

  it('неверный ответ снимает ставку и раскрывает ответ', () => {
    let state = bid(openAuction(), 'p2', 900).state;
    state = bid(state, 'p1', 'pass').state;
    state = reduce(state, { type: 'JUDGE', verdict: 'wrong', at: T0 + 9000 }).state;

    expect(score(state, 'p2')).toBe(1500 - 900);
    expect(state.phase).toBe('answer_reveal');
    expect(state.controlPlayerId).toBe('p1');
  });
});
