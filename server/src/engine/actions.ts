import type { RoomSettings, SoundId, TimerKind } from '@svoyak/shared';

/** Действия, которые понимает редьюсер. Всё, что меняет игру, проходит через них. */
export type GameAction =
  | { type: 'PLAYER_JOIN'; playerId: string; name: string; sessionToken: string; at: number }
  | { type: 'PLAYER_DISCONNECT'; playerId: string }
  | { type: 'PLAYER_KICK'; playerId: string }
  | { type: 'SET_SCORE'; playerId: string; score: number }
  | { type: 'SET_SETTINGS'; settings: Partial<RoomSettings> }
  | { type: 'HOST_PRESENCE'; connected: boolean }
  | { type: 'START_GAME'; at: number }
  /** Вопрос всегда открывает ведущий: игрок называет свой выбор вслух. */
  | { type: 'PICK_QUESTION'; themeId: string; questionId: string; at: number }
  | { type: 'CONTINUE'; at: number }
  | { type: 'NEXT_ROUND'; at: number }
  | { type: 'SET_CONTROL'; playerId: string }
  | { type: 'PAUSE'; paused: boolean }
  | { type: 'TIMER_EXPIRED'; kind: TimerKind; at: number }
  | { type: 'OPEN_BUZZER'; at: number }
  | {
      type: 'BUZZ';
      playerId: string;
      /** Метка нажатия, уже приведённая к серверному времени. */
      atServerTime: number;
      receivedAt: number;
    }
  | { type: 'BUZZ_WINDOW_CLOSED'; at: number }
  | { type: 'JUDGE'; verdict: 'correct' | 'wrong'; at: number }
  | { type: 'REVEAL_ANSWER'; at: number }
  | { type: 'SKIP_QUESTION'; at: number }
  | { type: 'EXTEND_TIME'; at: number }
  /** Кот в мешке: открывший передаёт вопрос выбранному игроку. */
  | { type: 'CAT_TRANSFER'; toPlayerId: string; at: number }
  /** Аукцион: ставка, ва-банк или пас. */
  | { type: 'BID'; playerId: string; amount: number | 'all-in' | 'pass'; at: number };

/** Побочные действия: редьюсер их только описывает, исполняет RoomRuntime. */
export type Effect =
  | { type: 'persist' }
  | { type: 'sound'; sound: SoundId }
  | { type: 'toast'; to: 'host' | 'all' | { playerId: string }; text: string; tone: 'info' | 'warn' | 'error' }
  | { type: 'setTimer'; kind: TimerKind; durationMs: number; onExpire: GameAction }
  | { type: 'clearTimer' }
  | { type: 'pauseTimer' }
  | { type: 'resumeTimer' };

/** Действия, которые ведущий может отменить кнопкой «отменить». */
const UNDOABLE = new Set<GameAction['type']>([
  'SET_SCORE',
  'PLAYER_KICK',
  'PICK_QUESTION',
  'SET_CONTROL',
  'JUDGE',
  'SKIP_QUESTION',
  'CAT_TRANSFER',
]);

export function isUndoable(action: GameAction): boolean {
  return UNDOABLE.has(action.type);
}
