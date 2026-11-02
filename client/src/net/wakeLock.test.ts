import { describe, it, expect } from 'vitest';
import { keepScreenAwake, type PageLike, type WakeLockApi, type WakeLockSentinelLike } from './wakeLock.js';

/** Браузерный wakeLock: выдаёт блокировки, может отказать; система снимает их сама. */
function fakeWakeLock(options: { failFirst?: boolean } = {}) {
  let failNext = options.failFirst ?? false;
  const held: WakeLockSentinelLike[] = [];
  const api: WakeLockApi = {
    request: () => {
      if (failNext) {
        failNext = false;
        return Promise.reject(new Error('NotAllowedError'));
      }
      const sentinel: WakeLockSentinelLike = {
        released: false,
        release: () => {
          sentinel.released = true;
          return Promise.resolve();
        },
      };
      held.push(sentinel);
      return Promise.resolve(sentinel);
    },
  };
  return { api, held, active: () => held.filter((lock) => !lock.released).length };
}

function fakePage(): PageLike & { fire: (type: string) => void } {
  const listeners = new Map<string, Set<() => void>>();
  return {
    visibilityState: 'visible',
    addEventListener: (type, listener) => {
      listeners.set(type, (listeners.get(type) ?? new Set()).add(listener));
    },
    removeEventListener: (type, listener) => {
      listeners.get(type)?.delete(listener);
    },
    fire: (type) => {
      for (const listener of listeners.get(type) ?? []) listener();
    },
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('keepScreenAwake', () => {
  it('держит экран включённым, пока страница открыта', async () => {
    const lock = fakeWakeLock();
    keepScreenAwake(lock.api, fakePage());
    await settle();
    expect(lock.active()).toBe(1);
  });

  it('возвращает блокировку, когда вкладка снова видна: система снимает её при сворачивании', async () => {
    const lock = fakeWakeLock();
    const page = fakePage();
    keepScreenAwake(lock.api, page);
    await settle();

    lock.held[0]?.release();
    page.visibilityState = 'hidden';
    page.fire('visibilitychange');
    await settle();
    expect(lock.active()).toBe(0);

    page.visibilityState = 'visible';
    page.fire('visibilitychange');
    await settle();
    expect(lock.active()).toBe(1);
  });

  it('если браузер отказал, пробует снова при следующем касании', async () => {
    const lock = fakeWakeLock({ failFirst: true });
    const page = fakePage();
    keepScreenAwake(lock.api, page);
    await settle();
    expect(lock.active()).toBe(0);

    page.fire('pointerdown');
    await settle();
    expect(lock.active()).toBe(1);
  });

  it('после ухода со страницы отпускает экран и больше не просит', async () => {
    const lock = fakeWakeLock();
    const page = fakePage();
    const stop = keepScreenAwake(lock.api, page);
    await settle();
    stop();
    page.fire('pointerdown');
    await settle();
    expect(lock.active()).toBe(0);
    expect(lock.held).toHaveLength(1);
  });

  it('браузер без wakeLock — просто ничего не делает', () => {
    expect(() => keepScreenAwake(undefined, fakePage())()).not.toThrow();
  });
});
