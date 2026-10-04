import { describe, expect, it } from 'vitest';
import { timerLeft } from './timer.js';
import type { TimerView } from './state.js';

const running = (endsAt: number, totalMs = 8000): TimerView => ({
  kind: 'buzz',
  endsAt,
  totalMs,
  remainingMs: null,
});

describe('timerLeft', () => {
  it('убывает со временем, пока таймер идёт', () => {
    const timer = running(10_000);
    expect(timerLeft(timer, 2_000)).toEqual({ ms: 8_000, progress: 1, seconds: 8 });
    expect(timerLeft(timer, 6_000)).toEqual({ ms: 4_000, progress: 0.5, seconds: 4 });
  });

  it('секунды округляются вверх: 0.3 с ещё показываются как 1', () => {
    expect(timerLeft(running(10_000), 9_700).seconds).toBe(1);
  });

  it('не уходит ниже нуля после окончания', () => {
    expect(timerLeft(running(10_000), 12_000)).toEqual({ ms: 0, progress: 0, seconds: 0 });
  });

  it('на паузе показывает присланный остаток и не зависит от часов', () => {
    const paused: TimerView = { ...running(10_000), remainingMs: 3_000 };
    expect(timerLeft(paused, 0)).toEqual(timerLeft(paused, 99_999));
    expect(timerLeft(paused, 0)).toEqual({ ms: 3_000, progress: 0.375, seconds: 3 });
  });

  it('не делит на ноль при нулевой длительности', () => {
    expect(timerLeft(running(10_000, 0), 10_000).progress).toBe(0);
  });
});
