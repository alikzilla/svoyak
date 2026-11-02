import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
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
    <section className="ws-card overflow-hidden">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="hover:bg-ws-hover flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors"
      >
        {open ? <EyeOff size={18} className="text-ws-key-ink" aria-hidden /> : <Eye size={18} className="text-ws-faint" aria-hidden />}
        <span className="ws-card-title">Шпаргалка</span>
        <span className="text-ws-faint num text-[0.8125rem]">осталось вопросов: {total}</span>
        <span className="ws-badge ws-badge-key ml-auto">{open ? 'скрыть ответы' : 'только для вас'}</span>
      </button>

      {open && (
        <div className="border-ws-line grid max-h-[60dvh] gap-5 overflow-y-auto border-t px-5 py-4">
          {themes.map((theme) => (
            <article key={theme.id} className="grid gap-2">
              <header>
                <h3 className="text-sm font-semibold">{theme.title}</h3>
                {theme.comment && <p className="text-ws-soft text-sm text-pretty">{theme.comment}</p>}
              </header>
              <ul className="divide-ws-line grid divide-y">
                {theme.questions.map((question) => (
                  <li key={question.questionId} className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-3 py-2">
                    <span className="num text-ws-accent-ink text-sm font-semibold">{question.price}</span>
                    <div className="grid gap-0.5 text-sm">
                      {question.type !== 'normal' && (
                        <span className="text-ws-faint text-xs font-medium">
                          {TYPE_LABEL[question.type]}
                          {question.catTheme && ` · тема «${question.catTheme}»`}
                        </span>
                      )}
                      <p className="text-ws-soft text-pretty">{question.text || 'без текста'}</p>
                      <p className="text-ws-key-ink font-semibold">
                        {question.answer}
                        {question.altAnswers.length > 0 && (
                          <span className="font-normal opacity-80"> · {question.altAnswers.join(', ')}</span>
                        )}
                      </p>
                      {question.hostComment && (
                        <p className="text-ws-faint text-pretty">{question.hostComment}</p>
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
