import type { FinalState, RoomState } from '@svoyak/shared';

/** Кто допущен до финала. По умолчанию — только с положительным счётом. */
export function finalParticipants(state: RoomState): string[] {
  return state.players
    .filter((player) => !state.settings.finalRequiresPositive || player.score > 0)
    .map((player) => player.id);
}

/** Порядок в финале — от меньшего счёта к большему: так убирают темы и так вскрывают ответы. */
export function byScoreAscending(state: RoomState, playerIds: string[]): string[] {
  return [...playerIds].sort((left, right) => {
    const leftScore = state.players.find((player) => player.id === left)?.score ?? 0;
    const rightScore = state.players.find((player) => player.id === right)?.score ?? 0;
    if (leftScore !== rightScore) return leftScore - rightScore;
    return left.localeCompare(right);
  });
}

export function remainingThemes(final: FinalState) {
  return final.themes.filter((theme) => theme.removedByPlayerId === null);
}

/** Следующий, кто убирает тему: по кругу в порядке возрастания счёта. */
export function nextRemovalTurn(
  state: RoomState,
  final: FinalState,
  afterPlayerId: string,
): string | null {
  const order = byScoreAscending(state, final.participantIds);
  if (order.length === 0) return null;
  const index = order.indexOf(afterPlayerId);
  return order[(index + 1) % order.length] ?? null;
}

/** Ставка по умолчанию для того, кто не успел: минимальная. */
export const MIN_BET = 1;

export function maxBet(state: RoomState, playerId: string): number {
  const score = state.players.find((player) => player.id === playerId)?.score ?? 0;
  return Math.max(MIN_BET, score);
}
