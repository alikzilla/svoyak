export interface RoomSettings {
  /** Время на чтение вопроса до открытия кнопки. */
  readingTimeMs: number;
  /** Сколько всего времени кнопка открыта на вопрос. */
  buzzOpenMs: number;
  /** Окно сбора нажатий: победителя выбираем по метке времени, а не по приходу пакета. */
  buzzGraceMs: number;
  /** Блокировка игрока за фальстарт в пределах вопроса. */
  falseStartLockMs: number;
  /** Время на устный ответ после нажатия. */
  answerTimeMs: number;
  /** Время на ответ у получателя кота и победителя аукциона. */
  soloAnswerTimeMs: number;
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
  readingTimeMs: 3000,
  buzzOpenMs: 8000,
  buzzGraceMs: 150,
  falseStartLockMs: 2500,
  answerTimeMs: 10000,
  soloAnswerTimeMs: 20000,
  finalBetTimeMs: 60000,
  finalAnswerTimeMs: 60000,
  penaltyOnWrong: true,
  allowNegative: true,
  finalRequiresPositive: true,
  auctionStep: 100,
};
