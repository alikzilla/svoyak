import { useEffect, useState } from 'react';
import type { ReactionEvent } from '@svoyak/shared';
import { socket } from './socket.js';

/** Сколько реакция висит на экране: ровно столько длится её полёт. */
export const REACTION_LIFETIME_MS = 2600;
/** Больше разом не рисуем: при шквале старые уступают место новым. */
const MAX_ON_SCREEN = 24;

/** Реакции, которые сейчас летят. Мимо состояния комнаты: их нет в проекции,
 *  поэтому после перезагрузки экрана старые не возвращаются. */
export function useReactions(): ReactionEvent[] {
  const [flying, setFlying] = useState<ReactionEvent[]>([]);

  useEffect(() => {
    const timers = new Set<number>();
    const onReaction = (reaction: ReactionEvent): void => {
      setFlying((current) => [...current, reaction].slice(-MAX_ON_SCREEN));
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        setFlying((current) => current.filter((item) => item.id !== reaction.id));
      }, REACTION_LIFETIME_MS);
      timers.add(timer);
    };

    socket.on('reaction', onReaction);
    return () => {
      socket.off('reaction', onReaction);
      for (const timer of timers) clearTimeout(timer);
    };
  }, []);

  return flying;
}
