import { DEFAULT_SETTINGS, type ClientToServerEvents, type Result } from '@svoyak/shared';

/**
 * Проверка входящих сокет-пакетов до обработчиков. Типы на клиенте — обещание,
 * а не гарантия: сломанный или чужой клиент пришлёт что угодно, и одно
 * `name.trim()` на числе роняло весь процесс вместе с вечером.
 */

type Check = (payload: unknown) => boolean;
type Field = (value: unknown) => boolean;

/** Длинная строка в идентификаторе или коде — уже ошибка, а не данные. */
const MAX_ID = 200;
/** Текст ответа в финале режется до 200 символов в редьюсере; запас на эмодзи. */
const MAX_TEXT = 1000;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const text =
  (max: number): Field =>
  (value) =>
    typeof value === 'string' && value.length <= max;

const id = text(MAX_ID);
const finite: Field = (value) => typeof value === 'number' && Number.isFinite(value);
const bool: Field = (value) => typeof value === 'boolean';
const oneOf =
  (...allowed: readonly unknown[]): Field =>
  (value) =>
    allowed.includes(value);
const optional =
  (field: Field): Field =>
  (value) =>
    value === undefined || field(value);

/** Объект ровно с этими полями: лишние ключи не мешают, кривые значения — да. */
const shape =
  (fields: Record<string, Field>): Check =>
  (payload) =>
    isObject(payload) && Object.entries(fields).every(([key, field]) => field(payload[key]));

/** Частичные настройки комнаты: только известные ключи и только того же типа,
 *  что у значения по умолчанию. Числа — конечные и неотрицательные. */
export const isSettingsPatch: Field = (value) => {
  if (!isObject(value)) return false;
  const defaults = DEFAULT_SETTINGS as unknown as Record<string, unknown>;
  return Object.entries(value).every(([key, setting]) => {
    if (!(key in defaults)) return false;
    const expected = typeof defaults[key];
    if (typeof setting !== expected) return false;
    return expected !== 'number' || (finite(setting) && (setting as number) >= 0);
  });
};

/** null — у события нет полезной нагрузки, только колбэк подтверждения.
 *  Record по всем событиям: новое событие без проверки не скомпилируется. */
const PAYLOADS: Record<keyof ClientToServerEvents, Check | null> = {
  'clock:ping': shape({ t0: finite }),

  'room:create': shape({
    packId: optional(id),
    gameId: optional(id),
    recipe: optional(isObject),
    settings: optional(isSettingsPatch),
  }),
  'room:join': shape({ code: id, name: text(MAX_ID) }),
  'room:rejoin': shape({ code: id, token: id, role: oneOf('host', 'player', 'board') }),
  'room:watch': shape({ code: id }),
  'room:leave': null,

  'host:updateSettings': isSettingsPatch,
  'host:setRecipe': shape({ recipe: isObject }),
  'host:startGame': null,
  'host:pickQuestion': shape({ themeId: id, questionId: id }),
  'host:openBuzzer': null,
  'host:judge': shape({ verdict: oneOf('correct', 'wrong') }),
  'host:revealAnswer': null,
  'host:continue': null,
  'host:skipQuestion': null,
  'host:extendTime': null,
  'host:setControl': shape({ playerId: id }),
  'host:adjustScore': shape({ playerId: id, score: finite }),
  'host:giveHint': shape({ playerId: id }),
  'host:kick': shape({ playerId: id }),
  'host:pause': shape({ paused: bool }),
  'host:undo': null,
  'host:nextRound': null,
  'host:closeRoom': null,
  'host:finalJudge': shape({ correct: bool }),

  'player:buzz': shape({ clientTime: finite, clockOffset: finite, minRtt: finite }),
  'player:catTransfer': shape({ toPlayerId: id }),
  'player:modifierTarget': shape({ targetPlayerId: id }),
  'player:bid': shape({ amount: (value) => finite(value) || value === 'all-in' || value === 'pass' }),
  'player:finalRemoveTheme': shape({ themeId: id }),
  'player:finalBet': shape({ bet: finite }),
  'player:finalAnswer': shape({ answer: text(MAX_TEXT) }),
  'player:react': shape({ emoji: text(16) }),
};

type AckFn = (result: Result<never>) => void;

export type PacketCheck =
  /** Аргументы для обработчика: полезная нагрузка (если есть) и колбэк, всегда функция. */
  | { ok: true; args: unknown[] }
  /** Пакет отбрасывается; ack — чем ответить отправителю, если он ждёт ответа. */
  | { ok: false; ack: AckFn | null };

const noop: AckFn = () => {};

/**
 * Приводит аргументы пакета к виду, который ждут обработчики: проверенная
 * нагрузка и функция-подтверждение последней. Клиент без колбэка получает
 * заглушку — обработчики зовут `ack` безусловно.
 */
export function checkPacket(event: unknown, args: readonly unknown[]): PacketCheck {
  const last = args.at(-1);
  const ack = typeof last === 'function' ? (last as AckFn) : null;

  if (typeof event !== 'string' || !Object.hasOwn(PAYLOADS, event)) return { ok: false, ack };
  const check = PAYLOADS[event as keyof ClientToServerEvents];

  if (check === null) return { ok: true, args: [ack ?? noop] };

  const payload = args[0];
  if (typeof payload === 'function' || !check(payload)) return { ok: false, ack };
  return { ok: true, args: [payload, ack ?? noop] };
}
