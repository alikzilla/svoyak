import type { BoardThemeView } from '@svoyak/shared';
import { PriceCell } from '../design/PriceCell.js';

interface BoardGridProps {
  board: BoardThemeView[];
  onPick?: (themeId: string, questionId: string) => void;
  /** Компактный вариант для телефона. */
  compact?: boolean;
  /** Общий экран: название темы читают с дивана, а не с ноутбука. */
  tv?: boolean;
}

export function BoardGrid({ board, onPick, compact = false, tv = false }: BoardGridProps) {
  // В сборной игре темы приходят из разных паков, и вопросов в них бывает
  // по-разному. Ширина табло — по самой длинной теме, а заголовок каждой темы
  // прибит к первой колонке: короткая тема оставляет пустые клетки, а не
  // утаскивает в свою строку чужие цены.
  const columns = Math.max(1, ...board.map((theme) => theme.cells.length));

  return (
    <div
      className={tv ? 'grid h-full content-center gap-2' : 'grid gap-2'}
      style={{
        // На телевизоре строки делят высоту экрана: при шести темах ужимаются,
        // при трёх не раздуваются больше привычной клетки.
        ...(tv ? { gridAutoRows: 'minmax(0, 7.5rem)' } : {}),
        gridTemplateColumns: `minmax(${compact ? '4.75rem' : tv ? '12rem' : '8rem'}, ${
          compact ? '1.1fr' : tv ? '1.8fr' : '1.3fr'
        }) repeat(${columns}, minmax(0, 1fr))`,
      }}
    >
      {board.map((theme, themeIndex) => (
        <div key={theme.id} className="contents">
          <div
            lang="ru"
            style={{ gridColumnStart: 1, overflowWrap: 'break-word', boxShadow: '4px 4px 0 #1a1a1a' }}
            className={`ink-border bg-p1 flex items-center rounded-2xl font-bold text-white hyphens-auto ${
              compact
                ? 'px-2 py-1.5 text-[0.7rem] leading-tight'
                : tv
                  ? 'font-pop px-4 py-2 text-[clamp(1rem,1.6vw,1.75rem)] leading-tight'
                  : 'font-pop px-3 py-2 text-sm'
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
              stretch={tv}
              {...(onPick ? { onOpen: () => onPick(theme.id, cell.questionId) } : {})}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
