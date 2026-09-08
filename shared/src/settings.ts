export interface RoomSettings {
  /** Сколько всего времени кнопка открыта на вопрос. */
  buzzOpenMs: number;
  /** Окно сбора нажатий: победителя выбираем по метке времени, а не по приходу пакета. */
  buzzGraceMs: number;
  /** Сколько времени на нажатие достаётся остальным после чужого неверного ответа,
   *  даже если общий бюджет уже вышел. Вопрос не должен пропадать, пока не попробовали все. */
  buzzReopenMinMs: number;
  /** Блокировка игрока за фальстарт в пределах вопроса. */
  falseStartLockMs: number;
  finalBetTimeMs: number;
  finalAnswerTimeMs: number;
  /** Снимать ли стоимость за неверный ответ. */
  penaltyOnWrong: boolean;
  /** Разрешать ли счёту уходить в минус. */
  allowNegative: boolean;
  /** Пускать в финал только игроков с положительным счётом. */
  finalRequiresPositive: boolean;
  /** Минимальный шаг повышения ставки на аукционе. */
  auctionStep: number;
}

export const DEFAULT_SETTINGS: RoomSettings = {
  buzzOpenMs: 8000,
  buzzGraceMs: 150,
  buzzReopenMinMs: 3000,
  falseStartLockMs: 2500,
  finalBetTimeMs: 60000,
  finalAnswerTimeMs: 60000,
  penaltyOnWrong: true,
  allowNegative: true,
  finalRequiresPositive: true,
  auctionStep: 100,
};
