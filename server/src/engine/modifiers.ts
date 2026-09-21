import type { ModifierKind, ModifierPlan, Pack } from '@svoyak/shared';

/** Источник случайности параметром: раскладку надо уметь проверить тестом. */
export type Random = () => number;

/** Достаёт из массива случайный элемент, не меняя исходный. */
function drawFrom<T>(items: T[], random: Random): T | undefined {
  if (items.length === 0) return undefined;
  const index = Math.min(items.length - 1, Math.floor(random() * items.length));
  return items.splice(index, 1)[0];
}

/** Перемешанная колода видов: пока не кончилась, виды не повторяются. */
function shuffled(kinds: readonly ModifierKind[], random: Random): ModifierKind[] {
  const rest = [...kinds];
  const deck: ModifierKind[] = [];
  while (rest.length > 0) {
    const kind = drawFrom(rest, random);
    if (kind) deck.push(kind);
  }
  return deck;
}

/** Куда лягут клетки-модификаторы. Считается один раз при создании комнаты:
 *  карта хранится в состоянии, поэтому переживает сохранение и отмену хода.
 *  Кот и аукцион не трогаются — модификатор не должен съедать спецвопрос,
 *  который автор пака поставил осознанно. В финале модификаторов нет. */
export function planModifierCells(
  pack: Pack,
  plan: ModifierPlan,
  random: Random = Math.random,
): Record<string, ModifierKind> {
  if (plan.perRound <= 0 || plan.kinds.length === 0) return {};

  const cells: Record<string, ModifierKind> = {};
  let deck: ModifierKind[] = [];

  for (const round of pack.rounds) {
    const eligible = round.themes.flatMap((theme) =>
      theme.questions.filter((question) => question.type === 'normal').map((question) => question.id),
    );
    const take = Math.min(plan.perRound, eligible.length);
    for (let index = 0; index < take; index += 1) {
      const questionId = drawFrom(eligible, random);
      if (questionId === undefined) break;
      if (deck.length === 0) deck = shuffled(plan.kinds, random);
      const kind = deck.pop();
      if (kind) cells[questionId] = kind;
    }
  }

  return cells;
}
