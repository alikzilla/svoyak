import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export type BuzzerState = 'closed' | 'open' | 'locked' | 'taken' | 'mine';

interface BigBuzzerProps {
  state: BuzzerState;
  /** До какого момента игрок заблокирован фальстартом. */
  lockedUntil: number | null;
  /** Когда кнопка откроется сама. Null — ведущий открывает её руками. */
  opensAt: number | null;
  /** Вопрос уже на экране, кнопка вот-вот откроется. Нажатие в этот момент —
   *  фальстарт, и о нём должен узнать сервер, а не только этот телефон. */
  armed: boolean;
  /** Открыта ли кнопка по мнению сервера. Нужно, чтобы понять, куда вернуться,
   *  когда истечёт блокировка: новой проекции на это событие не приходит. */
  openForAll: boolean;
  answeringName: string | null;
  color: string;
  onBuzz: () => void;
}

const LABEL: Record<BuzzerState, string> = {
  closed: 'ждите',
  open: 'ЖМИ',
  locked: 'фальстарт',
  taken: 'занято',
  mine: 'вы отвечаете',
};

/** Кнопка на пол-экрана: до неё не надо дотягиваться, состояние видно с вытянутой руки. */
export function BigBuzzer({
  state: reported,
  lockedUntil,
  opensAt,
  armed,
  openForAll,
  answeringName,
  color,
  onBuzz,
}: BigBuzzerProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (lockedUntil === null && opensAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [lockedUntil, opensAt]);

  const lockLeft = lockedUntil !== null ? Math.max(0, lockedUntil - now) : 0;

  // Блокировка истекает молча: сервер не шлёт проекцию на срабатывание таймера,
  // поэтому отпускаем кнопку сами, как только время вышло.
  const state: BuzzerState =
    reported === 'locked' && lockLeft <= 0 ? (openForAll ? 'open' : 'closed') : reported;

  // Отсчёт до открытия: игрок держит палец наготове, а не гадает.
  const openLeft = state === 'closed' && opensAt !== null ? Math.max(0, opensAt - now) : 0;
  // Пока вопрос на экране, кнопка нажимается даже закрытой: раннее нажатие — это
  // фальстарт, и судить его должен сервер, а не глушить этот телефон.
  const disabled = !(state === 'open' || (state === 'closed' && armed));

  const fill =
    state === 'open'
      ? 'var(--color-yes)'
      : state === 'locked'
        ? 'var(--color-no)'
        : state === 'mine'
          ? color
          : '#6a5fb8';

  const press = (): void => {
    if (disabled) return;
    // Вибрация — единственный отклик, когда игрок смотрит на ведущего, а не в телефон.
    navigator.vibrate?.(35);
    onBuzz();
  };

  return (
    <motion.button
      type="button"
      onPointerDown={press}
      disabled={disabled}
      // Открытие кнопки — момент, ради которого игрок держит телефон: она раздувается.
      animate={
        state === 'open'
          ? { scale: [0.9, 1.04, 1], rotate: [0, -1, 0] }
          : state === 'locked'
            ? { x: [0, -8, 8, -5, 0] }
            : { scale: 1, rotate: 0 }
      }
      transition={
        state === 'open'
          ? { type: 'spring', stiffness: 380, damping: 12 }
          : { duration: 0.35 }
      }
      whileTap={disabled ? undefined : { scale: 0.96, x: 5, y: 7, boxShadow: '0px 0px 0 #1a1a1a' }}
      style={{ backgroundColor: fill, boxShadow: '8px 9px 0 #1a1a1a' }}
      className="ink-border font-pop grid w-full flex-1 touch-none place-items-center rounded-[2.5rem] leading-none font-black text-white select-none"
    >
      <span className="grid justify-items-center gap-2 px-4 text-center">
        <span
          className="text-[clamp(2.5rem,14vw,5rem)]"
          style={{ WebkitTextStroke: '3px #1a1a1a', paintOrder: 'stroke fill' }}
        >
          {state === 'locked' ? (lockLeft / 1000).toFixed(1) : LABEL[state]}
        </span>
        {state === 'taken' && answeringName && (
          <span className="font-body text-xl font-bold">отвечает {answeringName}</span>
        )}
        {state === 'locked' && <span className="font-body text-xl font-bold">рано нажали</span>}
        {openLeft > 0 && (
          <span className="font-body text-xl font-bold tabular-nums">
            откроется через {(openLeft / 1000).toFixed(1)}
          </span>
        )}
      </span>
    </motion.button>
  );
}
