import { useState } from 'react';
import { ChevronRight, ClipboardPaste, Plus, Trash2, X } from 'lucide-react';
import type { FinalTheme, Pack, PackIssue, ParsedRow, Round, Theme } from '@svoyak/shared';
import { ConfirmDelete, EmptyState } from '../workspace/ui.js';
import { questionsWord, themesWord } from '../ui/host/GameSetup.js';
import { AltAnswersField } from './AltAnswersField.js';
import { QuickPaste } from './QuickPaste.js';
import { SortableList, SortableRow } from './Sortable.js';
import { ThemeCard } from './ThemeCard.js';

interface PackEditorProps {
  pack: Pack;
  issues: PackIssue[];
  onChange: (pack: Pack) => void;
}

const PRICES = [100, 200, 300, 400, 500];

function blankTheme(multiplier: number): Theme {
  return {
    id: crypto.randomUUID(),
    title: 'Новая тема',
    questions: PRICES.map((price) => ({
      id: crypto.randomUUID(),
      price: price * multiplier,
      type: 'normal' as const,
      text: '',
      answer: '',
      altAnswers: [],
    })),
  };
}

/** Копия темы или вопроса должна получить новые идентификаторы, иначе доска запутается. */
function cloneTheme(theme: Theme): Theme {
  return {
    ...theme,
    id: crypto.randomUUID(),
    title: `${theme.title} (копия)`,
    questions: theme.questions.map((question) => ({ ...question, id: crypto.randomUUID() })),
  };
}

const incompleteCount = (theme: Theme): number =>
  theme.questions.filter((question) => question.text.trim() === '' || question.answer.trim() === '').length;

/** Плавный переход к теме из оглавления; при «спокойном» режиме — сразу. */
function jumpTo(id: string): void {
  const target = document.getElementById(id);
  if (!target) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

export function PackEditor({ pack, issues, onChange }: PackEditorProps) {
  const [pasteInto, setPasteInto] = useState<string | null>(null);

  const patchRound = (roundId: string, patch: (round: Round) => Round): void => {
    onChange({
      ...pack,
      rounds: pack.rounds.map((round) => (round.id === roundId ? patch(round) : round)),
    });
  };

  const addRound = (): void => {
    const index = pack.rounds.length;
    const round: Round = { id: crypto.randomUUID(), title: `Раунд ${index + 1}`, themes: [blankTheme(index + 1)] };
    onChange({ ...pack, rounds: [...pack.rounds, round] });
    requestAnimationFrame(() => jumpTo(`round-${round.id}`));
  };

  const addTheme = (round: Round): void => {
    const theme = blankTheme(pack.rounds.indexOf(round) + 1);
    patchRound(round.id, (current) => ({ ...current, themes: [...current.themes, theme] }));
    requestAnimationFrame(() => jumpTo(`theme-${theme.id}`));
  };

  const applyPaste = (roundId: string, title: string | null, rows: ParsedRow[]): void => {
    const theme: Theme = {
      id: crypto.randomUUID(),
      title: title ?? 'Новая тема',
      questions: rows.map((row) => ({
        id: crypto.randomUUID(),
        price: row.price,
        type: 'normal' as const,
        text: row.text,
        answer: row.answer,
        altAnswers: row.altAnswers,
      })),
    };
    patchRound(roundId, (round) => ({ ...round, themes: [...round.themes, theme] }));
    setPasteInto(null);
  };

  const patchFinal = (themeId: string, patch: (theme: FinalTheme) => FinalTheme): void =>
    onChange({
      ...pack,
      final: { themes: pack.final.themes.map((item) => (item.id === themeId ? patch(item) : item)) },
    });

  const errors = issues.filter((issue) => issue.level === 'error');
  const warnings = issues.filter((issue) => issue.level === 'warning');
  const themesWithErrors = new Set(errors.map((issue) => issue.path.themeId).filter(Boolean));

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
      {/* Оглавление: весь пак на виду, недописанное отмечено. */}
      <nav aria-label="Содержание пака" className="hidden text-sm lg:sticky lg:top-20 lg:grid lg:gap-4">
        {pack.rounds.map((round) => (
          <div key={round.id} className="grid gap-0.5">
            <button
              type="button"
              onClick={() => jumpTo(`round-${round.id}`)}
              className="text-ws-faint hover:text-ws-fg px-2 py-1 text-left text-xs font-semibold tracking-wide"
            >
              {round.title || 'Раунд без названия'}
            </button>
            {round.themes.map((theme) => {
              const missing = incompleteCount(theme);
              const broken = themesWithErrors.has(theme.id);
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => jumpTo(`theme-${theme.id}`)}
                  className="text-ws-soft hover:bg-ws-sunken hover:text-ws-fg flex items-center gap-2 rounded-md px-2 py-1.5 text-left"
                >
                  <span className="min-w-0 flex-1 truncate">{theme.title || 'Тема без названия'}</span>
                  {missing > 0 || broken ? (
                    <span
                      className="bg-ws-no size-1.5 shrink-0 rounded-full"
                      title={`Не заполнено вопросов: ${missing}`}
                      aria-label="есть незаполненные вопросы"
                    />
                  ) : (
                    <span className="text-ws-faint num text-xs">{theme.questions.length}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
        <button
          type="button"
          onClick={() => jumpTo('final')}
          className="text-ws-faint hover:text-ws-fg px-2 py-1 text-left text-xs font-semibold tracking-wide"
        >
          Финал · <span className="num">{pack.final.themes.length}</span>
        </button>
      </nav>

      <div className="grid min-w-0 gap-10">
        {(errors.length > 0 || warnings.length > 0) && (
          <details className="ws-card ws-disclosure" open={errors.length > 0}>
            <summary className="px-5 py-3.5">
              <ChevronRight size={18} className="ws-chevron text-ws-faint" aria-hidden />
              <span className="ws-card-title">Проверка пака</span>
              {errors.length > 0 && <span className="ws-badge ws-badge-no num">ошибок: {errors.length}</span>}
              {warnings.length > 0 && (
                <span className="ws-badge ws-badge-warn num">предупреждений: {warnings.length}</span>
              )}
            </summary>
            <div className="border-ws-line grid gap-2 border-t px-5 py-3">
              {errors.length > 0 && (
                <p className="text-ws-soft text-sm">Пока есть ошибки, на этом паке нельзя создать комнату.</p>
              )}
              <ul className="grid max-h-48 gap-1 overflow-y-auto text-sm">
                {[...errors, ...warnings].slice(0, 40).map((issue, index) => (
                  <li key={`${issue.message}-${index}`} className="flex items-start gap-2">
                    <span
                      aria-hidden
                      className={`mt-2 size-1.5 shrink-0 rounded-full ${issue.level === 'error' ? 'bg-ws-no' : 'bg-ws-warn-ink'}`}
                    />
                    {issue.path.themeId ? (
                      <button
                        type="button"
                        onClick={() => jumpTo(`theme-${issue.path.themeId}`)}
                        className={`text-left underline-offset-2 hover:underline ${issue.level === 'error' ? 'text-ws-no-ink' : 'text-ws-soft'}`}
                      >
                        {issue.message}
                      </button>
                    ) : (
                      <span className={issue.level === 'error' ? 'text-ws-no-ink' : 'text-ws-soft'}>{issue.message}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </details>
        )}

        {pack.rounds.map((round, roundIndex) => {
          const questionCount = round.themes.reduce((sum, theme) => sum + theme.questions.length, 0);
          return (
            <section key={round.id} id={`round-${round.id}`} className="grid scroll-mt-20 gap-4">
              <header className="border-ws-line flex flex-wrap items-center gap-x-3 gap-y-2 border-b pb-3">
                <label className="min-w-48 flex-1">
                  <span className="sr-only">Название раунда</span>
                  <input
                    className="ws-input-bare text-[1.25rem] font-semibold tracking-tight"
                    value={round.title}
                    placeholder={`Раунд ${roundIndex + 1}`}
                    onChange={(event) =>
                      patchRound(round.id, (current) => ({ ...current, title: event.target.value }))
                    }
                  />
                </label>
                <span className="text-ws-faint num text-[0.8125rem]">
                  {round.themes.length} {themesWord(round.themes.length)} · {questionCount}{' '}
                  {questionsWord(questionCount)}
                </span>
                <span className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPasteInto(pasteInto === round.id ? null : round.id)}
                    aria-expanded={pasteInto === round.id}
                    className="ws-btn ws-btn-ghost ws-btn-sm"
                  >
                    <ClipboardPaste aria-hidden />
                    Вставить текстом
                  </button>
                  <button type="button" onClick={() => addTheme(round)} className="ws-btn ws-btn-sm">
                    <Plus aria-hidden />
                    Тема
                  </button>
                  {pack.rounds.length > 1 && (
                    <ConfirmDelete
                      icon={<Trash2 aria-hidden />}
                      title={`Удалить раунд «${round.title}»`}
                      confirmLabel="Удалить раунд"
                      onConfirm={() =>
                        onChange({ ...pack, rounds: pack.rounds.filter((item) => item.id !== round.id) })
                      }
                    />
                  )}
                </span>
              </header>

              {pasteInto === round.id && (
                <QuickPaste
                  onApply={(title, rows) => applyPaste(round.id, title, rows)}
                  onCancel={() => setPasteInto(null)}
                />
              )}

              {round.themes.length === 0 ? (
                <EmptyState
                  title="В раунде пока нет тем"
                  action={
                    <button type="button" onClick={() => addTheme(round)} className="ws-btn ws-btn-primary">
                      <Plus aria-hidden />
                      Добавить тему
                    </button>
                  }
                >
                  Тема — это строка табло: обычно пять вопросов по нарастающей цене.
                </EmptyState>
              ) : (
                <SortableList
                  ids={round.themes.map((theme) => theme.id)}
                  onReorder={(ids) =>
                    patchRound(round.id, (current) => ({
                      ...current,
                      themes: ids
                        .map((id) => current.themes.find((theme) => theme.id === id))
                        .filter((theme): theme is Theme => theme !== undefined),
                    }))
                  }
                >
                  <div className="grid gap-4">
                    {round.themes.map((theme) => (
                      <SortableRow key={theme.id} id={theme.id}>
                        {(handleProps) => (
                          <ThemeCard
                            packId={pack.id}
                            theme={theme}
                            dragHandle={handleProps}
                            onChange={(next) =>
                              patchRound(round.id, (current) => ({
                                ...current,
                                themes: current.themes.map((item) => (item.id === next.id ? next : item)),
                              }))
                            }
                            onDuplicate={() =>
                              patchRound(round.id, (current) => ({
                                ...current,
                                themes: [...current.themes, cloneTheme(theme)],
                              }))
                            }
                            onDelete={() =>
                              patchRound(round.id, (current) => ({
                                ...current,
                                themes: current.themes.filter((item) => item.id !== theme.id),
                              }))
                            }
                          />
                        )}
                      </SortableRow>
                    ))}
                  </div>
                </SortableList>
              )}
            </section>
          );
        })}

        <button
          type="button"
          onClick={addRound}
          className="border-ws-line-strong text-ws-soft hover:border-ws-accent hover:bg-ws-accent-soft hover:text-ws-accent-ink -mt-4 flex h-12 items-center justify-center gap-2 rounded-xl border border-dashed text-sm font-medium transition-colors"
        >
          <Plus size={16} aria-hidden />
          Добавить раунд
        </button>

        <section id="final" className="grid scroll-mt-20 gap-4">
          <header className="border-ws-line grid gap-1 border-b pb-3">
            <h2 className="text-[1.25rem] font-semibold tracking-tight">Финал</h2>
            <p className="text-ws-soft text-sm">
              Игроки по очереди убирают темы, пока не останется одна; затем ставят и пишут ответ. Цен
              здесь нет.
            </p>
          </header>

          {pack.final.themes.map((theme) => (
            <article key={theme.id} className="ws-ticket" style={{ boxShadow: 'var(--ws-shadow-1)' }}>
              <div className="grid gap-3 p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <label className="min-w-0 flex-1">
                    <span className="sr-only">Название финальной темы</span>
                    <input
                      className="ws-input-bare font-semibold"
                      value={theme.title}
                      placeholder="Название темы"
                      onChange={(event) => patchFinal(theme.id, (item) => ({ ...item, title: event.target.value }))}
                    />
                  </label>
                  <ConfirmDelete
                    icon={<X aria-hidden />}
                    title={`Удалить финальную тему «${theme.title}»`}
                    confirmLabel="Удалить тему"
                    onConfirm={() =>
                      onChange({ ...pack, final: { themes: pack.final.themes.filter((item) => item.id !== theme.id) } })
                    }
                  />
                </div>
                <label className="grid gap-1.5">
                  <span className="ws-label">Вопрос</span>
                  <textarea
                    className="ws-input min-h-20"
                    value={theme.question.text}
                    placeholder="Текст, который прочитает ведущий"
                    onChange={(event) =>
                      patchFinal(theme.id, (item) => ({ ...item, question: { ...item.question, text: event.target.value } }))
                    }
                  />
                </label>
              </div>
              <div className="ws-tear" aria-hidden />
              <div className="ws-key grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
                <label className="grid gap-1.5">
                  <span className="ws-key-label">Ответ</span>
                  <input
                    className="ws-input"
                    value={theme.question.answer}
                    placeholder="Правильный ответ"
                    onChange={(event) =>
                      patchFinal(theme.id, (item) => ({ ...item, question: { ...item.question, answer: event.target.value } }))
                    }
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="ws-key-label">Также принимаются</span>
                  <AltAnswersField
                    value={theme.question.altAnswers}
                    placeholder="через точку с запятой"
                    onChange={(altAnswers) =>
                      patchFinal(theme.id, (item) => ({ ...item, question: { ...item.question, altAnswers } }))
                    }
                  />
                </label>
              </div>
            </article>
          ))}

          <button
            type="button"
            onClick={() =>
              onChange({
                ...pack,
                final: {
                  themes: [
                    ...pack.final.themes,
                    {
                      id: crypto.randomUUID(),
                      title: 'Новая тема',
                      question: { id: crypto.randomUUID(), text: '', answer: '', altAnswers: [] },
                    },
                  ],
                },
              })
            }
            className="border-ws-line-strong text-ws-soft hover:border-ws-accent hover:bg-ws-accent-soft hover:text-ws-accent-ink flex h-12 items-center justify-center gap-2 rounded-xl border border-dashed text-sm font-medium transition-colors"
          >
            <Plus size={16} aria-hidden />
            Добавить финальную тему
          </button>
        </section>
      </div>
    </div>
  );
}
