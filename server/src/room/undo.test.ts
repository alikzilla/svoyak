import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS } from '@svoyak/shared';
import { demoClassicPack } from '../packs/demo/classic.js';
import { createRoomState } from '../engine/createRoom.js';
import { RoomRuntime } from './RoomRuntime.js';

function runtime(): RoomRuntime {
  const state = createRoomState({
    code: '1234',
    pack: demoClassicPack,
    settings: DEFAULT_SETTINGS,
    hostToken: 'host-token',
    now: 1000,
  });
  const room = new RoomRuntime(state, { persist: () => {}, joinUrlFor: () => 'url' });
  room.dispatch({ type: 'PLAYER_JOIN', playerId: 'p1', name: 'Вася', sessionToken: 't1', at: 2000 });
  return room;
}

describe('undo', () => {
  it('возвращает счёт к значению до правки', () => {
    const room = runtime();
    room.dispatch({ type: 'SET_SCORE', playerId: 'p1', score: 500 });
    expect(room.state.players[0]!.score).toBe(500);

    expect(room.undo()).toBe(true);
    expect(room.state.players[0]!.score).toBe(0);
  });

  it('возвращает кикнутого игрока', () => {
    const room = runtime();
    room.dispatch({ type: 'PLAYER_KICK', playerId: 'p1' });
    expect(room.state.players).toHaveLength(0);

    room.undo();
    expect(room.state.players).toHaveLength(1);
    expect(room.state.players[0]!.name).toBe('Вася');
  });

  it('на пустом стеке возвращает false и не меняет состояние', () => {
    const room = runtime();
    const before = JSON.stringify(room.state);
    expect(room.undo()).toBe(false);
    expect(JSON.stringify(room.state)).toBe(before);
  });

  it('вход игрока не попадает в стек отмены', () => {
    const room = runtime();
    expect(room.canUndo).toBe(false);
  });

  it('глубина стека ограничена пятьюдесятью снимками', () => {
    const room = runtime();
    for (let i = 1; i <= 60; i += 1) {
      room.dispatch({ type: 'SET_SCORE', playerId: 'p1', score: i * 10 });
    }
    let undone = 0;
    while (room.undo()) undone += 1;
    expect(undone).toBe(50);
  });

  it('отменённое действие сохраняется на диск', () => {
    const saves: number[] = [];
    const state = createRoomState({
      code: '1234',
      pack: demoClassicPack,
      settings: DEFAULT_SETTINGS,
      hostToken: 'host-token',
      now: 1000,
    });
    const room = new RoomRuntime(state, {
      persist: (next) => saves.push(next.players.length),
      joinUrlFor: () => 'url',
    });
    room.dispatch({ type: 'PLAYER_JOIN', playerId: 'p1', name: 'Вася', sessionToken: 't1', at: 2000 });
    room.dispatch({ type: 'PLAYER_KICK', playerId: 'p1' });
    room.undo();
    expect(saves.at(-1)).toBe(1);
  });
});

describe('снимок состояния', () => {
  it('не копирует пак, но копирует изменяемую часть', () => {
    const room = runtime();
    room.dispatch({ type: 'SET_SCORE', playerId: 'p1', score: 100 });
    const snapshot = room.snapshotForTest();
    room.dispatch({ type: 'SET_SCORE', playerId: 'p1', score: 200 });

    expect(snapshot.players[0]!.score).toBe(100);
    expect(snapshot.pack).toBe(room.state.pack);
  });
});

describe('отмена не трогает состав комнаты', () => {
  it('игрок, вошедший после снимка, не исчезает', () => {
    const room = runtime();
    room.dispatch({ type: 'SET_SCORE', playerId: 'p1', score: 500 });
    room.dispatch({ type: 'PLAYER_JOIN', playerId: 'p2', name: 'Петя', sessionToken: 't2', at: 3000 });

    room.undo();

    expect(room.state.players.map((player) => player.name)).toEqual(['Вася', 'Петя']);
    expect(room.state.players[0]?.score).toBe(0);
  });

  it('связь игроков не откатывается вместе с действием', () => {
    const room = runtime();
    room.dispatch({ type: 'PLAYER_DISCONNECT', playerId: 'p1' });
    room.dispatch({ type: 'SET_SCORE', playerId: 'p1', score: 700 });
    // Игрок вернулся уже после правки счёта.
    room.dispatch({ type: 'PLAYER_JOIN', playerId: 'p1', name: 'Вася', sessionToken: 't1', at: 4000 });

    room.undo();

    expect(room.state.players[0]?.score).toBe(0);
    expect(room.state.players[0]?.connected).toBe(true);
  });

  it('кикнутый игрок возвращается отменой', () => {
    const room = runtime();
    room.dispatch({ type: 'PLAYER_KICK', playerId: 'p1' });
    expect(room.state.players).toHaveLength(0);

    room.undo();
    expect(room.state.players.map((player) => player.name)).toEqual(['Вася']);
  });
});
