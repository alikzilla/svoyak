import '@fontsource-variable/onest';
import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ThemeMenu } from './ThemeMenu.js';

const NAV = [
  { to: '/host', label: 'Ведущий' },
  { to: '/editor', label: 'Паки' },
  { to: '/games', label: 'Игры' },
] as const;

interface ShellProps {
  children: ReactNode;
  /** Правая часть верхней полосы: связь, звук, действия экрана. Тема — всегда последней. */
  aside?: ReactNode;
  /** Во время игры полоса показывает игру, а не навигацию по разделам. */
  bar?: ReactNode;
}

/**
 * Одна ширина на все рабочие экраны — ведущий, паки, игры, сама игра.
 * Раньше у каждого экрана была своя, и при переходе по вкладкам заголовок
 * и края содержимого прыгали.
 */
const CONTAINER = 'mx-auto w-full max-w-7xl px-4 sm:px-6';

/** Оболочка рабочих экранов: полоса сверху и спокойный фон. */
export function Shell({ children, aside, bar }: ShellProps) {
  return (
    <div className="ws flex flex-col">
      <header className="bg-ws-surface/85 border-ws-line sticky top-0 z-30 border-b backdrop-blur-md">
        <div className={`${CONTAINER} flex h-14 items-center gap-4`}>
          <Link
            to="/"
            className="text-ws-fg shrink-0 text-[0.9375rem] font-semibold tracking-tight no-underline"
            title="На главную"
          >
            Свояк
          </Link>
          {bar ?? (
            <nav aria-label="Разделы" className="-mx-1 flex min-w-0 items-center gap-0.5 overflow-x-auto">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `rounded-md px-2.5 py-1.5 text-sm font-medium whitespace-nowrap no-underline transition-colors ${
                      isActive
                        ? 'bg-ws-sunken text-ws-fg'
                        : 'text-ws-soft hover:bg-ws-sunken hover:text-ws-fg'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          )}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {aside}
            <ThemeMenu />
          </div>
        </div>
      </header>
      <main className={`${CONTAINER} flex flex-1 flex-col pt-6 pb-16 sm:pt-8`}>
        {children}
      </main>
    </div>
  );
}

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Над заголовком: ссылка «назад». */
  back?: ReactNode;
}

export function PageHeader({ title, description, actions, back }: PageHeaderProps) {
  return (
    <div className="mb-6 grid gap-3">
      {back}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="grid min-w-0 gap-1">
          <h1 className="text-[1.625rem] leading-tight font-semibold tracking-tight">{title}</h1>
          {description && <p className="text-ws-soft max-w-2xl text-[0.9375rem]">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
