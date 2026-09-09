/** Рецепт игры: из каких тем каких паков она собрана.
 *  Комната всё равно хранит готовый пак — рецепт нужен мастеру настройки,
 *  чтобы показать состав и дать его переsobрать до старта. */

/** Ссылка на тему внутри пака. Для раундов ищется среди тем раундов,
 *  для финала — среди финальных тем. */
export interface ThemeRef {
  packId: string;
  themeId: string;
}

export interface GameRecipe {
  /** Темы по раундам: длина массива — число раундов. */
  rounds: ThemeRef[][];
  final: ThemeRef[];
}

/** Что мастер просит собрать. Seed позволяет повторить ту же случайную раскладку. */
export interface ComposeRequest {
  packIds: string[];
  rounds: number;
  themesPerRound: number;
  finalThemes: number;
  seed?: number;
}

/** Тема со своим происхождением — для превью в мастере. */
export interface ThemeOption extends ThemeRef {
  title: string;
  packTitle: string;
  questionsCount: number;
}

export interface ComposeResponse {
  recipe: GameRecipe;
  seed: number;
  /** Названия тем в том же порядке, что и в рецепте: мастеру нужно их показать. */
  rounds: ThemeOption[][];
  final: ThemeOption[];
  /** Неиспользованные темы: из них мастер берёт замену, не пересобирая всё. */
  pool: ThemeOption[];
  finalPool: ThemeOption[];
}
