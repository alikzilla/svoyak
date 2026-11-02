import { useState } from 'react';
import { parseThemeText, type ParsedRow } from '@svoyak/shared';

interface QuickPasteProps {
  onApply: (title: string | null, rows: ParsedRow[]) => void;
  onCancel: () => void;
}

const EXAMPLE = `Тема: Кино
100 | Кто снял «Крёстного отца»? | Фрэнсис Форд Коппола | Коппола
200 | Какого цвета таблетку глотает Нео? | Красную`;

/** Вставка темы целиком: быстрее, чем заполнять пять форм руками. */
export function QuickPaste({ onApply, onCancel }: QuickPasteProps) {
  const [text, setText] = useState('');
  const parsed = parseThemeText(text);

  return (
    <section className="ws-card grid gap-4 p-4 sm:p-5">
      <div className="grid gap-1">
        <h3 className="text-[0.9375rem] font-semibold">Вставить тему текстом</h3>
        <p className="text-ws-soft text-sm">
          Одна строка — один вопрос:{' '}
          <code className="bg-ws-sunken text-ws-fg rounded px-1 py-0.5 text-[0.8125rem]">цена | вопрос | ответ</code>.
          Четвёртая колонка необязательна — другие принимаемые ответы через точку с запятой. Первая
          строка «Тема: …» задаёт название.
        </p>
      </div>
      <textarea
        className="ws-input min-h-40 font-mono text-[0.8125rem]"
        value={text}
        placeholder={EXAMPLE}
        onChange={(event) => setText(event.target.value)}
      />

      {parsed.errors.length > 0 && (
        <ul role="alert" className="text-ws-no-ink grid gap-1 text-sm">
          {parsed.errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}

      {parsed.rows.length > 0 && (
        <div className="bg-ws-sunken rounded-lg px-4 py-3">
          <p className="text-ws-soft mb-2 text-[0.8125rem]">
            Разобрано вопросов: <span className="num text-ws-fg font-semibold">{parsed.rows.length}</span>
            {parsed.title && <> · тема «{parsed.title}»</>}
          </p>
          <ul className="grid gap-1 text-sm">
            {parsed.rows.map((row) => (
              <li key={`${row.price}-${row.text}`} className="flex min-w-0 gap-3">
                <span className="num text-ws-accent-ink w-10 shrink-0 text-right font-semibold">{row.price}</span>
                <span className="min-w-0 flex-1 truncate">{row.text}</span>
                <span className="text-ws-key-ink w-1/3 shrink-0 truncate font-medium">{row.answer}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={parsed.rows.length === 0}
          onClick={() => onApply(parsed.title, parsed.rows)}
          className="ws-btn ws-btn-primary"
        >
          Добавить тему
        </button>
        <button type="button" onClick={onCancel} className="ws-btn ws-btn-ghost">
          Отмена
        </button>
      </div>
    </section>
  );
}
