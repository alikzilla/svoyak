import { useState, type ReactNode } from 'react';
import { AlertCircle, Info, Minus, Plus, Volume2, VolumeX } from 'lucide-react';
import { isMuted, setMuted, unlockAudio } from '../net/sounds.js';

/** Число с кнопками «меньше/больше»: раунды, темы, модификаторы. */
export function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  hint?: ReactNode;
}) {
  const set = (next: number): void => onChange(Math.min(max, Math.max(min, next)));
  return (
    <div className="grid content-start gap-1.5">
      <span className="ws-label">{label}</span>
      <div className="border-ws-line-strong bg-ws-surface flex h-10 items-center justify-between rounded-lg border">
        <button
          type="button"
          aria-label={`${label}: меньше`}
          disabled={value <= min}
          onClick={() => set(value - 1)}
          className="text-ws-soft hover:bg-ws-sunken hover:text-ws-fg grid h-full w-10 place-items-center rounded-l-lg transition-colors disabled:opacity-35"
        >
          <Minus size={16} aria-hidden />
        </button>
        <span role="status" aria-live="polite" className="num text-[0.9375rem] font-semibold">
          {value}
        </span>
        <button
          type="button"
          aria-label={`${label}: больше`}
          disabled={value >= max}
          onClick={() => set(value + 1)}
          className="text-ws-soft hover:bg-ws-sunken hover:text-ws-fg grid h-full w-10 place-items-center rounded-r-lg transition-colors disabled:opacity-35"
        >
          <Plus size={16} aria-hidden />
        </button>
      </div>
      {hint && <span className="ws-help">{hint}</span>}
    </div>
  );
}

/** Выбор одного из нескольких: короткий список, все варианты на виду. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | null;
  options: Array<{ value: T; label: ReactNode }>;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="ws-seg">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Notice({
  tone = 'error',
  children,
  action,
}: {
  tone?: 'error' | 'warn' | 'info';
  children: ReactNode;
  action?: ReactNode;
}) {
  const Icon = tone === 'info' ? Info : AlertCircle;
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`ws-notice ws-notice-${tone}`}>
      <Icon aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}

/** Пустое место, которое объясняет, что сюда попадёт и как это сделать. */
export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="border-ws-line-strong grid justify-items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center">
      {icon && <div className="text-ws-faint mb-1 [&_svg]:size-7">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {children && <div className="text-ws-soft max-w-md text-sm">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Kbd({ children, label }: { children: ReactNode; label?: string }) {
  return (
    // На телефоне и планшете клавиатуры нет — подсказка только там, где пригодится.
    <kbd className="ws-kbd max-lg:hidden" {...(label ? { 'aria-label': label } : {})}>
      {children}
    </kbd>
  );
}

/**
 * Удаление в два шага, без модального окна: первая кнопка тихая, вторая —
 * красная «Удалить насовсем» рядом с «Отмена».
 */
export function ConfirmDelete({
  label = 'Удалить',
  confirmLabel = 'Удалить насовсем',
  onConfirm,
  size = 'sm',
  icon,
  title,
}: {
  label?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  size?: 'sm' | 'md';
  icon?: ReactNode;
  title?: string;
}) {
  const [armed, setArmed] = useState(false);
  const sizeClass = size === 'sm' ? 'ws-btn-sm' : '';

  if (armed) {
    return (
      <span className="flex items-center gap-1.5">
        <button
          type="button"
          autoFocus
          onClick={() => {
            setArmed(false);
            onConfirm();
          }}
          className={`ws-btn ws-btn-danger ${sizeClass}`}
        >
          {confirmLabel}
        </button>
        <button type="button" onClick={() => setArmed(false)} className={`ws-btn ws-btn-ghost ${sizeClass}`}>
          Отмена
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setArmed(true)}
      title={title ?? label}
      aria-label={icon ? (title ?? label) : undefined}
      className={`ws-btn ws-btn-ghost ws-btn-quiet-danger ${sizeClass} ${icon ? 'ws-btn-icon' : ''}`}
    >
      {icon ?? label}
    </button>
  );
}

/** Состояние связи с сервером: точка и короткое слово. */
export function ConnectionStatus({ connected }: { connected: boolean }) {
  return (
    <span
      role="status"
      className={`inline-flex items-center gap-1.5 text-[0.8125rem] font-medium ${
        connected ? 'text-ws-soft' : 'text-ws-no-ink'
      }`}
    >
      <span
        aria-hidden
        className={`size-2 rounded-full ${connected ? 'bg-ws-yes' : 'bg-ws-no animate-pulse'}`}
      />
      <span className="hidden sm:inline">{connected ? 'на связи' : 'нет связи…'}</span>
    </span>
  );
}

/** Звук: первое включение заодно будит аудио — браузеры требуют жеста. */
export function SoundButton() {
  const [muted, setMutedState] = useState(isMuted);
  return (
    <button
      type="button"
      onClick={() => {
        const next = !muted;
        setMuted(next);
        setMutedState(next);
        if (!next) unlockAudio();
      }}
      title={muted ? 'Включить звук' : 'Выключить звук'}
      aria-label={muted ? 'Включить звук' : 'Выключить звук'}
      aria-pressed={muted}
      className="ws-btn ws-btn-ghost ws-btn-sm ws-btn-icon"
    >
      {muted ? <VolumeX aria-hidden /> : <Volume2 aria-hidden />}
    </button>
  );
}

/** Подпись секции внутри листа. */
export function SectionTitle({ children, meta }: { children: ReactNode; meta?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-[0.9375rem] font-semibold">{children}</h2>
      {meta && <span className="text-ws-faint num text-[0.8125rem]">{meta}</span>}
    </div>
  );
}
