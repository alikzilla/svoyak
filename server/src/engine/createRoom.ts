import type { BuzzState, ModifierKind, ModifierPlan, Pack, RoomSettings, RoomState } from '@svoyak/shared';
import { EMPTY_MODIFIER_PLAN } from '@svoyak/shared';
import { buildBoard } from './board.js';

export interface CreateRoomArgs {
  code: string;
  pack: Pack;
  settings: RoomSettings;
  hostToken: string;
  now?: number;
  modifierCells?: Record<string, ModifierKind>;
  /** План, по которому уже посчитана `modifierCells`. Хранится отдельно, чтобы
   *  пересборка состава в лобби могла пересчитать раскладку под новый пак. */
  modifierPlan?: ModifierPlan;
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
  modifierPlan = EMPTY_MODIFIER_PLAN,
}: CreateRoomArgs): RoomState {
  const firstRound = pack.rounds[0];
  return {
    code,
    createdAt: now,
    settings,
    pack,
    modifierCells,
    modifierPlan,
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
