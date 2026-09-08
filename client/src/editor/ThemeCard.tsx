import { useState } from 'react';
import type { Question, Theme } from '@svoyak/shared';
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

const TYPE_MARK: Record<Question['type'], string> = {
  normal: '',
  cat: '🐱',
  auction: '🔨',
};

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
    <section className="grid gap-3 rounded-2xl border border-line bg-surface p-4">
      <header className="flex items-center gap-2">
        <button
          {...dragHandle}
          type="button"
          className="cursor-grab rounded-lg px-2 py-1 text-muted hover:text-ink"
          title="Перетащить тему"
        >
          ⠿
        </button>
        <input
          className="min-w-0 flex-1 rounded-xl border border-transparent bg-transparent px-2 py-1.5 text-lg font-semibold hover:border-line focus:border-gold"
          value={theme.title}
          placeholder="Название темы"
          onChange={(event) => onChange({ ...theme, title: event.target.value })}
        />
        <button
          type="button"
          onClick={onDuplicate}
          className="rounded-lg border border-line px-2 py-1 text-sm text-muted hover:border-gold hover:text-ink"
        >
          Дублировать
        </button>
        {confirmDelete ? (
          <>
            <button
              type="button"
              onClick={onDelete}
              className="rounded-lg bg-bad px-2 py-1 text-sm text-bg"
            >
              Удалить тему
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="rounded-lg border border-line px-2 py-1 text-sm text-muted"
            >
              Отмена
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="rounded-lg border border-line px-2 py-1 text-sm text-muted hover:border-bad hover:text-bad"
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
                          className="cursor-grab rounded-lg px-1.5 py-1 text-muted hover:text-ink"
                          title="Перетащить вопрос"
                        >
                          ⠿
                        </button>
                        <button
                          type="button"
                          onClick={() => setOpenId(open ? null : question.id)}
                          className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-3 py-2 text-left ${
                            incomplete ? 'border-bad/50' : 'border-line'
                          } bg-surface-2 hover:border-gold`}
                        >
                          <span className="w-14 shrink-0 text-right font-bold tabular-nums text-gold">
                            {question.price}
                          </span>
                          <span className="min-w-0 flex-1 truncate">
                            {TYPE_MARK[question.type]} {question.text || 'пустой вопрос'}
                          </span>
                          {incomplete && <span className="shrink-0 text-xs text-bad">не заполнен</span>}
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
                          className="rounded-lg border border-line px-2 py-1 text-sm text-muted hover:border-gold hover:text-ink"
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
                          className="rounded-lg border border-line px-2 py-1 text-sm text-muted hover:border-bad hover:text-bad"
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
        className="justify-self-start rounded-xl border border-dashed border-line px-3 py-2 text-sm text-muted hover:border-gold hover:text-ink"
      >
        + вопрос
      </button>
    </section>
  );
}
