import { describe, it, expect } from 'vitest';
import type { Pack } from '@svoyak/shared';
import { buildPackFromRecipe, draftRecipe } from './compose.js';

function packWith(id: string, themes: { id: string; title: string; prices: number[] }[]): Pack {
  return {
    id,
    title: `Пак ${id}`,
    createdAt: 1,
    updatedAt: 1,
    rounds: [
      {
        id: `${id}-r1`,
        title: 'Первый раунд',
        themes: themes.map((theme) => ({
          id: theme.id,
          title: theme.title,
          questions: theme.prices.map((price, index) => ({
            id: `${theme.id}-q${index + 1}`,
            price,
            type: 'normal' as const,
            text: `вопрос ${index + 1} темы ${theme.title}`,
            answer: `ответ ${index + 1}`,
            altAnswers: [],
          })),
        })),
      },
    ],
    final: {
      themes: [
        {
          id: `${id}-f1`,
          title: `Финал ${id}`,
          question: { id: `${id}-f1-q`, text: 'финальный вопрос', answer: 'финальный ответ', altAnswers: [] },
        },
      ],
    },
  };
}

const kino = packWith('kino', [
  { id: 'kino-t1', title: 'Режиссёры', prices: [100, 200, 300, 400, 500] },
  { id: 'kino-t2', title: 'Оскар', prices: [100, 200, 300, 400, 500] },
]);
// У второго пака цены второго раунда: в исходнике сетка другая.
const muz = packWith('muz', [{ id: 'muz-t1', title: 'Рок', prices: [200, 400, 600, 800, 1000] }]);

const packs = new Map<string, Pack>([
  ['kino', kino],
  ['muz', muz],
]);
const lookup = (id: string): Pack | null => packs.get(id) ?? null;

describe('buildPackFromRecipe', () => {
  it('приводит цены тем из разных паков к сетке раунда', () => {
    const pack = buildPackFromRecipe(
      {
        rounds: [
          [
            { packId: 'kino', themeId: 'kino-t1' },
            { packId: 'muz', themeId: 'muz-t1' },
          ],
          [{ packId: 'kino', themeId: 'kino-t2' }],
        ],
        final: [{ packId: 'kino', themeId: 'kino-f1' }],
      },
      lookup,
    );

    // Первый раунд — сетка 100..500 для обеих тем, включая пришедшую с 200..1000.
    for (const theme of pack.rounds[0]!.themes) {
      expect(theme.questions.map((question) => question.price)).toEqual([100, 200, 300, 400, 500]);
    }
    // Второй раунд — удвоенная сетка, хотя тема взята из первого раунда пака.
    expect(pack.rounds[1]!.themes[0]!.questions.map((question) => question.price)).toEqual([
      200, 400, 600, 800, 1000,
    ]);
  });

  it('сохраняет названия тем и тексты вопросов', () => {
    const pack = buildPackFromRecipe(
      { rounds: [[{ packId: 'muz', themeId: 'muz-t1' }]], final: [{ packId: 'kino', themeId: 'kino-f1' }] },
      lookup,
    );
    expect(pack.rounds[0]!.themes[0]!.title).toBe('Рок');
    expect(pack.rounds[0]!.themes[0]!.questions[0]!.text).toBe('вопрос 1 темы Рок');
    expect(pack.final.themes[0]!.title).toBe('Финал kino');
    expect(pack.final.themes[0]!.question.answer).toBe('финальный ответ');
  });

  it('выдаёт уникальные идентификаторы, даже если одна тема взята дважды', () => {
    const pack = buildPackFromRecipe(
      {
        rounds: [
          [
            { packId: 'kino', themeId: 'kino-t1' },
            { packId: 'kino', themeId: 'kino-t1' },
          ],
        ],
        final: [{ packId: 'kino', themeId: 'kino-f1' }],
      },
      lookup,
    );
    const ids = [
      ...pack.rounds.flatMap((round) => [
        round.id,
        ...round.themes.flatMap((theme) => [theme.id, ...theme.questions.map((q) => q.id)]),
      ]),
      ...pack.final.themes.flatMap((theme) => [theme.id, theme.question.id]),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('отказывается собирать игру, если темы нет в паке', () => {
    expect(() =>
      buildPackFromRecipe(
        { rounds: [[{ packId: 'kino', themeId: 'нет-такой' }]], final: [{ packId: 'kino', themeId: 'kino-f1' }] },
        lookup,
      ),
    ).toThrow(/Тема не найдена/);
  });

  it('отказывается собирать игру без раундов', () => {
    expect(() =>
      buildPackFromRecipe({ rounds: [], final: [{ packId: 'kino', themeId: 'kino-f1' }] }, lookup),
    ).toThrow(/нет ни одного раунда/i);
  });
});

describe('draftRecipe', () => {
  const many = new Map<string, Pack>();
  for (const id of ['a', 'b', 'c']) {
    many.set(
      id,
      packWith(
        id,
        Array.from({ length: 6 }, (_, index) => ({
          id: `${id}-t${index + 1}`,
          title: `Тема ${id}${index + 1}`,
          prices: [100, 200, 300, 400, 500],
        })),
      ),
    );
  }
  const manyLookup = (id: string): Pack | null => many.get(id) ?? null;

  it('набирает запрошенное число раундов, тем и финальных тем', () => {
    const { recipe } = draftRecipe(
      { packIds: ['a', 'b', 'c'], rounds: 3, themesPerRound: 4, finalThemes: 3, seed: 1 },
      manyLookup,
    );
    expect(recipe.rounds).toHaveLength(3);
    for (const round of recipe.rounds) expect(round).toHaveLength(4);
    expect(recipe.final).toHaveLength(3);
  });

  it('не повторяет одну тему дважды за игру', () => {
    const { recipe } = draftRecipe(
      { packIds: ['a', 'b', 'c'], rounds: 3, themesPerRound: 5, finalThemes: 3, seed: 7 },
      manyLookup,
    );
    const keys = recipe.rounds.flat().map((ref) => `${ref.packId}/${ref.themeId}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('на одном seed даёт тот же состав, на другом — другой', () => {
    const request = { packIds: ['a', 'b', 'c'], rounds: 2, themesPerRound: 4, finalThemes: 3 };
    const first = draftRecipe({ ...request, seed: 42 }, manyLookup).recipe;
    const same = draftRecipe({ ...request, seed: 42 }, manyLookup).recipe;
    const other = draftRecipe({ ...request, seed: 43 }, manyLookup).recipe;
    expect(same).toEqual(first);
    expect(other).not.toEqual(first);
  });

  it('раздаёт темы по кругу, чтобы раунд не состоял из одного пака', () => {
    // Шесть тем на три пака: каждый должен дать ровно по две, на любом seed.
    for (const seed of [1, 2, 3, 17, 100]) {
      const { recipe } = draftRecipe(
        { packIds: ['a', 'b', 'c'], rounds: 1, themesPerRound: 6, finalThemes: 3, seed },
        manyLookup,
      );
      const perPack = new Map<string, number>();
      for (const ref of recipe.rounds[0]!) {
        perPack.set(ref.packId, (perPack.get(ref.packId) ?? 0) + 1);
      }
      expect([...perPack.values()].sort()).toEqual([2, 2, 2]);
    }
  });

  it('и в каждом раунде тоже мешает паки, а не отдаёт раунд одному', () => {
    const { recipe } = draftRecipe(
      { packIds: ['a', 'b', 'c'], rounds: 3, themesPerRound: 3, finalThemes: 3, seed: 8 },
      manyLookup,
    );
    for (const round of recipe.rounds) {
      expect(new Set(round.map((ref) => ref.packId)).size).toBe(3);
    }
  });

  it('возвращает названия тем для превью', () => {
    const { rounds, final } = draftRecipe(
      { packIds: ['a'], rounds: 1, themesPerRound: 2, finalThemes: 1, seed: 5 },
      manyLookup,
    );
    expect(rounds[0]![0]!.title).toMatch(/^Тема a/);
    expect(rounds[0]![0]!.packTitle).toBe('Пак a');
    expect(rounds[0]![0]!.questionsCount).toBe(5);
    expect(final[0]!.title).toBe('Финал a');
  });

  it('отдаёт запас неиспользованных тем, чтобы можно было заменить одну', () => {
    const { recipe, pool, finalPool } = draftRecipe(
      { packIds: ['a', 'b', 'c'], rounds: 1, themesPerRound: 4, finalThemes: 1, seed: 21 },
      manyLookup,
    );

    // Всего тем 18, четыре ушли в раунд: остальные доступны для замены.
    expect(pool).toHaveLength(14);
    const used = new Set(recipe.rounds.flat().map((ref) => `${ref.packId}/${ref.themeId}`));
    expect(pool.every((option) => !used.has(`${option.packId}/${option.themeId}`))).toBe(true);
    expect(finalPool).toHaveLength(2);
  });

  it('объясняет, что тем не хватает, вместо пустого раунда', () => {
    expect(() =>
      draftRecipe({ packIds: ['a'], rounds: 3, themesPerRound: 5, finalThemes: 3, seed: 1 }, manyLookup),
    ).toThrow(/не хватает тем/i);
  });

  it('объясняет, что не хватает финальных тем', () => {
    expect(() =>
      draftRecipe({ packIds: ['a'], rounds: 1, themesPerRound: 2, finalThemes: 4, seed: 1 }, manyLookup),
    ).toThrow(/финальных тем/i);
  });

  it('собранный рецепт сразу годится для сборки пака', () => {
    const { recipe } = draftRecipe(
      { packIds: ['a', 'b', 'c'], rounds: 2, themesPerRound: 4, finalThemes: 3, seed: 11 },
      manyLookup,
    );
    const pack = buildPackFromRecipe(recipe, manyLookup);
    expect(pack.rounds).toHaveLength(2);
    expect(pack.rounds[1]!.themes[0]!.questions[0]!.price).toBe(200);
  });
});
