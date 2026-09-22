import { MODIFIER_TITLES } from '@svoyak/shared';
import type { AuctionState, FinalState, LogEntry, RoomState, TimerKind } from '@svoyak/shared';
import type { Effect, GameAction } from './actions.js';
import { findByName, findByToken, findPlayer, updatePlayer } from './players.js';
import { advanceRound, closeQuestion, hasOpenQuestion, resetBuzz } from './flow.js';
import { buildBoard } from './board.js';
import { applyModifier } from './modifiers.js';
import { activeQuestion, findQuestion, findTheme } from './questions.js';
import { canBuzz, pickWinner } from './buzz.js';
import { minRaise, nextBidder } from './auction.js';
import { MIN_BET, byScoreAscending, maxBet, nextRemovalTurn, remainingThemes } from './final.js';
import { applyDelta } from './players.js';

export interface ReduceResult {
  state: RoomState;
  effects: Effect[];
  /** Заполнено, если действие отклонено. Состояние при этом не менялось. */
  error?: string;
}

const MAX_LOG = 200;
/** Сколько добавляет кнопка «дать ещё время». */
const EXTRA_TIME_MS = 5000;

/** Какой таймер идёт в этой фазе. Редьюсер не знает о планировщике, только о фазе. */
function timerKindFor(phase: RoomState['phase']): TimerKind | null {
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

function reject(state: RoomState, error: string): ReduceResult {
  return { state, effects: [], error };
}

function log(state: RoomState, at: number, text: string): LogEntry[] {
  return [...state.log, { at, text }].slice(-MAX_LOG);
}

/** Чистая функция: ни I/O, ни таймеров, ни случайности. */
export function reduce(state: RoomState, action: GameAction): ReduceResult {
  switch (action.type) {
    case 'PLAYER_JOIN': {
      const name = action.name.trim();
      if (name === '') return reject(state, 'Имя не может быть пустым');

      const byToken = findByToken(state, action.sessionToken);
      if (byToken) {
        return {
          state: {
            ...state,
            players: updatePlayer(state.players, byToken.id, (player) => ({
              ...player,
              connected: true,
              name,
            })),
            log: log(state, action.at, `${name} снова в игре`),
          },
          effects: [{ type: 'persist' }],
        };
      }

      const byName = findByName(state, name);
      if (byName?.connected) return reject(state, 'Игрок с таким именем уже в игре');
      if (byName) {
        // Токен потерян (очистили браузер) — возвращаем игрока по имени вместе со счётом.
        return {
          state: {
            ...state,
            players: updatePlayer(state.players, byName.id, (player) => ({
              ...player,
              connected: true,
              sessionToken: action.sessionToken,
            })),
            log: log(state, action.at, `${name} снова в игре`),
          },
          effects: [{ type: 'persist' }],
        };
      }

      if (state.phase !== 'lobby' && state.phase !== 'picking') {
        return reject(state, 'Сейчас нельзя войти: дождитесь паузы между вопросами');
      }

      return {
        state: {
          ...state,
          players: [
            ...state.players,
            {
              id: action.playerId,
              name,
              score: 0,
              connected: true,
              joinedAt: action.at,
              sessionToken: action.sessionToken,
              hints: 0,
            },
          ],
          log: log(state, action.at, `${name} присоединился`),
        },
        effects: [{ type: 'persist' }],
      };
    }

    case 'PLAYER_DISCONNECT': {
      if (!findPlayer(state, action.playerId)) return reject(state, 'Игрок не найден');
      return {
        state: {
          ...state,
          players: updatePlayer(state.players, action.playerId, (player) => ({
            ...player,
            connected: false,
          })),
        },
        effects: [{ type: 'persist' }],
      };
    }

    case 'PLAYER_KICK': {
      const player = findPlayer(state, action.playerId);
      if (!player) return reject(state, 'Игрок не найден');
      return {
        state: {
          ...state,
          players: state.players.filter((candidate) => candidate.id !== action.playerId),
          controlPlayerId: state.controlPlayerId === action.playerId ? null : state.controlPlayerId,
          log: log(state, Date.now(), `${player.name} удалён из игры`),
        },
        effects: [{ type: 'persist' }],
      };
    }

    case 'SET_SCORE': {
      const player = findPlayer(state, action.playerId);
      if (!player) return reject(state, 'Игрок не найден');
      if (!Number.isFinite(action.score)) return reject(state, 'Некорректный счёт');
      return {
        state: {
          ...state,
          players: updatePlayer(state.players, action.playerId, (candidate) => ({
            ...candidate,
            score: Math.round(action.score),
          })),
          log: log(state, Date.now(), `Счёт ${player.name}: ${player.score} → ${action.score}`),
        },
        effects: [{ type: 'persist' }],
      };
    }

    case 'SET_SETTINGS': {
      return {
        state: { ...state, settings: { ...state.settings, ...action.settings } },
        effects: [{ type: 'persist' }],
      };
    }

    case 'SET_PACK': {
      // Состав меняется только до старта: доска уже сыгранных клеток не переживёт подмену.
      if (state.phase !== 'lobby') return reject(state, 'Состав можно менять только до начала игры');
      const first = action.pack.rounds[0];
      return {
        state: {
          ...state,
          pack: action.pack,
          // Старая карта клеток ссылалась на вопросы прежнего пака — новую
          // раскладку под новый пак вызывающий уже посчитал и передал сюда.
          modifierCells: action.modifierCells,
          roundIndex: 0,
          board: first ? buildBoard(first, action.modifierCells) : [],
        },
        effects: [{ type: 'persist' }],
      };
    }

    case 'HOST_PRESENCE': {
      return { state: { ...state, hostConnected: action.connected }, effects: [] };
    }

    case 'START_GAME': {
      if (state.phase !== 'lobby') return reject(state, 'Игра уже идёт');
      const first = [...state.players].sort((a, b) => a.joinedAt - b.joinedAt)[0];
      if (!first) return reject(state, 'Нужен хотя бы один игрок');
      return {
        state: {
          ...state,
          phase: 'picking',
          controlPlayerId: first.id,
          log: log(state, action.at, `Игра началась. Первым выбирает ${first.name}`),
        },
        effects: [{ type: 'sound', sound: 'round_start' }, { type: 'persist' }],
      };
    }

    case 'PICK_QUESTION': {
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
          // Без цели обмен сразу помечается как решённый (цель — сам открывший):
          // это не настоящий обмен, а сигнал сцене не ждать выбора на телефоне.
          modifier: {
            kind: modifierKind,
            playerId,
            targetPlayerId: modifierKind === 'swap' && !swapHasTarget ? playerId : null,
          },
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

      // Кнопку открывает ведущий, но если включён автостарт, движок делает это
      // за него: пауза даётся на то, чтобы дочитать вопрос вслух.
      if (phase === 'reading' && state.settings.autoOpenBuzzer) {
        const pause = state.settings.readingMs;
        if (pause <= 0) {
          const started = openBuzzer(opened, action.at);
          return { ...started, effects: [{ type: 'clearTimer' }, ...started.effects] };
        }
        return {
          state: opened,
          effects: [
            {
              type: 'setTimer',
              kind: 'reading',
              durationMs: pause,
              onExpire: { type: 'OPEN_BUZZER', at: action.at + pause },
            },
            { type: 'persist' },
          ],
        };
      }

      return {
        state: opened,
        effects: [{ type: 'clearTimer' }, { type: 'persist' }],
      };
    }

    case 'CONTINUE': {
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

    case 'NEXT_ROUND': {
      if (state.phase !== 'round_end' && state.phase !== 'round_intro') {
        return reject(state, 'Раунд ещё не закончен');
      }
      const next = advanceRound(state);
      return {
        state: {
          ...next,
          log: log(
            state,
            action.at,
            next.phase === 'results' ? 'Раунды закончились' : `Раунд ${next.roundIndex + 1}`,
          ),
        },
        effects: [{ type: 'clearTimer' }, { type: 'sound', sound: 'round_start' }, { type: 'persist' }],
      };
    }

    case 'SET_CONTROL': {
      if (!findPlayer(state, action.playerId)) return reject(state, 'Игрок не найден');
      return {
        state: { ...state, controlPlayerId: action.playerId },
        effects: [{ type: 'persist' }],
      };
    }

    case 'PAUSE': {
      if (state.paused === action.paused) return { state, effects: [] };
      return {
        state: { ...state, paused: action.paused },
        effects: [
          action.paused ? { type: 'pauseTimer' } : { type: 'resumeTimer' },
          { type: 'persist' },
        ],
      };
    }

    case 'OPEN_BUZZER': {
      return openBuzzer(state, action.at);
    }

    case 'BUZZ': {
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

    case 'BUZZ_WINDOW_CLOSED': {
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

    case 'JUDGE': {
      return judge(state, action.verdict, action.at);
    }

    case 'REVEAL_ANSWER': {
      if (!state.active) return reject(state, 'Нет открытого вопроса');
      const revealed = enterReveal(state, action.at, 'Ведущий раскрыл ответ');
      return { ...revealed, effects: [...revealed.effects, { type: 'persist' }] };
    }

    case 'SKIP_QUESTION': {
      if (!state.active) return reject(state, 'Нет открытого вопроса');
      const skipped = enterReveal(state, action.at, 'Вопрос снят');
      return { ...skipped, effects: [...skipped.effects, { type: 'persist' }] };
    }

    case 'EXTEND_TIME': {
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

    case 'CAT_TRANSFER': {
      if (state.phase !== 'cat_transfer' || !state.cat || !state.active) {
        return reject(state, 'Сейчас никто не передаёт кота');
      }
      const question = activeQuestion(state);
      const canKeep = question?.cat?.canKeep ?? false;
      if (action.toPlayerId === state.cat.fromPlayerId && !canKeep) {
        return reject(state, 'Кота нужно отдать другому игроку');
      }
      const receiver = findPlayer(state, action.toPlayerId);
      if (!receiver) return reject(state, 'Игрок не найден');

      return {
        state: {
          ...state,
          phase: 'cat_answer',
          cat: { ...state.cat, toPlayerId: receiver.id },
          active: { ...state.active, soloPlayerId: receiver.id },
          log: log(state, action.at, `Кот в мешке достаётся ${receiver.name}: «${state.cat.theme}»`),
        },
        effects: [{ type: 'sound', sound: 'cat' }, { type: 'persist' }],
      };
    }

    case 'MODIFIER_TARGET': {
      const modifier = state.modifier;
      if (state.phase !== 'modifier' || !modifier) return reject(state, 'Сейчас нечего менять');
      if (modifier.kind !== 'swap') return reject(state, 'Этот модификатор не меняет счёт');
      if (modifier.targetPlayerId !== null) return reject(state, 'Обмен уже состоялся');
      if (modifier.playerId !== action.playerId) {
        return reject(state, 'Выбирает тот, кто открыл клетку');
      }
      if (action.targetPlayerId === action.playerId) {
        return reject(state, 'С самим собой меняться нельзя');
      }
      const target = findPlayer(state, action.targetPlayerId);
      if (!target) return reject(state, 'Игрок не найден');

      const players = applyModifier(
        state.players,
        'swap',
        action.playerId,
        action.targetPlayerId,
        state.settings,
      );

      return {
        state: {
          ...state,
          players,
          modifier: { ...modifier, targetPlayerId: action.targetPlayerId },
          log: log(
            state,
            action.at,
            `${nameOf(state, action.playerId)} меняется счётом с ${target.name}`,
          ),
        },
        effects: [...modifierEffects(state, action.at), { type: 'persist' }],
      };
    }

    case 'BID': {
      const auction = state.auction;
      if (state.phase !== 'auction_bidding' || !auction || !state.active) {
        return reject(state, 'Сейчас нет торгов');
      }
      if (auction.turnPlayerId !== action.playerId) return reject(state, 'Сейчас не ваш ход');
      const player = findPlayer(state, action.playerId);
      if (!player) return reject(state, 'Игрок не найден');

      const step = state.settings.auctionStep;

      if (action.amount === 'pass') {
        const passed = { ...auction, passedIds: [...auction.passedIds, action.playerId] };
        return closeOrContinueAuction(state, passed, action.playerId, action.at);
      }

      const amount = action.amount === 'all-in' ? player.score : action.amount;
      if (!Number.isFinite(amount)) return reject(state, 'Некорректная ставка');
      if (amount > player.score) return reject(state, 'Ставка больше вашего счёта');
      if (amount < minRaise(auction, step)) {
        return reject(state, `Поднимать нужно минимум до ${minRaise(auction, step)}`);
      }

      const raised: AuctionState = {
        ...auction,
        currentBid: amount,
        leaderId: action.playerId,
        allInIds:
          amount === player.score ? [...auction.allInIds, action.playerId] : auction.allInIds,
      };
      const withLog: RoomState = {
        ...state,
        log: log(
          state,
          action.at,
          `${player.name}: ${amount === player.score ? 'ва-банк' : 'ставка'} ${amount}`,
        ),
      };
      const result = closeOrContinueAuction(withLog, raised, action.playerId, action.at);
      return {
        ...result,
        effects: [
          { type: 'sound', sound: amount === player.score ? 'all_in' : 'bid' },
          ...result.effects,
        ],
      };
    }

    case 'FINAL_REMOVE_THEME': {
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

    case 'FINAL_BET': {
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

    case 'FINAL_ANSWER': {
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

    case 'FINAL_JUDGE': {
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

    case 'GIVE_HINT': {
      const player = findPlayer(state, action.playerId);
      if (!player) return reject(state, 'Игрок не найден');
      // Без этой проверки счётчик мог бы уйти в минус, и ведущий раздавал бы подсказки без ограничений.
      if ((player.hints ?? 0) <= 0) return reject(state, 'У игрока нет жетона подсказки');

      return {
        state: {
          ...state,
          players: updatePlayer(state.players, action.playerId, (candidate) => ({
            ...candidate,
            hints: (candidate.hints ?? 0) - 1,
          })),
          log: log(state, action.at, `${player.name} получает подсказку от ведущего`),
        },
        effects: [{ type: 'persist' }],
      };
    }

    case 'TIMER_EXPIRED': {
      if (action.kind === 'buzz') {
        if (state.phase !== 'buzzer_open') return { state, effects: [] };
        const expired = enterReveal(state, action.at, 'Время вышло, никто не ответил');
        return {
          ...expired,
          effects: [{ type: 'sound', sound: 'time_up' }, ...expired.effects, { type: 'persist' }],
        };
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
  }
}

/** Отметить клетку сыгранной. Общее для вопросов и модификаторов. */
function markPlayed(
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

const nameOf = (state: RoomState, playerId: string): string =>
  state.players.find((player) => player.id === playerId)?.name ?? 'Игрок';

/** Эффекты сцены модификатора: таймер, а при нулевой настройке — его отсутствие.
 *  Имя нарочно отличается от `enterReveal`: та сцена показывает ответ на вопрос,
 *  эта — выпавший модификатор, и путать их нельзя. */
function modifierEffects(state: RoomState, at: number): Effect[] {
  const durationMs = state.settings.modifierMs;
  if (durationMs <= 0) return [{ type: 'clearTimer' }];
  return [
    {
      type: 'setTimer',
      kind: 'modifier',
      durationMs,
      onExpire: { type: 'TIMER_EXPIRED', kind: 'modifier', at: at + durationMs },
    },
  ];
}

/** После каждой ставки: либо ход следующему, либо торги закончены и играет лидер. */
function closeOrContinueAuction(
  state: RoomState,
  auction: AuctionState,
  afterPlayerId: string,
  at: number,
): ReduceResult {
  const turn = nextBidder(state, auction, afterPlayerId);
  const withSkipped: AuctionState = {
    ...auction,
    passedIds: [...new Set([...auction.passedIds, ...turn.skipped])],
  };

  if (turn.playerId !== null) {
    return {
      state: { ...state, auction: { ...withSkipped, turnPlayerId: turn.playerId } },
      effects: [{ type: 'persist' }],
    };
  }

  const winnerId = withSkipped.leaderId;
  const winner = winnerId ? findPlayer(state, winnerId) : undefined;
  if (!winnerId || !winner || !state.active) return reject(state, 'Торги некому выиграть');

  return {
    state: {
      ...state,
      phase: 'auction_answer',
      auction: { ...withSkipped, turnPlayerId: null },
      active: { ...state.active, price: withSkipped.currentBid, soloPlayerId: winnerId },
      log: log(state, at, `Аукцион выиграл ${winner.name} за ${withSkipped.currentBid}`),
    },
    effects: [{ type: 'persist' }],
  };
}

/** Вскрытие идёт от меньшего счёта к большему — интрига держится до конца. */
function startFinalReveal(state: RoomState, final: FinalState): RoomState {
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

/** Вердикт ведущего: счёт, право хода и что делать с кнопкой дальше. */
function judge(state: RoomState, verdict: 'correct' | 'wrong', at: number): ReduceResult {
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
function openBuzzer(state: RoomState, at: number): ReduceResult {
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
function enterReveal(state: RoomState, at: number, reason: string): ReduceResult {
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
