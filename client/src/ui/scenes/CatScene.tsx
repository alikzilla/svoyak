import { motion } from 'framer-motion';
import { Avatar, colorForIndex } from '../../design/Avatar.js';
import { Doodle } from '../../design/Doodles.js';

interface CatSceneProps {
  theme: string;
  price: number;
  /** Кому достался кот; пока не выбрали — null. */
  receiverName: string | null;
  receiverIndex: number;
  fromName: string;
}

/** Сцена кота: мешок трясётся, пока выбирают, и кот выпрыгивает на выбранного игрока. */
export function CatScene({ theme, price, receiverName, receiverIndex, fromName }: CatSceneProps) {
  const chosen = receiverName !== null;

  return (
    <div className="grid justify-items-center gap-4 text-center">
      <p className="font-body text-xl font-bold opacity-75">кот в мешке</p>

      <div className="relative grid h-40 place-items-center">
        {/* Мешок ходит ходуном, пока кота не отдали. */}
        <motion.div
          animate={
            chosen
              ? { scale: 0.9, rotate: -14, opacity: 0.45 }
              : { rotate: [-7, 7, -7], scale: [1, 1.06, 1] }
          }
          transition={
            chosen ? { duration: 0.3 } : { duration: 0.7, repeat: Infinity, ease: 'easeInOut' }
          }
        >
          <Doodle name="bag" size={120} color="#1a1a1a" fill="#ffc53d" strokeWidth={5} />
        </motion.div>

        {chosen && (
          <motion.div
            className="absolute"
            // Кот выпрыгивает из мешка по дуге и приземляется на аватар.
            initial={{ y: -10, x: -50, scale: 0.3, rotate: -30, opacity: 0 }}
            animate={{
              y: [-10, -100, 10],
              x: [-50, -10, 55],
              scale: [0.3, 1.2, 1],
              rotate: [-30, 10, 0],
              opacity: 1,
            }}
            transition={{ duration: 0.9, ease: 'easeOut', times: [0, 0.5, 1] }}
          >
            <Doodle name="cat" size={100} color="#1a1a1a" fill="#ff6b57" strokeWidth={5} />
          </motion.div>
        )}
      </div>

      <p className="font-pop text-3xl font-black text-pretty">{theme || 'без темы'}</p>
      <p className="font-body text-lg font-bold">
        за <span className="font-pop tabular-nums">{price}</span>
      </p>

      {chosen ? (
        <motion.div
          className="grid justify-items-center gap-1"
          initial={{ scale: 0.7, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 14, delay: 0.6 }}
        >
          <Avatar seed={receiverName} color={colorForIndex(receiverIndex)} size={88} mood="answering" />
          <p className="font-pop text-2xl font-black">отвечает {receiverName}</p>
        </motion.div>
      ) : (
        <p className="font-body text-lg font-bold opacity-75">{fromName} решает, кому отдать</p>
      )}
    </div>
  );
}
