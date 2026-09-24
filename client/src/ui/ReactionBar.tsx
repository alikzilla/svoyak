import { useState } from 'react';
import { motion } from 'framer-motion';
import { REACTIONS, type Reaction } from '@svoyak/shared';
import { ask } from '../net/socket.js';
import { haptic } from '../net/haptics.js';

/** Ряд реакций на телефоне. Сервер всё равно режет частые нажатия,
 *  а здесь кнопка просто коротко подпрыгивает, чтобы нажатие ощущалось. */
export function ReactionBar() {
  const [last, setLast] = useState<{ emoji: Reaction; at: number } | null>(null);

  const react = (emoji: Reaction): void => {
    haptic('tap');
    setLast({ emoji, at: Date.now() });
    void ask('player:react', { emoji });
  };

  return (
    <div className="relative flex shrink-0 justify-center gap-1.5">
      {REACTIONS.map((emoji) => (
        <motion.button
          key={emoji}
          type="button"
          onClick={() => react(emoji)}
          aria-label={`реакция ${emoji}`}
          whileTap={{ scale: 0.9 }}
          className="ink-border bg-card grid size-11 place-items-center rounded-2xl text-2xl"
          style={{ boxShadow: '3px 3px 0 #1a1a1a' }}
        >
          {/* Ключ меняется с каждым нажатием — прыжок проигрывается заново. */}
          <motion.span
            key={last?.emoji === emoji ? last.at : 0}
            initial={last?.emoji === emoji ? { scale: 1.5 } : false}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 12 }}
          >
            {emoji}
          </motion.span>
        </motion.button>
      ))}
    </div>
  );
}
