export interface ParsedRow {
  price: number;
  text: string;
  answer: string;
  altAnswers: string[];
}

export interface ParsedTheme {
  title: string | null;
  rows: ParsedRow[];
  errors: string[];
}

/** Строка «Тема: Название» задаёт заголовок, остальные — вопросы. */
const TITLE_PREFIX = /^\s*тема\s*:\s*/i;
/** Колонки разделяются вертикальной чертой или табуляцией. */
const SPLIT = /\s*[|\t]\s*/;

/**
 * Разбирает тему, вставленную одним куском текста:
 *
 *     Тема: Кино
 *     100 | вопрос | ответ
 *     200 | вопрос | ответ | альтернатива; ещё одна
 */
export function parseThemeText(text: string): ParsedTheme {
  const rows: ParsedRow[] = [];
  const errors: string[] = [];
  let title: string | null = null;

  const lines = text.split(/\r?\n/);
  for (const [index, rawLine] of lines.entries()) {
    const line = rawLine.trim();
    const lineNumber = index + 1;
    if (line === '') continue;

    if (TITLE_PREFIX.test(line)) {
      const parsed = line.replace(TITLE_PREFIX, '').trim();
      if (parsed !== '') title = parsed;
      continue;
    }

    const parts = line.split(SPLIT);
    if (parts.length < 3) {
      errors.push(`Строка ${lineNumber}: нужны цена, вопрос и ответ через «|»`);
      continue;
    }

    const [rawPrice = '', questionText = '', answer = '', rawAlts = ''] = parts;
    const price = Number(rawPrice.replace(/\s/g, ''));
    if (!Number.isFinite(price) || price <= 0) {
      errors.push(`Строка ${lineNumber}: цена должна быть положительным числом`);
      continue;
    }
    if (questionText.trim() === '') {
      errors.push(`Строка ${lineNumber}: пустой текст вопроса`);
      continue;
    }
    if (answer.trim() === '') {
      errors.push(`Строка ${lineNumber}: пустой ответ`);
      continue;
    }

    rows.push({
      price,
      text: questionText.trim(),
      answer: answer.trim(),
      altAnswers: rawAlts
        .split(';')
        .map((alt) => alt.trim())
        .filter((alt) => alt !== ''),
    });
  }

  return { title, rows, errors };
}
