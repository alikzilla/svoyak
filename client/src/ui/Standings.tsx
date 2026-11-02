import { Trophy } from 'lucide-react';
import type { PlayerPublic } from '@svoyak/shared';
import { Avatar, colorForIndex } from '../design/Avatar.js';

interface StandingsProps {
  players: PlayerPublic[];
}

/** Итоговая таблица: победитель наверху. Цвет игрока — по порядку входа, как везде. */
export function Standings({ players }: StandingsProps) {
  const colorOf = new Map(players.map((player, index) => [player.id, colorForIndex(index)]));
  const ranked = [...players].sort((left, right) => right.score - left.score);
  const best = ranked[0]?.score ?? 0;

  return (
    <ol className="divide-ws-line grid divide-y">
      {ranked.map((player, index) => {
        const winner = player.score === best && best > 0;
        return (
          <li
            key={player.id}
            className={`flex items-center gap-3 px-4 py-3 ${winner ? 'bg-ws-accent-soft' : ''}`}
          >
            <span className="text-ws-faint num w-5 text-right text-sm">{index + 1}</span>
            <Avatar seed={player.name} color={colorOf.get(player.id) ?? colorForIndex(index)} size={32} />
            <span className="min-w-0 flex-1 truncate font-semibold">{player.name}</span>
            {winner && (
              <span className="ws-badge ws-badge-accent">
                <Trophy aria-hidden />
                победа
              </span>
            )}
            <span className={`num w-20 text-right text-lg font-semibold ${winner ? 'text-ws-accent-ink' : ''}`}>
              {player.score}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
