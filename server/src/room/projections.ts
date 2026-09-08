import type {
  BaseView,
  BoardView,
  FinalPublicView,
  HostQuestionView,
  HostView,
  PlayerPrompt,
  PlayerPublic,
  PlayerView,
  PublicQuestionView,
  RoomState,
  TimerView,
} from '@svoyak/shared';
import { activeQuestion } from '../engine/questions.js';

function projectPlayers(state: RoomState, now: number): PlayerPublic[] {
  return state.players.map((player) => {
    const lockedUntil = state.buzz.lockedUntil[player.id] ?? null;
    return {
      id: player.id,
      name: player.name,
      score: player.score,
      connected: player.connected,
      isControl: state.controlPlayerId === player.id,
      isAnswering: state.buzz.answeringPlayerId === player.id,
      lockedUntil: lockedUntil !== null && lockedUntil > now ? lockedUntil : null,
    };
  });
}

function projectTimer(state: RoomState): TimerView | null {
  if (!state.timer) return null;
  return {
    kind: state.timer.kind,
    endsAt: state.timer.endsAt,
    totalMs: state.timer.totalMs,
    remainingMs: state.timer.remainingMs,
  };
}

function projectBase(state: RoomState, now: number): BaseView {
  return {
    code: state.code,
    phase: state.phase,
    paused: state.paused,
    packTitle: state.pack.title,
    roundTitle: state.pack.rounds[state.roundIndex]?.title ?? 'Финал',
    roundIndex: state.roundIndex,
    roundsTotal: state.pack.rounds.length,
    board: state.board,
    players: projectPlayers(state, now),
    controlPlayerId: state.controlPlayerId,
    timer: projectTimer(state),
  };
}

/** Вопрос без ответа. Ответ добавляется только после того, как ведущий его раскрыл. */
function projectPublicQuestion(state: RoomState): PublicQuestionView | null {
  const active = state.active;
  const question = activeQuestion(state);
  if (!active || !question) return null;

  const view: PublicQuestionView = {
    themeTitle: active.themeTitle,
    price: active.price,
    type: active.type,
    text: question.text,
  };
  if (question.media) view.media = question.media;
  if (active.answerRevealed) {
    view.revealedAnswer = question.answer;
    if (question.answerMedia) view.revealedAnswerMedia = question.answerMedia;
  }
  return view;
}

function projectHostQuestion(state: RoomState): HostQuestionView | null {
  const active = state.active;
  const question = activeQuestion(state);
  if (!active || !question) return null;

  const view: HostQuestionView = {
    themeTitle: active.themeTitle,
    price: active.price,
    type: active.type,
    text: question.text,
    answer: question.answer,
    altAnswers: question.altAnswers,
  };
  if (question.media) view.media = question.media;
  if (question.answerMedia) view.answerMedia = question.answerMedia;
  if (question.hostComment) view.hostComment = question.hostComment;
  return view;
}

function projectFinalPublic(state: RoomState): FinalPublicView | null {
  const final = state.final;
  if (!final) return null;
  return {
    themes: final.themes,
    removalTurnPlayerId: final.removalTurnPlayerId,
    participantIds: final.participantIds,
    betPlacedIds: Object.keys(final.bets),
    answerPlacedIds: Object.keys(final.answers),
    revealed: final.revealOrder.slice(0, final.revealIndex).map((playerId) => ({
      playerId,
      bet: final.bets[playerId] ?? 0,
      answer: final.answers[playerId] ?? '',
      correct: final.judged[playerId] ?? null,
    })),
    currentRevealPlayerId: final.revealOrder[final.revealIndex] ?? null,
  };
}

export interface HostProjectionOptions {
  canUndo?: boolean;
  now?: number;
}

export function projectForHost(
  state: RoomState,
  joinUrl: string,
  options: HostProjectionOptions = {},
): HostView {
  const now = options.now ?? Date.now();
  const finalPublic = projectFinalPublic(state);
  const finalThemeAnswer =
    state.final && state.final.themes.length === 1
      ? (state.pack.final.themes.find((theme) => theme.id === state.final?.themes[0]?.id)?.question
          .answer ?? null)
      : null;

  return {
    ...projectBase(state, now),
    role: 'host',
    settings: state.settings,
    question: projectHostQuestion(state),
    auction: state.auction,
    cat: state.cat,
    final: finalPublic ? { ...finalPublic, themeAnswer: finalThemeAnswer } : null,
    log: state.log,
    canUndo: options.canUndo ?? false,
    joinUrl,
  };
}

/** Что телефон игрока предлагает сделать прямо сейчас. */
function projectPrompt(state: RoomState, playerId: string, now: number): PlayerPrompt {
  const me = state.players.find((player) => player.id === playerId);
  if (!me) return { kind: 'wait' };
  const isControl = state.controlPlayerId === playerId;

  switch (state.phase) {
    case 'picking':
      return isControl ? { kind: 'pick_question' } : { kind: 'wait' };

    case 'reading':
    case 'buzzer_open': {
      if (state.active?.spentPlayerIds.includes(playerId)) return { kind: 'wait' };
      const lockedUntil = state.buzz.lockedUntil[playerId] ?? null;
      return {
        kind: 'buzz',
        open: state.phase === 'buzzer_open' && state.buzz.answeringPlayerId === null,
        lockedUntil: lockedUntil !== null && lockedUntil > now ? lockedUntil : null,
      };
    }

    case 'cat_transfer': {
      if (state.cat?.fromPlayerId !== playerId) return { kind: 'wait' };
      const question = activeQuestion(state);
      const canKeep = question?.cat?.canKeep ?? false;
      return {
        kind: 'cat_pick',
        canKeep,
        candidates: state.players
          .filter((player) => canKeep || player.id !== playerId)
          .map((player) => ({ id: player.id, name: player.name })),
      };
    }

    case 'auction_bidding': {
      const auction = state.auction;
      if (!auction || auction.turnPlayerId !== playerId) return { kind: 'wait' };
      return {
        kind: 'auction_bid',
        currentBid: auction.currentBid,
        minBid: auction.currentBid + state.settings.auctionStep,
        maxBid: me.score,
        canPass: auction.leaderId !== null,
      };
    }

    case 'cat_answer':
    case 'auction_answer':
      return state.active?.soloPlayerId === playerId ? { kind: 'solo_answer' } : { kind: 'wait' };

    case 'final_theme_removal': {
      const final = state.final;
      if (!final || final.removalTurnPlayerId !== playerId) return { kind: 'wait' };
      return {
        kind: 'final_remove_theme',
        themes: final.themes
          .filter((theme) => theme.removedByPlayerId === null)
          .map((theme) => ({ id: theme.id, title: theme.title })),
      };
    }

    case 'final_bets': {
      const final = state.final;
      if (!final?.participantIds.includes(playerId)) return { kind: 'wait' };
      return { kind: 'final_bet', min: 1, max: Math.max(1, me.score), placed: playerId in final.bets };
    }

    case 'final_answers': {
      const final = state.final;
      if (!final?.participantIds.includes(playerId)) return { kind: 'wait' };
      return { kind: 'final_answer', placed: playerId in final.answers };
    }

    default:
      return { kind: 'wait' };
  }
}

export function projectForPlayer(state: RoomState, playerId: string, now = Date.now()): PlayerView {
  const me = state.players.find((player) => player.id === playerId);
  return {
    ...projectBase(state, now),
    role: 'player',
    meId: playerId,
    myScore: me?.score ?? 0,
    question: projectPublicQuestion(state),
    prompt: projectPrompt(state, playerId, now),
    auction: state.auction,
    cat: state.cat,
    final: projectFinalPublic(state),
    myFinalBet: state.final?.bets[playerId] ?? null,
    myFinalAnswer: state.final?.answers[playerId] ?? null,
  };
}

export function projectForBoard(state: RoomState, joinUrl: string, now = Date.now()): BoardView {
  return {
    ...projectBase(state, now),
    role: 'board',
    question: projectPublicQuestion(state),
    final: projectFinalPublic(state),
    joinUrl,
  };
}
