import { gameIntroMs, gameThemeTitles, roundIntroMs } from '@svoyak/shared';
import type { FinalState, RoomState } from '@svoyak/shared';
import type { Effect } from './actions.js';
import { buildBoard, hasUnplayedCells } from './board.js';
import { EMPTY_BUZZ } from './createRoom.js';
import { byScoreAscending, finalParticipants } from './final.js';

/** Сброс кнопки между вопросами: блокировки за фальстарт живут только внутри вопроса. */
export function resetBuzz(): RoomState['buzz'] {
  return { ...EMPTY_BUZZ, lockedUntil: {}, candidates: [], answeringSince: null };
}

/** Закрыть текущий вопрос и вернуться к выбору либо завершить раунд. */
export function closeQuestion(state: RoomState): RoomState {
  return {
    ...state,
    active: null,
    buzz: resetBuzz(),
    auction: null,
    cat: null,
    modifier: null,
    timer: null,
    phase: hasUnplayedCells(state.board) ? 'picking' : 'round_end',
  };
}

/** Состав финала и первый ход: тему убирает тот, у кого меньше очков. */
export function enterFinal(state: RoomState): RoomState {
  const participantIds = finalParticipants(state);
  const order = byScoreAscending(state, participantIds);

  if (participantIds.length === 0 || state.pack.final.themes.length === 0) {
    return { ...state, phase: 'results', active: null, timer: null, final: null };
  }

  const final: FinalState = {
    participantIds: order,
    themes: state.pack.final.themes.map((theme) => ({
      id: theme.id,
      title: theme.title,
      removedByPlayerId: null,
    })),
    removalTurnPlayerId: order[0] ?? null,
    bets: {},
    answers: {},
    revealOrder: [],
    revealIndex: 0,
    judged: {},
  };

  // Тем может оказаться ровно одна — тогда убирать нечего, сразу ставки.
  const phase = final.themes.length > 1 ? 'final_theme_removal' : 'final_bets';
  return { ...state, phase, active: null, buzz: resetBuzz(), timer: null, final };
}

/** Доска и фаза следующего раунда; после последнего — финал. */
export function advanceRound(state: RoomState): RoomState {
  const nextIndex = state.roundIndex + 1;
  const nextRound = state.pack.rounds[nextIndex];
  if (!nextRound) return enterFinal({ ...state, active: null, timer: null });

  return {
    ...state,
    roundIndex: nextIndex,
    board: buildBoard(nextRound, state.modifierCells),
    active: null,
    buzz: resetBuzz(),
    timer: null,
    phase: 'round_intro',
  };
}

/** Фазы, в которых на столе есть открытый вопрос. */
const QUESTION_PHASES = new Set<RoomState['phase']>([
  'modifier',
  'announce',
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

/** Заставки начала игры и раунда: на табло пока ничего не открыть. */
export function isIntro(phase: RoomState['phase']): boolean {
  return phase === 'game_intro' || phase === 'round_intro';
}

/** Таймер заставки: когда он истечёт, движок сам пойдёт дальше. */
function introTimer(durationMs: number, at: number): Effect {
  return {
    type: 'setTimer',
    kind: 'intro',
    durationMs,
    onExpire: { type: 'TIMER_EXPIRED', kind: 'intro', at: at + durationMs },
  };
}

/** «Темы игры» плывут столько, сколько тем во всём паке. */
export function gameIntroTimer(state: RoomState, at: number): Effect {
  return introTimer(gameIntroMs(gameThemeTitles(state.pack).length), at);
}

/** Темы раунда выскакивают по одной — длительность по числу тем на доске. */
export function roundIntroTimer(state: RoomState, at: number): Effect {
  return introTimer(roundIntroMs(state.board.length), at);
}
