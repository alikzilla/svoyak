import { motion } from 'framer-motion';
import { useMemo } from 'react';

/** Каракули для фона. Рисуются вручную: стоковые иконки выдали бы шаблон. */
const SHAPES: Record<string, string> = {
  star: 'M30 4 L36 22 L55 22 L40 33 L46 52 L30 40 L14 52 L20 33 L5 22 L24 22 Z',
  spiral: 'M30 30 m0 -3 a3 3 0 1 1 -3 3 a6 6 0 1 1 6 -6 a9 9 0 1 1 -9 9 a12 12 0 1 1 12 -12',
  question: 'M18 18 q2 -14 14 -14 q14 0 14 12 q0 10 -12 14 l0 8 M34 52 l0 4',
  squiggle: 'M4 30 q8 -16 16 0 t16 0 t16 0',
  bolt: 'M32 4 L14 34 L28 34 L24 56 L46 26 L32 26 Z',
  ring: 'M30 6 a24 24 0 1 0 1 0',
  check: 'M10 32 L24 46 L50 12',
  bag: 'M18 22 L42 22 L50 54 L10 54 Z M22 22 q8 -12 16 0 M20 30 L40 30',
  cat: 'M18 30 L14 16 L26 24 M42 30 L46 16 L34 24 M14 34 a16 14 0 1 0 32 0 a16 14 0 1 0 -32 0 M24 34 l0 2 M36 34 l0 2 M28 42 q2 3 4 0 M8 38 L20 40 M52 38 L40 40',
  hammer: 'M12 46 L34 24 M26 16 L46 36 L38 44 L18 24 Z',
  crown: 'M12 44 L16 18 L26 32 L32 14 L38 32 L48 18 L52 44 Z M12 48 L52 48',
  speaker: 'M8 24 L20 24 L34 12 L34 48 L20 36 L8 36 Z M42 20 q8 10 0 20 M50 14 q12 16 0 32',
  mute: 'M8 24 L20 24 L34 12 L34 48 L20 36 L8 36 Z M44 22 L58 38 M58 22 L44 38',
  arrow: 'M6 40 q18 -30 44 -22 M38 12 l12 6 l-8 10',
};

export type DoodleName = keyof typeof SHAPES;

interface DoodleProps {
  name: DoodleName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  fill?: string;
  className?: string;
}

export function Doodle({
  name,
  size = 60,
  color = '#1a1a1a',
  strokeWidth = 4,
  fill = 'none',
  className = '',
}: DoodleProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" className={className} aria-hidden>
      <path
        d={SHAPES[name]}
        fill={fill}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface DoodleFieldProps {
  /** Меньше дудлов — легче слабому ноуту и стриму. */
  density?: 'full' | 'light' | 'off';
  night?: boolean;
}

const NAMES: DoodleName[] = ['star', 'spiral', 'question', 'squiggle', 'bolt', 'ring'];

/** Фоновые каракули: плывут медленно, чтобы не спорить с игрой за внимание. */
export function DoodleField({ density = 'full', night = false }: DoodleFieldProps) {
  const items = useMemo(() => {
    const count = density === 'full' ? 14 : density === 'light' ? 6 : 0;
    return Array.from({ length: count }, (_, index) => ({
      name: NAMES[index % NAMES.length] as DoodleName,
      left: (index * 37) % 96,
      top: (index * 53) % 92,
      size: 40 + ((index * 17) % 60),
      duration: 18 + ((index * 7) % 14),
      delay: (index * 1.7) % 9,
      drift: index % 2 === 0 ? 26 : -22,
    }));
  }, [density]);

  if (density === 'off') return null;

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      {items.map((item, index) => (
        <motion.div
          key={index}
          className="absolute"
          style={{ left: `${item.left}%`, top: `${item.top}%` }}
          animate={{
            y: [0, item.drift, 0],
            x: [0, -item.drift / 2, 0],
            rotate: [0, item.drift > 0 ? 14 : -14, 0],
          }}
          transition={{ duration: item.duration, repeat: Infinity, ease: 'easeInOut', delay: item.delay }}
        >
          <Doodle
            name={item.name}
            size={item.size}
            color={night ? '#8ea2ff' : '#1a1a1a'}
            strokeWidth={3}
            className={night ? 'opacity-25' : 'opacity-[0.07]'}
          />
        </motion.div>
      ))}
    </div>
  );
}
