import { motion } from 'framer-motion';

interface StampProps {
  text: string;
  tone: 'yes' | 'no' | 'gold';
  /** Ключ перезапускает анимацию: штамп должен шлёпаться каждый раз заново. */
  shown: boolean;
}

const TONE_CLASS = {
  yes: 'text-yes border-yes',
  no: 'text-no border-no',
  gold: 'text-gold border-gold',
} as const;

/** Штамп вердикта: прилетает сверху с перелётом и замирает под углом. */
export function Stamp({ text, tone, shown }: StampProps) {
  if (!shown) return null;

  return (
    <motion.div
      initial={{ scale: 2.2, opacity: 0, rotate: -20 }}
      animate={{ scale: 1, opacity: 1, rotate: -8 }}
      exit={{ scale: 0.7, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 520, damping: 15 }}
      className={`font-hand pointer-events-none rounded-2xl border-[7px] bg-card/90 px-8 py-3 text-6xl font-bold ${TONE_CLASS[tone]}`}
      style={{ boxShadow: '8px 8px 0 rgb(26 26 26 / 25%)' }}
    >
      {text}
    </motion.div>
  );
}
