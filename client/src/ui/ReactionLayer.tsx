import { AnimatePresence, motion } from 'framer-motion';
import type { PlayerPublic } from '@svoyak/shared';
import { colorForIndex } from '../design/Avatar.js';
import { REACTION_LIFETIME_MS, useReactions } from '../net/reactions.js';

/** Позиция по id, а не Math.random в рендере: иначе реакция прыгала бы при каждой перерисовке. */
function laneOf(id: string): number {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return 8 + (Math.abs(hash) % 84);
}

/** Реакции игроков всплывают поверх общего экрана, подписанные цветом игрока. */
export function ReactionLayer({ players }: { players: PlayerPublic[] }) {
  const reactions = useReactions();

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden>
      <AnimatePresence>
        {reactions.map((reaction) => {
          const index = players.findIndex((player) => player.id === reaction.playerId);
          const name = players[index]?.name ?? '';
          const lane = laneOf(reaction.id);
          return (
            <motion.div
              key={reaction.id}
              className="absolute bottom-0 grid justify-items-center"
              style={{ left: `${lane}%` }}
              initial={{ y: 40, opacity: 0, scale: 0.4 }}
              animate={{
                y: '-70vh',
                opacity: [0, 1, 1, 0],
                scale: [0.4, 1.2, 1, 0.9],
                x: [0, lane % 2 === 0 ? 24 : -24, 0],
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: REACTION_LIFETIME_MS / 1000, ease: 'easeOut' }}
            >
              <span className="text-7xl drop-shadow-[3px_3px_0_#1a1a1a]">{reaction.emoji}</span>
              {name && (
                <span
                  className="ink-border font-pop rounded-full px-2 text-sm font-black text-white"
                  style={{ backgroundColor: colorForIndex(Math.max(0, index)) }}
                >
                  {name}
                </span>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
