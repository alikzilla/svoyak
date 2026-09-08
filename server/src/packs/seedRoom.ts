/** Служебный скрипт: комната во втором раунде, где лежат кот и аукцион.
 *  Нужен, чтобы проверять спецвопросы руками, не разыгрывая первый раунд. */
import { DEFAULT_SETTINGS } from '@svoyak/shared';
import { createRoomState } from '../engine/createRoom.js';
import { reduce } from '../engine/reducer.js';
import { saveRoom } from '../storage/roomsRepo.js';
import { demoClassicPack } from './demo/classic.js';

const code = process.argv[2] ?? '7777';
/** «final» — сразу перед финалом, иначе второй раунд. */
const mode = process.argv[3] ?? 'round2';
let state = createRoomState({
  code,
  pack: demoClassicPack,
  settings: DEFAULT_SETTINGS,
  hostToken: 'seed-host-token',
});

// Игроки добавляются заранее: в фазе между раундами вход закрыт.
const seeded: Array<[string, string, number]> = [
  ['Аня', 'seed-a', 500],
  ['Боря', 'seed-b', 900],
];
for (const [index, [name, token, points]] of seeded.entries()) {
  const playerId = `seed-p${index + 1}`;
  state = reduce(state, {
    type: 'PLAYER_JOIN',
    playerId,
    name,
    sessionToken: token,
    at: Date.now() + index,
  }).state;
  state = reduce(state, { type: 'SET_SCORE', playerId, score: points }).state;
}
state = reduce(state, { type: 'START_GAME', at: Date.now() }).state;

if (mode === 'final') {
  state = { ...state, phase: 'round_end', roundIndex: demoClassicPack.rounds.length - 1 };
} else {
  state = { ...state, phase: 'round_end', roundIndex: 0 };
  state = reduce(state, { type: 'NEXT_ROUND', at: Date.now() }).state;
  state = { ...state, phase: 'picking' };
}

saveRoom(state);
console.log(
  `Комната ${code} готова: ${mode === 'final' ? 'перед финалом' : `раунд ${state.roundIndex + 1}`}, токен ведущего seed-host-token`,
);
