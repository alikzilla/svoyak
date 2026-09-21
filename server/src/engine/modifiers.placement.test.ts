import { describe, it, expect } from 'vitest';
import type { Pack, Question } from '@svoyak/shared';
import { planModifierCells } from './modifiers.js';

const question = (id: string, over: Partial<Question> = {}): Question => ({
  id,
  price: 100,
  type: 'normal',
  text: 'вопрос',
  answer: 'ответ',
  altAnswers: [],
  ...over,
});

/** Пак с двумя раундами по одной теме: в первом пять клеток, во втором четыре. */
const pack: Pack = {
  id: 'p',
  title: 'Пак',
  createdAt: 1,
  updatedAt: 1,
  rounds: [
    {
      id: 'r1',
      title: 'Первый раунд',
      themes: [
        {
          id: 'r1-t1',
          title: 'Тема',
          questions: ['a1', 'a2', 'a3', 'a4', 'a5'].map((id) => question(id)),
        },
      ],
    },
    {
      id: 'r2',
      title: 'Второй раунд',
      themes: [
        {
          id: 'r2-t1',
          title: 'Тема',
          questions: ['b1', 'b2', 'b3', 'b4'].map((id) => question(id)),
        },
      ],
    },
  ],
  final: { themes: [{ id: 'f1', title: 'Финал', question: { id: 'fq', text: 'т', answer: 'о', altAnswers: [] } }] },
};

/** Предсказуемый «случай»: всегда берём первый элемент из оставшихся. */
const firstAlways = (): number => 0;

describe('раскладка модификаторов', () => {
  it('без плана клеток не появляется', () => {
    expect(planModifierCells(pack, { perRound: 0, kinds: ['flip'] })).toEqual({});
  });

  it('без включённых видов клеток не появляется', () => {
    expect(planModifierCells(pack, { perRound: 3, kinds: [] })).toEqual({});
  });

  it('кладёт ровно столько клеток в каждый раунд', () => {
    const cells = planModifierCells(pack, { perRound: 2, kinds: ['flip', 'jackpot'] }, firstAlways);
    const firstRound = ['a1', 'a2', 'a3', 'a4', 'a5'].filter((id) => id in cells);
    const secondRound = ['b1', 'b2', 'b3', 'b4'].filter((id) => id in cells);
    expect(firstRound).toHaveLength(2);
    expect(secondRound).toHaveLength(2);
  });

  it('берёт все клетки, если их меньше запрошенного, и это не ошибка', () => {
    const small: Pack = {
      ...pack,
      rounds: [{ id: 'r1', title: 'Раунд', themes: [{ id: 't', title: 'Тема', questions: [question('x1')] }] }],
    };
    const cells = planModifierCells(small, { perRound: 5, kinds: ['flip'] }, firstAlways);
    expect(Object.keys(cells)).toEqual(['x1']);
  });

  it('не занимает клетки кота и аукциона', () => {
    const special: Pack = {
      ...pack,
      rounds: [
        {
          id: 'r1',
          title: 'Раунд',
          themes: [
            {
              id: 't',
              title: 'Тема',
              questions: [
                question('c1', { type: 'cat', cat: { theme: 'Кот', price: 'nominal', canKeep: false } }),
                question('c2', { type: 'auction' }),
                question('c3'),
              ],
            },
          ],
        },
      ],
    };
    const cells = planModifierCells(special, { perRound: 3, kinds: ['flip'] }, firstAlways);
    expect(Object.keys(cells)).toEqual(['c3']);
  });

  it('использует все разрешённые виды, прежде чем повторяться', () => {
    const cells = planModifierCells(pack, { perRound: 3, kinds: ['flip', 'jackpot'] }, firstAlways);
    const kinds = Object.values(cells);
    expect(kinds).toContain('flip');
    expect(kinds).toContain('jackpot');
  });

  it('колода видов переживает переход между раундами', () => {
    // При perRound=1 второй раунд обязан достать оставшийся вид из колоды
    // первого раунда, а не начать новую — иначе колода не «переживает»
    // раунды, а тест на очерёдность видов (выше) этого не различает.
    const cells = planModifierCells(pack, { perRound: 1, kinds: ['flip', 'jackpot'] }, firstAlways);
    expect(cells).toEqual({ a1: 'jackpot', b1: 'flip' });
  });

  it('в финале модификаторов нет', () => {
    const cells = planModifierCells(pack, { perRound: 5, kinds: ['flip'] }, firstAlways);
    expect(cells['fq']).toBeUndefined();
  });
});
