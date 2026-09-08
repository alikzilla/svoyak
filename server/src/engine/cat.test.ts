import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, type Pack, type RoomState } from '@svoyak/shared';
import { demoClassicPack } from '../packs/demo/classic.js';
import { createRoomState } from './createRoom.js';
import { reduce } from './reducer.js';

const T0 = 100_000;
const score = (state: RoomState, playerId: string): number =>
  state.players.find((player) => player.id === playerId)?.score ?? 0;

/** Демо-пак: кот лежит в «Животных» за 800 во втором раунде. */
const CAT_THEME = 'r2-animals';
const CAT_QUESTION = 'r2-animals-q4';

function roomAtCatRound(pack: Pack = demoClassicPack): RoomState {
  let state = createRoomState({
    code: '1234',
    pack,
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
  // Переходим во второй раунд, где лежит кот.
  state = { ...state, phase: 'round_end' };
  return reduce(state, { type: 'NEXT_ROUND', at: 3500 }).state;
}

const openCat = (state = roomAtCatRound()): RoomState =>
  reduce(state, {
    type: 'PICK_QUESTION',
    themeId: CAT_THEME,
    questionId: CAT_QUESTION,
    at: T0,
  }).state;

describe('кот в мешке', () => {
  it('уводит в передачу, а не в чтение вопроса', () => {
    const state = openCat();
    expect(state.phase).toBe('cat_transfer');
    expect(state.cat).toMatchObject({ fromPlayerId: 'p1', toPlayerId: null, theme: 'Птицы' });
  });

  it('цена «nominal» берётся от клетки', () => {
    const state = openCat();
    expect(state.cat?.price).toBe(800);
    expect(state.active?.price).toBe(800);
  });

  it('заданная цена кота идёт вместо номинала', () => {
    const pack = structuredClone(demoClassicPack);
    const question = pack.rounds[1]!.themes[1]!.questions[3]!;
    question.cat = { theme: 'Птицы', price: 300, canKeep: false };
    const state = openCat(roomAtCatRound(pack));
    expect(state.active?.price).toBe(300);
  });

  it('передавать себе нельзя, если canKeep выключен', () => {
    const result = reduce(openCat(), { type: 'CAT_TRANSFER', toPlayerId: 'p1', at: T0 + 1000 });
    expect(result.error).toBeDefined();
  });

  it('при canKeep кота можно оставить себе', () => {
    const pack = structuredClone(demoClassicPack);
    pack.rounds[1]!.themes[1]!.questions[3]!.cat = { theme: 'Птицы', price: 'nominal', canKeep: true };
    const result = reduce(openCat(roomAtCatRound(pack)), {
      type: 'CAT_TRANSFER',
      toPlayerId: 'p1',
      at: T0 + 1000,
    });
    expect(result.error).toBeUndefined();
    expect(result.state.active?.soloPlayerId).toBe('p1');
  });

  it('после передачи отвечает только получивший', () => {
    const state = reduce(openCat(), { type: 'CAT_TRANSFER', toPlayerId: 'p2', at: T0 + 1000 }).state;
    expect(state.phase).toBe('cat_answer');
    expect(state.active?.soloPlayerId).toBe('p2');
    expect(state.cat?.toPlayerId).toBe('p2');
  });

  it('кнопка в этой фазе не работает', () => {
    const state = reduce(openCat(), { type: 'CAT_TRANSFER', toPlayerId: 'p2', at: T0 + 1000 }).state;
    const buzzed = reduce(state, {
      type: 'BUZZ',
      playerId: 'p3',
      atServerTime: T0 + 2000,
      receivedAt: T0 + 2000,
    });
    expect(buzzed.state.buzz.candidates).toHaveLength(0);
    expect(buzzed.state.phase).toBe('cat_answer');
  });

  it('верный ответ даёт деньги и право хода получившему', () => {
    let state = reduce(openCat(), { type: 'CAT_TRANSFER', toPlayerId: 'p2', at: T0 + 1000 }).state;
    state = reduce(state, { type: 'JUDGE', verdict: 'correct', at: T0 + 5000 }).state;

    expect(score(state, 'p2')).toBe(800);
    expect(state.controlPlayerId).toBe('p2');
    expect(state.phase).toBe('picking');
  });

  it('неверный ответ снимает деньги с получившего и оставляет ход передавшему', () => {
    let state = reduce(openCat(), { type: 'CAT_TRANSFER', toPlayerId: 'p2', at: T0 + 1000 }).state;
    state = reduce(state, { type: 'JUDGE', verdict: 'wrong', at: T0 + 5000 }).state;

    expect(score(state, 'p2')).toBe(-800);
    expect(state.controlPlayerId).toBe('p1');
  });

  it('неверный ответ не открывает кнопку остальным, а раскрывает ответ', () => {
    let state = reduce(openCat(), { type: 'CAT_TRANSFER', toPlayerId: 'p2', at: T0 + 1000 }).state;
    state = reduce(state, { type: 'JUDGE', verdict: 'wrong', at: T0 + 5000 }).state;

    expect(state.phase).toBe('answer_reveal');
    expect(state.active?.answerRevealed).toBe(true);
  });
});
