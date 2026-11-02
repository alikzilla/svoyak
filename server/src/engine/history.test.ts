import { describe, it, expect } from 'vitest';
import type { GameResult, RoomState } from '@svoyak/shared';
import { DEFAULT_SETTINGS } from '@svoyak/shared';
import { demoClassicPack } from '../packs/demo/classic.js';
import { createRoomState } from './createRoom.js';
import { hallOfFame, resultOf } from './history.js';

function finishedRoom(scores: Array<[string, number]>): RoomState {
  const state = createRoomState({
    code: '4242',
    pack: demoClassicPack,
    settings: DEFAULT_SETTINGS,
    hostToken: 'h',
    now: 1000,
  });
  return {
    ...state,
    phase: 'results',
    players: scores.map(([name, score], index) => ({
      id: `p${index}`,
      name,
      score,
      connected: true,
      joinedAt: index,
      sessionToken: `t${index}`,
      hints: 0,
    })),
  };
}

const game = (id: string, finishedAt: number, players: Array<[string, number]>): GameResult => ({
  id,
  code: id,
  packTitle: 'Пак',
  startedAt: finishedAt - 1,
  finishedAt,
  players: players.map(([name, score]) => ({ name, score })),
});

describe('итог игры', () => {
  it('сыгранная комната даёт запись: счёт по убыванию, id из кода и времени создания', () => {
    const result = resultOf(finishedRoom([['Аня', 300], ['Боря', 900]]), 5000);
    expect(result).toEqual({
      id: '1000-4242',
      code: '4242',
      packTitle: demoClassicPack.title,
      startedAt: 1000,
      finishedAt: 5000,
      players: [
        { name: 'Боря', score: 900 },
        { name: 'Аня', score: 300 },
      ],
    });
  });

  it('пока игра идёт или в комнате никого — записи нет', () => {
    expect(resultOf({ ...finishedRoom([['Аня', 1]]), phase: 'picking' }, 1)).toBeNull();
    expect(resultOf(finishedRoom([]), 1)).toBeNull();
  });
});

describe('зал славы', () => {
  it('считает победы, игры и рекорд, а лучший — первым', () => {
    const fame = hallOfFame([
      game('b', 2, [['Боря', 1200], ['Аня', 400]]),
      game('a', 1, [['Аня', 700], ['Боря', 500]]),
      game('c', 3, [['Боря', 300], ['Вера', 100]]),
    ]);
    expect(fame).toEqual([
      { name: 'Боря', games: 3, wins: 2, bestScore: 1200 },
      { name: 'Аня', games: 2, wins: 1, bestScore: 700 },
      { name: 'Вера', games: 1, wins: 0, bestScore: 100 },
    ]);
  });

  it('ничья — победа обоим, а при счёте не больше нуля победителя нет', () => {
    const fame = hallOfFame([
      game('a', 1, [['Аня', 500], ['Боря', 500]]),
      game('b', 2, [['Аня', 0], ['Боря', -200]]),
    ]);
    expect(fame.map((entry) => [entry.name, entry.wins])).toEqual([
      ['Аня', 1],
      ['Боря', 1],
    ]);
  });

  it('одно имя в разном регистре — один человек, показывается последнее написание', () => {
    const fame = hallOfFame([
      game('new', 2, [['ВАСЯ', 100]]),
      game('old', 1, [[' вася ', 200]]),
    ]);
    expect(fame).toEqual([{ name: 'ВАСЯ', games: 2, wins: 2, bestScore: 200 }]);
  });
});
