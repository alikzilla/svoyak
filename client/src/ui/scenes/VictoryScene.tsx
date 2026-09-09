import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import type { PlayerPublic } from '@svoyak/shared';
import { Avatar, colorForIndex } from '../../design/Avatar.js';
import { Doodle } from '../../design/Doodles.js';

interface VictorySceneProps {
  players: PlayerPublic[];
}

/** Пьедестал: первое место посередине и выше, серебро слева, бронза справа. */
const PODIUM = [
  { place: 2, height: 'h-28', order: 'order-1' },
  { place: 1, height: 'h-44', order: 'order-2' },
  { place: 3, height: 'h-20', order: 'order-3' },
];

export function VictoryScene({ players }: VictorySceneProps) {
  const ranked = [...players].sort((left, right) => right.score - left.score);
  const started = useRef(false);

  // Салют и серпантин: один залп на въезде и ленты с боков.
  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const colors = ranked.slice(0, 3).map((player) =>
      colorForIndex(players.findIndex((candidate) => candidate.id === player.id)),
    );

    void confetti({ particleCount: 160, spread: 100, origin: { y: 0.55 }, colors, scalar: 1.2 });

    const ribbons = window.setInterval(() => {
      for (const side of [0, 1]) {
        void confetti({
          particleCount: 14,
          angle: side === 0 ? 60 : 120,
          spread: 60,
          origin: { x: side, y: 0.7 },
          colors,
          // Вытянутые частицы читаются как серпантин, а не как крошка.
          scalar: 1.6,
          ticks: 260,
          shapes: ['square'],
        });
      }
    }, 900);

    const stop = window.setTimeout(() => clearInterval(ribbons), 5400);
    return () => {
      clearInterval(ribbons);
      clearTimeout(stop);
    };
  }, [players, ranked]);

  return (
    <div className="grid justify-items-center gap-8">
      <motion.h2
        initial={{ scale: 0.5, rotate: -8, opacity: 0 }}
        animate={{ scale: 1, rotate: -2, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 12 }}
        className="font-pop text-[clamp(2.5rem,7vw,4.5rem)] font-black"
        style={{ WebkitTextStroke: '4px #1a1a1a', paintOrder: 'stroke fill', color: '#ffc53d' }}
      >
        {ranked[0]?.name} побеждает
      </motion.h2>

      <div className="flex items-end justify-center gap-3">
        {PODIUM.map(({ place, height, order }) => {
          const player = ranked[place - 1];
          if (!player) return null;
          const color = colorForIndex(players.findIndex((candidate) => candidate.id === player.id));
          const winner = place === 1;

          return (
            <motion.div
              key={player.id}
              className={`grid justify-items-center gap-2 ${order}`}
              initial={{ y: 120, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 240, damping: 18, delay: 0.15 * (4 - place) }}
            >
              {winner && (
                <motion.div
                  animate={{ y: [0, -8, 0], rotate: [-6, 6, -6] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Doodle name="crown" size={64} color="#1a1a1a" fill="#ffc53d" strokeWidth={5} />
                </motion.div>
              )}

              <Avatar
                seed={player.name}
                color={color}
                size={winner ? 104 : 72}
                mood={winner ? 'winner' : 'idle'}
              />

              <div
                className={`ink-border grid w-28 place-items-center rounded-t-3xl px-3 pt-3 sm:w-36 ${height}`}
                style={{ backgroundColor: color, boxShadow: '6px 6px 0 #1a1a1a' }}
              >
                <p className="font-pop text-ink truncate text-xl font-black">{player.name}</p>
                <p
                  className="font-pop text-3xl font-black tabular-nums"
                  style={{ WebkitTextStroke: '3px #1a1a1a', paintOrder: 'stroke fill', color: '#fff6e9' }}
                >
                  {player.score}
                </p>
                <p className="font-pop text-ink/60 text-4xl font-black">{place}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {ranked.length > 3 && (
        <ul className="font-body flex flex-wrap justify-center gap-3 font-bold">
          {ranked.slice(3).map((player, index) => (
            <li key={player.id} className="ink-border bg-card text-ink rounded-2xl px-3 py-1">
              {index + 4}. {player.name} · <span className="tabular-nums">{player.score}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
