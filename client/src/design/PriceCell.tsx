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
        fill={played ? '#efe3d2' : '#ffffff'}
        className="h-24 w-full"
        contentClassName="grid place-items-center"
      >
        <span
          className={`font-pop text-4xl font-black tabular-nums ${played ? 'text-ink/25' : 'text-p1'}`}
        >
          {price}
        </span>
      </RoughFrame>
      {played && <RoughCross seed={price} color="#c2493c" />}
    </motion.button>
  );
}
