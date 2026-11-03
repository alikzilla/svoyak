/** Комната и её участники: вход, выход, счёт, настройки, право хода, пауза, раунды. */
import type { RoomState } from '@svoyak/shared';
import { findByName, findByToken, findPlayer, updatePlayer } from './players.js';
import { advanceRound, gameIntroTimer, roundIntroTimer } from './flow.js';
import { buildBoard } from './board.js';
import type { ReduceResult, ActionOf } from './reduceCommon.js';
import { reject, log } from './reduceCommon.js';

export function onPlayerJoin(state: RoomState, action: ActionOf<'PLAYER_JOIN'>): ReduceResult {
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

export function onPlayerDisconnect(state: RoomState, action: ActionOf<'PLAYER_DISCONNECT'>): ReduceResult {
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

export function onPlayerKick(state: RoomState, action: ActionOf<'PLAYER_KICK'>): ReduceResult {
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

export function onSetScore(state: RoomState, action: ActionOf<'SET_SCORE'>): ReduceResult {
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

export function onSetSettings(state: RoomState, action: ActionOf<'SET_SETTINGS'>): ReduceResult {
  return {
    state: { ...state, settings: { ...state.settings, ...action.settings } },
    effects: [{ type: 'persist' }],
  };
}

export function onSetPack(state: RoomState, action: ActionOf<'SET_PACK'>): ReduceResult {
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

export function onHostPresence(state: RoomState, action: ActionOf<'HOST_PRESENCE'>): ReduceResult {
  return { state: { ...state, hostConnected: action.connected }, effects: [] };
}

export function onStartGame(state: RoomState, action: ActionOf<'START_GAME'>): ReduceResult {
  if (state.phase !== 'lobby') return reject(state, 'Игра уже идёт');
  const first = [...state.players].sort((a, b) => a.joinedAt - b.joinedAt)[0];
  if (!first) return reject(state, 'Нужен хотя бы один игрок');
  return {
    state: {
      ...state,
      phase: 'game_intro',
      controlPlayerId: first.id,
      log: log(state, action.at, `Игра началась. Первым выбирает ${first.name}`),
    },
    effects: [
      { type: 'sound', sound: 'round_start' },
      gameIntroTimer(state, action.at),
      { type: 'persist' },
    ],
  };
}

export function onNextRound(state: RoomState, action: ActionOf<'NEXT_ROUND'>): ReduceResult {
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
    effects: [
      { type: 'clearTimer' },
      { type: 'sound', sound: 'round_start' },
      ...(next.phase === 'round_intro' ? [roundIntroTimer(next, action.at)] : []),
      { type: 'persist' },
    ],
  };
}

export function onSetControl(state: RoomState, action: ActionOf<'SET_CONTROL'>): ReduceResult {
  if (!findPlayer(state, action.playerId)) return reject(state, 'Игрок не найден');
  return {
    state: { ...state, controlPlayerId: action.playerId },
    effects: [{ type: 'persist' }],
  };
}

export function onPause(state: RoomState, action: ActionOf<'PAUSE'>): ReduceResult {
  if (state.paused === action.paused) return { state, effects: [] };
  return {
    state: { ...state, paused: action.paused },
    effects: [
      action.paused ? { type: 'pauseTimer' } : { type: 'resumeTimer' },
      { type: 'persist' },
    ],
  };
}

export function onGiveHint(state: RoomState, action: ActionOf<'GIVE_HINT'>): ReduceResult {
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
