import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { useEffect } from 'react';

interface ScoreNumberProps {
  value: number;
  size?: 'md' | 'lg' | 'xl';
  color?: string;
}

const SIZES = { md: 'text-4xl', lg: 'text-6xl', xl: 'text-8xl' } as const;

/** Счёт наматывается прокруткой, а не перескакивает: видно, что очки начислили. */
export function ScoreNumber({ value, size = 'lg', color = 'var(--color-ink)' }: ScoreNumberProps) {
  const raw = useMotionValue(value);
  const shown = useTransform(raw, (current) => Math.round(current).toString());

  useEffect(() => {
    const controls = animate(raw, value, { duration: 0.7, ease: [0.2, 0.9, 0.2, 1] });
    return () => controls.stop();
  }, [value, raw]);

  return (
    <motion.span
      key={value}
      initial={{ scale: 1 }}
      animate={{ scale: [1, 1.18, 1] }}
      transition={{ duration: 0.5 }}
      className={`font-pop inline-block font-black tabular-nums ${SIZES[size]}`}
      style={{
        color,
        WebkitTextStroke: '3px #1a1a1a',
        paintOrder: 'stroke fill',
        transform: 'rotate(-3deg)',
      }}
    >
      <motion.span>{shown}</motion.span>
    </motion.span>
  );
}

interface FloatingPointsProps {
  amount: number;
  shown: boolean;
}

/** Плюс или минус, улетающий от счёта. */
export function FloatingPoints({ amount, shown }: FloatingPointsProps) {
  if (!shown) return null;
  const positive = amount >= 0;

  return (
    <motion.span
      initial={{ y: 0, opacity: 0, scale: 0.6 }}
      animate={{ y: positive ? -70 : 70, opacity: [0, 1, 1, 0], scale: 1.2 }}
      transition={{ duration: 1.1, ease: 'easeOut' }}
      className={`font-pop pointer-events-none absolute text-4xl font-black ${
        positive ? 'text-yes' : 'text-no'
      }`}
      style={{ WebkitTextStroke: '2px #1a1a1a', paintOrder: 'stroke fill' }}
    >
      {positive ? '+' : '−'}
      {Math.abs(amount)}
    </motion.span>
  );
}
