import { motion } from 'framer-motion';
import { RoughCross, RoughFrame } from './rough.js';

interface PriceCellProps {
  price: number;
  played?: boolean;
  tilt?: number;
  /** Растянуться на высоту строки табло, а не держать свою: так табло влезает в телевизор. */
  stretch?: boolean;
  onOpen?: () => void;
}

/** Клетка табло: при наведении подпрыгивает, сыгранная — перечёркнута от руки. */
export function PriceCell({ price, played = false, tilt = 0, stretch = false, onOpen }: PriceCellProps) {
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
      className={stretch ? 'relative h-full min-h-0' : 'relative'}
    >
      <RoughFrame
        seed={price}
        fill={played ? '#d8cdb8' : 'var(--color-card)'}
        className={stretch ? 'h-full min-h-10 w-full' : 'h-20 w-full sm:h-24'}
        contentClassName="grid place-items-center"
      >
        <span
          className={`font-pop font-black tabular-nums ${
            stretch ? 'text-[clamp(1.25rem,min(3.2vw,5.5dvh),3rem)]' : 'text-3xl sm:text-4xl'
          } ${
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
