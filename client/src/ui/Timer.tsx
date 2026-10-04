import { useEffect, useState } from 'react';
import { timerLeft, type TimerView } from '@svoyak/shared';
import { DoodleTimer } from '../design/DoodleTimer.js';

/**
 * Таймер, который тикает сам. Сервер присылает только момент окончания и не
 * шлёт обновлений каждую секунду, поэтому остаток пересчитываем здесь по часам.
 * Раньше полосу кормили значением, посчитанным при рендере экрана ведущего, и
 * она замирала до следующего события с сервера.
 */
export function LiveTimer({ timer, label }: { timer: TimerView; label?: string }) {
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
  return <DoodleTimer progress={left.progress} seconds={left.seconds} {...(label ? { label } : {})} />;
}
