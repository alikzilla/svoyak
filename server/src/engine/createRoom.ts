import type { BuzzState, Pack, RoomSettings, RoomState } from '@svoyak/shared';
import { buildBoard } from './board.js';

export interface CreateRoomArgs {
  code: string;
  pack: Pack;
  settings: RoomSettings;
  hostToken: string;
  now?: number;
}

export const EMPTY_BUZZ: BuzzState = {
  openedAt: null,
  closesAt: null,
  graceClosesAt: null,
  candidates: [],
  answeringSince: null,
  lockedUntil: {},
  falseStarts: {},
  answeringPlayerId: null,
};

export function createRoomState({
  code,
  pack,
  settings,
  hostToken,
  now = Date.now(),
}: CreateRoomArgs): RoomState {
  const firstRound = pack.rounds[0];
  return {
    code,
    createdAt: now,
    settings,
    pack,
    hostToken,
    hostConnected: false,
    players: [],
    phase: 'lobby',
    roundIndex: 0,
    board: firstRound ? buildBoard(firstRound) : [],
    active: null,
    controlPlayerId: null,
    buzz: { ...EMPTY_BUZZ, lockedUntil: {} },
    auction: null,
    cat: null,
    final: null,
    timer: null,
    paused: false,
    log: [{ at: now, text: `Комната ${code} создана. Пак: «${pack.title}»` }],
  };
}
