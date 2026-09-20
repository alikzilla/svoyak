import type { GameRecipe } from './recipe.js';
import type { ModifierKind } from './modifiers.js';

/** Сколько клеток-модификаторов класть в раунд и какие виды разрешены.
 *  Пустой `kinds` означает то же, что `perRound: 0`. */
export interface ModifierPlan {
  perRound: number;
  kinds: ModifierKind[];
}

export interface GameMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

/** Игра — это состав вечера: указатели на темы в паках плюс план модификаторов.
 *  Содержимое не копируется: единственный источник вопросов — пак. */
export interface Game extends GameMeta {
  recipe: GameRecipe;
  modifiers: ModifierPlan;
}

/** Карточка игры для списка. `missingRefs` — темы, которые больше не
 *  резолвятся: пак удалили или тему из него вырезали. */
export interface GameSummary extends GameMeta {
  roundsCount: number;
  themesCount: number;
  finalThemesCount: number;
  modifiersPerRound: number;
  missingRefs: number;
  playable: boolean;
}

export const GAME_LIMITS = {
  rounds: [1, 5],
  themesPerRound: [1, 8],
  finalThemes: [1, 8],
  modifiersPerRound: [0, 5],
} as const;

export const EMPTY_MODIFIER_PLAN: ModifierPlan = { perRound: 0, kinds: [] };
