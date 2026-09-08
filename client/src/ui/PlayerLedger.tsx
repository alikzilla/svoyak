import { useState } from 'react';
import type { PlayerPublic } from '@svoyak/shared';

interface PlayerLedgerProps {
  players: PlayerPublic[];
  /** Правка счёта доступна только ведущему. */
  onScoreChange?: (playerId: string, score: number) => void;
  onKick?: (playerId: string) => void;
  highlightId?: string | null;
}

export function PlayerLedger({ players, onScoreChange, onKick, highlightId }: PlayerLedgerProps) {
  const [pendingKick, setPendingKick] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  if (players.length === 0) {
    return (
      <p className="py-8 text-center text-muted">
        Пока никто не подключился. Покажите гостям QR-код.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-line">
      {players.map((player) => {
        const isEditing = player.id in draft;
        return (
          <li
            key={player.id}
            className={`flex items-center gap-3 py-3 ${
              player.id === highlightId ? 'text-gold' : ''
            }`}
          >
            <span
              className={`size-2 shrink-0 rounded-full ${player.connected ? 'bg-good' : 'bg-line'}`}
              title={player.connected ? 'на связи' : 'нет связи'}
            />
            <span className="min-w-0 flex-1 truncate text-lg">{player.name}</span>

            {onScoreChange ? (
              <input
                className="w-28 rounded-lg border border-line bg-surface px-2 py-1 text-right text-lg tabular-nums focus:border-gold"
                value={isEditing ? draft[player.id] : String(player.score)}
                inputMode="numeric"
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, [player.id]: event.target.value }))
                }
                onBlur={() => {
                  const raw = draft[player.id];
                  setDraft(({ [player.id]: _removed, ...rest }) => rest);
                  const parsed = Number(raw);
                  if (raw !== undefined && raw !== '' && Number.isFinite(parsed)) {
                    onScoreChange(player.id, parsed);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                }}
              />
            ) : (
              <span className="w-28 text-right text-lg tabular-nums">{player.score}</span>
            )}

            {onKick &&
              (pendingKick === player.id ? (
                <span className="flex gap-1">
                  <button
                    className="rounded-lg bg-bad px-2 py-1 text-sm text-bg"
                    onClick={() => {
                      onKick(player.id);
                      setPendingKick(null);
                    }}
                  >
                    Убрать
                  </button>
                  <button
                    className="rounded-lg border border-line px-2 py-1 text-sm text-muted"
                    onClick={() => setPendingKick(null)}
                  >
                    Отмена
                  </button>
                </span>
              ) : (
                <button
                  className="rounded-lg border border-line px-2 py-1 text-sm text-muted hover:border-bad hover:text-bad"
                  onClick={() => setPendingKick(player.id)}
                >
                  Убрать
                </button>
              ))}
          </li>
        );
      })}
    </ul>
  );
}
