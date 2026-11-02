/** Итог одной сыгранной игры — строка «Зала славы». */
export interface GameResult {
  /** Комната и момент её создания: одна игра — одна запись, сколько бы
   *  раз комната ни возвращалась к итогам (например, после отмены). */
  id: string;
  code: string;
  packTitle: string;
  startedAt: number;
  finishedAt: number;
  /** От большего счёта к меньшему. */
  players: Array<{ name: string; score: number }>;
}

/** Игрок за все вечера. Одно имя — один человек: так же, как в комнате. */
export interface FameEntry {
  name: string;
  games: number;
  wins: number;
  bestScore: number;
}

export interface HistoryResponse {
  /** Сначала последние. */
  evenings: GameResult[];
  /** Сначала больше побед. */
  fame: FameEntry[];
}
