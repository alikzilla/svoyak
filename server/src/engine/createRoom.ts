import type { BuzzState, ModifierKind, Pack, RoomSettings, RoomState } from '@svoyak/shared';
import { buildBoard } from './board.js';

export interface CreateRoomArgs {
  code: string;
  pack: Pack;
  settings: RoomSettings;
  hostToken: string;
  now?: number;
  modifierCells?: Record<string, ModifierKind>;
}

export const EMPTY_BUZZ: BuzzState = {
  openedAt: null,
  closesAt: null,
  graceClosesAt: null,
  candidates: [],
  answeringSince: null,
  lockedUntil: {},
  answeringPlayerId: null,
};

export function createRoomState({
  code,
  pack,
  settings,
  hostToken,
  now = Date.now(),
  modifierCells = {},
}: CreateRoomArgs): RoomState {
  const firstRound = pack.rounds[0];
  return {
    code,
    createdAt: now,
    settings,
    pack,
    modifierCells,
    hostToken,
    hostConnected: false,
    players: [],
    phase: 'lobby',
    roundIndex: 0,
    board: firstRound ? buildBoard(firstRound, modifierCells) : [],
    active: null,
    controlPlayerId: null,
    buzz: { ...EMPTY_BUZZ, lockedUntil: {} },
    auction: null,
    cat: null,
    modifier: null,
    final: null,
    timer: null,
    paused: false,
    log: [{ at: now, text: `Комната ${code} создана. Пак: «${pack.title}»` }],
  };
}
