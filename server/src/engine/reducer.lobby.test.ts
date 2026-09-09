import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, type Pack, type RoomState } from '@svoyak/shared';
import { demoClassicPack } from '../packs/demo/classic.js';
import { createRoomState } from './createRoom.js';
import { reduce } from './reducer.js';
import { applyDelta } from './players.js';

const fresh = (): RoomState =>
  createRoomState({
    code: '1234',
    pack: demoClassicPack,
    settings: DEFAULT_SETTINGS,
    hostToken: 'host-token',
    now: 1000,
  });

const join = (state: RoomState, name: string, id: string, token: string): RoomState =>
  reduce(state, { type: 'PLAYER_JOIN', playerId: id, name, sessionToken: token, at: 2000 }).state;

describe('редьюсер: лобби', () => {
  it('вход добавляет игрока с нулевым счётом', () => {
    const state = join(fresh(), 'Вася', 'p1', 't1');
    expect(state.players).toHaveLength(1);
    expect(state.players[0]).toMatchObject({ id: 'p1', name: 'Вася', score: 0, connected: true });
  });

  it('имя, занятое подключённым игроком, отклоняется', () => {
    const withVasya = join(fresh(), 'Вася', 'p1', 't1');
    const result = reduce(withVasya, {
      type: 'PLAYER_JOIN',
      playerId: 'p2',
      name: 'Вася',
      sessionToken: 't2',
      at: 3000,
    });
    expect(result.error).toBeDefined();
    expect(result.state.players).toHaveLength(1);
  });

  it('вход с известным токеном переподключает того же игрока, а не создаёт нового', () => {
    let state = join(fresh(), 'Вася', 'p1', 't1');
    state = reduce(state, { type: 'SET_SCORE', playerId: 'p1', score: 500 }).state;
    state = reduce(state, { type: 'PLAYER_DISCONNECT', playerId: 'p1' }).state;

    const result = reduce(state, {
      type: 'PLAYER_JOIN',
      playerId: 'p-new',
      name: 'Вася',
      sessionToken: 't1',
      at: 4000,
    });

    expect(result.error).toBeUndefined();
    expect(result.state.players).toHaveLength(1);
    expect(result.state.players[0]).toMatchObject({ id: 'p1', score: 500, connected: true });
  });

  it('вход под именем отключённого игрока возвращает его вместе со счётом', () => {
    let state = join(fresh(), 'Вася', 'p1', 't1');
    state = reduce(state, { type: 'SET_SCORE', playerId: 'p1', score: 300 }).state;
    state = reduce(state, { type: 'PLAYER_DISCONNECT', playerId: 'p1' }).state;

    const result = reduce(state, {
      type: 'PLAYER_JOIN',
      playerId: 'p-new',
      name: 'Вася',
      sessionToken: 'token-lost',
      at: 5000,
    });

    expect(result.state.players).toHaveLength(1);
    expect(result.state.players[0]).toMatchObject({ id: 'p1', score: 300, connected: true });
    expect(result.state.players[0]!.sessionToken).toBe('token-lost');
  });

  it('отключение сохраняет игрока и его счёт', () => {
    let state = join(fresh(), 'Вася', 'p1', 't1');
    state = reduce(state, { type: 'SET_SCORE', playerId: 'p1', score: 200 }).state;
    state = reduce(state, { type: 'PLAYER_DISCONNECT', playerId: 'p1' }).state;
    expect(state.players[0]).toMatchObject({ score: 200, connected: false });
  });

  it('кик удаляет игрока и снимает с него право хода', () => {
    let state = join(fresh(), 'Вася', 'p1', 't1');
    state = { ...state, controlPlayerId: 'p1' };
    state = reduce(state, { type: 'PLAYER_KICK', playerId: 'p1' }).state;
    expect(state.players).toHaveLength(0);
    expect(state.controlPlayerId).toBeNull();
  });

  it('правка счёта ставит ровно то значение, которое задал ведущий', () => {
    let state = join(fresh(), 'Вася', 'p1', 't1');
    state = reduce(state, { type: 'SET_SCORE', playerId: 'p1', score: -700 }).state;
    expect(state.players[0]!.score).toBe(-700);
  });

  it('замена пака в лобби пересобирает доску', () => {
    const state = join(fresh(), 'Вася', 'p1', 't1');
    const swapped: Pack = {
      ...demoClassicPack,
      id: 'other',
      rounds: [{ ...demoClassicPack.rounds[1]!, id: 'only', title: 'Единственный раунд' }],
    };

    const result = reduce(state, { type: 'SET_PACK', pack: swapped });

    expect(result.state.pack.id).toBe('other');
    expect(result.state.board.map((theme) => theme.title)).toEqual(
      swapped.rounds[0]!.themes.map((theme) => theme.title),
    );
  });

  it('после старта пак заменить нельзя', () => {
    let state = join(fresh(), 'Вася', 'p1', 't1');
    state = reduce(state, { type: 'START_GAME', at: 5000 }).state;

    const result = reduce(state, { type: 'SET_PACK', pack: demoClassicPack });

    expect(result.error).toBe('Состав можно менять только до начала игры');
    expect(result.state.pack.id).toBe(demoClassicPack.id);
  });

  it('редьюсер не мутирует исходное состояние', () => {
    const before = fresh();
    const snapshot = JSON.stringify(before);
    join(before, 'Вася', 'p1', 't1');
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe('applyDelta', () => {
  it('складывает счёт с изменением', () => {
    expect(applyDelta(300, -500, true)).toBe(-200);
  });

  it('не опускает счёт ниже нуля, если минус запрещён', () => {
    expect(applyDelta(300, -500, false)).toBe(0);
  });
});
