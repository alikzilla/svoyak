import { describe, it, expect } from 'vitest';
import type { BoardTheme, BoardThemeView } from './state.js';

/** Настоящая проверка здесь — не в expect() ниже, а в строке
 *  `@ts-expect-error`: директива и есть тест. `BoardThemeView`/`BoardCellView`
 *  объявляют секретное поле `modifier` как `never`, а не просто убирают его
 *  через `Omit` (тот пропускал бы любой источник, структурно всё ещё
 *  несущий `modifier`, — ровно та регрессия, которую эта проверка обязана
 *  ловить). Если кто-то когда-нибудь ослабит типы назад до `Omit` или
 *  иначе вернёт `modifier` в форму `BoardThemeView`, присваивание ниже
 *  станет законным, директива — неиспользуемой, и `tsc --noEmit` упадёт с
 *  «Unused '@ts-expect-error' directive» в гейте typecheck, раньше любого
 *  ручного ревью. Функция никогда не вызывается — она существует только
 *  для компилятора, не для рантайма. */
function assertBoardSecretCannotLeak(raw: BoardTheme[]): void {
  // @ts-expect-error `modifier` (ModifierKind) не влезает в `never` — секрет доски не должен структурно проходить в проекцию.
  const leaked: BoardThemeView[] = raw;
  void leaked;
}
void assertBoardSecretCannotLeak;

describe('секрет доски — типовая гарантия', () => {
  it('проверяется компилятором, не рантаймом — см. ts-expect-error в этом файле', () => {
    // Раннеру нужен хотя бы один it(); сама проверка — директива на
    // строке 16, над assertBoardSecretCannotLeak(): typecheck упадёт, если
    // присваивание там когда-нибудь станет законным. Важно: эта строка не
    // должна САМА начинаться с "// @ts-expect-error" — иначе tsc посчитает
    // её отдельной, ничего не подавляющей директивой и провалит typecheck
    // с «Unused '@ts-expect-error' directive» — ровно так это и всплыло.
    expect(true).toBe(true);
  });
});
