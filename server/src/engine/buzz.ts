import type { BuzzCandidate, RoomState } from '@svoyak/shared';

export interface BuzzTimeArgs {
  /** Локальное время клиента в момент нажатия. */
  clientTime: number;
  /** Смещение часов клиента относительно сервера. */
  clockOffset: number;
  /** Минимальный измеренный RTT клиента. */
  minRtt: number;
  /** Когда пакет пришёл на сервер. */
  receivedAt: number;
}

/** Запас на дрожание сети: нажатие не могло случиться раньше, чем за RTT плюс это. */
const JITTER_SLACK_MS = 250;

/** Метка клиента в серверном времени. Клиенту не верим: зажимаем в правдоподобные границы —
 *  нажатие не бывает в будущем и не бывает старше времени полёта пакета. */
export function adjustBuzzTime({
  clientTime,
  clockOffset,
  minRtt,
  receivedAt,
}: BuzzTimeArgs): number {
  const inServerTime = clientTime + clockOffset;
  const earliestPlausible = receivedAt - Math.max(0, minRtt) - JITTER_SLACK_MS;
  return Math.min(receivedAt, Math.max(earliestPlausible, inServerTime));
}

/** Может ли игрок сейчас нажимать: не заблокирован фальстартом и ещё не отвечал. */
export function canBuzz(state: RoomState, playerId: string, at: number): boolean {
  const lockedUntil = state.buzz.lockedUntil[playerId];
  if (lockedUntil !== undefined && lockedUntil > at) return false;
  if (state.active?.spentPlayerIds.includes(playerId)) return false;
  return true;
}

/** Победитель окна сбора: минимальная скорректированная метка среди тех, кто вправе отвечать. */
export function pickWinner(candidates: BuzzCandidate[]): BuzzCandidate | null {
  return candidates.reduce<BuzzCandidate | null>(
    (best, candidate) => (best === null || candidate.atServerTime < best.atServerTime ? candidate : best),
    null,
  );
}
