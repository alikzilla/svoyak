import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  type MotionValue,
} from 'framer-motion';
import { timerLeft, type TimerView } from '@svoyak/shared';
import type { ClockReading } from '../net/useClock.js';

/** С этого остатка полосы краснеют — так же, как таймер ведущего. */
const URGENT_MS = 3000;

type Side = 'top' | 'right' | 'bottom' | 'left';
const SIDES: Side[] = ['top', 'right', 'bottom', 'left'];

/** Толщина полосы и поле вокруг карточки: от высоты экрана, чтобы на телевизоре
 *  полосы читались с дивана, а вопросу место оставалось. */
const FRAME_VARS = {
  '--bz-thick': 'clamp(0.875rem, 2dvh, 1.5rem)',
  '--bz-gutter': 'calc(var(--bz-thick) + clamp(0.5rem, 1dvh, 0.875rem))',
} as CSSProperties;

/** Полосы стоят в поле вокруг карточки и не заходят в углы: четыре отдельные
 *  полосы, а не одна рамка. */
const PLACEMENT: Record<Side, CSSProperties> = {
  top: { top: 0, left: 'var(--bz-gutter)', right: 'var(--bz-gutter)', height: 'var(--bz-thick)' },
  bottom: { bottom: 0, left: 'var(--bz-gutter)', right: 'var(--bz-gutter)', height: 'var(--bz-thick)' },
  left: { left: 0, top: 'var(--bz-gutter)', bottom: 'var(--bz-gutter)', width: 'var(--bz-thick)' },
  right: { right: 0, top: 'var(--bz-gutter)', bottom: 'var(--bz-gutter)', width: 'var(--bz-thick)' },
};

interface BuzzCountdownProps {
  /** Таймер комнаты. Полосы видны, только пока открыта кнопка. */
  timer: TimerView | null;
  /** Часы, сверенные с сервером: конец таймера приходит в серверном времени. */
  readClock: () => ClockReading;
  children: ReactNode;
}

/**
 * Сколько ещё можно жать на кнопку — четыре полосы вокруг вопроса на общем
 * экране. Каждая сжимается от краёв к своей середине. Поле под полосы занято
 * всегда, а не только при открытой кнопке: иначе карточка с вопросом дёргалась бы
 * в тот момент, когда ведущий открывает кнопку.
 */
export function BuzzCountdown({ timer, readClock, children }: BuzzCountdownProps) {
  const buzz = timer?.kind === 'buzz' ? timer : null;
  const running = buzz !== null && buzz.remainingMs === null;

  // После неверного ответа сервер заводит новый таймер только на остаток
  // бюджета. Полосы меряем от полного окна вопроса, чтобы они продолжили с того
  // места, где замерли, а не налились заново. Карточка живёт, пока открыт этот
  // вопрос, так что бюджет сбрасывается сам вместе с ней.
  const [budgetMs, setBudgetMs] = useState(buzz?.totalMs ?? 0);
  if (buzz && buzz.totalMs > budgetMs) setBudgetMs(buzz.totalMs);

  const progress = useMotionValue(1);
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    if (!buzz) return;
    let frame = 0;
    // Полоса едет каждый кадр через motion value: React при этом не
    // перерисовывается, перерисовка нужна только когда полосы краснеют.
    const tick = (): void => {
      const left = timerLeft(buzz, Date.now() + readClock().offset);
      progress.set(budgetMs > 0 ? Math.min(1, left.ms / budgetMs) : 0);
      setUrgent(left.ms > 0 && left.ms <= URGENT_MS);
      // На паузе остаток фиксирован, а после окончания ехать некуда.
      if (buzz.remainingMs === null && left.ms > 0) frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [buzz, budgetMs, progress, readClock]);

  const calm = useReducedMotion() ?? false;
  // На паузе время стоит, и мигать незачем.
  const pulse = urgent && running && !calm;

  return (
    <div className="relative" style={{ ...FRAME_VARS, padding: 'var(--bz-gutter)' }}>
      {children}
      <AnimatePresence>
        {buzz && (
          <motion.div
            key="buzz-countdown"
            aria-hidden
            className="pointer-events-none absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {SIDES.map((side) => (
              <Bar key={side} side={side} progress={progress} urgent={urgent} pulse={pulse} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Bar({
  side,
  progress,
  urgent,
  pulse,
}: {
  side: Side;
  progress: MotionValue<number>;
  urgent: boolean;
  pulse: boolean;
}) {
  const horizontal = side === 'top' || side === 'bottom';

  return (
    // Пустой жёлоб остаётся на месте: видно, сколько времени уже ушло.
    <div
      className="ink-border absolute overflow-hidden rounded-full"
      style={{
        ...PLACEMENT[side],
        backgroundColor: 'color-mix(in srgb, var(--color-ink) 45%, transparent)',
        boxShadow: '3px 3px 0 #1a1a1a',
      }}
    >
      <motion.div
        // Зелёный — как кнопка «ЖМИ» на телефоне: кнопка открыта, пока полоса есть.
        // Масштаб от центра, поэтому полоса съезжается с обоих концов к середине.
        className="h-full w-full rounded-full transition-colors duration-200"
        style={{
          backgroundColor: urgent ? 'var(--color-no)' : 'var(--color-yes)',
          ...(horizontal ? { scaleX: progress } : { scaleY: progress }),
        }}
        animate={pulse ? { opacity: [1, 0.55, 1] } : { opacity: 1 }}
        transition={pulse ? { duration: 0.5, repeat: Infinity } : { duration: 0.2 }}
      />
    </div>
  );
}
