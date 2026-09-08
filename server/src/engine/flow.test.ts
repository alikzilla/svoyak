import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, type RoomState } from '@svoyak/shared';
import { demoClassicPack } from '../packs/demo/classic.js';
import { createRoomState } from './createRoom.js';
import { reduce } from './reducer.js';

function lobbyWithPlayers(): RoomState {
  let state = createRoomState({
    code: '1234',
    pack: demoClassicPack,
    settings: DEFAULT_SETTINGS,
    hostToken: 'h',
    now: 1000,
  });
  for (const [index, name] of ['Вася', 'Петя', 'Маша'].entries()) {
    state = reduce(state, {
      type: 'PLAYER_JOIN',
      playerId: `p${index + 1}`,
      name,
      sessionToken: `t${index + 1}`,
      at: 2000 + index,
    }).state;
  }
  return state;
}

const started = (): RoomState => reduce(lobbyWithPlayers(), { type: 'START_GAME', at: 3000 }).state;

/** Открыть клетку «Кино за 300» от имени игрока с правом хода. */
function withOpenQuestion(state: RoomState = started()): RoomState {
  return reduce(state, {
    type: 'PICK_QUESTION',
    themeId: 'r1-kino',
    questionId: 'r1-kino-q3',
    at: 4000,
  }).state;
}

describe('старт игры', () => {
  it('переводит в выбор вопроса и отдаёт право хода первому игроку', () => {
    const state = started();
    expect(state.phase).toBe('picking');
    expect(state.controlPlayerId).toBe('p1');
  });

  it('без игроков игра не начинается', () => {
    const empty = createRoomState({
      code: '1234',
      pack: demoClassicPack,
      settings: DEFAULT_SETTINGS,
      hostToken: 'h',
      now: 1000,
    });
    const result = reduce(empty, { type: 'START_GAME', at: 3000 });
    expect(result.error).toBeDefined();
    expect(result.state.phase).toBe('lobby');
  });
});

describe('выбор вопроса', () => {
  it('открывает вопрос, помечает клетку сыгранной и заводит таймер чтения', () => {
    const state = withOpenQuestion();
    expect(state.phase).toBe('reading');
    expect(state.active).toMatchObject({ questionId: 'r1-kino-q3', price: 300, type: 'normal' });
    const cell = state.board
      .find((theme) => theme.id === 'r1-kino')
      ?.cells.find((candidate) => candidate.questionId === 'r1-kino-q3');
    expect(cell?.played).toBe(true);
  });

  it('заводит таймер чтения через эффект', () => {
    const result = reduce(started(), {
      type: 'PICK_QUESTION',
      themeId: 'r1-kino',
      questionId: 'r1-kino-q3',
      at: 4000,
    });
    expect(result.effects).toContainEqual({
      type: 'setTimer',
      kind: 'reading',
      durationMs: DEFAULT_SETTINGS.readingTimeMs,
      onExpire: { type: 'TIMER_EXPIRED', kind: 'reading', at: 4000 },
    });
  });

  it('уже сыгранную клетку выбрать нельзя', () => {
    const state = withOpenQuestion();
    const back = reduce(state, { type: 'CONTINUE', at: 5000 }).state;
    const again = reduce(back, {
      type: 'PICK_QUESTION',
      themeId: 'r1-kino',
      questionId: 'r1-kino-q3',
      at: 6000,
    });
    expect(again.error).toBeDefined();
  });

  it('вопрос открывает ведущий — право хода лишь подсказывает, кого слушать', () => {
    const result = reduce(started(), {
      type: 'PICK_QUESTION',
      themeId: 'r1-kino',
      questionId: 'r1-kino-q3',
      at: 4000,
    });
    expect(result.error).toBeUndefined();
    expect(result.state.phase).toBe('reading');
    // Право хода при этом не меняется: оно определяет очередь, а не право клика.
    expect(result.state.controlPlayerId).toBe('p1');
  });
});

describe('конец раунда', () => {
  it('когда клетки кончились, раунд завершается', () => {
    let state = started();
    for (const theme of state.board) {
      for (const cell of theme.cells) {
        state = reduce(state, {
          type: 'PICK_QUESTION',
          themeId: theme.id,
          questionId: cell.questionId,
          at: 4000,
        }).state;
        state = reduce(state, { type: 'CONTINUE', at: 5000 }).state;
      }
    }
    expect(state.phase).toBe('round_end');
  });

  it('следующий раунд строит новую доску и сохраняет счёт', () => {
    let state = started();
    state = reduce(state, { type: 'SET_SCORE', playerId: 'p1', score: 900 }).state;
    state = { ...state, phase: 'round_end' };
    state = reduce(state, { type: 'NEXT_ROUND', at: 9000 }).state;

    expect(state.roundIndex).toBe(1);
    expect(state.phase).toBe('round_intro');
    expect(state.board[0]?.cells.map((cell) => cell.price)).toEqual([200, 400, 600, 800, 1000]);
    expect(state.players.find((player) => player.id === 'p1')?.score).toBe(900);
  });

  it('после последнего раунда игра идёт к результатам', () => {
    let state = started();
    state = { ...state, roundIndex: demoClassicPack.rounds.length - 1, phase: 'round_end' };
    state = reduce(state, { type: 'NEXT_ROUND', at: 9000 }).state;
    expect(state.phase).toBe('results');
  });
});

describe('пауза', () => {
  it('ставится и снимается, не меняя фазу', () => {
    let state = withOpenQuestion();
    state = reduce(state, { type: 'PAUSE', paused: true }).state;
    expect(state.paused).toBe(true);
    expect(state.phase).toBe('reading');
    state = reduce(state, { type: 'PAUSE', paused: false }).state;
    expect(state.paused).toBe(false);
  });
});
