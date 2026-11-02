import type { RoomState } from '@svoyak/shared';
import type { GameAction } from './actions.js';
import type { ReduceResult } from './reduceCommon.js';
import { onPlayerJoin, onPlayerDisconnect, onPlayerKick, onSetScore, onSetSettings, onSetPack, onHostPresence, onStartGame, onNextRound, onSetControl, onPause, onGiveHint } from './reduceRoom.js';
import { onPickQuestion, onContinue, onOpenBuzzer, onBuzz, onBuzzWindowClosed, onJudge, onRevealAnswer, onSkipQuestion, onExtendTime, onTimerExpired } from './reduceQuestion.js';
import { onCatTransfer, onModifierTarget, onBid } from './reduceSpecials.js';
import { onFinalRemoveTheme, onFinalBet, onFinalAnswer, onFinalJudge } from './reduceFinal.js';

export type { ReduceResult } from './reduceCommon.js';
export { revealAnswer } from './reduceQuestion.js';

/** Чистая функция: ни I/O, ни таймеров, ни случайности. Сам редьюсер только
 *  выбирает обработчик; правила живут в reduceRoom, reduceQuestion,
 *  reduceSpecials и reduceFinal. */
export function reduce(state: RoomState, action: GameAction): ReduceResult {
  switch (action.type) {
    case 'PLAYER_JOIN':
      return onPlayerJoin(state, action);
    case 'PLAYER_DISCONNECT':
      return onPlayerDisconnect(state, action);
    case 'PLAYER_KICK':
      return onPlayerKick(state, action);
    case 'SET_SCORE':
      return onSetScore(state, action);
    case 'SET_SETTINGS':
      return onSetSettings(state, action);
    case 'SET_PACK':
      return onSetPack(state, action);
    case 'HOST_PRESENCE':
      return onHostPresence(state, action);
    case 'START_GAME':
      return onStartGame(state, action);
    case 'PICK_QUESTION':
      return onPickQuestion(state, action);
    case 'CONTINUE':
      return onContinue(state, action);
    case 'NEXT_ROUND':
      return onNextRound(state, action);
    case 'SET_CONTROL':
      return onSetControl(state, action);
    case 'PAUSE':
      return onPause(state, action);
    case 'OPEN_BUZZER':
      return onOpenBuzzer(state, action);
    case 'BUZZ':
      return onBuzz(state, action);
    case 'BUZZ_WINDOW_CLOSED':
      return onBuzzWindowClosed(state, action);
    case 'JUDGE':
      return onJudge(state, action);
    case 'REVEAL_ANSWER':
      return onRevealAnswer(state, action);
    case 'SKIP_QUESTION':
      return onSkipQuestion(state, action);
    case 'EXTEND_TIME':
      return onExtendTime(state, action);
    case 'CAT_TRANSFER':
      return onCatTransfer(state, action);
    case 'MODIFIER_TARGET':
      return onModifierTarget(state, action);
    case 'BID':
      return onBid(state, action);
    case 'FINAL_REMOVE_THEME':
      return onFinalRemoveTheme(state, action);
    case 'FINAL_BET':
      return onFinalBet(state, action);
    case 'FINAL_ANSWER':
      return onFinalAnswer(state, action);
    case 'FINAL_JUDGE':
      return onFinalJudge(state, action);
    case 'GIVE_HINT':
      return onGiveHint(state, action);
    case 'TIMER_EXPIRED':
      return onTimerExpired(state, action);
  }
}
