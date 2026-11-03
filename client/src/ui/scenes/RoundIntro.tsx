import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface RoundIntroProps {
  title: string;
  /** Меняется при смене раунда — по нему и запускается вылет. */
  roundKey: string | number;
}

/** Обводка крупного заголовка сцены: жёлтые буквы с чернильным контуром. */
export const TITLE_INK = { WebkitTextStroke: '5px #1a1a1a', paintOrder: 'stroke fill', color: '#ffc53d' } as const;

/** Буквы заголовка выпрыгивают по очереди. `animate={false}` — сразу на месте:
 *  экран перезагрузили, а заголовок уже отыграл. */
export function JumpingLetters({ text, animate = true }: { text: string; animate?: boolean }) {
  return (
    <>
      {[...text].map((letter, index) => (
        <motion.span
          key={`${letter}-${index}`}
          initial={animate ? { y: 90, opacity: 0, rotate: -12 } : false}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          transition={{
            type: 'spring',
            stiffness: 420,
            damping: 14,
            delay: index * 0.045,
          }}
          className="inline-block"
        >
          {/* Обычный пробел в inline-block схлопнется, и слова слипнутся. */}
          {letter === ' ' ? ' ' : letter}
        </motion.span>
      ))}
    </>
  );
}

/** Название раунда вылетает во весь экран: буквы прыгают по очереди, потом уходит. */
export function RoundIntro({ title, roundKey }: RoundIntroProps) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    setShown(true);
    const timer = window.setTimeout(() => setShown(false), 2200);
    return () => clearTimeout(timer);
  }, [roundKey]);

  return (
    <AnimatePresence>
      {shown && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-40 grid place-items-center"
          style={{ backgroundColor: 'rgb(19 28 63 / 82%)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.p
            className="font-pop flex flex-wrap justify-center px-6 text-center text-[clamp(2.5rem,10vw,7rem)] font-black"
            style={TITLE_INK}
            exit={{ scale: 1.4, opacity: 0, y: -60 }}
            transition={{ duration: 0.4 }}
          >
            <JumpingLetters text={title} />
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
