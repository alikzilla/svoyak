import { useEffect, useState } from 'react';
import { timerLeft, type TimerKind, type TimerView } from '@svoyak/shared';

const LABEL: Record<TimerKind, string> = {
  announce: 'тема на экране',
  reading: 'до открытия кнопки',
  buzz: 'кнопка открыта',
  reveal: 'ответ на экране',
  modifier: 'модификатор',
  final_bet: 'ставки',
  final_answer: 'ответы',
};

/**
 * Таймер, который тикает сам. Сервер присылает только момент окончания и не
 * шлёт обновлений каждую секунду, поэтому остаток пересчитываем здесь по часам.
 */
export function LiveTimer({ timer, paused = false }: { timer: TimerView; paused?: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  const running = timer.remainingMs === null;

  useEffect(() => {
    setNow(Date.now());
    // На паузе остаток фиксирован, а после окончания тикать нечему.
    if (!running) return;
    const id = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= timer.endsAt) window.clearInterval(id);
    }, 100);
    return () => window.clearInterval(id);
  }, [running, timer.endsAt]);

  const left = timerLeft(timer, now);
  const urgent = left.seconds <= 3 && timer.kind === 'buzz';

  return (
    <div className="grid min-w-36 gap-1" role="timer" aria-label={`${LABEL[timer.kind]}: ${left.seconds} с`}>
      <div className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
        <span className="text-ws-soft">{paused ? 'пауза' : LABEL[timer.kind]}</span>
        <span className={`num font-semibold ${urgent ? 'text-ws-no-ink' : ''}`}>{left.seconds} с</span>
      </div>
      <div className="bg-ws-sunken h-1.5 overflow-hidden rounded-full">
        <div
          className={`h-full rounded-full transition-[width] duration-100 ease-linear ${
            urgent ? 'bg-ws-no' : 'bg-ws-accent'
          }`}
          style={{ width: `${Math.max(0, Math.min(1, left.progress)) * 100}%` }}
        />
      </div>
    </div>
  );
}
