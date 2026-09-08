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
        gridTemplateColumns: `minmax(${compact ? '4.75rem' : '9rem'}, ${
          compact ? '1.1fr' : '1.4fr'
        }) repeat(${columns}, minmax(0, 1fr))`,
      }}
    >
      {board.map((theme) => (
        <div key={theme.id} className="contents">
          <div
            className={`flex items-center overflow-hidden rounded-xl bg-surface font-semibold hyphens-auto ${
              compact ? 'px-2 py-1.5 text-[0.7rem] leading-tight' : 'px-3 py-2 text-sm'
            }`}
            // Переносим по слогам, а рвём слово только если иначе никак.
            style={{ overflowWrap: 'break-word' }}
            lang="ru"
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
