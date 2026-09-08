import { useState } from 'react';

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

  return (
    <div className="flex flex-1 flex-col justify-center gap-4">
      <div className="text-center">
        <p className="text-sm text-muted">Аукцион · ваш ход</p>
        <p className="text-3xl font-black tabular-nums text-gold">{currentBid}</p>
        <p className="text-muted">
          перебить можно от <span className="tabular-nums">{minBid}</span>, у вас{' '}
          <span className="tabular-nums">{maxBid}</span>
        </p>
      </div>

      {affordable && (
        <>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAmount((value) => Math.max(minBid, value - 100))}
              className="rounded-2xl border border-line px-5 py-4 text-2xl"
            >
              −
            </button>
            <input
              className="min-w-0 flex-1 rounded-2xl border border-line bg-surface px-3 py-4 text-center text-2xl font-bold tabular-nums focus:border-gold"
              value={amount}
              inputMode="numeric"
              onChange={(event) => setAmount(Number(event.target.value.replace(/\D/g, '')) || 0)}
            />
            <button
              onClick={() => setAmount((value) => Math.min(maxBid, value + 100))}
              className="rounded-2xl border border-line px-5 py-4 text-2xl"
            >
              +
            </button>
          </div>

          <button
            disabled={amount < minBid || amount > maxBid}
            onClick={() => onBid(amount)}
            className="rounded-2xl bg-gold px-4 py-4 text-xl font-bold text-bg disabled:opacity-40"
          >
            Ставлю {amount}
          </button>

          <button
            onClick={() => onBid('all-in')}
            className="rounded-2xl border border-gold px-4 py-3 font-bold text-gold"
          >
            Ва-банк · {maxBid}
          </button>
        </>
      )}

      {!affordable && (
        <p className="text-center text-muted text-pretty">Перебить нечем — можно только спасовать.</p>
      )}

      <button
        disabled={!canPass}
        onClick={() => onBid('pass')}
        className="rounded-2xl border border-line px-4 py-3 text-muted disabled:opacity-40"
      >
        Пас
      </button>
    </div>
  );
}
