/** Подсказка ведущему в финале: похож ли письменный ответ на правильный.
 *  Решает всё равно ведущий — функция только предлагает вердикт, поэтому
 *  «похоже» отделено от «совпадает»: опечатку или одну фамилию вместо
 *  полного имени стоит показать, но не засчитывать молча. */

export type AnswerMatchKind = 'exact' | 'close' | 'none';

export interface AnswerMatch {
  kind: AnswerMatchKind;
  /** Какой из принимаемых ответов совпал — как он записан в паке. */
  matched: string | null;
}

/** Регистр, ё, кавычки, знаки препинания и лишние пробелы на смысл не влияют. */
export function normalizeAnswer(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"'`„“”‘’]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Сколько опечаток прощаем: в коротком слове одна буква меняет смысл. */
function typoBudget(length: number): number {
  if (length <= 3) return 0;
  if (length <= 6) return 1;
  if (length <= 12) return 2;
  return 3;
}

function levenshtein(left: string, right: string): number {
  if (left === right) return 0;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      current[column] = Math.min(
        (previous[column] ?? 0) + 1,
        (current[column - 1] ?? 0) + 1,
        (previous[column - 1] ?? 0) + cost,
      );
    }
    previous = current;
  }
  return previous[right.length] ?? 0;
}

/** Варианты записи одного ответа: «Пушкин (А. С.)» принимается и как «Пушкин». */
function variantsOf(accepted: string): string[] {
  const full = normalizeAnswer(accepted);
  const withoutBrackets = normalizeAnswer(accepted.replace(/\([^)]*\)|\[[^\]]*\]/g, ' '));
  return [...new Set([full, withoutBrackets])].filter((variant) => variant.length > 0);
}

function isClose(given: string, variant: string): boolean {
  if (levenshtein(given, variant) <= typoBudget(variant.length)) return true;
  // «Санкт Петербург» и «Санктпетербург» — один ответ.
  if (given.replace(/ /g, '') === variant.replace(/ /g, '')) return true;

  const givenWords = given.split(' ');
  const variantWords = variant.split(' ');
  // Только фамилия из полного имени: «Коппола» при ответе «Фрэнсис Форд Коппола».
  const last = variantWords[variantWords.length - 1];
  if (variantWords.length > 1 && last !== undefined && last.length > 3 && given === last) return true;
  // Правильный ответ целиком внутри более длинной фразы: «это коппола наверное».
  return variantWords.length <= givenWords.length && ` ${given} `.includes(` ${variant} `);
}

export function matchAnswer(given: string, accepted: readonly string[]): AnswerMatch {
  const normalized = normalizeAnswer(given);
  if (normalized.length === 0) return { kind: 'none', matched: null };

  let close: string | null = null;
  for (const answer of accepted) {
    for (const variant of variantsOf(answer)) {
      if (variant === normalized) return { kind: 'exact', matched: answer };
      if (close === null && isClose(normalized, variant)) close = answer;
    }
  }
  return close === null ? { kind: 'none', matched: null } : { kind: 'close', matched: close };
}
