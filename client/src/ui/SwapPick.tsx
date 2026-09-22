import { motion } from 'framer-motion';
import { Avatar, colorForIndex } from '../design/Avatar.js';

interface SwapPickProps {
  candidates: Array<{ id: string; name: string }>;
  onPick: (playerId: string) => void;
}

/** Обмен счётом: открывший клетку выбирает, с кем меняется.
 *  CatPick тут не подходит: он требует theme, price и canKeep, которых у обмена нет. */
export function SwapPick({ candidates, onPick }: SwapPickProps) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-4 overflow-y-auto">
      <p className="font-pop text-center text-2xl font-black">С кем меняешься счётом?</p>
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
    </div>
  );
}
