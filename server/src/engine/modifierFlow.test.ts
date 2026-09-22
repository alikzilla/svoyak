import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, type RoomSettings, type RoomState } from '@svoyak/shared';
import { demoClassicPack } from '../packs/demo/classic.js';
import { createRoomState } from './createRoom.js';
import { reduce } from './reducer.js';

const T0 = 100_000;

const firstTheme = demoClassicPack.rounds[0]?.themes[0];
const firstQuestion = firstTheme?.questions[0];
if (!firstTheme || !firstQuestion) throw new Error('Пак demo-classic неожиданно пуст');

const score = (state: RoomState, playerId: string): number =>
  state.players.find((player) => player.id === playerId)?.score ?? 0;

/** Комната, где первая клетка — модификатор указанного вида, ход у Васи.
 *  Объявлена как const-стрелка, а не как function: только так TypeScript
 *  проносит внутрь замыкания сужение firstQuestion до string | undefined,
 *  сделанное выше по модулю — для hoisted function declaration оно теряется. */
const room = (kind: 'jackpot' | 'nothing' | 'flip', settings: Partial<RoomSettings> = {}): RoomState => {
  let state = createRoomState({
    code: '1234',
    pack: demoClassicPack,
    settings: { ...DEFAULT_SETTINGS, ...settings },
    hostToken: 'h',
    now: 1000,
    modifierCells: { [firstQuestion.id]: kind },
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
};

const pick =(state: RoomState, at = T0): ReturnType<typeof reduce> =>
  reduce(state, {
    type: 'PICK_QUESTION',
    themeId: firstTheme.id,
    questionId: firstQuestion.id,
    at,
  });

describe('клетка-модификатор', () => {
  it('открывает сцену модификатора вместо вопроса', () => {
    const state = pick(room('jackpot')).state;
    expect(state.phase).toBe('modifier');
    expect(state.modifier?.kind).toBe('jackpot');
    expect(state.active).toBeNull();
  });

  it('эффект применяется сразу', () => {
    const state = pick(room('jackpot')).state;
    expect(score(state, 'p1')).toBe(2000);
  });

  it('клетка отмечается сыгранной', () => {
    const state = pick(room('nothing')).state;
    const cell = state.board
      .find((theme) => theme.id === firstTheme.id)
      ?.cells.find((item) => item.questionId === firstQuestion.id);
    expect(cell?.played).toBe(true);
  });

  it('право хода остаётся у открывшего', () => {
    const state = pick(room('flip')).state;
    expect(state.controlPlayerId).toBe('p1');
  });

  it('заводит таймер сцены', () => {
    const result = pick(room('nothing'));
    expect(result.effects).toContainEqual({
      type: 'setTimer',
      kind: 'modifier',
      durationMs: DEFAULT_SETTINGS.modifierMs,
      onExpire: { type: 'TIMER_EXPIRED', kind: 'modifier', at: T0 + DEFAULT_SETTINGS.modifierMs },
    });
  });

  it('при нулевой настройке сцену закрывает ведущий', () => {
    const result = pick(room('nothing', { modifierMs: 0 }));
    expect(result.state.phase).toBe('modifier');
    expect(result.effects.some((effect) => effect.type === 'setTimer')).toBe(false);
  });

  it('таймер возвращает к выбору клетки', () => {
    const opened = pick(room('nothing')).state;
    const after = reduce(opened, {
      type: 'TIMER_EXPIRED',
      kind: 'modifier',
      at: T0 + DEFAULT_SETTINGS.modifierMs,
    }).state;
    expect(after.phase).toBe('picking');
    expect(after.modifier).toBeNull();
  });

  it('ведущий закрывает сцену раньше таймера', () => {
    const opened = pick(room('nothing')).state;
    const after = reduce(opened, { type: 'CONTINUE', at: T0 + 1000 }).state;
    expect(after.phase).toBe('picking');
    expect(after.modifier).toBeNull();
  });

  it('пишет строку в журнал', () => {
    const state = pick(room('jackpot')).state;
    expect(state.log.at(-1)?.text).toContain('Джекпот');
  });

  it('последняя клетка раунда ведёт к концу раунда', () => {
    // Оставляем неразыгранной только клетку-модификатор.
    const base = room('nothing');
    const drained: RoomState = {
      ...base,
      board: base.board.map((theme) => ({
        ...theme,
        cells: theme.cells.map((cell) =>
          cell.questionId === firstQuestion.id ? cell : { ...cell, played: true },
        ),
      })),
    };
    const opened = pick(drained).state;
    const after = reduce(opened, { type: 'CONTINUE', at: T0 + 1000 }).state;
    expect(after.phase).toBe('round_end');
  });

  it('кнопка на сцене модификатора не работает', () => {
    const opened = pick(room('nothing')).state;
    const after = reduce(opened, {
      type: 'BUZZ',
      playerId: 'p2',
      atServerTime: T0 + 500,
      receivedAt: T0 + 500,
    }).state;
    expect(after.buzz.candidates).toHaveLength(0);
  });
});
