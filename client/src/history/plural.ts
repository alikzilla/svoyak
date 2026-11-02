type Forms = readonly [one: string, few: string, many: string];

/** Форма слова для числа: «игра», «игры» или «игр». */
export function pluralWord(count: number, [one, few, many]: Forms): string {
  const tens = Math.abs(count) % 100;
  const units = tens % 10;
  if (tens >= 11 && tens <= 14) return many;
  if (units === 1) return one;
  return units >= 2 && units <= 4 ? few : many;
}

/** «1 игра, 2 игры, 5 игр»: число и слово в нужной форме. */
export function plural(count: number, forms: Forms): string {
  return `${count} ${pluralWord(count, forms)}`;
}
