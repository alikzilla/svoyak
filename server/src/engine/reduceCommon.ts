/** Общее для обработчиков редьюсера: результат, отказ, журнал. */
import type { LogEntry, RoomState } from '@svoyak/shared';
import type { Effect, GameAction } from './actions.js';

/** Действие конкретного типа: обработчик получает уже суженный тип. */
export type ActionOf<T extends GameAction['type']> = Extract<GameAction, { type: T }>;

export interface ReduceResult {
  state: RoomState;
  effects: Effect[];
  /** Заполнено, если действие отклонено. Состояние при этом не менялось. */
  error?: string;
}

const MAX_LOG = 200;

export function reject(state: RoomState, error: string): ReduceResult {
  return { state, effects: [], error };
}

export function log(state: RoomState, at: number, text: string): LogEntry[] {
  return [...state.log, { at, text }].slice(-MAX_LOG);
}

export const nameOf = (state: RoomState, playerId: string): string =>
  state.players.find((player) => player.id === playerId)?.name ?? 'Игрок';
