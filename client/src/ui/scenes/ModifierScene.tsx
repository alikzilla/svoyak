import { motion } from 'framer-motion';
import type { ModifierView, PlayerPublic } from '@svoyak/shared';
import { MODIFIER_HINTS, MODIFIER_TITLES } from '@svoyak/shared';
import { RoughFrame } from '../../design/rough.js';

interface ModifierSceneProps {
  modifier: ModifierView;
  players: PlayerPublic[];
}

/** Под клеткой оказался не вопрос, а модификатор. Показываем, что выпало
 *  и кому: счёт уже изменился, табло рядом покажет цифры. */
export function ModifierScene({ modifier, players }: ModifierSceneProps) {
  const name = (id: string | null): string =>
    players.find((player) => player.id === id)?.name ?? '—';

  return (
    <RoughFrame
      fill="var(--color-card)"
      seed={17}
      contentClassName="text-ink grid gap-4 px-8 py-10 text-center"
    >
      <p className="font-body text-ink/60 text-sm font-bold">вместо вопроса</p>
      <motion.p
        initial={{ scale: 0.6, rotate: -6, opacity: 0 }}
        animate={{ scale: 1, rotate: -2, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 16 }}
        className="font-pop text-[clamp(2.5rem,7vw,5rem)] font-black"
      >
        {MODIFIER_TITLES[modifier.kind]}
      </motion.p>
      <p className="font-body text-[clamp(1.2rem,2.5vw,2rem)] font-bold">
        {MODIFIER_HINTS[modifier.kind]}
      </p>
      <p className="font-body text-lg font-bold opacity-70">
        {modifier.kind === 'swap' && modifier.targetPlayerId === null
          ? `${name(modifier.playerId)} выбирает, с кем меняться`
          : modifier.kind === 'swap'
            ? `${name(modifier.playerId)} ↔ ${name(modifier.targetPlayerId)}`
            : name(modifier.playerId)}
      </p>
    </RoughFrame>
  );
}
