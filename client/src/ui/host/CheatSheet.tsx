import { useState } from 'react';
import type { CheatSheetTheme } from '@svoyak/shared';

const OPEN_KEY = 'svoyak:cheatSheetOpen';

/** Экран ведущего бывает виден гостям, поэтому шпаргалка по умолчанию свёрнута,
 *  а раскрытой остаётся, только если ведущий сам её так оставил. */
function loadOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) === '1';
  } catch {
    return false;
  }
}

function saveOpen(open: boolean): void {
  try {
    localStorage.setItem(OPEN_KEY, open ? '1' : '0');
  } catch {
    // Без хранилища шпаргалка просто снова откроется свёрнутой.
  }
}

const TYPE_LABEL = { cat: 'кот в мешке', auction: 'аукцион' } as const;

/** Вопросы раунда, которые ещё можно выбрать: прочитать заранее, чтобы не
 *  спотыкаться на имени или ударении, когда клетку откроют. */
export function CheatSheet({ themes }: { themes: CheatSheetTheme[] }) {
  const [open, setOpen] = useState(loadOpen);
  const total = themes.reduce((sum, theme) => sum + theme.questions.length, 0);
  if (total === 0) return null;

  const toggle = (): void => {
    setOpen(!open);
    saveOpen(!open);
  };

  return (
    <section className="ink-border bg-card text-ink mt-4 rounded-2xl" style={{ boxShadow: '4px 4px 0 #1a1a1a' }}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="font-pop flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-lg font-black"
      >
        <span>
          Шпаргалка{' '}
          <span className="font-body text-sm font-bold opacity-60">
            · осталось вопросов: <span className="tabular-nums">{total}</span>
          </span>
        </span>
        <span className="font-body text-sm font-bold opacity-70">{open ? 'скрыть' : 'показать'}</span>
      </button>

      {open && (
        <div className="grid max-h-[60dvh] gap-4 overflow-y-auto border-t-2 border-[#1a1a1a] px-4 py-3">
          {themes.map((theme) => (
            <article key={theme.id} className="grid gap-2">
              <header>
                <h3 className="font-pop text-base font-black">{theme.title}</h3>
                {theme.comment && (
                  <p className="font-body text-sm font-bold opacity-70 text-pretty">{theme.comment}</p>
                )}
              </header>
              <ul className="grid gap-2">
                {theme.questions.map((question) => (
                  <li key={question.questionId} className="grid grid-cols-[3.5rem_1fr] gap-3">
                    <span className="font-pop text-p1 text-lg font-black tabular-nums">{question.price}</span>
                    <div className="font-body min-w-0 text-sm">
                      {question.type !== 'normal' && (
                        <p className="text-xs font-black uppercase opacity-60">
                          {TYPE_LABEL[question.type]}
                          {question.catTheme && ` · тема «${question.catTheme}»`}
                        </p>
                      )}
                      <p className="font-bold text-pretty opacity-80">{question.text || '— без текста —'}</p>
                      <p className="font-black">
                        → {question.answer}
                        {question.altAnswers.length > 0 && (
                          <span className="font-bold opacity-60"> ({question.altAnswers.join(', ')})</span>
                        )}
                      </p>
                      {question.hostComment && (
                        <p className="font-bold opacity-60 text-pretty">{question.hostComment}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
