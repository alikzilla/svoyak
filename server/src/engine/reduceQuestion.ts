/** Ход вопроса: выбор клетки, чтение, кнопка, ответ, вердикт и сцена с ответом. */
import { MODIFIER_TITLES } from '@svoyak/shared';
import type { AuctionState, RoomState, TimerKind } from '@svoyak/shared';
import { applyDelta, findPlayer, updatePlayer } from './players.js';
import { closeQuestion, hasOpenQuestion, resetBuzz } from './flow.js';
import { applyModifier } from './modifiers.js';
import { findQuestion, findTheme } from './questions.js';
import { canBuzz, pickWinner } from './buzz.js';
import { MIN_BET } from './final.js';
import type { ReduceResult, ActionOf } from './reduceCommon.js';
import { reject, log, nameOf } from './reduceCommon.js';
import { modifierEffects, closeOrContinueAuction } from './reduceSpecials.js';
import { startFinalReveal } from './reduceFinal.js';

/** Сколько добавляет кнопка «дать ещё время». */
export const EXTRA_TIME_MS = 5000;

/** Какой таймер идёт в этой фазе. Редьюсер не знает о планировщике, только о фазе. */
export function timerKindFor(phase: RoomState['phase']): TimerKind | null {
  switch (phase) {
    case 'buzzer_open':
      return 'buzz';
    case 'final_bets':
      return 'final_bet';
    case 'final_answers':
      return 'final_answer';
    default:
      return null;
  }
}

/** Вопрос открыт в фазе 'reading': кнопку открывает ведущий, но если включён
 *  автостарт, движок делает это за него — пауза даётся на то, чтобы дочитать
 *  вопрос вслух. */
export function startReading(state: RoomState, at: number): ReduceResult {
  if (state.settings.autoOpenBuzzer) {
    const pause = state.settings.readingMs;
    if (pause <= 0) {
      const started = openBuzzer(state, at);
      return { ...started, effects: [{ type: 'clearTimer' }, ...started.effects] };
    }
    return {
      state,
      effects: [
        {
          type: 'setTimer',
          kind: 'reading',
          durationMs: pause,
          onExpire: { type: 'OPEN_BUZZER', at: at + pause },
        },
        { type: 'persist' },
      ],
    };
  }
  return { state, effects: [{ type: 'clearTimer' }, { type: 'persist' }] };
}

/** Отметить клетку сыгранной. Общее для вопросов и модификаторов. */
export function markPlayed(
  board: RoomState['board'],
  themeId: string,
  questionId: string,
): RoomState['board'] {
  return board.map((theme) =>
    theme.id !== themeId
      ? theme
      : {
          ...theme,
          cells: theme.cells.map((cell) =>
            cell.questionId === questionId ? { ...cell, played: true } : cell,
          ),
        },
  );
}

/** Вердикт ведущего: счёт, право хода и что делать с кнопкой дальше. */
export function judge(state: RoomState, verdict: 'correct' | 'wrong', at: number): ReduceResult {
  const active = state.active;
  const playerId = state.buzz.answeringPlayerId ?? active?.soloPlayerId ?? null;
  if (!active || !playerId) return reject(state, 'Сейчас никто не отвечает');
  const player = findPlayer(state, playerId);
  if (!player) return reject(state, 'Отвечающий не найден');

  const delta = verdict === 'correct' ? active.price : -active.price;
  const penalised = verdict === 'wrong' && !state.settings.penaltyOnWrong ? 0 : delta;
  const players = updatePlayer(state.players, playerId, (candidate) => ({
    ...candidate,
    score: applyDelta(candidate.score, penalised, state.settings.allowNegative),
  }));

  if (verdict === 'correct') {
    // Счёт и право хода применяются сразу, а вопрос ещё висит на сцене с ответом:
    // закроет её таймер или ведущий кнопкой «дальше».
    const correct = enterReveal(
      {
        ...state,
        players,
        controlPlayerId: playerId,
      },
      at,
      `${player.name}: верно, +${active.price}`,
    );
    return {
      ...correct,
      effects: [{ type: 'sound', sound: 'correct' }, ...correct.effects, { type: 'persist' }],
    };
  }

  const spentPlayerIds = [...active.spentPlayerIds, playerId];
  const someoneLeft = state.players.some(
    (candidate) => !spentPlayerIds.includes(candidate.id) && candidate.connected,
  );

  const afterWrong: RoomState = {
    ...state,
    players,
    active: { ...active, spentPlayerIds },
    buzz: {
      ...state.buzz,
      answeringPlayerId: null,
      answeringSince: null,
      candidates: [],
      graceClosesAt: null,
    },
    log: log(state, at, `${player.name}: неверно, ${penalised === 0 ? 'без штрафа' : penalised}`),
  };

  // У спецвопросов кнопки нет: играл один, значит вопрос закончен.
  if (active.soloPlayerId !== null || !someoneLeft) {
    const done = enterReveal(
      afterWrong,
      at,
      active.soloPlayerId !== null ? 'Вопрос играл один игрок' : 'Отвечать больше некому',
    );
    return {
      ...done,
      effects: [{ type: 'sound', sound: 'wrong' }, ...done.effects, { type: 'persist' }],
    };
  }

  // Время устного ответа не принадлежит кнопке: бюджет заморожен с момента нажатия.
  // И даже если бюджет исчерпан, остальным даётся минимальное окно — вопрос не
  // должен пропасть, пока его не попробовали все.
  const budgetLeft = Math.max(0, (state.buzz.closesAt ?? at) - (state.buzz.answeringSince ?? at));
  const remainingMs = Math.max(budgetLeft, state.settings.buzzReopenMinMs);
  const closesAt = at + remainingMs;

  return {
    state: {
      ...afterWrong,
      phase: 'buzzer_open',
      buzz: { ...afterWrong.buzz, closesAt },
    },
    effects: [
      { type: 'sound', sound: 'wrong' },
      {
        type: 'setTimer',
        kind: 'buzz',
        durationMs: remainingMs,
        onExpire: { type: 'TIMER_EXPIRED', kind: 'buzz', at: closesAt },
      },
      { type: 'persist' },
    ],
  };
}

/** Открытие кнопки: с этого момента идёт общий бюджет времени на вопрос. */
export function openBuzzer(state: RoomState, at: number): ReduceResult {
  if (state.phase !== 'reading') return reject(state, 'Вопрос ещё не открыт');

  return {
    state: {
      ...state,
      phase: 'buzzer_open',
      buzz: {
        ...state.buzz,
        openedAt: at,
        closesAt: at + state.settings.buzzOpenMs,
        candidates: [],
        graceClosesAt: null,
        answeringPlayerId: null,
      },
    },
    effects: [
      { type: 'sound', sound: 'buzz_open' },
      {
        type: 'setTimer',
        kind: 'buzz',
        durationMs: state.settings.buzzOpenMs,
        onExpire: { type: 'TIMER_EXPIRED', kind: 'buzz', at: at + state.settings.buzzOpenMs },
      },
    ],
  };
}

/** Сцена с ответом: держится таймером, а ведущий может закрыть её раньше кнопкой
 *  «дальше». При `answerRevealMs: 0` таймера нет — сцена ждёт ведущего. */
export function enterReveal(state: RoomState, at: number, reason: string): ReduceResult {
  const next = revealAnswer(state, at, reason);
  const durationMs = state.settings.answerRevealMs;
  if (durationMs <= 0) return { state: next, effects: [{ type: 'clearTimer' }] };

  return {
    state: next,
    effects: [
      {
        type: 'setTimer',
        kind: 'reveal',
        durationMs,
        onExpire: { type: 'TIMER_EXPIRED', kind: 'reveal', at: at + durationMs },
      },
    ],
  };
}

/** Показать правильный ответ всем: с этого момента он попадает в проекции игроков. */
export function revealAnswer(state: RoomState, at: number, reason: string): RoomState {
  return {
    ...state,
    phase: 'answer_reveal',
    active: state.active ? { ...state.active, answerRevealed: true } : null,
    buzz: {
      ...state.buzz,
      answeringPlayerId: null,
      answeringSince: null,
      candidates: [],
      graceClosesAt: null,
    },
    timer: null,
    log: [...state.log, { at, text: reason }].slice(-200),
  };
}

export function onPickQuestion(state: RoomState, action: ActionOf<'PICK_QUESTION'>): ReduceResult {
  if (state.phase !== 'picking' && state.phase !== 'round_intro') {
    return reject(state, 'Сейчас не время выбирать вопрос');
  }
  const theme = findTheme(state.pack, state.roundIndex, action.themeId);
  const question = findQuestion(
    state.pack,
    state.roundIndex,
    action.themeId,
    action.questionId,
  );
  if (!theme || !question) return reject(state, 'Вопрос не найден');

  const boardTheme = state.board.find((candidate) => candidate.id === action.themeId);
  const cell = boardTheme?.cells.find(
    (candidate) => candidate.questionId === action.questionId,
  );
  if (!cell) return reject(state, 'Клетки нет на доске');
  if (cell.played) return reject(state, 'Этот вопрос уже разыгран');

  // Под клеткой-модификатором нет вопроса: эффект срабатывает сразу,
  // и открывший выбирает следующую клетку.
  const modifierKind = cell.modifier;
  if (modifierKind !== undefined) {
    const playerId = state.controlPlayerId;
    if (!playerId) return reject(state, 'Некому открывать клетку');

    // Меняться счётом не с кем в комнате на одного — тогда обмен ведёт
    // себя как пустышка, а не как вопрос без ответа: без этой проверки
    // телефон открывшего застревал бы на «с кем меняешься?» без единой
    // кнопки, а фаза 'modifier' не заканчивалась бы (таймер не ставился).
    const swapHasTarget = modifierKind === 'swap' && state.players.some((p) => p.id !== playerId);

    const players =
      modifierKind === 'swap' && swapHasTarget
        ? state.players
        : applyModifier(state.players, modifierKind, playerId, null, state.settings);

    const opened: RoomState = {
      ...state,
      phase: 'modifier',
      players,
      active: null,
      cat: null,
      auction: null,
      // targetPlayerId всегда null здесь, кандидат на обмен есть или нет:
      // «цель — сам открывший» была бы значением, которое MODIFIER_TARGET
      // сам же и запрещает («С самим собой меняться нельзя»), и файл с
      // таким состоянием выглядел бы повреждённым. Кто должен ждать
      // выбора, а кто — нет, решает projectPrompt() по числу игроков, а
      // не эта клетка по выдуманному значению.
      modifier: { kind: modifierKind, playerId, targetPlayerId: null },
      board: markPlayed(state.board, action.themeId, action.questionId),
      buzz: resetBuzz(),
      log: log(state, action.at, `${nameOf(state, playerId)}: ${MODIFIER_TITLES[modifierKind]}`),
    };

    // Обмену с доступной целью нужна цель: сцена ждёт выбора, а не
    // таймера. Во всех остальных случаях, включая обмен без кандидатов,
    // сцена таймерная, как у пустышки.
    if (swapHasTarget) {
      return { state: opened, effects: [{ type: 'clearTimer' }, { type: 'persist' }] };
    }
    return { state: opened, effects: [...modifierEffects(state, action.at), { type: 'persist' }] };
  }

  const openedBy = state.controlPlayerId;
  const catPrice =
    question.type === 'cat' && question.cat
      ? question.cat.price === 'nominal'
        ? question.price
        : question.cat.price
      : question.price;

  // Спецвопросы идут без кнопки: кот сразу к передаче, аукцион — к торгам.
  const phase: RoomState['phase'] =
    question.type === 'cat' && openedBy
      ? 'cat_transfer'
      : question.type === 'auction' && openedBy
        ? 'auction_bidding'
        : 'reading';

  const opened: RoomState = {
      ...state,
      phase,
      cat:
        phase === 'cat_transfer' && openedBy
          ? {
              fromPlayerId: openedBy,
              toPlayerId: null,
              theme: question.cat?.theme ?? '',
              price: catPrice,
            }
          : null,
      auction: null,
      board: markPlayed(state.board, action.themeId, action.questionId),
      active: {
        themeId: theme.id,
        themeTitle: theme.title,
        questionId: question.id,
        price: phase === 'cat_transfer' ? catPrice : question.price,
        nominalPrice: question.price,
        type: question.type,
        spentPlayerIds: [],
        soloPlayerId: null,
        answerRevealed: false,
      },
      buzz: resetBuzz(),
      log: log(state, action.at, `${theme.title} за ${question.price}`),
  };

  if (phase === 'auction_bidding' && openedBy) {
    // Номинал ставит открывший, дальше по кругу могут перебить.
    const opening: AuctionState = {
      currentBid: question.price,
      leaderId: openedBy,
      turnPlayerId: null,
      passedIds: [],
      allInIds: [],
    };
    const started = closeOrContinueAuction(opened, opening, openedBy, action.at);
    return { ...started, effects: [{ type: 'clearTimer' }, ...started.effects] };
  }

  // Обычный вопрос сначала объявляют: все видят, какую тему и цену
  // выбрали, и только потом текст. Пауза на чтение начинается после.
  if (phase === 'reading' && state.settings.announceMs > 0) {
    const durationMs = state.settings.announceMs;
    return {
      state: { ...opened, phase: 'announce' },
      effects: [
        {
          type: 'setTimer',
          kind: 'announce',
          durationMs,
          onExpire: { type: 'TIMER_EXPIRED', kind: 'announce', at: action.at + durationMs },
        },
        { type: 'persist' },
      ],
    };
  }

  if (phase === 'reading') return startReading(opened, action.at);

  return {
    state: opened,
    effects: [{ type: 'clearTimer' }, { type: 'persist' }],
  };
}

export function onContinue(state: RoomState, action: ActionOf<'CONTINUE'>): ReduceResult {
  // Ведущий не ждёт конца объявления и сразу открывает вопрос.
  if (state.phase === 'announce') {
    return startReading({ ...state, phase: 'reading' }, action.at);
  }
  if (state.phase === 'modifier') {
    return {
      state: closeQuestion(state),
      effects: [{ type: 'clearTimer' }, { type: 'persist' }],
    };
  }
  const final = state.final;
  if (state.phase === 'final_bets' && final) {
    // Кто не успел поставить — ставит минимум: игра не должна вставать из-за отвалившегося.
    const bets = { ...final.bets };
    for (const playerId of final.participantIds) {
      if (!(playerId in bets)) bets[playerId] = MIN_BET;
    }
    return {
      state: { ...state, phase: 'final_answers', final: { ...final, bets } },
      effects: [{ type: 'persist' }],
    };
  }
  if (state.phase === 'final_answers' && final) {
    const answers = { ...final.answers };
    for (const playerId of final.participantIds) {
      if (!(playerId in answers)) answers[playerId] = '';
    }
    return {
      state: startFinalReveal(state, { ...final, answers }),
      effects: [{ type: 'persist' }],
    };
  }
  if (!hasOpenQuestion(state)) return reject(state, 'Нечего закрывать');
  return {
    state: closeQuestion(state),
    effects: [{ type: 'clearTimer' }, { type: 'persist' }],
  };
}

export function onOpenBuzzer(state: RoomState, action: ActionOf<'OPEN_BUZZER'>): ReduceResult {
  return openBuzzer(state, action.at);
}

export function onBuzz(state: RoomState, action: ActionOf<'BUZZ'>): ReduceResult {
  const player = findPlayer(state, action.playerId);
  if (!player) return reject(state, 'Игрок не найден');

  // Нажатие до открытия кнопки: блокируем нажавшего прямо сейчас. Пока
  // блокировка идёт, лишние тычки не считаем — иначе долбёжка продлевала бы
  // наказание и сыпала уведомлениями.
  if (state.phase === 'reading') {
    if (!canBuzz(state, action.playerId, action.atServerTime)) return { state, effects: [] };
    return {
      state: {
        ...state,
        buzz: {
          ...state.buzz,
          lockedUntil: {
            ...state.buzz.lockedUntil,
            [action.playerId]: action.atServerTime + state.settings.falseStartLockMs,
          },
        },
        log: log(state, action.receivedAt, `Фальстарт: ${player.name}`),
      },
      effects: [
        {
          type: 'toast',
          to: { playerId: action.playerId },
          text: 'Фальстарт! Кнопка заблокирована на пару секунд',
          tone: 'warn',
        },
        { type: 'persist' },
      ],
    };
  }

  if (state.phase !== 'buzzer_open') return { state, effects: [] };
  if (state.buzz.answeringPlayerId !== null) return { state, effects: [] };
  if (!canBuzz(state, action.playerId, action.atServerTime)) return { state, effects: [] };
  if (state.buzz.candidates.some((candidate) => candidate.playerId === action.playerId)) {
    return { state, effects: [] };
  }

  const candidates = [
    ...state.buzz.candidates,
    { playerId: action.playerId, atServerTime: action.atServerTime },
  ];
  const isFirst = state.buzz.candidates.length === 0;
  if (!isFirst) {
    return { state: { ...state, buzz: { ...state.buzz, candidates } }, effects: [] };
  }

  // Первое нажатие открывает окно сбора: победителя выбираем по метке, а не по пакету.
  const graceClosesAt = action.atServerTime + state.settings.buzzGraceMs;
  return {
    state: { ...state, buzz: { ...state.buzz, candidates, graceClosesAt } },
    effects: [
      {
        type: 'setTimer',
        kind: 'buzz',
        durationMs: state.settings.buzzGraceMs,
        onExpire: { type: 'BUZZ_WINDOW_CLOSED', at: graceClosesAt },
      },
    ],
  };
}

export function onBuzzWindowClosed(state: RoomState, action: ActionOf<'BUZZ_WINDOW_CLOSED'>): ReduceResult {
  if (state.phase !== 'buzzer_open') return { state, effects: [] };
  const eligible = state.buzz.candidates.filter((candidate) =>
    canBuzz(state, candidate.playerId, candidate.atServerTime),
  );
  const winner = pickWinner(eligible);
  if (!winner) {
    return {
      state: { ...state, buzz: { ...state.buzz, candidates: [], graceClosesAt: null } },
      effects: [],
    };
  }

  const player = findPlayer(state, winner.playerId);
  return {
    state: {
      ...state,
      phase: 'answering',
      buzz: {
        ...state.buzz,
        candidates: [],
        graceClosesAt: null,
        answeringPlayerId: winner.playerId,
        answeringSince: action.at,
      },
      log: log(state, action.at, `Отвечает ${player?.name ?? '—'}`),
    },
    // Таймер снимается: ведущий сам решит, когда времени было достаточно.
    effects: [{ type: 'sound', sound: 'buzz_hit' }, { type: 'clearTimer' }],
  };
}

export function onJudge(state: RoomState, action: ActionOf<'JUDGE'>): ReduceResult {
  return judge(state, action.verdict, action.at);
}

export function onRevealAnswer(state: RoomState, action: ActionOf<'REVEAL_ANSWER'>): ReduceResult {
  if (!state.active) return reject(state, 'Нет открытого вопроса');
  const revealed = enterReveal(state, action.at, 'Ведущий раскрыл ответ');
  return { ...revealed, effects: [...revealed.effects, { type: 'persist' }] };
}

export function onSkipQuestion(state: RoomState, action: ActionOf<'SKIP_QUESTION'>): ReduceResult {
  if (!state.active) return reject(state, 'Нет открытого вопроса');
  const skipped = enterReveal(state, action.at, 'Вопрос снят');
  return { ...skipped, effects: [...skipped.effects, { type: 'persist' }] };
}

export function onExtendTime(state: RoomState, action: ActionOf<'EXTEND_TIME'>): ReduceResult {
  const kind = timerKindFor(state.phase);
  if (!kind) return reject(state, 'Сейчас нет таймера');
  const extraMs = EXTRA_TIME_MS;
  return {
    state,
    effects: [
      {
        type: 'setTimer',
        kind,
        durationMs: extraMs,
        onExpire: { type: 'TIMER_EXPIRED', kind, at: action.at + extraMs },
      },
      {
        type: 'toast',
        to: 'all',
        text: 'Ведущий добавил времени',
        tone: 'info',
      },
    ],
  };
}

export function onTimerExpired(state: RoomState, action: ActionOf<'TIMER_EXPIRED'>): ReduceResult {
  if (action.kind === 'buzz') {
    if (state.phase !== 'buzzer_open') return { state, effects: [] };
    const expired = enterReveal(state, action.at, 'Время вышло, никто не ответил');
    return {
      ...expired,
      effects: [{ type: 'sound', sound: 'time_up' }, ...expired.effects, { type: 'persist' }],
    };
  }

  if (action.kind === 'announce') {
    if (state.phase !== 'announce') return { state, effects: [] };
    return startReading({ ...state, phase: 'reading' }, action.at);
  }

  if (action.kind === 'reveal') {
    if (state.phase !== 'answer_reveal') return { state, effects: [] };
    return {
      state: closeQuestion(state),
      effects: [{ type: 'clearTimer' }, { type: 'persist' }],
    };
  }

  if (action.kind === 'modifier') {
    if (state.phase !== 'modifier') return { state, effects: [] };
    return {
      state: closeQuestion(state),
      effects: [{ type: 'clearTimer' }, { type: 'persist' }],
    };
  }

  return { state, effects: [] };
}
