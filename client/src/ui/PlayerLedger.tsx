import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { PlayerPublic } from '@svoyak/shared';
import { Avatar, colorForIndex } from '../design/Avatar.js';

interface PlayerLedgerProps {
  players: PlayerPublic[];
  /** Правка счёта доступна только ведущему. */
  onScoreChange?: (playerId: string, score: number) => void;
  onKick?: (playerId: string) => void;
  /** Передать право хода вручную. */
  onSetControl?: (playerId: string) => void;
  highlightId?: string | null;
}

const chip =
  'ink-border font-body rounded-xl px-2 py-1 text-xs font-bold text-ink bg-card';

export function PlayerLedger({
  players,
  onScoreChange,
  onKick,
  onSetControl,
  highlightId,
}: PlayerLedgerProps) {
  const [pendingKick, setPendingKick] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  if (players.length === 0) {
    return (
      <motion.p
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        className="font-body py-6 text-center font-bold opacity-80"
      >
        Пока пусто — покажите гостям QR-код
      </motion.p>
    );
  }

  return (
    <ul className="grid gap-2">
      <AnimatePresence initial={false}>
        {players.map((player, index) => {
          const color = colorForIndex(index);
          const isEditing = player.id in draft;
          const control = player.id === highlightId;

          return (
            <motion.li
              key={player.id}
              layout
              // Игрок влетает в список с отскоком: видно, что кто-то присоединился.
              initial={{ x: -40, scale: 0.8, opacity: 0 }}
              animate={{ x: 0, scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 16 }}
              style={{ boxShadow: '5px 5px 0 #1a1a1a' }}
              className={`ink-border text-ink flex items-center gap-2 rounded-2xl px-3 py-2 ${
                control ? 'bg-p4' : 'bg-card'
              }`}
            >
              <Avatar
                seed={player.name}
                color={color}
                size={40}
                mood={player.isAnswering ? 'answering' : 'idle'}
              />

              <span className="font-pop min-w-0 flex-1 truncate text-lg font-black">
                {player.name}
                {control && <span className="font-body ml-2 text-xs">ход</span>}
                {player.isAnswering && <span className="font-body text-yes ml-2 text-xs">отвечает</span>}
                {player.lockedUntil !== null && (
                  <span className="font-body text-no ml-2 text-xs">фальстарт</span>
                )}
                {!player.connected && <span className="font-body ml-2 text-xs opacity-50">не в сети</span>}
              </span>

              {onSetControl && !control && (
                <button onClick={() => onSetControl(player.id)} className={chip} title="Передать ход">
                  ход
                </button>
              )}

              {onScoreChange ? (
                <input
                  className="ink-border font-pop w-24 rounded-xl bg-white/70 px-2 py-1 text-right text-lg font-black tabular-nums"
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
                <span className="font-pop w-24 text-right text-xl font-black tabular-nums">
                  {player.score}
                </span>
              )}

              {onKick &&
                (pendingKick === player.id ? (
                  <span className="flex gap-1">
                    <button
                      className="ink-border bg-no font-body rounded-xl px-2 py-1 text-xs font-bold text-white"
                      onClick={() => {
                        onKick(player.id);
                        setPendingKick(null);
                      }}
                    >
                      убрать
                    </button>
                    <button className={chip} onClick={() => setPendingKick(null)}>
                      отмена
                    </button>
                  </span>
                ) : (
                  <button className={chip} onClick={() => setPendingKick(player.id)} title="Убрать игрока">
                    ✕
                  </button>
                ))}
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
