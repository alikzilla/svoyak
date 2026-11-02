import { useEffect } from 'react';

export interface WakeLockSentinelLike {
  released: boolean;
  release(): Promise<void>;
}

export interface WakeLockApi {
  request(type: 'screen'): Promise<WakeLockSentinelLike>;
}

export interface PageLike {
  visibilityState: string;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

/**
 * Не даёт экрану погаснуть. Телефон игрока подолгу лежит без дела, пока
 * отвечают другие; экран гаснет, браузер рвёт сокет — и переподключается он
 * как раз к открытию кнопки. Система сама снимает блокировку при сворачивании
 * вкладки, поэтому она возвращается, когда вкладка снова видна. Если браузер
 * отказал (энергосбережение, нет жеста), пробуем на следующем касании.
 * Возвращает отписку: экран отпускается.
 */
export function keepScreenAwake(api: WakeLockApi | undefined, page: PageLike): () => void {
  if (!api) return () => {};

  let sentinel: WakeLockSentinelLike | null = null;
  let pending = false;
  let stopped = false;

  const acquire = async (): Promise<void> => {
    if (stopped || pending || page.visibilityState !== 'visible') return;
    if (sentinel && !sentinel.released) return;
    pending = true;
    try {
      const lock = await api.request('screen');
      if (stopped) void lock.release();
      else sentinel = lock;
    } catch {
      // Отказ — не ошибка игры: попробуем снова при следующем поводе.
    } finally {
      pending = false;
    }
  };

  const retry = (): void => void acquire();
  page.addEventListener('visibilitychange', retry);
  page.addEventListener('pointerdown', retry);
  retry();

  return () => {
    stopped = true;
    page.removeEventListener('visibilitychange', retry);
    page.removeEventListener('pointerdown', retry);
    if (sentinel && !sentinel.released) void sentinel.release();
    sentinel = null;
  };
}

/** Экран не гаснет, пока смонтирован компонент. */
export function useWakeLock(): void {
  useEffect(
    () =>
      keepScreenAwake(
        (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock,
        document,
      ),
    [],
  );
}
