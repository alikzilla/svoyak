import type { AuctionState, Player, RoomState } from '@svoyak/shared';

/** Минимальная сумма, которой можно перебить текущую ставку. */
export function minRaise(auction: AuctionState, step: number): number {
  return auction.currentBid + step;
}

/** Может ли игрок вообще участвовать: хватает ли счёта перебить лидера. */
export function canOutbid(player: Player, auction: AuctionState, step: number): boolean {
  return player.score >= minRaise(auction, step);
}

/** Порядок торгов — по кругу от того, кто открыл вопрос. */
function bidOrder(state: RoomState, fromPlayerId: string): Player[] {
  const players = state.players;
  const start = players.findIndex((player) => player.id === fromPlayerId);
  if (start < 0) return players;
  return [...players.slice(start + 1), ...players.slice(0, start + 1)];
}

export interface NextTurn {
  /** Кому ходить; null — торги закончены. */
  playerId: string | null;
  /** Кого пропустили: перебить нечем. */
  skipped: string[];
}

/** Следующий, кто может перебить лидера. Тех, кому не хватает счёта, пасуем сами. */
export function nextBidder(state: RoomState, auction: AuctionState, afterPlayerId: string): NextTurn {
  const skipped: string[] = [];
  for (const player of bidOrder(state, afterPlayerId)) {
    if (player.id === auction.leaderId) continue;
    if (auction.passedIds.includes(player.id)) continue;
    if (!player.connected) {
      skipped.push(player.id);
      continue;
    }
    if (!canOutbid(player, auction, state.settings.auctionStep)) {
      skipped.push(player.id);
      continue;
    }
    return { playerId: player.id, skipped };
  }
  return { playerId: null, skipped };
}
