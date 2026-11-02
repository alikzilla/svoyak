import { describe, it, expect } from 'vitest';
import { plural } from './plural.js';

const games = (count: number): string => plural(count, ['игра', 'игры', 'игр']);

describe('plural', () => {
  it.each([
    [1, '1 игра'],
    [2, '2 игры'],
    [4, '4 игры'],
    [5, '5 игр'],
    [11, '11 игр'],
    [12, '12 игр'],
    [14, '14 игр'],
    [21, '21 игра'],
    [22, '22 игры'],
    [0, '0 игр'],
    [111, '111 игр'],
  ])('%i → %s', (count, expected) => {
    expect(games(count)).toBe(expected);
  });
});
