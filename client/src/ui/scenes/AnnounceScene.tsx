import { motion } from 'framer-motion';
import { RoughFrame } from '../../design/rough.js';

interface AnnounceSceneProps {
  themeTitle: string;
  price: number;
}

/** Объявление выбранной клетки: тема выезжает плашкой, цена выпрыгивает
 *  карточкой табло — все видят, что играем, ещё до текста вопроса. */
export function AnnounceScene({ themeTitle, price }: AnnounceSceneProps) {
  return (
    <div className="grid justify-items-center gap-8 text-center">
      <motion.p
        lang="ru"
        className="ink-border bg-p1 font-pop max-w-4xl rounded-3xl px-8 py-4 text-[clamp(2rem,5vw,4rem)] leading-tight font-black text-balance text-white hyphens-auto"
        style={{ boxShadow: '8px 8px 0 #1a1a1a', overflowWrap: 'break-word' }}
        initial={{ x: -80, opacity: 0, rotate: -4 }}
        animate={{ x: 0, opacity: 1, rotate: -1.5 }}
        transition={{ type: 'spring', stiffness: 300, damping: 18 }}
      >
        {themeTitle}
      </motion.p>

      <motion.div
        initial={{ scale: 0.2, rotate: -25, opacity: 0 }}
        animate={{ scale: 1, rotate: 3, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 13, delay: 0.3 }}
      >
        <RoughFrame
          seed={price}
          fill="var(--color-card)"
          contentClassName="grid place-items-center px-14 py-6"
        >
          <span
            className="font-pop text-[clamp(5rem,16vw,11rem)] leading-none font-black tabular-nums"
            style={{ WebkitTextStroke: '6px #1a1a1a', paintOrder: 'stroke fill', color: '#ffc53d' }}
          >
            {price}
          </span>
        </RoughFrame>
      </motion.div>
    </div>
  );
}
