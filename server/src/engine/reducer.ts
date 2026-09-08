import type { LogEntry, RoomState } from '@svoyak/shared';
import type { Effect, GameAction } from './actions.js';
import { findByName, findByToken, findPlayer, updatePlayer } from './players.js';

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
  }
}
