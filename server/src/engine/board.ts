import type { BoardTheme, ModifierKind, Round } from '@svoyak/shared';

/** Доска раунда: темы с клетками по цене вопроса. Клетка-модификатор помечается
 *  здесь, но наружу это поле не уходит — его срезает проекция. */
export function buildBoard(
  round: Round,
  modifierCells: Record<string, ModifierKind> = {},
): BoardTheme[] {
  return round.themes.map((theme) => ({
    id: theme.id,
    title: theme.title,
    cells: theme.questions.map((question) => {
      const modifier = modifierCells[question.id];
      return {
        questionId: question.id,
        price: question.price,
        played: false,
        ...(modifier !== undefined ? { modifier } : {}),
      };
    }),
  }));
}

/** Остались ли в раунде неразыгранные клетки. */
export function hasUnplayedCells(board: BoardTheme[]): boolean {
  return board.some((theme) => theme.cells.some((cell) => !cell.played));
}
