import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, type Player, type RoomSettings } from '@svoyak/shared';
import { applyModifier } from './modifiers.js';

const player = (id: string, score: number): Player => ({
  id,
  name: id,
  score,
  connected: true,
  joinedAt: 0,
  sessionToken: `t-${id}`,
  hints: 0,
});

/** Вася открыл клетку, Петя ведёт, Маша в минусе. */
const table = (): Player[] => [player('p1', 300), player('p2', 1000), player('p3', -200)];

const scores = (players: Player[]): Record<string, number> =>
  Object.fromEntries(players.map((item) => [item.id, item.score]));

const run = (
  kind: Parameters<typeof applyModifier>[1],
  target: string | null = null,
  settings: RoomSettings = DEFAULT_SETTINGS,
  players: Player[] = table(),
): Record<string, number> => scores(applyModifier(players, kind, 'p1', target, settings));

describe('эффекты модификаторов', () => {
  it('перевёртыш меняет знак счёта открывшему', () => {
    expect(run('flip')['p1']).toBe(-300);
  });

  it('перевёртыш вытаскивает из минуса', () => {
    const players = [player('p1', -700), player('p2', 100)];
    expect(run('flip', null, DEFAULT_SETTINGS, players)['p1']).toBe(700);
  });

  it('джекпот добавляет ровно 2000', () => {
    expect(run('jackpot')['p1']).toBe(2300);
  });

  it('пустышка не меняет ничего', () => {
    expect(run('nothing')).toEqual({ p1: 300, p2: 1000, p3: -200 });
  });

  it('ограбление снимает 500 с лидера и отдаёт открывшему', () => {
    const after = run('robbery');
    expect(after['p2']).toBe(500);
    expect(after['p1']).toBe(800);
  });

  it('ограбление ищет лидера среди остальных, а не себя', () => {
    const players = [player('p1', 5000), player('p2', 100)];
    const after = run('robbery', null, DEFAULT_SETTINGS, players);
    expect(after['p1']).toBe(5500);
    expect(after['p2']).toBe(-400);
  });

  it('ограбление в одиночку ничего не делает', () => {
    const players = [player('p1', 300)];
    expect(run('robbery', null, DEFAULT_SETTINGS, players)).toEqual({ p1: 300 });
  });

  it('удвоение удваивает счёт', () => {
    expect(run('double')['p1']).toBe(600);
  });

  it('удвоение в минусе удваивает долг', () => {
    const players = [player('p1', -400), player('p2', 0)];
    expect(run('double', null, DEFAULT_SETTINGS, players)['p1']).toBe(-800);
  });

  it('щедрость раздаёт каждому по 500 за свой счёт', () => {
    const after = run('generosity');
    expect(after['p1']).toBe(-200);
    expect(after['p2']).toBe(1500);
    expect(after['p3']).toBe(300);
  });

  it('щедрость в одиночку ничего не делает', () => {
    const players = [player('p1', 300)];
    expect(run('generosity', null, DEFAULT_SETTINGS, players)).toEqual({ p1: 300 });
  });

  it('подсказка выдаёт жетон и не трогает счёт', () => {
    const after = applyModifier(table(), 'hint', 'p1', null, DEFAULT_SETTINGS);
    expect(after.find((item) => item.id === 'p1')?.hints).toBe(1);
    expect(after.find((item) => item.id === 'p1')?.score).toBe(300);
  });

  it('обмен меняет счета местами', () => {
    const after = run('swap', 'p2');
    expect(after['p1']).toBe(1000);
    expect(after['p2']).toBe(300);
  });

  it('обмен без цели ничего не делает', () => {
    expect(run('swap', null)).toEqual({ p1: 300, p2: 1000, p3: -200 });
  });

  it('обмен с самим собой ничего не делает', () => {
    expect(run('swap', 'p1')).toEqual({ p1: 300, p2: 1000, p3: -200 });
  });

  it('обмен с несуществующим игроком ничего не делает', () => {
    expect(run('swap', 'нет-такого')).toEqual({ p1: 300, p2: 1000, p3: -200 });
  });
});

describe('запрет минуса соблюдается всеми модификаторами', () => {
  const noNegative: RoomSettings = { ...DEFAULT_SETTINGS, allowNegative: false };

  it('перевёртыш не уводит в минус', () => {
    expect(run('flip', null, noNegative)['p1']).toBe(0);
  });

  it('удвоение не удваивает долг', () => {
    const players = [player('p1', -400), player('p2', 0)];
    expect(run('double', null, noNegative, players)['p1']).toBe(0);
  });

  it('обмен не приносит чужой минус', () => {
    const after = run('swap', 'p3', noNegative);
    expect(after['p1']).toBe(0);
    expect(after['p3']).toBe(300);
  });

  it('щедрость не опускает дарителя ниже нуля', () => {
    const players = [player('p1', 100), player('p2', 0)];
    expect(run('generosity', null, noNegative, players)['p1']).toBe(0);
  });
});
