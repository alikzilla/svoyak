import { useState } from 'react';
import type { Pack, PackIssue, ParsedRow, Round, Theme } from '@svoyak/shared';
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
    onChange({
      ...pack,
      rounds: [
        ...pack.rounds,
        {
          id: crypto.randomUUID(),
          title: `Раунд ${index + 1}`,
          themes: [blankTheme(index + 1)],
        },
      ],
    });
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

  const errors = issues.filter((issue) => issue.level === 'error');
  const warnings = issues.filter((issue) => issue.level === 'warning');

  return (
    <div className="grid gap-6">
      {(errors.length > 0 || warnings.length > 0) && (
        <section className="grid gap-2 rounded-2xl border border-line bg-surface p-4">
          <h2 className="text-sm text-muted">
            Проверка пака: <span className="text-bad tabular-nums">{errors.length}</span> ошибок,{' '}
            <span className="text-gold tabular-nums">{warnings.length}</span> предупреждений
          </h2>
          <ul className="grid max-h-40 gap-1 overflow-y-auto text-sm">
            {[...errors, ...warnings].slice(0, 30).map((issue, index) => (
              <li key={`${issue.message}-${index}`} className={issue.level === 'error' ? 'text-bad' : 'text-muted'}>
                {issue.message}
              </li>
            ))}
          </ul>
          {errors.length > 0 && (
            <p className="text-xs text-muted">Пока есть ошибки, комнату на этом паке создать нельзя.</p>
          )}
        </section>
      )}

      {pack.rounds.map((round) => (
        <section key={round.id} className="grid gap-3">
          <header className="flex flex-wrap items-center gap-2">
            <input
              className="min-w-0 flex-1 rounded-xl border border-transparent bg-transparent px-2 py-1.5 text-xl font-bold hover:border-line focus:border-gold"
              value={round.title}
              onChange={(event) =>
                patchRound(round.id, (current) => ({ ...current, title: event.target.value }))
              }
            />
            <button
              type="button"
              onClick={() => setPasteInto(pasteInto === round.id ? null : round.id)}
              className="rounded-xl border border-line px-3 py-1.5 text-sm hover:border-gold"
            >
              Вставить тему текстом
            </button>
            <button
              type="button"
              onClick={() =>
                patchRound(round.id, (current) => ({
                  ...current,
                  themes: [...current.themes, blankTheme(pack.rounds.indexOf(round) + 1)],
                }))
              }
              className="rounded-xl border border-line px-3 py-1.5 text-sm hover:border-gold"
            >
              + тема
            </button>
            {pack.rounds.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  onChange({ ...pack, rounds: pack.rounds.filter((item) => item.id !== round.id) })
                }
                className="rounded-xl border border-line px-3 py-1.5 text-sm text-muted hover:border-bad hover:text-bad"
              >
                Удалить раунд
              </button>
            )}
          </header>

          {pasteInto === round.id && (
            <QuickPaste
              onApply={(title, rows) => applyPaste(round.id, title, rows)}
              onCancel={() => setPasteInto(null)}
            />
          )}

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
            <div className="grid gap-3">
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
        </section>
      ))}

      <button
        type="button"
        onClick={addRound}
        className="justify-self-start rounded-xl border border-dashed border-line px-4 py-2 text-muted hover:border-gold hover:text-ink"
      >
        + раунд
      </button>

      <section className="grid gap-3">
        <h2 className="text-xl font-bold">Финал</h2>
        <p className="text-sm text-muted">
          Игроки по очереди убирают темы, пока не останется одна. Цен здесь нет.
        </p>
        {pack.final.themes.map((theme) => (
          <div key={theme.id} className="grid gap-2 rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-center gap-2">
              <input
                className="min-w-0 flex-1 rounded-xl border border-transparent bg-transparent px-2 py-1.5 font-semibold hover:border-line focus:border-gold"
                value={theme.title}
                placeholder="Название темы"
                onChange={(event) =>
                  onChange({
                    ...pack,
                    final: {
                      themes: pack.final.themes.map((item) =>
                        item.id === theme.id ? { ...item, title: event.target.value } : item,
                      ),
                    },
                  })
                }
              />
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...pack,
                    final: { themes: pack.final.themes.filter((item) => item.id !== theme.id) },
                  })
                }
                className="rounded-lg border border-line px-2 py-1 text-sm text-muted hover:border-bad hover:text-bad"
              >
                ✕
              </button>
            </div>
            <textarea
              className="min-h-16 w-full resize-y rounded-xl border border-line bg-bg px-3 py-2 focus:border-gold"
              value={theme.question.text}
              placeholder="Вопрос"
              onChange={(event) =>
                onChange({
                  ...pack,
                  final: {
                    themes: pack.final.themes.map((item) =>
                      item.id === theme.id
                        ? { ...item, question: { ...item.question, text: event.target.value } }
                        : item,
                    ),
                  },
                })
              }
            />
            <input
              className="w-full rounded-xl border border-line bg-bg px-3 py-2 focus:border-gold"
              value={theme.question.answer}
              placeholder="Ответ"
              onChange={(event) =>
                onChange({
                  ...pack,
                  final: {
                    themes: pack.final.themes.map((item) =>
                      item.id === theme.id
                        ? { ...item, question: { ...item.question, answer: event.target.value } }
                        : item,
                    ),
                  },
                })
              }
            />
          </div>
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
          className="justify-self-start rounded-xl border border-dashed border-line px-4 py-2 text-muted hover:border-gold hover:text-ink"
        >
          + финальная тема
        </button>
      </section>
    </div>
  );
}
