import type { BoardTheme } from '@svoyak/shared';
import { PriceCell } from '../design/PriceCell.js';

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
      className="grid gap-2"
      style={{
        gridTemplateColumns: `minmax(${compact ? '4.75rem' : '8rem'}, ${
          compact ? '1.1fr' : '1.3fr'
        }) repeat(${columns}, minmax(0, 1fr))`,
      }}
    >
      {board.map((theme, themeIndex) => (
        <div key={theme.id} className="contents">
          <div
            lang="ru"
            style={{ overflowWrap: 'break-word', boxShadow: '4px 4px 0 #1a1a1a' }}
            className={`ink-border bg-p1 flex items-center rounded-2xl font-bold text-white hyphens-auto ${
              compact ? 'px-2 py-1.5 text-[0.7rem] leading-tight' : 'font-pop px-3 py-2 text-sm'
            }`}
          >
            {theme.title}
          </div>

          {theme.cells.map((cell, cellIndex) => (
            <PriceCell
              key={cell.questionId}
              price={cell.price}
              played={cell.played}
              tilt={(themeIndex + cellIndex) % 2 === 0 ? -1.1 : 1.1}
              {...(onPick ? { onOpen: () => onPick(theme.id, cell.questionId) } : {})}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
