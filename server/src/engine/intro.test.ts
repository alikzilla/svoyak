import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, gameIntroMs, gameThemeTitles, roundIntroMs, type RoomState } from '@svoyak/shared';
import { demoClassicPack } from '../packs/demo/classic.js';
import { createRoomState } from './createRoom.js';
import { reduce } from './reducer.js';
import type { Effect } from './actions.js';

function lobby(): RoomState {
  let state = createRoomState({
    code: '1234',
    pack: demoClassicPack,
    settings: { ...DEFAULT_SETTINGS, announceMs: 0 },
    hostToken: 'h',
    now: 1000,
  });
  state = reduce(state, {
    type: 'PLAYER_JOIN',
    playerId: 'p1',
    name: 'Вася',
    sessionToken: 't1',
    at: 2000,
  }).state;
  return state;
}

const introTimer = (effects: Effect[]) =>
  effects.find((effect) => effect.type === 'setTimer' && effect.kind === 'intro');

const expire = (state: RoomState, at = 9000) =>
  reduce(state, { type: 'TIMER_EXPIRED', kind: 'intro', at });

describe('заставка «Темы игры»', () => {
  it('старт игры начинается со списка всех тем, а не с табло', () => {
    const result = reduce(lobby(), { type: 'START_GAME', at: 3000 });
    expect(result.state.phase).toBe('game_intro');
    expect(result.state.controlPlayerId).toBe('p1');
  });

  it('длится столько, сколько нужно на все темы пака', () => {
    const result = reduce(lobby(), { type: 'START_GAME', at: 3000 });
    const themeCount = gameThemeTitles(demoClassicPack).length;
    expect(introTimer(result.effects)).toMatchObject({ durationMs: gameIntroMs(themeCount) });
  });

  it('по окончании переходит к заставке первого раунда', () => {
    const started = reduce(lobby(), { type: 'START_GAME', at: 3000 }).state;
    const result = expire(started);
    expect(result.state.phase).toBe('round_intro');
    expect(result.state.roundIndex).toBe(0);
    expect(introTimer(result.effects)).toMatchObject({ durationMs: roundIntroMs(started.board.length) });
  });
});

describe('заставка раунда', () => {
  it('по окончании открывает табло', () => {
    const roundIntro = expire(reduce(lobby(), { type: 'START_GAME', at: 3000 }).state).state;
    const result = expire(roundIntro);
    expect(result.state.phase).toBe('picking');
  });

  it('следующий раунд тоже начинается с заставки на своё число тем', () => {
    const roundEnd: RoomState = { ...reduce(lobby(), { type: 'START_GAME', at: 3000 }).state, phase: 'round_end' };
    const result = reduce(roundEnd, { type: 'NEXT_ROUND', at: 9000 });
    expect(result.state.phase).toBe('round_intro');
    expect(introTimer(result.effects)).toMatchObject({ durationMs: roundIntroMs(result.state.board.length) });
  });

  it('устаревший таймер заставки не трогает игру, которая уже идёт', () => {
    const picking: RoomState = { ...reduce(lobby(), { type: 'START_GAME', at: 3000 }).state, phase: 'picking' };
    const result = expire(picking);
    expect(result.state).toBe(picking);
    expect(result.effects).toEqual([]);
  });
});

describe('пропуск заставки', () => {
  it('«Темы игры» пропускаются сразу к табло', () => {
    const started = reduce(lobby(), { type: 'START_GAME', at: 3000 }).state;
    const result = reduce(started, { type: 'CONTINUE', at: 4000 });
    expect(result.state.phase).toBe('picking');
    expect(result.effects).toContainEqual({ type: 'clearTimer' });
  });

  it('заставка раунда пропускается к табло', () => {
    const roundIntro = expire(reduce(lobby(), { type: 'START_GAME', at: 3000 }).state).state;
    const result = reduce(roundIntro, { type: 'CONTINUE', at: 9500 });
    expect(result.state.phase).toBe('picking');
    expect(result.effects).toContainEqual({ type: 'clearTimer' });
  });
});

describe('вопрос во время заставки', () => {
  const pick = (state: RoomState) =>
    reduce(state, { type: 'PICK_QUESTION', themeId: 'r1-kino', questionId: 'r1-kino-q1', at: 4000 });

  it('во время «Тем игры» открыть нельзя', () => {
    const started = reduce(lobby(), { type: 'START_GAME', at: 3000 }).state;
    expect(pick(started).error).toBeDefined();
  });

  it('во время заставки раунда открыть нельзя', () => {
    const roundIntro = expire(reduce(lobby(), { type: 'START_GAME', at: 3000 }).state).state;
    expect(pick(roundIntro).error).toBeDefined();
  });
});
