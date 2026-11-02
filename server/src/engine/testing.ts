import type { RoomState } from '@svoyak/shared';
import { isIntro } from './flow.js';
import { reduce } from './reducer.js';

/** Только для тестов: пропустить заставку, если она идёт, — тестам нужно табло. */
export function skipIntro(state: RoomState, at = 3100): RoomState {
  return isIntro(state.phase) ? reduce(state, { type: 'CONTINUE', at }).state : state;
}
