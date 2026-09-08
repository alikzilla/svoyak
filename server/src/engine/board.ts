import type { BoardTheme, Round } from '@svoyak/shared';

/** Доска раунда: темы с клетками по цене вопроса. */
export function buildBoard(round: Round): BoardTheme[] {
  return round.themes.map((theme) => ({
    id: theme.id,
    title: theme.title,
    cells: theme.questions.map((question) => ({
      questionId: question.id,
      price: question.price,
      played: false,
    })),
  }));
}

/** Остались ли в раунде неразыгранные клетки. */
export function hasUnplayedCells(board: BoardTheme[]): boolean {
  return board.some((theme) => theme.cells.some((cell) => !cell.played));
}
