import { useState } from 'react';
import { Cat, ChevronDown, Copy, Gavel, GripVertical, Plus, Trash2, X } from 'lucide-react';
import type { Question, Theme } from '@svoyak/shared';
import { ConfirmDelete } from '../workspace/ui.js';
import { questionsWord } from '../ui/host/GameSetup.js';
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

function blankQuestion(price: number): Question {
  return { id: crypto.randomUUID(), price, type: 'normal', text: '', answer: '', altAnswers: [] };
}

const isIncomplete = (question: Question): boolean =>
  question.text.trim() === '' || question.answer.trim() === '';

/**
 * Тема — строка табло. Свёрнутые вопросы читаются как таблица: цена, вопрос,
 * ответ. Клик раскрывает билет вопроса прямо на месте.
 */
export function ThemeCard({ packId, theme, onChange, onDuplicate, onDelete, dragHandle }: ThemeCardProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const missing = theme.questions.filter(isIncomplete).length;

  const patchQuestion = (question: Question): void => {
    onChange({
      ...theme,
      questions: theme.questions.map((candidate) => (candidate.id === question.id ? question : candidate)),
    });
  };

  const addQuestion = (): void => {
    const lastPrice = theme.questions.at(-1)?.price ?? 0;
    const step =
      theme.questions.length > 1 ? theme.questions[1]!.price - theme.questions[0]!.price || 100 : 100;
    const question = blankQuestion(lastPrice + step);
    onChange({ ...theme, questions: [...theme.questions, question] });
    setOpenId(question.id);
  };

  return (
    <section id={`theme-${theme.id}`} className="ws-card scroll-mt-20 overflow-clip">
      <header className="border-ws-line flex flex-wrap items-center gap-x-2 gap-y-1 border-b py-2 pr-3 pl-1.5">
        <button
          {...dragHandle}
          type="button"
          className="text-ws-faint hover:text-ws-fg grid size-8 cursor-grab place-items-center rounded-md active:cursor-grabbing"
          aria-label="Перетащить тему"
          title="Перетащить тему"
        >
          <GripVertical size={16} aria-hidden />
        </button>
        <label className="min-w-40 flex-1">
          <span className="sr-only">Название темы</span>
          <input
            // На телефоне название не сжимается в три буквы: кнопки уходят строкой ниже.
            className="ws-input-bare text-[1rem] font-semibold"
            value={theme.title}
            placeholder="Название темы"
            onChange={(event) => onChange({ ...theme, title: event.target.value })}
          />
        </label>
        <span className="text-ws-faint num text-[0.8125rem]">
          {theme.questions.length} {questionsWord(theme.questions.length)}
        </span>
        {missing > 0 && <span className="ws-badge ws-badge-no num">не заполнено: {missing}</span>}
        <span className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            onClick={onDuplicate}
            className="ws-btn ws-btn-ghost ws-btn-sm ws-btn-icon"
            title="Дублировать тему"
            aria-label="Дублировать тему"
          >
            <Copy aria-hidden />
          </button>
          <ConfirmDelete
            icon={<Trash2 aria-hidden />}
            title={`Удалить тему «${theme.title}»`}
            confirmLabel="Удалить тему"
            onConfirm={onDelete}
          />
        </span>
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
        <ul className="divide-ws-line grid divide-y">
          {theme.questions.map((question) => {
            const open = openId === question.id;
            const incomplete = isIncomplete(question);
            return (
              <li key={question.id}>
                <SortableRow id={question.id}>
                  {(handleProps) => (
                    <div className={open ? 'bg-ws-surface' : ''}>
                      <div className="group hover:bg-ws-hover flex items-center gap-1 py-1 pr-2 pl-1.5 transition-colors">
                        <button
                          {...handleProps}
                          type="button"
                          className="text-ws-faint hover:text-ws-fg grid size-8 shrink-0 cursor-grab place-items-center rounded-md opacity-40 group-hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing"
                          aria-label="Перетащить вопрос"
                          title="Перетащить вопрос"
                        >
                          <GripVertical size={14} aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => setOpenId(open ? null : question.id)}
                          aria-expanded={open}
                          className="flex min-h-10 min-w-0 flex-1 items-center gap-3 rounded-md px-1 text-left text-sm"
                        >
                          <span className="num text-ws-accent-ink w-11 shrink-0 text-right font-semibold">
                            {question.price}
                          </span>
                          {question.type === 'cat' && (
                            <Cat size={15} className="text-ws-soft shrink-0" aria-label="кот в мешке" />
                          )}
                          {question.type === 'auction' && (
                            <Gavel size={15} className="text-ws-soft shrink-0" aria-label="аукцион" />
                          )}
                          <span className={`min-w-0 flex-1 truncate ${question.text ? '' : 'text-ws-faint italic'}`}>
                            {question.text || 'Вопрос ещё не написан'}
                          </span>
                          <span
                            className={`hidden w-[32%] shrink-0 truncate md:block ${
                              question.answer ? 'text-ws-key-ink font-medium' : 'text-ws-faint italic'
                            }`}
                          >
                            {question.answer || 'нет ответа'}
                          </span>
                          {incomplete && (
                            <span className="bg-ws-no size-1.5 shrink-0 rounded-full" aria-label="не заполнен" />
                          )}
                          <ChevronDown
                            size={16}
                            aria-hidden
                            className={`text-ws-faint shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                          />
                        </button>
                        <button
                          type="button"
                          title="Дублировать вопрос"
                          aria-label="Дублировать вопрос"
                          onClick={() =>
                            onChange({
                              ...theme,
                              questions: [...theme.questions, { ...question, id: crypto.randomUUID() }],
                            })
                          }
                          className="ws-btn ws-btn-ghost ws-btn-sm ws-btn-icon opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-sm:opacity-100"
                        >
                          <Copy aria-hidden />
                        </button>
                        <span className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 max-sm:opacity-100">
                          <ConfirmDelete
                            icon={<X aria-hidden />}
                            title="Удалить вопрос"
                            confirmLabel="Удалить"
                            onConfirm={() =>
                              onChange({
                                ...theme,
                                questions: theme.questions.filter((candidate) => candidate.id !== question.id),
                              })
                            }
                          />
                        </span>
                      </div>
                      {open && <QuestionForm packId={packId} question={question} onChange={patchQuestion} />}
                    </div>
                  )}
                </SortableRow>
              </li>
            );
          })}
        </ul>
      </SortableList>

      <div className="border-ws-line border-t px-2 py-1.5">
        <button type="button" onClick={addQuestion} className="ws-btn ws-btn-ghost ws-btn-sm">
          <Plus aria-hidden />
          Добавить вопрос
        </button>
      </div>
    </section>
  );
}
