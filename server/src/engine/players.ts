import type { Player, RoomState } from '@svoyak/shared';

export function findPlayer(state: RoomState, playerId: string): Player | undefined {
  return state.players.find((player) => player.id === playerId);
}

export function findByToken(state: RoomState, token: string): Player | undefined {
  return state.players.find((player) => player.sessionToken === token);
}

export function findByName(state: RoomState, name: string): Player | undefined {
  const normalized = name.trim().toLowerCase();
  return state.players.find((player) => player.name.trim().toLowerCase() === normalized);
}

/** Изменение счёта с учётом запрета уходить в минус. */
export function applyDelta(score: number, delta: number, allowNegative: boolean): number {
  const next = score + delta;
  return allowNegative ? next : Math.max(0, next);
}

/** Возвращает новый список игроков с изменённым одним игроком. */
export function updatePlayer(
  players: Player[],
  playerId: string,
  patch: (player: Player) => Player,
): Player[] {
  return players.map((player) => (player.id === playerId ? patch(player) : player));
}
