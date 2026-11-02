/** Финал: вычёркивание тем, ставки, ответы и вскрытие. */
import type { FinalState, RoomState } from '@svoyak/shared';
import { applyDelta, findPlayer, updatePlayer } from './players.js';
import { MIN_BET, byScoreAscending, maxBet, nextRemovalTurn } from './final.js';
import type { ReduceResult, ActionOf } from './reduceCommon.js';
import { reject, log } from './reduceCommon.js';

/** Вскрытие идёт от меньшего счёта к большему — интрига держится до конца. */
export function startFinalReveal(state: RoomState, final: FinalState): RoomState {
  return {
    ...state,
    phase: 'final_reveal',
    final: {
      ...final,
      revealOrder: byScoreAscending(state, final.participantIds),
      revealIndex: 0,
    },
  };
}

export function onFinalRemoveTheme(state: RoomState, action: ActionOf<'FINAL_REMOVE_THEME'>): ReduceResult {
  const final = state.final;
  if (state.phase !== 'final_theme_removal' || !final) {
    return reject(state, 'Сейчас темы не убирают');
  }
  if (final.removalTurnPlayerId !== action.playerId) return reject(state, 'Сейчас не ваш ход');

  const theme = final.themes.find((candidate) => candidate.id === action.themeId);
  if (!theme) return reject(state, 'Темы нет в финале');
  if (theme.removedByPlayerId !== null) return reject(state, 'Эту тему уже убрали');

  const player = findPlayer(state, action.playerId);
  const themes = final.themes.map((candidate) =>
    candidate.id === action.themeId
      ? { ...candidate, removedByPlayerId: action.playerId }
      : candidate,
  );
  const left = themes.filter((candidate) => candidate.removedByPlayerId === null);

  const nextFinal: FinalState = {
    ...final,
    themes,
    removalTurnPlayerId:
      left.length > 1 ? nextRemovalTurn(state, final, action.playerId) : null,
  };

  return {
    state: {
      ...state,
      phase: left.length > 1 ? 'final_theme_removal' : 'final_bets',
      final: nextFinal,
      log: log(state, action.at, `${player?.name ?? '—'} убирает тему «${theme.title}»`),
    },
    effects: [{ type: 'persist' }],
  };
}

export function onFinalBet(state: RoomState, action: ActionOf<'FINAL_BET'>): ReduceResult {
  const final = state.final;
  if (state.phase !== 'final_bets' || !final) return reject(state, 'Сейчас не время ставок');
  if (!final.participantIds.includes(action.playerId)) {
    return reject(state, 'Вы не играете в финале');
  }
  const bet = Math.round(action.bet);
  if (!Number.isFinite(bet) || bet < MIN_BET) return reject(state, 'Ставка не меньше единицы');
  if (bet > maxBet(state, action.playerId)) return reject(state, 'Ставка больше вашего счёта');

  const bets = { ...final.bets, [action.playerId]: bet };
  const everyone = final.participantIds.every((playerId) => playerId in bets);
  return {
    state: {
      ...state,
      phase: everyone ? 'final_answers' : 'final_bets',
      final: { ...final, bets },
    },
    effects: [{ type: 'persist' }],
  };
}

export function onFinalAnswer(state: RoomState, action: ActionOf<'FINAL_ANSWER'>): ReduceResult {
  const final = state.final;
  if (state.phase !== 'final_answers' || !final) return reject(state, 'Сейчас не время ответов');
  if (!final.participantIds.includes(action.playerId)) {
    return reject(state, 'Вы не играете в финале');
  }

  const answers = { ...final.answers, [action.playerId]: action.answer.trim().slice(0, 200) };
  const everyone = final.participantIds.every((playerId) => playerId in answers);
  return {
    state: everyone
      ? startFinalReveal(state, { ...final, answers })
      : { ...state, final: { ...final, answers } },
    effects: everyone
      ? [{ type: 'sound', sound: 'drumroll' }, { type: 'persist' }]
      : [{ type: 'persist' }],
  };
}

export function onFinalJudge(state: RoomState, action: ActionOf<'FINAL_JUDGE'>): ReduceResult {
  const final = state.final;
  if (state.phase !== 'final_reveal' || !final) return reject(state, 'Сейчас нечего вскрывать');
  const playerId = final.revealOrder[final.revealIndex];
  if (!playerId) return reject(state, 'Все ответы уже вскрыты');

  const player = findPlayer(state, playerId);
  const bet = final.bets[playerId] ?? MIN_BET;
  const delta = action.correct ? bet : -bet;
  const revealIndex = final.revealIndex + 1;
  const done = revealIndex >= final.revealOrder.length;

  return {
    state: {
      ...state,
      phase: done ? 'results' : 'final_reveal',
      players: updatePlayer(state.players, playerId, (candidate) => ({
        ...candidate,
        score: applyDelta(candidate.score, delta, state.settings.allowNegative),
      })),
      final: { ...final, revealIndex, judged: { ...final.judged, [playerId]: action.correct } },
      log: log(
        state,
        action.at,
        `Финал, ${player?.name ?? '—'}: ${action.correct ? 'верно' : 'неверно'} (${bet})`,
      ),
    },
    effects: [
      { type: 'sound', sound: action.correct ? 'correct' : 'wrong' },
      ...(done ? ([{ type: 'sound', sound: 'victory' }] as const) : []),
      { type: 'persist' },
    ],
  };
}
