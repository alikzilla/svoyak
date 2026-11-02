import type { FameEntry, GameResult, RoomState } from '@svoyak/shared';

/** Итог комнаты, дошедшей до итогов. Пока игра идёт или в комнате никого —
 *  записывать нечего. */
export function resultOf(state: RoomState, now: number): GameResult | null {
  if (state.phase !== 'results' || state.players.length === 0) return null;
  return {
    id: `${state.createdAt}-${state.code}`,
    code: state.code,
    packTitle: state.pack.title,
    startedAt: state.createdAt,
    finishedAt: now,
    players: [...state.players]
      .sort((left, right) => right.score - left.score)
      .map((player) => ({ name: player.name, score: player.score })),
  };
}

/** Победители игры — как на экране итогов: лучший счёт, если он больше нуля. */
function winnersOf(result: GameResult): Set<string> {
  const best = result.players[0]?.score ?? 0;
  if (best <= 0) return new Set();
  return new Set(result.players.filter((player) => player.score === best).map((player) => player.name));
}

const nameKey = (name: string): string => name.trim().toLocaleLowerCase('ru');

/**
 * Игроки за все вечера. Одно имя — один человек, как и при входе в комнату;
 * регистр и пробелы не различаются, а показывается последнее написание.
 */
export function hallOfFame(results: GameResult[]): FameEntry[] {
  const newestFirst = [...results].sort((left, right) => right.finishedAt - left.finishedAt);
  const byName = new Map<string, FameEntry>();

  for (const result of newestFirst) {
    const winners = winnersOf(result);
    for (const player of result.players) {
      const key = nameKey(player.name);
      const entry = byName.get(key) ?? { name: player.name.trim(), games: 0, wins: 0, bestScore: player.score };
      entry.games += 1;
      if (winners.has(player.name)) entry.wins += 1;
      entry.bestScore = Math.max(entry.bestScore, player.score);
      byName.set(key, entry);
    }
  }

  return [...byName.values()].sort(
    (left, right) =>
      right.wins - left.wins ||
      right.bestScore - left.bestScore ||
      right.games - left.games ||
      left.name.localeCompare(right.name, 'ru'),
  );
}
