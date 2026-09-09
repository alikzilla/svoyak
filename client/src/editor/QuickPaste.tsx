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
    <div className="grid gap-3 rounded-2xl border border-gold/40 bg-card p-4">
      <p className="text-sm text-ink/60">
        Одна строка — один вопрос: <code className="text-ink">цена | вопрос | ответ</code>, и
        необязательная четвёртая колонка с другими принимаемыми ответами через точку с запятой.
      </p>
      <textarea
        className="min-h-40 w-full resize-y ink-border rounded-xl bg-white/70 px-3 py-2 font-mono text-sm text-ink placeholder:text-ink/30 focus:border-p1"
        value={text}
        placeholder={EXAMPLE}
        onChange={(event) => setText(event.target.value)}
      />

      {parsed.errors.length > 0 && (
        <ul className="grid gap-1 text-sm text-no">
          {parsed.errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}

      {parsed.rows.length > 0 && (
        <div className="ink-border rounded-xl bg-white/70 p-3">
          <p className="mb-2 text-xs text-ink/60">
            Разобрано вопросов: <span className="tabular-nums text-ink">{parsed.rows.length}</span>
            {parsed.title && <> · тема «{parsed.title}»</>}
          </p>
          <ul className="grid gap-1 text-sm">
            {parsed.rows.map((row) => (
              <li key={`${row.price}-${row.text}`} className="truncate">
                <span className="tabular-nums text-p1">{row.price}</span> — {row.text} →{' '}
                <span className="text-ink/60">{row.answer}</span>
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
          className="rounded-xl bg-p4 px-4 py-2 font-bold text-bg disabled:opacity-40"
        >
          Добавить тему
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="ink-border rounded-xl px-4 py-2 text-ink/60 hover:border-p1 hover:text-ink"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}
