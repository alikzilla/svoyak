import type { BoardTheme } from '@svoyak/shared';

interface BoardGridProps {
  board: BoardTheme[];
  onPick?: (themeId: string, questionId: string) => void;
  /** Компактный вариант для телефона. */
  compact?: boolean;
}

export function BoardGrid({ board, onPick, compact = false }: BoardGridProps) {
  const columns = board[0]?.cells.length ?? 5;

  return (
    <div
      className="grid gap-1.5"
      style={{
        gridTemplateColumns: `minmax(${compact ? '5rem' : '9rem'}, 1.4fr) repeat(${columns}, minmax(0, 1fr))`,
      }}
    >
      {board.map((theme) => (
        <div key={theme.id} className="contents">
          <div
            className={`flex items-center rounded-xl bg-surface px-3 py-2 font-semibold text-pretty ${
              compact ? 'text-xs' : 'text-sm'
            }`}
          >
            {theme.title}
          </div>
          {theme.cells.map((cell) => {
            const label = cell.played ? '' : cell.price;
            const clickable = Boolean(onPick) && !cell.played;
            return (
              <button
                key={cell.questionId}
                disabled={!clickable}
                onClick={() => onPick?.(theme.id, cell.questionId)}
                className={`rounded-xl border tabular-nums transition ${
                  compact ? 'py-3 text-base' : 'py-4 text-2xl'
                } font-black ${
                  cell.played
                    ? 'border-transparent bg-surface/40 text-transparent'
                    : clickable
                      ? 'border-line bg-surface-2 text-gold hover:border-gold hover:bg-surface'
                      : 'border-line bg-surface-2 text-gold'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
