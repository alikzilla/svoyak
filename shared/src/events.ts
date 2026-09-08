import type { Pack, PackSummary } from './pack.js';
import type { RoomSettings } from './settings.js';
import type { AnyView, Role } from './state.js';

/** Результат запроса с подтверждением. Ошибки — часть контракта, а не исключения. */
export type Result<T> = { ok: true; data: T } | { ok: false; error: string };
export type Ack<T> = (result: Result<T>) => void;

export interface ClockPong {
  /** Метка клиента, вернувшаяся без изменений. */
  t0: number;
  /** Серверное время в момент ответа. */
  tServer: number;
}

export interface CreateRoomPayload {
  packId: string;
  settings?: Partial<RoomSettings>;
}

export interface CreateRoomResult {
  code: string;
  hostToken: string;
}

export interface JoinRoomPayload {
  code: string;
  name: string;
}

export interface JoinRoomResult {
  playerId: string;
  sessionToken: string;
}

export interface RejoinPayload {
  code: string;
  /** Токен игрока или ведущего. */
  token: string;
  role: Role;
}

export interface RejoinResult {
  playerId: string | null;
  role: Role;
}

export interface WatchBoardPayload {
  code: string;
}

export interface PickQuestionPayload {
  themeId: string;
  questionId: string;
}

export type Judgement = 'correct' | 'wrong';

export interface JudgePayload {
  verdict: Judgement;
}

export interface AdjustScorePayload {
  playerId: string;
  /** Новое значение счёта, а не дельта: ведущий правит число, которое видит. */
  score: number;
}

export interface KickPayload {
  playerId: string;
}

export interface CatTransferPayload {
  toPlayerId: string;
}

export interface BidPayload {
  /** Сумма ставки; `all-in` — весь счёт игрока. */
  amount: number | 'all-in' | 'pass';
}

export interface BuzzPayload {
  /** Локальная метка времени клиента в момент нажатия. */
  clientTime: number;
  /** Оценка смещения часов клиента относительно сервера (мс). */
  clockOffset: number;
  /** Минимальный измеренный RTT, мс. */
  minRtt: number;
}

export interface FinalRemoveThemePayload {
  themeId: string;
}

export interface FinalBetPayload {
  bet: number;
}

export interface FinalAnswerPayload {
  answer: string;
}

export interface FinalJudgePayload {
  correct: boolean;
}

export type SoundId =
  | 'buzz_open'
  | 'buzz_hit'
  | 'correct'
  | 'wrong'
  | 'time_up'
  | 'round_start'
  | 'game_over';

export interface ClientToServerEvents {
  'clock:ping': (payload: { t0: number }, ack: (pong: ClockPong) => void) => void;

  'room:create': (payload: CreateRoomPayload, ack: Ack<CreateRoomResult>) => void;
  'room:join': (payload: JoinRoomPayload, ack: Ack<JoinRoomResult>) => void;
  'room:rejoin': (payload: RejoinPayload, ack: Ack<RejoinResult>) => void;
  'room:watch': (payload: WatchBoardPayload, ack: Ack<null>) => void;
  'room:leave': (ack: Ack<null>) => void;

  'host:updateSettings': (payload: Partial<RoomSettings>, ack: Ack<null>) => void;
  'host:startGame': (ack: Ack<null>) => void;
  'host:pickQuestion': (payload: PickQuestionPayload, ack: Ack<null>) => void;
  'host:openBuzzer': (ack: Ack<null>) => void;
  'host:judge': (payload: JudgePayload, ack: Ack<null>) => void;
  'host:revealAnswer': (ack: Ack<null>) => void;
  /** Закрыть разыгранный вопрос и вернуться к выбору. */
  'host:continue': (ack: Ack<null>) => void;
  'host:skipQuestion': (ack: Ack<null>) => void;
  'host:extendTime': (ack: Ack<null>) => void;
  'host:setControl': (payload: { playerId: string }, ack: Ack<null>) => void;
  'host:adjustScore': (payload: AdjustScorePayload, ack: Ack<null>) => void;
  'host:kick': (payload: KickPayload, ack: Ack<null>) => void;
  'host:pause': (payload: { paused: boolean }, ack: Ack<null>) => void;
  'host:undo': (ack: Ack<null>) => void;
  'host:nextRound': (ack: Ack<null>) => void;
  'host:finalJudge': (payload: FinalJudgePayload, ack: Ack<null>) => void;
  'host:finalRevealNext': (ack: Ack<null>) => void;

  'player:buzz': (payload: BuzzPayload, ack: Ack<null>) => void;
  'player:pickQuestion': (payload: PickQuestionPayload, ack: Ack<null>) => void;
  'player:catTransfer': (payload: CatTransferPayload, ack: Ack<null>) => void;
  'player:bid': (payload: BidPayload, ack: Ack<null>) => void;
  'player:finalRemoveTheme': (payload: FinalRemoveThemePayload, ack: Ack<null>) => void;
  'player:finalBet': (payload: FinalBetPayload, ack: Ack<null>) => void;
  'player:finalAnswer': (payload: FinalAnswerPayload, ack: Ack<null>) => void;
}

export interface ServerToClientEvents {
  /** Полная проекция состояния для роли этого сокета. */
  'state:sync': (view: AnyView) => void;
  'sound:play': (sound: SoundId) => void;
  /** Короткое сообщение поверх интерфейса (фальстарт, ошибка действия). */
  'toast': (payload: { text: string; tone: 'info' | 'warn' | 'error' }) => void;
  'room:closed': (payload: { reason: string }) => void;
}

/** REST-контракты редактора паков. */
export interface PacksListResponse {
  packs: PackSummary[];
}

export interface PackResponse {
  pack: Pack;
}
