import { motion } from 'framer-motion';
import { Avatar, colorForIndex } from '../design/Avatar.js';
import { Doodle } from '../design/Doodles.js';

interface CatPickProps {
  theme: string;
  price: number;
  candidates: Array<{ id: string; name: string }>;
  canKeep: boolean;
  onPick: (playerId: string) => void;
}

/** Кот в мешке: открывший выбирает, кому достанется вопрос. */
export function CatPick({ theme, price, candidates, canKeep, onPick }: CatPickProps) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-4 overflow-y-auto">
      <div className="grid justify-items-center gap-1 text-center">
        <motion.div
          animate={{ rotate: [-6, 6, -6], y: [0, -6, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Doodle name="question" size={54} color="#ffc53d" strokeWidth={5} />
        </motion.div>
        <p className="font-body text-sm font-bold opacity-75">кот в мешке</p>
        <p className="font-pop text-2xl font-black text-pretty">{theme || 'без темы'}</p>
        <p className="font-body font-bold">
          за <span className="tabular-nums">{price}</span> — кому отдаёте?
        </p>
      </div>

      <ul className="grid gap-2">
        {candidates.map((candidate, index) => (
          <li key={candidate.id}>
            <motion.button
              onClick={() => onPick(candidate.id)}
              whileTap={{ scale: 0.96, x: 4, y: 5, boxShadow: '0px 0px 0 #1a1a1a' }}
              style={{ boxShadow: '6px 6px 0 #1a1a1a' }}
              className="ink-border bg-card text-ink flex w-full items-center gap-3 rounded-3xl px-4 py-3"
            >
              <Avatar seed={candidate.name} color={colorForIndex(index)} size={44} />
              <span className="font-pop text-2xl font-black">{candidate.name}</span>
            </motion.button>
          </li>
        ))}
      </ul>

      {canKeep && (
        <p className="font-body text-center text-sm font-bold opacity-75">
          этого кота можно оставить себе
        </p>
      )}
    </div>
  );
}
