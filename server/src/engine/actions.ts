import type { RoomSettings, SoundId, TimerKind } from '@svoyak/shared';

/** Действия, которые понимает редьюсер. Всё, что меняет игру, проходит через них. */
export type GameAction =
  | { type: 'PLAYER_JOIN'; playerId: string; name: string; sessionToken: string; at: number }
  | { type: 'PLAYER_DISCONNECT'; playerId: string }
  | { type: 'PLAYER_KICK'; playerId: string }
  | { type: 'SET_SCORE'; playerId: string; score: number }
  | { type: 'SET_SETTINGS'; settings: Partial<RoomSettings> }
  | { type: 'HOST_PRESENCE'; connected: boolean };

/** Побочные действия: редьюсер их только описывает, исполняет RoomRuntime. */
export type Effect =
  | { type: 'persist' }
  | { type: 'sound'; sound: SoundId }
  | { type: 'toast'; to: 'host' | 'all' | { playerId: string }; text: string; tone: 'info' | 'warn' | 'error' }
  | { type: 'setTimer'; kind: TimerKind; durationMs: number; onExpire: GameAction }
  | { type: 'clearTimer' };

/** Действия, которые ведущий может отменить кнопкой «отменить». */
const UNDOABLE = new Set<GameAction['type']>(['SET_SCORE', 'PLAYER_KICK']);

export function isUndoable(action: GameAction): boolean {
  return UNDOABLE.has(action.type);
}
