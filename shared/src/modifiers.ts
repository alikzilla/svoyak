/** Клетки-модификаторы. Под такой клеткой нет вопроса: игрок открывает её,
 *  эффект срабатывает, и он выбирает следующую. */
export type ModifierKind =
  | 'flip'
  | 'jackpot'
  | 'nothing'
  | 'robbery'
  | 'double'
  | 'generosity'
  | 'hint'
  | 'swap';

/** Порядок фиксирован: по нему рисуются галочки в конструкторе. */
export const MODIFIER_KINDS: readonly ModifierKind[] = [
  'flip',
  'jackpot',
  'nothing',
  'robbery',
  'double',
  'generosity',
  'hint',
  'swap',
];

export const MODIFIER_TITLES: Record<ModifierKind, string> = {
  flip: 'Перевёртыш',
  jackpot: 'Джекпот',
  nothing: 'Пустышка',
  robbery: 'Ограбление',
  double: 'Удвоение',
  generosity: 'Щедрость',
  hint: 'Подсказка',
  swap: 'Обмен',
};

export const MODIFIER_HINTS: Record<ModifierKind, string> = {
  flip: 'твой счёт меняет знак',
  jackpot: '+2000 на счёт',
  nothing: 'ничего не происходит',
  robbery: 'отнимаешь 500 у лидера',
  double: 'твой счёт удваивается',
  generosity: 'отдаёшь по 500 каждому',
  hint: 'жетон подсказки от ведущего',
  swap: 'меняешься счётом с кем захочешь',
};

/** Ровно столько даёт джекпот и столько ходит в ограблении и щедрости. */
export const JACKPOT_AMOUNT = 2000;
export const TRANSFER_AMOUNT = 500;
