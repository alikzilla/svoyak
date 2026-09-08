/** Служебный скрипт: комната во втором раунде, где лежат кот и аукцион.
 *  Нужен, чтобы проверять спецвопросы руками, не разыгрывая первый раунд. */
import { DEFAULT_SETTINGS } from '@svoyak/shared';
import { createRoomState } from '../engine/createRoom.js';
import { reduce } from '../engine/reducer.js';
import { saveRoom } from '../storage/roomsRepo.js';
import { demoClassicPack } from './demo/classic.js';

const code = process.argv[2] ?? '7777';
let state = createRoomState({
  code,
  pack: demoClassicPack,
  settings: DEFAULT_SETTINGS,
  hostToken: 'seed-host-token',
});

state = { ...state, phase: 'round_end', roundIndex: 0 };
state = reduce(state, { type: 'NEXT_ROUND', at: Date.now() }).state;
state = { ...state, phase: 'picking' };

saveRoom(state);
console.log(`Комната ${code} готова: раунд ${state.roundIndex + 1}, токен ведущего seed-host-token`);
