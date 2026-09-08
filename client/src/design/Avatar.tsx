import { motion } from 'framer-motion';
import { useMemo } from 'react';

export type AvatarMood = 'idle' | 'answering' | 'wrong' | 'winner';

interface AvatarProps {
  /** Одна и та же строка всегда даёт одного и того же персонажа. */
  seed: string;
  color: string;
  size?: number;
  mood?: AvatarMood;
}

/** Простой детерминированный генератор: персонаж игрока не должен меняться между экранами. */
function makeRandom(seed: string): () => number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return () => {
    hash += 0x6d2b79f5;
    let value = Math.imul(hash ^ (hash >>> 15), 1 | hash);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const HEADS = [
  'M50 8 C78 8 90 30 90 52 C90 80 72 94 50 94 C28 94 10 80 10 52 C10 30 22 8 50 8 Z',
  'M50 6 C80 6 94 28 92 54 C90 82 70 96 50 96 C30 96 9 81 8 54 C7 27 20 6 50 6 Z',
  'M18 20 C30 6 70 6 82 20 C96 36 94 74 78 88 C62 100 38 100 22 88 C6 74 4 36 18 20 Z',
  'M50 8 C76 10 88 34 86 56 C84 82 68 96 50 96 C32 96 16 80 14 56 C12 32 24 6 50 8 Z',
];

const HAIR = [
  '',
  'M22 26 C30 6 46 2 50 16 C56 2 72 6 78 26',
  'M28 22 L34 4 L42 20 L50 2 L58 20 L66 4 L72 22',
  'M50 6 L50 -8 M50 -8 m-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0',
  'M20 30 C22 10 40 4 50 8 C62 4 80 12 80 30',
];

const MOUTHS = [
  'M36 66 Q50 80 64 66',
  'M38 68 Q50 62 62 68',
  'M40 64 q5 10 10 0 q5 -10 10 0',
  'M42 64 a8 7 0 1 0 16 0 a8 7 0 1 0 -16 0',
  'M36 70 Q50 74 64 68',
];

export function Avatar({ seed, color, size = 72, mood = 'idle' }: AvatarProps) {
  const face = useMemo(() => {
    const random = makeRandom(seed);
    const pick = <T,>(list: T[]): T => list[Math.floor(random() * list.length)] as T;
    return {
      head: pick(HEADS),
      hair: pick(HAIR),
      mouth: pick(MOUTHS),
      eyeStyle: Math.floor(random() * 3),
      tilt: (random() - 0.5) * 10,
      blinkDelay: random() * 4,
      eyeGap: 12 + random() * 4,
    };
  }, [seed]);

  const animate =
    mood === 'answering'
      ? { y: [0, -14, 0], rotate: [face.tilt, face.tilt - 6, face.tilt], scale: 1.12 }
      : mood === 'wrong'
        ? { y: 6, rotate: face.tilt, scaleY: 0.84, scaleX: 1.1 }
        : mood === 'winner'
          ? { y: [0, -10, 0], rotate: [face.tilt - 4, face.tilt + 4, face.tilt - 4] }
          : { y: [0, -3, 0], rotate: [face.tilt - 2, face.tilt + 2, face.tilt - 2] };

  const duration = mood === 'answering' ? 0.5 : mood === 'winner' ? 1.1 : 3.4;

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="-10 -14 120 118"
      animate={animate}
      transition={
        mood === 'wrong'
          ? { type: 'spring', stiffness: 320, damping: 12 }
          : { duration, repeat: Infinity, ease: 'easeInOut' }
      }
      style={{ overflow: 'visible' }}
      aria-hidden
    >
      <g stroke="#1a1a1a" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round">
        <path d={face.head} fill={color} />
        {face.hair !== '' && <path d={face.hair} fill="none" />}

        {/* Глаза моргают: сжимаются по вертикали раз в несколько секунд. */}
        <motion.g
          animate={{ scaleY: [1, 1, 0.1, 1] }}
          transition={{
            duration: 4.2,
            times: [0, 0.92, 0.96, 1],
            repeat: Infinity,
            delay: face.blinkDelay,
          }}
          style={{ transformOrigin: '50px 46px' }}
        >
          {face.eyeStyle === 0 && (
            <>
              <circle cx={50 - face.eyeGap} cy={46} r={5} fill="#1a1a1a" stroke="none" />
              <circle cx={50 + face.eyeGap} cy={46} r={5} fill="#1a1a1a" stroke="none" />
            </>
          )}
          {face.eyeStyle === 1 && (
            <>
              <path d={`M${44 - face.eyeGap} 48 q${6} -10 ${12} 0`} fill="none" />
              <path d={`M${44 + face.eyeGap} 48 q${6} -10 ${12} 0`} fill="none" />
            </>
          )}
          {face.eyeStyle === 2 && (
            <>
              <circle cx={50 - face.eyeGap} cy={46} r={7} fill="#fff" />
              <circle cx={50 - face.eyeGap + 2} cy={47} r={3} fill="#1a1a1a" stroke="none" />
              <circle cx={50 + face.eyeGap} cy={46} r={7} fill="#fff" />
              <circle cx={50 + face.eyeGap + 2} cy={47} r={3} fill="#1a1a1a" stroke="none" />
            </>
          )}
        </motion.g>

        <path d={face.mouth} fill="none" />
      </g>
    </motion.svg>
  );
}

/** Шесть цветов игроков: закрепляются по порядку входа в комнату. */
export const PLAYER_COLORS = ['#5b2ee6', '#ff6b57', '#12beb0', '#ffc53d', '#93d93a', '#ff5fa2'];

export const colorForIndex = (index: number): string =>
  PLAYER_COLORS[index % PLAYER_COLORS.length] ?? PLAYER_COLORS[0]!;
