import { useState } from 'react';
import type { Question, Theme } from '@svoyak/shared';
import { Doodle } from '../design/Doodles.js';
import { QuestionForm } from './QuestionForm.js';
import { SortableList, SortableRow } from './Sortable.js';

interface ThemeCardProps {
  packId: string;
  theme: Theme;
  onChange: (theme: Theme) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  dragHandle: Record<string, unknown>;
}

/** Метка типа вопроса: рисованный значок вместо стокового эмодзи. */
function TypeMark({ type }: { type: Question['type'] }) {
  if (type === 'cat') return <Doodle name="cat" size={20} strokeWidth={5} fill="#ff6b57" className="shrink-0" />;
  if (type === 'auction') return <Doodle name="hammer" size={20} strokeWidth={5} fill="#f2a93b" className="shrink-0" />;
  return null;
}

function blankQuestion(price: number): Question {
  return {
    id: crypto.randomUUID(),
    price,
    type: 'normal',
    text: '',
    answer: '',
    altAnswers: [],
  };
}

export function ThemeCard({
  packId,
  theme,
  onChange,
  onDuplicate,
  onDelete,
  dragHandle,
}: ThemeCardProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const patchQuestion = (question: Question): void => {
    onChange({
      ...theme,
      questions: theme.questions.map((candidate) =>
        candidate.id === question.id ? question : candidate,
      ),
    });
  };

  const addQuestion = (): void => {
    const lastPrice = theme.questions.at(-1)?.price ?? 0;
    const step = theme.questions.length > 1
      ? (theme.questions[1]!.price - theme.questions[0]!.price) || 100
      : 100;
    const question = blankQuestion(lastPrice + step);
    onChange({ ...theme, questions: [...theme.questions, question] });
    setOpenId(question.id);
  };

  return (
    <section className="grid gap-3 rounded-2xl ink-border bg-card text-ink p-4">
      <header className="flex items-center gap-2">
        <button
          {...dragHandle}
          type="button"
          className="cursor-grab rounded-lg px-2 py-1 text-ink/60 hover:text-ink"
          title="Перетащить тему"
        >
          ⠿
        </button>
        <input
          className="min-w-0 flex-1 rounded-xl border-4 border-transparent bg-transparent px-2 py-1.5 text-lg font-semibold hover:border-ink/30 focus:border-p1"
          value={theme.title}
          placeholder="Название темы"
          onChange={(event) => onChange({ ...theme, title: event.target.value })}
        />
        <button
          type="button"
          onClick={onDuplicate}
          className="ink-border rounded-lg px-2 py-1 text-sm text-ink/60 hover:border-p1 hover:text-ink"
        >
          Дублировать
        </button>
        {confirmDelete ? (
          <>
            <button
              type="button"
              onClick={onDelete}
              className="rounded-lg bg-no px-2 py-1 text-sm text-bg"
            >
              Удалить тему
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="ink-border rounded-lg px-2 py-1 text-sm text-ink/60"
            >
              Отмена
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="ink-border rounded-lg px-2 py-1 text-sm text-ink/60 hover:border-no hover:text-no"
          >
            Удалить
          </button>
        )}
      </header>

      <SortableList
        ids={theme.questions.map((question) => question.id)}
        onReorder={(ids) =>
          onChange({
            ...theme,
            questions: ids
              .map((id) => theme.questions.find((question) => question.id === id))
              .filter((question): question is Question => question !== undefined),
          })
        }
      >
        <ul className="grid gap-2">
          {theme.questions.map((question) => {
            const open = openId === question.id;
            const incomplete = question.text.trim() === '' || question.answer.trim() === '';
            return (
              <li key={question.id}>
                <SortableRow id={question.id}>
                  {(handleProps) => (
                    <div className="grid gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          {...handleProps}
                          type="button"
                          className="cursor-grab rounded-lg px-1.5 py-1 text-ink/60 hover:text-ink"
                          title="Перетащить вопрос"
                        >
                          ⠿
                        </button>
                        <button
                          type="button"
                          onClick={() => setOpenId(open ? null : question.id)}
                          className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-3 py-2 text-left ${
                            incomplete ? 'border-no/50' : 'border-ink'
                          } bg-card hover:border-p1`}
                        >
                          <span className="w-14 shrink-0 text-right font-bold tabular-nums text-p1">
                            {question.price}
                          </span>
                          <TypeMark type={question.type} />
                          <span className="min-w-0 flex-1 truncate">
                            {question.text || 'пустой вопрос'}
                          </span>
                          {incomplete && <span className="shrink-0 text-xs text-no">не заполнен</span>}
                        </button>
                        <button
                          type="button"
                          title="Дублировать вопрос"
                          onClick={() =>
                            onChange({
                              ...theme,
                              questions: [
                                ...theme.questions,
                                { ...question, id: crypto.randomUUID() },
                              ],
                            })
                          }
                          className="ink-border rounded-lg px-2 py-1 text-sm text-ink/60 hover:border-p1 hover:text-ink"
                        >
                          ⧉
                        </button>
                        <button
                          type="button"
                          title="Удалить вопрос"
                          onClick={() =>
                            onChange({
                              ...theme,
                              questions: theme.questions.filter(
                                (candidate) => candidate.id !== question.id,
                              ),
                            })
                          }
                          className="ink-border rounded-lg px-2 py-1 text-sm text-ink/60 hover:border-no hover:text-no"
                        >
                          ✕
                        </button>
                      </div>
                      {open && (
                        <QuestionForm packId={packId} question={question} onChange={patchQuestion} />
                      )}
                    </div>
                  )}
                </SortableRow>
              </li>
            );
          })}
        </ul>
      </SortableList>

      <button
        type="button"
        onClick={addQuestion}
        className="justify-self-start rounded-xl border border-dashed border-ink px-3 py-2 text-sm text-ink/60 hover:border-p1 hover:text-ink"
      >
        + вопрос
      </button>
    </section>
  );
}
