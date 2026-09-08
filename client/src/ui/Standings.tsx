import type { PlayerPublic } from '@svoyak/shared';

interface StandingsProps {
  players: PlayerPublic[];
  compact?: boolean;
}

/** Итоговая таблица: победитель наверху, крупно. */
export function Standings({ players, compact = false }: StandingsProps) {
  const ranked = [...players].sort((left, right) => right.score - left.score);
  const best = ranked[0]?.score ?? 0;

  return (
    <ol className="grid gap-2">
      {ranked.map((player, index) => {
        const winner = player.score === best && best > 0;
        return (
          <li
            key={player.id}
            className={`flex items-center gap-3 rounded-2xl border px-4 ${
              compact ? 'py-2' : 'py-4'
            } ${winner ? 'border-gold bg-gold/10' : 'border-line bg-surface'}`}
          >
            <span className="w-6 text-center tabular-nums text-muted">{index + 1}</span>
            <span className={`min-w-0 flex-1 truncate ${compact ? 'text-lg' : 'text-2xl'}`}>
              {player.name}
            </span>
            <span
              className={`tabular-nums font-black ${winner ? 'text-gold' : 'text-ink'} ${
                compact ? 'text-lg' : 'text-3xl'
              }`}
            >
              {player.score}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
