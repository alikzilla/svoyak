import { motion } from 'framer-motion';
import { RoughCross, RoughFrame } from './rough.js';

interface PriceCellProps {
  price: number;
  played?: boolean;
  tilt?: number;
  onOpen?: () => void;
}

/** Клетка табло: при наведении подпрыгивает, сыгранная — перечёркнута от руки. */
export function PriceCell({ price, played = false, tilt = 0, onOpen }: PriceCellProps) {
  return (
    <motion.button
      type="button"
      disabled={played}
      onClick={onOpen}
      initial={false}
      animate={{ rotate: tilt }}
      whileHover={played ? undefined : { scale: 1.09, y: -8, rotate: tilt + 1.5 }}
      whileTap={played ? undefined : { scale: 0.95, y: 2 }}
      transition={{ type: 'spring', stiffness: 460, damping: 17 }}
      className="relative"
    >
      <RoughFrame
        seed={price}
        fill={played ? '#d8cdb8' : 'var(--color-card)'}
        className="h-20 w-full sm:h-24"
        contentClassName="grid place-items-center"
      >
        <span
          className={`font-pop text-3xl font-black tabular-nums sm:text-4xl ${
            played ? 'text-ink/20' : 'text-p1'
          }`}
        >
          {price}
        </span>
      </RoughFrame>
      {played && <RoughCross seed={price} color="#c2493c" />}
    </motion.button>
  );
}
