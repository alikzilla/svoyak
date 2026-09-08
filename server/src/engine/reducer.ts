import type { LogEntry, RoomState, TimerKind } from '@svoyak/shared';
import type { Effect, GameAction } from './actions.js';
import { findByName, findByToken, findPlayer, updatePlayer } from './players.js';
import { advanceRound, closeQuestion, hasOpenQuestion, resetBuzz } from './flow.js';
import { findQuestion, findTheme } from './questions.js';
import { canBuzz, pickWinner } from './buzz.js';
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
    case 'reading':
      return 'reading';
    case 'buzzer_open':
      return 'buzz';
    case 'answering':
      return 'answer';
    case 'cat_answer':
    case 'auction_answer':
      return 'solo_answer';
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

      return {
        state: {
          ...state,
          phase: 'reading',
          board: state.board.map((candidate) =>
            candidate.id !== action.themeId
              ? candidate
              : {
                  ...candidate,
                  cells: candidate.cells.map((current) =>
                    current.questionId === action.questionId ? { ...current, played: true } : current,
                  ),
                },
          ),
          active: {
            themeId: theme.id,
            themeTitle: theme.title,
            questionId: question.id,
            price: question.price,
            nominalPrice: question.price,
            type: question.type,
            spentPlayerIds: [],
            soloPlayerId: null,
            answerRevealed: false,
          },
          buzz: resetBuzz(),
          log: log(state, action.at, `${theme.title} за ${question.price}`),
        },
        effects: [
          {
            type: 'setTimer',
            kind: 'reading',
            durationMs: state.settings.readingTimeMs,
            onExpire: { type: 'TIMER_EXPIRED', kind: 'reading', at: action.at },
          },
          { type: 'persist' },
        ],
      };
    }

    case 'CONTINUE': {
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

      // Нажатие до открытия кнопки: блокируем нажавшего на этот вопрос.
      if (state.phase === 'reading') {
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
          },
          log: log(state, action.at, `Отвечает ${player?.name ?? '—'}`),
        },
        effects: [
          { type: 'sound', sound: 'buzz_hit' },
          {
            type: 'setTimer',
            kind: 'answer',
            durationMs: state.settings.answerTimeMs,
            onExpire: { type: 'TIMER_EXPIRED', kind: 'answer', at: action.at },
          },
        ],
      };
    }

    case 'JUDGE': {
      return judge(state, action.verdict, action.at);
    }

    case 'REVEAL_ANSWER': {
      if (!state.active) return reject(state, 'Нет открытого вопроса');
      return {
        state: revealAnswer(state, action.at, 'Ведущий раскрыл ответ'),
        effects: [{ type: 'clearTimer' }, { type: 'persist' }],
      };
    }

    case 'SKIP_QUESTION': {
      if (!state.active) return reject(state, 'Нет открытого вопроса');
      return {
        state: revealAnswer(state, action.at, 'Вопрос снят'),
        effects: [{ type: 'clearTimer' }, { type: 'persist' }],
      };
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

    case 'TIMER_EXPIRED': {
      if (action.kind === 'reading') return openBuzzer(state, action.at);
      if (action.kind === 'answer') return judge(state, 'wrong', action.at);

      if (action.kind === 'buzz') {
        if (state.phase !== 'buzzer_open') return { state, effects: [] };
        return {
          state: revealAnswer(state, action.at, 'Время вышло, никто не ответил'),
          effects: [{ type: 'sound', sound: 'time_up' }, { type: 'clearTimer' }, { type: 'persist' }],
        };
      }

      return { state, effects: [] };
    }
  }
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
    return {
      state: closeQuestion({
        ...state,
        players,
        controlPlayerId: playerId,
        log: log(state, at, `${player.name}: верно, +${active.price}`),
      }),
      effects: [{ type: 'sound', sound: 'correct' }, { type: 'clearTimer' }, { type: 'persist' }],
    };
  }

  const spentPlayerIds = [...active.spentPlayerIds, playerId];
  const afterWrong: RoomState = {
    ...state,
    players,
    active: { ...active, spentPlayerIds },
    buzz: { ...state.buzz, answeringPlayerId: null, candidates: [], graceClosesAt: null },
    log: log(state, at, `${player.name}: неверно, ${penalised === 0 ? 'без штрафа' : penalised}`),
  };

  // Остальные доигрывают остаток общего бюджета времени на кнопку.
  const closesAt = state.buzz.closesAt ?? 0;
  const remainingMs = closesAt - at;
  const someoneLeft = state.players.some(
    (candidate) => !spentPlayerIds.includes(candidate.id) && candidate.connected,
  );

  if (remainingMs <= 0 || !someoneLeft) {
    return {
      state: revealAnswer(afterWrong, at, 'Отвечать больше некому'),
      effects: [{ type: 'sound', sound: 'wrong' }, { type: 'clearTimer' }, { type: 'persist' }],
    };
  }

  return {
    state: { ...afterWrong, phase: 'buzzer_open' },
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

/** Показать правильный ответ всем: с этого момента он попадает в проекции игроков. */
export function revealAnswer(state: RoomState, at: number, reason: string): RoomState {
  return {
    ...state,
    phase: 'answer_reveal',
    active: state.active ? { ...state.active, answerRevealed: true } : null,
    buzz: { ...state.buzz, answeringPlayerId: null, candidates: [], graceClosesAt: null },
    timer: null,
    log: [...state.log, { at, text: reason }].slice(-200),
  };
}
