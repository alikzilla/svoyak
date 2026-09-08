import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS } from '@svoyak/shared';
import { demoClassicPack } from '../packs/demo/classic.js';
import { createRoomState } from './createRoom.js';

const room = () =>
  createRoomState({
    code: '1234',
    pack: demoClassicPack,
    settings: DEFAULT_SETTINGS,
    hostToken: 'host-token',
  });

describe('createRoomState', () => {
  it('стартует в лобби без игроков и без права хода', () => {
    const state = room();
    expect(state.phase).toBe('lobby');
    expect(state.players).toEqual([]);
    expect(state.controlPlayerId).toBeNull();
    expect(state.roundIndex).toBe(0);
    expect(state.timer).toBeNull();
    expect(state.paused).toBe(false);
  });

  it('строит доску первого раунда с ценами из пака', () => {
    const state = room();
    expect(state.board).toHaveLength(4);
    expect(state.board[0]!.title).toBe('Кино');
    expect(state.board[0]!.cells.map((cell) => cell.price)).toEqual([100, 200, 300, 400, 500]);
  });

  it('все клетки доски изначально непройденные', () => {
    const state = room();
    expect(state.board.every((theme) => theme.cells.every((cell) => !cell.played))).toBe(true);
  });

  it('кнопка закрыта и без блокировок', () => {
    const state = room();
    expect(state.buzz.openedAt).toBeNull();
    expect(state.buzz.answeringPlayerId).toBeNull();
    expect(state.buzz.lockedUntil).toEqual({});
  });
});
