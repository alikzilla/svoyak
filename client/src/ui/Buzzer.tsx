import { useEffect, useState } from 'react';

interface BuzzerProps {
  open: boolean;
  lockedUntil: number | null;
  /** Имя того, кто уже отвечает, если кнопку успели нажать. */
  answeringName: string | null;
  onBuzz: () => void;
}

/** Кнопка во весь экран: единственное, что делает игрок руками во время вопроса. */
export function Buzzer({ open, lockedUntil, answeringName, onBuzz }: BuzzerProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (lockedUntil === null) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const lockLeft = lockedUntil !== null ? Math.max(0, lockedUntil - now) : 0;
  const locked = lockLeft > 0;

  const press = (): void => {
    if (locked) return;
    // Вибрация — единственный отклик, когда игрок смотрит на ведущего, а не в телефон.
    navigator.vibrate?.(30);
    onBuzz();
  };

  const label = locked
    ? `Фальстарт · ${(lockLeft / 1000).toFixed(1)}`
    : answeringName
      ? `Отвечает ${answeringName}`
      : open
        ? 'ЖМИ'
        : 'Ждите';

  const tone = locked
    ? 'bg-bad/20 text-bad border-bad'
    : answeringName
      ? 'bg-surface text-muted border-line'
      : open
        ? 'bg-gold text-bg border-gold'
        : 'bg-surface-2 text-muted border-line';

  return (
    <button
      type="button"
      onPointerDown={press}
      disabled={locked}
      // Кнопку жмут быстро и много: убираем задержки и выделение текста.
      className={`w-full flex-1 touch-none rounded-3xl border-4 text-[clamp(2rem,1rem+10vw,4rem)] leading-none font-black tabular-nums transition-colors select-none ${tone}`}
    >
      {label}
    </button>
  );
}
