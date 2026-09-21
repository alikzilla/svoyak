import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, type RoomState } from '@svoyak/shared';
import { demoClassicPack } from '../packs/demo/classic.js';
import { createRoomState } from '../engine/createRoom.js';
import { reduce } from '../engine/reducer.js';
import { projectForBoard, projectForHost, projectForPlayer } from './projections.js';

/** Комната, где первая клетка первой темы — модификатор. */
function roomWithModifier(): RoomState {
  const firstTheme = demoClassicPack.rounds[0]?.themes[0];
  const firstQuestion = firstTheme?.questions[0];
  if (!firstTheme || !firstQuestion) throw new Error('Пак demo-classic неожиданно пуст');

  let state = createRoomState({
    code: '1234',
    pack: demoClassicPack,
    settings: DEFAULT_SETTINGS,
    hostToken: 'h',
    now: 1000,
    modifierCells: { [firstQuestion.id]: 'jackpot' },
  });
  for (const [index, name] of ['Вася', 'Петя'].entries()) {
    state = reduce(state, {
      type: 'PLAYER_JOIN',
      playerId: `p${index + 1}`,
      name,
      sessionToken: `t${index + 1}`,
      at: 2000 + index,
    }).state;
  }
  return reduce(state, { type: 'START_GAME', at: 3000 }).state;
}

/** Достаёт клетки доски из проекции независимо от роли. */
function cellsOf<Cell>(view: { board: Array<{ cells: Cell[] }> }): Cell[] {
  return view.board.flatMap((theme) => theme.cells);
}

describe('секретность модификатора', () => {
  it('клетка помечена в состоянии комнаты', () => {
    const state = roomWithModifier();
    const marked = state.board[0]?.cells[0];
    expect(marked?.modifier).toBe('jackpot');
  });

  it('игрок не видит модификатор до открытия клетки', () => {
    const state = roomWithModifier();
    const view = projectForPlayer(state, 'p1', Date.now());
    // Структурная проверка: ни одна клетка не несёт ключ modifier вообще —
    // это не рассыплется в задаче 9, когда поле появится во всех трёх видах.
    expect(cellsOf(view).some((cell) => 'modifier' in cell)).toBe(false);
    // Значение-подстраховка: вид модификатора — это значение, а не имя поля,
    // поэтому такая проверка не протухнет и ловит утечку под другим ключом.
    expect(JSON.stringify(view)).not.toContain('jackpot');
  });

  it('общий экран не видит модификатор до открытия клетки', () => {
    const state = roomWithModifier();
    const view = projectForBoard(state, 'http://x', Date.now());
    expect(cellsOf(view).some((cell) => 'modifier' in cell)).toBe(false);
    expect(JSON.stringify(view)).not.toContain('jackpot');
  });

  it('ведущий тоже не видит: он открывает клетку по просьбе игрока', () => {
    const state = roomWithModifier();
    const view = projectForHost(state, 'http://x', { now: Date.now() });
    expect(cellsOf(view).some((cell) => 'modifier' in cell)).toBe(false);
    expect(JSON.stringify(view)).not.toContain('jackpot');
  });
});
