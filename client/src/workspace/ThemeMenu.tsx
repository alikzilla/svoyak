import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Check, Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { useThemePref, type ThemePref } from './theme.js';

const OPTIONS: Array<{ value: ThemePref; label: string; icon: LucideIcon }> = [
  { value: 'light', label: 'Светлая', icon: Sun },
  { value: 'dark', label: 'Тёмная', icon: Moon },
  { value: 'system', label: 'Как в системе', icon: Monitor },
];

/** Переключатель темы в верхней полосе: светлая, тёмная или как в системе. */
export function ThemeMenu() {
  const [pref, setPref] = useThemePref();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const current = OPTIONS.find((option) => option.value === pref) ?? OPTIONS[2]!;
  const Icon = current.icon;

  // Открытое меню закрывается кликом мимо и клавишей Esc; фокус — на выбранный пункт.
  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
    const onPointer = (event: PointerEvent): void => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: globalThis.KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  /** Стрелки ходят по пунктам, как в обычном меню. */
  const onMenuKey = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitemradio"]'));
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  };

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Тема: ${current.label.toLowerCase()}`}
        title="Тема оформления"
        className="ws-btn ws-btn-ghost ws-btn-sm ws-btn-icon"
      >
        <Icon aria-hidden />
      </button>
      {open && (
        <div id={menuId} role="menu" aria-label="Тема оформления" className="ws-menu" onKeyDown={onMenuKey}>
          <p className="ws-menu-label" aria-hidden>
            Тема
          </p>
          {OPTIONS.map((option) => {
            const OptionIcon = option.icon;
            const checked = option.value === pref;
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={checked}
                tabIndex={checked ? 0 : -1}
                onClick={() => {
                  setPref(option.value);
                  setOpen(false);
                  trigger.current?.focus();
                }}
                className="ws-menu-item"
              >
                <OptionIcon aria-hidden />
                <span className="flex-1">{option.label}</span>
                {checked && <Check aria-hidden />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
