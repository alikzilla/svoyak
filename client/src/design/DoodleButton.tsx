import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

export type ButtonTone = 'p1' | 'p2' | 'p3' | 'p4' | 'p5' | 'p6' | 'yes' | 'no' | 'gold' | 'paper';

interface DoodleButtonProps {
  children: ReactNode;
  tone?: ButtonTone;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Главная кнопка экрана слегка покачивается сама, чтобы её заметили. */
  idle?: boolean;
  disabled?: boolean;
  tilt?: number;
  className?: string;
  onClick?: () => void;
}

const TONES: Record<ButtonTone, string> = {
  p1: 'bg-p1 text-white',
  p2: 'bg-p2 text-ink',
  p3: 'bg-p3 text-ink',
  p4: 'bg-p4 text-ink',
  p5: 'bg-p5 text-ink',
  p6: 'bg-p6 text-ink',
  yes: 'bg-yes text-white',
  no: 'bg-no text-white',
  gold: 'bg-gold text-ink',
  paper: 'bg-paper-2 text-ink',
};

const SIZES = {
  sm: 'px-4 py-2 text-lg rounded-2xl',
  md: 'px-6 py-3 text-2xl rounded-2xl',
  lg: 'px-8 py-4 text-3xl rounded-3xl',
  xl: 'px-10 py-6 text-5xl rounded-[2rem]',
} as const;

/** Кнопка: заливка, чёрная обводка, жёсткая тень. Нажатие вдавливает её в тень. */
export function DoodleButton({
  children,
  tone = 'p1',
  size = 'md',
  idle = false,
  disabled = false,
  tilt = -1.2,
  className = '',
  onClick,
}: DoodleButtonProps) {
  const press = {
    rest: { scale: 1, x: 0, y: 0, boxShadow: '6px 6px 0 #1a1a1a' },
    hover: { scale: 1.05, y: -4, boxShadow: '9px 10px 0 #1a1a1a' },
    // Нажатие вдавливает кнопку в собственную тень.
    tap: { scale: 0.97, x: 5, y: 6, boxShadow: '0px 0px 0 #1a1a1a' },
  };

  return (
    // Покачивание живёт на обёртке: иначе оно анимирует те же y и rotate,
    // что и наведение, и состояния дерутся между собой.
    <motion.div
      className="inline-block"
      initial={false}
      animate={idle && !disabled ? { rotate: [tilt, tilt + 1.8, tilt] } : { rotate: tilt }}
      transition={
        idle && !disabled
          ? { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }
          : { type: 'spring', stiffness: 400, damping: 20 }
      }
    >
      <motion.button
        type="button"
        disabled={disabled}
        onClick={onClick}
        variants={press}
        initial="rest"
        animate="rest"
        whileHover={disabled ? undefined : 'hover'}
        whileTap={disabled ? undefined : 'tap'}
        transition={{ type: 'spring', stiffness: 600, damping: 20, mass: 0.6 }}
        className={`ink-border font-hand block font-bold whitespace-nowrap disabled:opacity-45 disabled:saturate-50 ${TONES[tone]} ${SIZES[size]} ${className}`}
      >
        {children}
      </motion.button>
    </motion.div>
  );
}
