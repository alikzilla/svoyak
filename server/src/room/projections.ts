import type {
  BaseView,
  BoardThemeView,
  BoardView,
  FinalPublicView,
  HostQuestionView,
  HostView,
  ModifierView,
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
      isAnswering:
        state.buzz.answeringPlayerId === player.id || state.active?.soloPlayerId === player.id,
      lockedUntil: lockedUntil !== null && lockedUntil > now ? lockedUntil : null,
      // Комната, восстановленная с диска, может быть сохранена до появления этого поля.
      hints: player.hints ?? 0,
    };
  });
}

/** Доска наружу. Модификатор виден только на уже открытой клетке: пока клетка
 *  закрыта, она обязана быть неотличима от обычной — это единственная точка,
 *  через которую доска уходит во все три проекции. */
function projectBoard(state: RoomState): BoardThemeView[] {
  return state.board.map((theme) => ({
    ...theme,
    cells: theme.cells.map(({ questionId, price, played }) => ({ questionId, price, played })),
  }));
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
    // В финале номер раунда уже не важен: показываем, где мы на самом деле.
    roundTitle:
      state.phase === 'results'
        ? 'Итог'
        : state.final !== null
          ? 'Финал'
          : (state.pack.rounds[state.roundIndex]?.title ?? 'Финал'),
    roundIndex: state.roundIndex,
    roundsTotal: state.pack.rounds.length,
    board: projectBoard(state),
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

  // Кота передают вслепую, а на аукционе торгуются по теме и цене:
  // до конца этих фаз текст вопроса игрокам не показываем.
  const hidden = state.phase === 'cat_transfer' || state.phase === 'auction_bidding';

  const view: PublicQuestionView = {
    themeTitle: active.themeTitle,
    price: active.price,
    type: active.type,
    text: hidden ? '' : question.text,
  };
  if (hidden) view.hidden = true;
  if (!hidden && question.media) view.media = question.media;
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

/** Оставшаяся тема финала и её вопрос из пака. */
function finalTheme(state: RoomState) {
  const remaining = state.final?.themes.filter((theme) => theme.removedByPlayerId === null) ?? [];
  if (remaining.length !== 1) return null;
  const id = remaining[0]?.id;
  return state.pack.final.themes.find((theme) => theme.id === id) ?? null;
}

function projectFinalPublic(state: RoomState): FinalPublicView | null {
  const final = state.final;
  if (!final) return null;

  const theme = finalTheme(state);
  // Ставят вслепую: текст вопроса появляется только когда пора писать ответ.
  const questionVisible =
    state.phase === 'final_answers' || state.phase === 'final_reveal' || state.phase === 'results';

  return {
    themes: final.themes,
    themeTitle: theme?.title ?? null,
    questionText: questionVisible ? (theme?.question.text ?? null) : null,
    ...(questionVisible && theme?.question.media
      ? { questionMedia: theme.question.media }
      : {}),
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

/** Открытая клетка-модификатор наружу. Секрета тут уже нет: клетку открыли. */
function projectModifier(state: RoomState): ModifierView | null {
  if (!state.modifier) return null;
  return {
    kind: state.modifier.kind,
    playerId: state.modifier.playerId,
    targetPlayerId: state.modifier.targetPlayerId,
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
  const theme = finalTheme(state);

  return {
    ...projectBase(state, now),
    role: 'host',
    settings: state.settings,
    question: projectHostQuestion(state),
    auction: state.auction,
    cat: state.cat,
    modifier: projectModifier(state),
    final: finalPublic
      ? {
          ...finalPublic,
          // Ведущему вопрос виден всегда: ему его читать.
          questionText: theme?.question.text ?? null,
          ...(theme?.question.media ? { questionMedia: theme.question.media } : {}),
          answer: theme?.question.answer ?? null,
          altAnswers: theme?.question.altAnswers ?? [],
          ...(theme?.question.hostComment !== undefined
            ? { hostComment: theme.question.hostComment }
            : {}),
          bets: state.final?.bets ?? {},
          answers: state.final?.answers ?? {},
        }
      : null,
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
      return isControl ? { kind: 'your_turn' } : { kind: 'wait' };

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

    case 'modifier': {
      const candidates = state.players
        .filter((player) => player.id !== playerId)
        .map((player) => ({ id: player.id, name: player.name }));
      // Цель ещё не выбрана — сцена ждёт именно открывшего клетку, остальные
      // смотрят. Но ждать нечего, если меняться не с кем: в комнате на
      // одного targetPlayerId остаётся null до конца сцены (выбирать некого),
      // и без проверки candidates.length телефон показал бы «С кем
      // меняешься счётом?» без единой кнопки.
      if (
        state.modifier?.kind === 'swap' &&
        state.modifier.targetPlayerId === null &&
        state.modifier.playerId === playerId &&
        candidates.length > 0
      ) {
        return { kind: 'modifier_swap', candidates };
      }
      return { kind: 'wait' };
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
    modifier: projectModifier(state),
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
    cat: state.cat,
    auction: state.auction,
    modifier: projectModifier(state),
    final: projectFinalPublic(state),
    joinUrl,
  };
}
