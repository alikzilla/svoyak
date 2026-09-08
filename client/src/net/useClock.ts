import { useEffect, useRef } from 'react';
import type { ClockPong } from '@svoyak/shared';
import { socket } from './socket.js';

export interface ClockReading {
  /** Смещение часов клиента относительно сервера, мс. */
  offset: number;
  /** Минимальный измеренный RTT, мс. */
  minRtt: number;
}

const SAMPLES = 10;
const INTERVAL_MS = 2000;

/** Синхронизация часов для честной кнопки: держим лучшее измерение из последних десяти. */
export function useClock(): { read: () => ClockReading } {
  const samples = useRef<Array<{ offset: number; rtt: number }>>([]);

  useEffect(() => {
    const ping = (): void => {
      const t0 = Date.now();
      socket.emit('clock:ping', { t0 }, (pong: ClockPong) => {
        const t1 = Date.now();
        const rtt = t1 - pong.t0;
        // Предполагаем симметричную задержку: серверное время в момент ответа + половина RTT.
        const offset = pong.tServer + rtt / 2 - t1;
        samples.current = [...samples.current, { offset, rtt }].slice(-SAMPLES);
      });
    };

    ping();
    const timer = setInterval(ping, INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  const read = (): ClockReading => {
    const best = samples.current.reduce<{ offset: number; rtt: number } | null>(
      (acc, sample) => (acc === null || sample.rtt < acc.rtt ? sample : acc),
      null,
    );
    return { offset: best?.offset ?? 0, minRtt: best?.rtt ?? 0 };
  };

  return { read };
}
