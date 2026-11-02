import type { BoardThemeView } from '@svoyak/shared';

interface HostBoardProps {
  board: BoardThemeView[];
  /** Пока идёт вопрос, клетки не нажимаются. */
  onPick?: (themeId: string, questionId: string) => void;
  /** Клетка вопроса, который сейчас в игре: обведена акцентом. */
  currentId?: string | null;
}

/**
 * Табло глазами ведущего: темы строками, цены кнопками. Сыгранная клетка
 * перечёркнута одной линией, текущая — обведена. Рисованное табло с
 * наклонными клетками живёт на телевизоре.
 */
export function HostBoard({ board, onPick, currentId = null }: HostBoardProps) {
  // Ширина — по самой длинной теме: короткая оставляет пустые места, а не
  // утаскивает в свою строку чужие цены.
  const columns = Math.max(1, ...board.map((theme) => theme.cells.length));

  return (
    <div
      className="grid items-center gap-x-1.5 gap-y-1.5"
      style={{ gridTemplateColumns: `minmax(7rem, 1.5fr) repeat(${columns}, minmax(3.25rem, 1fr))` }}
    >
      {board.map((theme) => (
        <div key={theme.id} className="contents">
          <div
            lang="ru"
            style={{ gridColumnStart: 1, overflowWrap: 'break-word' }}
            className="pr-2 text-sm leading-snug font-medium hyphens-auto"
          >
            {theme.title}
          </div>
          {theme.cells.map((cell) => {
            const current = cell.questionId === currentId;
            const pickable = !cell.played && onPick !== undefined;
            return (
              <button
                key={cell.questionId}
                type="button"
                disabled={!pickable}
                onClick={pickable ? () => onPick(theme.id, cell.questionId) : undefined}
                aria-label={`${theme.title}, ${cell.price}${cell.played ? ', сыграно' : ''}`}
                aria-current={current || undefined}
                className={`num h-11 rounded-lg border text-[0.9375rem] font-semibold transition-colors ${
                  current
                    ? 'border-ws-accent bg-ws-accent-soft text-ws-accent-ink ring-ws-accent ring-1'
                    : cell.played
                      ? 'text-ws-faint border-transparent bg-transparent line-through decoration-[1.5px]'
                      : pickable
                        ? 'border-ws-line-strong bg-ws-surface hover:border-ws-accent hover:bg-ws-accent-soft hover:text-ws-accent-ink cursor-pointer shadow-[var(--ws-shadow-1)]'
                        : 'border-ws-line bg-ws-surface text-ws-soft cursor-default'
                }`}
              >
                {cell.price}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
