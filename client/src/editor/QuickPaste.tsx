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
    <div className="on-paper border-gold bg-card text-ink relative grid gap-3 rounded-2xl border-4 p-4">
      <p className="text-soft font-body text-sm font-bold">
        Одна строка — один вопрос: <code className="text-ink">цена | вопрос | ответ</code>, и
        необязательная четвёртая колонка с другими принимаемыми ответами через точку с запятой.
      </p>
      <textarea
        className="field min-h-40 resize-y font-mono text-sm"
        value={text}
        placeholder={EXAMPLE}
        onChange={(event) => setText(event.target.value)}
      />

      {parsed.errors.length > 0 && (
        <ul role="alert" className="text-no-ink grid gap-1 text-sm font-bold">
          {parsed.errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}

      {parsed.rows.length > 0 && (
        <div className="ink-border bg-paper rounded-xl p-3">
          <p className="text-soft mb-2 text-xs font-bold">
            Разобрано вопросов: <span className="tabular-nums text-ink">{parsed.rows.length}</span>
            {parsed.title && <> · тема «{parsed.title}»</>}
          </p>
          <ul className="grid gap-1 text-sm">
            {parsed.rows.map((row) => (
              <li key={`${row.price}-${row.text}`} className="truncate">
                <span className="tabular-nums text-p1-ink">{row.price}</span> — {row.text} →{' '}
                <span className="text-soft">{row.answer}</span>
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
          className="btn bg-p4 font-body"
        >
          Добавить тему
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="btn font-body"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}
