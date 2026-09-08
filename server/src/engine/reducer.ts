import type { LogEntry, RoomState } from '@svoyak/shared';
import type { Effect, GameAction } from './actions.js';
import { findByName, findByToken, findPlayer, updatePlayer } from './players.js';
import { advanceRound, closeQuestion, hasOpenQuestion, resetBuzz } from './flow.js';
import { findQuestion, findTheme } from './questions.js';

export interface ReduceResult {
  state: RoomState;
  effects: Effect[];
  /** Заполнено, если действие отклонено. Состояние при этом не менялось. */
  error?: string;
}

const MAX_LOG = 200;

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
      if (action.byPlayerId !== null && action.byPlayerId !== state.controlPlayerId) {
        return reject(state, 'Право хода не у вас');
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

    case 'TIMER_EXPIRED': {
      return { state, effects: [] };
    }
  }
}
