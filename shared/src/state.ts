import type { Media, Pack, QuestionType } from './pack.js';
import type { ModifierKind } from './modifiers.js';
import type { ModifierPlan } from './game.js';
import type { RoomSettings } from './settings.js';

/** Фазы игры. Пауза — отдельный флаг поверх фазы, а не фаза. */
export type Phase =
  | 'lobby'
  | 'round_intro'
  | 'picking'
  | 'announce'
  | 'modifier'
  | 'reading'
  | 'cat_transfer'
  | 'cat_answer'
  | 'auction_bidding'
  | 'auction_answer'
  | 'buzzer_open'
  | 'answering'
  | 'answer_reveal'
  | 'round_end'
  | 'final_theme_removal'
  | 'final_bets'
  | 'final_answers'
  | 'final_reveal'
  | 'results';

/** Таймеры ограничивают только игроков. Темп игры задаёт ведущий:
 *  он открывает вопрос, открывает кнопку и решает, когда ответа достаточно. */
export type TimerKind = 'announce' | 'reading' | 'buzz' | 'reveal' | 'modifier' | 'final_bet' | 'final_answer';

export interface TimerState {
  kind: TimerKind;
  /** Серверное время окончания. При паузе замораживается через `remainingMs`. */
  endsAt: number;
  totalMs: number;
  /** Заполняется при паузе, чтобы восстановить остаток. */
  remainingMs: number | null;
}

export interface Player {
  id: string;
  name: string;
  score: number;
  connected: boolean;
  joinedAt: number;
  /** Секрет для переподключения. Никогда не попадает в проекции. */
  sessionToken: string;
  /** Жетоны подсказки: тратит их ведущий по просьбе игрока вслух. */
  hints: number;
}

export interface BoardCell {
  questionId: string;
  price: number;
  played: boolean;
  /** Под клеткой не вопрос, а модификатор. В проекции срезается, пока клетка
   *  не открыта: снаружи она ничем не отличается от обычной. */
  modifier?: ModifierKind;
}

export interface BoardTheme {
  id: string;
  title: string;
  cells: BoardCell[];
}

/** Клетка доски снаружи, для всех проекций. `Omit<BoardCell, 'modifier'>`
 *  тут не годится: Omit лишь убирает поле из объявленной формы, но не
 *  запрещает источник, который структурно всё ещё его несёт, — `BoardCell[]`
 *  (с необязательным `modifier`) прошёл бы в `Omit<BoardCell,
 *  'modifier'>[]` без единой ошибки, потому что проверка совместимости
 *  массива смотрит на присваиваемость элементов, а не на точный список
 *  ключей. Поэтому `modifier` объявлен как `never`: значение вида
 *  `ModifierKind`, пришедшее из `BoardCell`, в `never` не влезает, и
 *  `board: state.board` откажется типизироваться. Это доказано тестом
 *  `boardSecrecy.test.ts` (`@ts-expect-error` на незаконном присваивании),
 *  а не только утверждается в комментарии. Runtime-срез в `projectBoard()` и
 *  `modifierSecrecy.test.ts` остаются: тип ловит ошибку в коде, тест —
 *  то, что реально уходит по сети. */
export interface BoardCellView {
  questionId: string;
  price: number;
  played: boolean;
  modifier?: never;
}

export interface BoardThemeView {
  id: string;
  title: string;
  cells: BoardCellView[];
}

/** Вопрос, который сейчас в игре. */
export interface ActiveQuestion {
  themeId: string;
  themeTitle: string;
  questionId: string;
  /** Цена, по которой идёт игра: у кота и аукциона отличается от номинала. */
  price: number;
  nominalPrice: number;
  type: QuestionType;
  /** Игроки, потерявшие право отвечать на этот вопрос. */
  spentPlayerIds: string[];
  /** Кому достался вопрос без кнопки (кот, аукцион). */
  soloPlayerId: string | null;
  answerRevealed: boolean;
}

export interface BuzzCandidate {
  playerId: string;
  /** Момент нажатия в серверном времени после компенсации пинга. */
  atServerTime: number;
}

export interface BuzzState {
  /** Серверное время открытия кнопки; null — кнопка закрыта. */
  openedAt: number | null;
  /** До какого момента кнопка открыта суммарно по вопросу. */
  closesAt: number | null;
  /** Окно сбора нажатий закрывается в этот момент. */
  graceClosesAt: number | null;
  candidates: BuzzCandidate[];
  /** Момент, с которого игрок отвечает вслух: бюджет кнопки на это время заморожен. */
  answeringSince: number | null;
  /** playerId → время окончания блокировки за фальстарт. */
  lockedUntil: Record<string, number>;
  answeringPlayerId: string | null;
}

export interface AuctionState {
  currentBid: number;
  leaderId: string | null;
  turnPlayerId: string | null;
  passedIds: string[];
  allInIds: string[];
}

export interface CatState {
  fromPlayerId: string;
  toPlayerId: string | null;
  theme: string;
  price: number;
}

export interface FinalThemeState {
  id: string;
  title: string;
  removedByPlayerId: string | null;
}

export interface FinalState {
  participantIds: string[];
  themes: FinalThemeState[];
  removalTurnPlayerId: string | null;
  bets: Record<string, number>;
  answers: Record<string, string>;
  /** Порядок вскрытия — от меньшего счёта к большему. */
  revealOrder: string[];
  revealIndex: number;
  judged: Record<string, boolean>;
}

/** Открытая клетка-модификатор. Вопроса под ней нет. */
export interface ModifierState {
  kind: ModifierKind;
  /** Кто открыл клетку: эффект действует на него. */
  playerId: string;
  /** Только для обмена: с кем меняемся. До выбора — null. */
  targetPlayerId: string | null;
}

export interface ModifierView {
  kind: ModifierKind;
  playerId: string;
  targetPlayerId: string | null;
}

export interface LogEntry {
  at: number;
  text: string;
}

export interface RoomState {
  code: string;
  createdAt: number;
  settings: RoomSettings;
  /** Пак копируется в комнату целиком: правки пака не меняют идущую игру. */
  pack: Pack;
  /** Куда легли клетки-модификаторы: questionId → вид. Считается один раз при
   *  создании комнаты, поэтому переживает сохранение и отмену хода. */
  modifierCells: Record<string, ModifierKind>;
  /** План, по которому раскладка считалась. Хранится отдельно от самой
   *  раскладки: при пересборке состава в лобби («Состав игры») новый пак
   *  получает свежую раскладку по этому же плану, а не наследует старую
   *  карту, ссылающуюся на вопросы, которых в новом паке уже нет. */
  modifierPlan: ModifierPlan;
  hostToken: string;
  hostConnected: boolean;
  players: Player[];
  phase: Phase;
  roundIndex: number;
  board: BoardTheme[];
  active: ActiveQuestion | null;
  /** У кого право хода. */
  controlPlayerId: string | null;
  buzz: BuzzState;
  auction: AuctionState | null;
  cat: CatState | null;
  modifier: ModifierState | null;
  final: FinalState | null;
  timer: TimerState | null;
  paused: boolean;
  log: LogEntry[];
}

/* ── Проекции для клиентов ─────────────────────────────────────────────── */

export type Role = 'host' | 'player' | 'board';

export interface PlayerPublic {
  id: string;
  name: string;
  score: number;
  connected: boolean;
  isControl: boolean;
  isAnswering: boolean;
  /** Заблокирован фальстартом до этого момента. */
  lockedUntil: number | null;
  hints: number;
}

export interface QuestionViewCommon {
  themeTitle: string;
  price: number;
  type: QuestionType;
  text: string;
  media?: Media;
}

/** То, что видит ведущий: с ответом и комментарием. */
export interface HostQuestionView extends QuestionViewCommon {
  answer: string;
  altAnswers: string[];
  answerMedia?: Media;
  hostComment?: string;
}

/** То, что видят игроки и общий экран. Ответ появляется только после раскрытия. */
export interface PublicQuestionView extends QuestionViewCommon {
  revealedAnswer?: string;
  revealedAnswerMedia?: Media;
  /** Текст ещё не показывают: кота передают вслепую, на аукционе торгуются по теме. */
  hidden?: boolean;
}

export interface TimerView {
  kind: TimerKind;
  endsAt: number;
  totalMs: number;
  remainingMs: number | null;
}

export interface BaseView {
  code: string;
  phase: Phase;
  paused: boolean;
  packTitle: string;
  roundTitle: string;
  roundIndex: number;
  roundsTotal: number;
  board: BoardThemeView[];
  players: PlayerPublic[];
  controlPlayerId: string | null;
  timer: TimerView | null;
}

export interface AuctionView {
  currentBid: number;
  leaderId: string | null;
  turnPlayerId: string | null;
  passedIds: string[];
}

export interface CatView {
  fromPlayerId: string;
  toPlayerId: string | null;
  theme: string;
  price: number;
}

export interface FinalPublicView {
  themes: FinalThemeState[];
  /** Оставшаяся тема — известна с самого начала ставок. */
  themeTitle: string | null;
  /** Текст вопроса появляется только когда пора отвечать: ставят вслепую. */
  questionText: string | null;
  /** Медиа финального вопроса. Появляется вместе с текстом. */
  questionMedia?: Media;
  removalTurnPlayerId: string | null;
  participantIds: string[];
  /** Кто уже сделал ставку и написал ответ — без содержимого. */
  betPlacedIds: string[];
  answerPlacedIds: string[];
  /** Вскрытые ответы: заполняются по мере показа ведущим. */
  revealed: FinalRevealedEntry[];
  currentRevealPlayerId: string | null;
}

export interface FinalRevealedEntry {
  playerId: string;
  bet: number;
  answer: string;
  correct: boolean | null;
}

/** Финал глазами ведущего: с ответом и с тем, кто ещё не сдал ставку. */
export interface FinalHostView extends FinalPublicView {
  answer: string | null;
  altAnswers: string[];
  hostComment?: string;
  /** Ставки и ответы целиком — ведущий вскрывает их по одному. */
  bets: Record<string, number>;
  answers: Record<string, string>;
}

/** Шпаргалка ведущего: вопросы раунда, которые ещё можно выбрать, чтобы
 *  прочитать их заранее. Строится по закрытым клеткам, и у клетки-модификатора
 *  тут та же запись, что у обычной, — модификатор ведущему не выдаётся. */
export interface CheatSheetQuestion {
  questionId: string;
  price: number;
  type: QuestionType;
  text: string;
  answer: string;
  altAnswers: string[];
  hostComment?: string;
  /** Тема кота в мешке: её объявляют вместо темы клетки. */
  catTheme?: string;
}

export interface CheatSheetTheme {
  id: string;
  title: string;
  /** Пояснение к теме из пака — зачитывается перед раундом. */
  comment?: string;
  questions: CheatSheetQuestion[];
}

export interface HostView extends BaseView {
  role: 'host';
  settings: RoomSettings;
  question: HostQuestionView | null;
  auction: AuctionView | null;
  cat: CatView | null;
  modifier: ModifierView | null;
  final: FinalHostView | null;
  log: LogEntry[];
  cheatSheet: CheatSheetTheme[];
  canUndo: boolean;
  /** Ссылка для подключения игроков, показывается вместе с QR. */
  joinUrl: string;
}

/** Что телефон игрока должен предложить сделать прямо сейчас. */
export type PlayerPrompt =
  | { kind: 'buzz'; open: boolean; lockedUntil: number | null }
  /** Очередь этого игрока называть вопрос — вслух ведущему, не кликом. */
  | { kind: 'your_turn' }
  | { kind: 'cat_pick'; candidates: Array<{ id: string; name: string }>; canKeep: boolean }
  /** Обмен счётом: открывший клетку выбирает, с кем поменяться. */
  | { kind: 'modifier_swap'; candidates: Array<{ id: string; name: string }> }
  | { kind: 'auction_bid'; currentBid: number; minBid: number; maxBid: number; canPass: boolean }
  | { kind: 'solo_answer' }
  | { kind: 'final_remove_theme'; themes: Array<{ id: string; title: string }> }
  | { kind: 'final_bet'; min: number; max: number; placed: boolean }
  | { kind: 'final_answer'; placed: boolean }
  | { kind: 'wait' };

export interface PlayerView extends BaseView {
  role: 'player';
  meId: string;
  myScore: number;
  question: PublicQuestionView | null;
  prompt: PlayerPrompt;
  auction: AuctionView | null;
  cat: CatView | null;
  modifier: ModifierView | null;
  final: FinalPublicView | null;
  /** Моя ставка и мой ответ в финале — только свои. */
  myFinalBet: number | null;
  myFinalAnswer: string | null;
}

export interface BoardView extends BaseView {
  role: 'board';
  question: PublicQuestionView | null;
  /** Спецвопросы показываются и на общем экране: секретного в них ничего нет. */
  cat: CatView | null;
  auction: AuctionView | null;
  modifier: ModifierView | null;
  final: FinalPublicView | null;
  joinUrl: string;
}

export type AnyView = HostView | PlayerView | BoardView;
