import { useState } from 'react';
import { motion } from 'framer-motion';
import { DoodleButton } from '../design/DoodleButton.js';

interface BidPanelProps {
  currentBid: number;
  minBid: number;
  maxBid: number;
  canPass: boolean;
  onBid: (amount: number | 'all-in' | 'pass') => void;
}

/** Торги на аукционе: крупные кнопки, потому что жать приходится быстро. */
export function BidPanel({ currentBid, minBid, maxBid, canPass, onBid }: BidPanelProps) {
  const [amount, setAmount] = useState(minBid);
  const affordable = maxBid >= minBid;
  const step = 100;

  return (
    <div className="flex flex-1 flex-col justify-center gap-4 overflow-y-auto">
      <div className="grid justify-items-center gap-1 text-center">
        <p className="font-body text-sm font-bold opacity-75">аукцион · ваш ход</p>
        <p
          className="font-pop text-gold text-6xl font-black tabular-nums"
          style={{ WebkitTextStroke: '3px #1a1a1a', paintOrder: 'stroke fill' }}
        >
          {currentBid}
        </p>
        <p className="font-body font-bold">
          перебить от <span className="tabular-nums">{minBid}</span>, у вас{' '}
          <span className="tabular-nums">{maxBid}</span>
        </p>
      </div>

      {affordable ? (
        <>
          <div className="flex items-center gap-2">
            <DoodleButton
              size="md"
              tone="paper"
              tilt={0}
              onClick={() => setAmount((value) => Math.max(minBid, value - step))}
            >
              −
            </DoodleButton>
            <motion.input
              key={amount}
              initial={{ scale: 1.06 }}
              animate={{ scale: 1 }}
              className="ink-border font-pop bg-card text-ink min-w-0 flex-1 rounded-2xl px-2 py-3 text-center text-3xl font-black tabular-nums"
              style={{ boxShadow: '4px 4px 0 #1a1a1a' }}
              value={amount}
              inputMode="numeric"
              onChange={(event) => setAmount(Number(event.target.value.replace(/\D/g, '')) || 0)}
            />
            <DoodleButton
              size="md"
              tone="paper"
              tilt={0}
              onClick={() => setAmount((value) => Math.min(maxBid, value + step))}
            >
              +
            </DoodleButton>
          </div>

          <DoodleButton
            size="lg"
            tone="gold"
            tilt={-0.8}
            disabled={amount < minBid || amount > maxBid}
            onClick={() => onBid(amount)}
            className="w-full"
          >
            Ставлю {amount}
          </DoodleButton>

          <DoodleButton size="md" tone="p2" tilt={0.8} onClick={() => onBid('all-in')} className="w-full">
            Ва-банк · {maxBid}
          </DoodleButton>
        </>
      ) : (
        <p className="font-body text-center font-bold text-pretty">
          Перебить нечем — остаётся пас.
        </p>
      )}

      <DoodleButton
        size="md"
        tone="paper"
        tilt={0}
        disabled={!canPass}
        onClick={() => onBid('pass')}
        className="w-full"
      >
        Пас
      </DoodleButton>
    </div>
  );
}
