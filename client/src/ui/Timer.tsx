import { useEffect, useState } from 'react';
import type { TimerView } from '@svoyak/shared';

interface TimerBarProps {
  timer: TimerView | null;
  paused: boolean;
}

/** Полоса времени. На паузе замирает: сервер прислал остаток вместо момента окончания. */
export function TimerBar({ timer, paused }: TimerBarProps) {
  const [, force] = useState(0);

  useEffect(() => {
    if (!timer || timer.remainingMs !== null) return;
    const id = setInterval(() => force((tick) => tick + 1), 100);
    return () => clearInterval(id);
  }, [timer]);

  if (!timer) return null;

  const left = timer.remainingMs ?? Math.max(0, timer.endsAt - Date.now());
  const ratio = timer.totalMs > 0 ? Math.min(1, left / timer.totalMs) : 0;
  const seconds = Math.ceil(left / 1000);

  return (
    <div className="flex items-center gap-3">
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={timer.totalMs}
        aria-valuenow={left}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-100 ease-linear ${
            ratio < 0.25 ? 'bg-bad' : 'bg-gold'
          }`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      <span className="w-8 text-right text-sm tabular-nums text-muted">
        {paused ? '⏸' : seconds}
      </span>
    </div>
  );
}
