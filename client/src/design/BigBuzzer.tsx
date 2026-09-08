import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export type BuzzerState = 'closed' | 'open' | 'locked' | 'taken' | 'mine';

interface BigBuzzerProps {
  state: BuzzerState;
  /** До какого момента игрок заблокирован фальстартом. */
  lockedUntil: number | null;
  answeringName: string | null;
  color: string;
  onBuzz: () => void;
}

const LABEL: Record<BuzzerState, string> = {
  closed: 'ждите',
  open: 'ЖМИ',
  locked: 'фальстарт',
  taken: 'занято',
  mine: 'вы отвечаете',
};

/** Кнопка на пол-экрана: до неё не надо дотягиваться, состояние видно с вытянутой руки. */
export function BigBuzzer({ state, lockedUntil, answeringName, color, onBuzz }: BigBuzzerProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (lockedUntil === null) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const lockLeft = lockedUntil !== null ? Math.max(0, lockedUntil - now) : 0;
  const disabled = state !== 'open';

  const fill =
    state === 'open'
      ? 'var(--color-yes)'
      : state === 'locked'
        ? 'var(--color-no)'
        : state === 'mine'
          ? color
          : '#6a5fb8';

  const press = (): void => {
    if (disabled) return;
    // Вибрация — единственный отклик, когда игрок смотрит на ведущего, а не в телефон.
    navigator.vibrate?.(35);
    onBuzz();
  };

  return (
    <motion.button
      type="button"
      onPointerDown={press}
      disabled={disabled}
      // Открытие кнопки — момент, ради которого игрок держит телефон: она раздувается.
      animate={
        state === 'open'
          ? { scale: [0.9, 1.04, 1], rotate: [0, -1, 0] }
          : state === 'locked'
            ? { x: [0, -8, 8, -5, 0] }
            : { scale: 1, rotate: 0 }
      }
      transition={
        state === 'open'
          ? { type: 'spring', stiffness: 380, damping: 12 }
          : { duration: 0.35 }
      }
      whileTap={disabled ? undefined : { scale: 0.96, x: 5, y: 7, boxShadow: '0px 0px 0 #1a1a1a' }}
      style={{ backgroundColor: fill, boxShadow: '8px 9px 0 #1a1a1a' }}
      className="ink-border font-pop grid w-full flex-1 touch-none place-items-center rounded-[2.5rem] leading-none font-black text-white select-none"
    >
      <span className="grid justify-items-center gap-2 px-4 text-center">
        <span
          className="text-[clamp(2.5rem,14vw,5rem)]"
          style={{ WebkitTextStroke: '3px #1a1a1a', paintOrder: 'stroke fill' }}
        >
          {state === 'locked' ? (lockLeft / 1000).toFixed(1) : LABEL[state]}
        </span>
        {state === 'taken' && answeringName && (
          <span className="font-body text-xl font-bold">отвечает {answeringName}</span>
        )}
        {state === 'locked' && <span className="font-body text-xl font-bold">рано нажали</span>}
      </span>
    </motion.button>
  );
}
