import { useEffect, useRef, useState } from 'react';
import { Crown, Lightbulb, UserX, Users } from 'lucide-react';
import type { PlayerPublic } from '@svoyak/shared';
import { Avatar, colorForIndex } from '../design/Avatar.js';
import { ConfirmDelete, EmptyState } from '../workspace/ui.js';

interface PlayerLedgerProps {
  players: PlayerPublic[];
  /** Правка счёта доступна только ведущему. */
  onScoreChange?: (playerId: string, score: number) => void;
  onKick?: (playerId: string) => void;
  /** Передать право хода вручную. */
  onSetControl?: (playerId: string) => void;
  /** Списать жетон подсказки: ведущий говорит подсказку вслух сам. */
  onGiveHint?: (playerId: string) => void;
  highlightId?: string | null;
}

interface Delta {
  value: number;
  key: number;
}

/**
 * Изменение счёта видно прямо в строке игрока: «+300» зелёным или «−300»
 * красным на полторы секунды. Это и есть подтверждение вердикта на экране
 * ведущего — штамп и конфетти остались на телевизоре.
 */
function useScoreDeltas(players: PlayerPublic[]): Record<string, Delta> {
  const previous = useRef<Record<string, number>>({});
  const [deltas, setDeltas] = useState<Record<string, Delta>>({});

  useEffect(() => {
    const changed: Record<string, Delta> = {};
    for (const player of players) {
      const before = previous.current[player.id];
      if (before !== undefined && before !== player.score) {
        changed[player.id] = { value: player.score - before, key: Date.now() };
      }
      previous.current[player.id] = player.score;
    }
    if (Object.keys(changed).length === 0) return;
    setDeltas((current) => ({ ...current, ...changed }));
    const timer = window.setTimeout(() => {
      setDeltas((current) => {
        const next = { ...current };
        for (const id of Object.keys(changed)) {
          if (next[id]?.key === changed[id]?.key) delete next[id];
        }
        return next;
      });
    }, 1600);
    return () => clearTimeout(timer);
  }, [players]);

  return deltas;
}

const signed = (value: number): string => (value > 0 ? `+${value}` : `−${Math.abs(value)}`);

export function PlayerLedger({
  players,
  onScoreChange,
  onKick,
  onSetControl,
  onGiveHint,
  highlightId,
}: PlayerLedgerProps) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  // Escape отменяет правку: blur после него не должен применять черновик.
  const cancelEdit = useRef(false);
  const deltas = useScoreDeltas(players);

  if (players.length === 0) {
    return (
      <EmptyState icon={<Users aria-hidden />} title="Пока никого">
        Покажите гостям QR-код или продиктуйте код комнаты — игроки появятся здесь, как только
        введут имя.
      </EmptyState>
    );
  }

  return (
    <ul className="divide-ws-line grid divide-y">
      {players.map((player, index) => {
        const color = colorForIndex(index);
        const isEditing = player.id in draft;
        const control = player.id === highlightId;
        const delta = deltas[player.id];

        return (
          <li
            key={player.id}
            className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 transition-colors duration-500 ${
              delta ? (delta.value > 0 ? 'bg-ws-yes-soft' : 'bg-ws-no-soft') : player.isAnswering ? 'bg-ws-accent-soft' : ''
            }`}
          >
            <span className={player.connected ? '' : 'opacity-45 grayscale'}>
              <Avatar
                seed={player.name}
                color={color}
                size={34}
                mood={player.isAnswering ? 'answering' : 'idle'}
              />
            </span>

            <span className="flex min-w-32 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
              <span
                className={`truncate text-[0.9375rem] font-semibold ${player.connected ? '' : 'text-ws-faint'}`}
              >
                {player.name}
              </span>
              {control && (
                <span className="ws-badge ws-badge-accent" title="Право хода: этот игрок выбирает вопрос">
                  <Crown aria-hidden />
                  ход
                </span>
              )}
              {player.isAnswering && <span className="ws-badge ws-badge-yes">отвечает</span>}
              {player.lockedUntil !== null && <span className="ws-badge ws-badge-no">фальстарт</span>}
              {!player.connected && <span className="ws-badge">не в сети</span>}
            </span>

            <span className="ml-auto flex items-center gap-1.5">
              {onGiveHint && player.hints > 0 && (
                <button
                  type="button"
                  onClick={() => onGiveHint(player.id)}
                  className="ws-btn ws-btn-sm"
                  title="Скажите подсказку вслух — жетон спишется"
                >
                  <Lightbulb aria-hidden />
                  Подсказка <span className="text-ws-faint num">×{player.hints}</span>
                </button>
              )}

              {onSetControl && !control && (
                <button
                  type="button"
                  onClick={() => onSetControl(player.id)}
                  className="ws-btn ws-btn-ghost ws-btn-sm"
                  title="Передать право хода этому игроку"
                >
                  Дать ход
                </button>
              )}

              <span className="relative">
                {delta && (
                  <span
                    key={delta.key}
                    aria-live="polite"
                    className={`num pointer-events-none absolute top-1/2 right-full mr-2 -translate-y-1/2 text-sm font-semibold whitespace-nowrap ${
                      delta.value > 0 ? 'text-ws-yes-ink' : 'text-ws-no-ink'
                    }`}
                  >
                    {signed(delta.value)}
                  </span>
                )}
                {onScoreChange ? (
                  <input
                    aria-label={`Счёт игрока ${player.name}`}
                    title="Счёт можно поправить вручную"
                    className="ws-input num w-24 text-right text-base font-semibold"
                    value={isEditing ? draft[player.id] : String(player.score)}
                    inputMode="numeric"
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, [player.id]: event.target.value }))
                    }
                    onBlur={() => {
                      const raw = cancelEdit.current ? undefined : draft[player.id];
                      cancelEdit.current = false;
                      setDraft(({ [player.id]: _removed, ...rest }) => rest);
                      const parsed = Number(raw?.replace('−', '-'));
                      if (raw !== undefined && raw !== '' && Number.isFinite(parsed)) {
                        onScoreChange(player.id, parsed);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.currentTarget.blur();
                      if (event.key === 'Escape') {
                        cancelEdit.current = true;
                        event.currentTarget.blur();
                      }
                    }}
                  />
                ) : (
                  <span className="num w-24 text-right text-base font-semibold">{player.score}</span>
                )}
              </span>

              {onKick && (
                <ConfirmDelete
                  icon={<UserX aria-hidden />}
                  title={`Убрать ${player.name} из игры`}
                  confirmLabel="Убрать"
                  onConfirm={() => onKick(player.id)}
                />
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
