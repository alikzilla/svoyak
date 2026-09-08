import type { RoomState } from '@svoyak/shared';
import { buildBoard, hasUnplayedCells } from './board.js';
import { EMPTY_BUZZ } from './createRoom.js';

/** Сброс кнопки между вопросами: блокировки за фальстарт живут только внутри вопроса. */
export function resetBuzz(): RoomState['buzz'] {
  return { ...EMPTY_BUZZ, lockedUntil: {}, candidates: [] };
}

/** Закрыть текущий вопрос и вернуться к выбору либо завершить раунд. */
export function closeQuestion(state: RoomState): RoomState {
  return {
    ...state,
    active: null,
    buzz: resetBuzz(),
    auction: null,
    cat: null,
    timer: null,
    phase: hasUnplayedCells(state.board) ? 'picking' : 'round_end',
  };
}

/** Доска и фаза следующего раунда; после последнего — результаты. */
export function advanceRound(state: RoomState): RoomState {
  const nextIndex = state.roundIndex + 1;
  const nextRound = state.pack.rounds[nextIndex];
  if (!nextRound) return { ...state, phase: 'results', active: null, timer: null };

  return {
    ...state,
    roundIndex: nextIndex,
    board: buildBoard(nextRound),
    active: null,
    buzz: resetBuzz(),
    timer: null,
    phase: 'round_intro',
  };
}

/** Фазы, в которых на столе есть открытый вопрос. */
const QUESTION_PHASES = new Set<RoomState['phase']>([
  'reading',
  'buzzer_open',
  'answering',
  'answer_reveal',
  'cat_transfer',
  'cat_answer',
  'auction_bidding',
  'auction_answer',
]);

export function hasOpenQuestion(state: RoomState): boolean {
  return QUESTION_PHASES.has(state.phase);
}
