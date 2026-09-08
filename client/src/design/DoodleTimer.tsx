import { motion } from 'framer-motion';
import { RoughFrame } from './rough.js';

interface DoodleTimerProps {
  /** Доля оставшегося времени, 0…1. */
  progress: number;
  seconds: number;
  label?: string;
}

/** Полоса времени: сжимается по transform, поэтому не грузит перерисовкой.
 *  На последних секундах краснеет, пульсирует и трясётся. */
export function DoodleTimer({ progress, seconds, label }: DoodleTimerProps) {
  const urgent = seconds <= 3 && seconds > 0;

  return (
    <motion.div
      animate={urgent ? { x: [0, -3, 3, -2, 0], rotate: [0, -0.4, 0.4, 0] } : { x: 0, rotate: 0 }}
      transition={urgent ? { duration: 0.35, repeat: Infinity } : { duration: 0.2 }}
      className="flex items-center gap-3"
    >
      <RoughFrame className="h-9 flex-1" seed={21}>
        <div className="h-9 overflow-hidden px-2 py-2">
          <motion.div
            className="h-5 origin-left rounded-full"
            style={{
              backgroundColor: urgent ? 'var(--color-no)' : 'var(--color-p1)',
              scaleX: Math.max(0, Math.min(1, progress)),
            }}
            animate={urgent ? { opacity: [1, 0.55, 1] } : { opacity: 1 }}
            transition={urgent ? { duration: 0.5, repeat: Infinity } : { duration: 0.2 }}
          />
        </div>
      </RoughFrame>

      <motion.span
        animate={urgent ? { scale: [1, 1.25, 1] } : { scale: 1 }}
        transition={urgent ? { duration: 0.5, repeat: Infinity } : { duration: 0.2 }}
        className={`font-pop w-16 text-right text-3xl font-black tabular-nums ${
          urgent ? 'text-no' : 'text-ink'
        }`}
      >
        {seconds}
      </motion.span>
      {label && <span className="font-body text-ink-soft text-sm">{label}</span>}
    </motion.div>
  );
}
