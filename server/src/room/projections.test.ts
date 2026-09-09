import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, type RoomState } from '@svoyak/shared';
import { demoClassicPack } from '../packs/demo/classic.js';
import { createRoomState } from '../engine/createRoom.js';
import { reduce } from '../engine/reducer.js';
import { projectForBoard, projectForHost, projectForPlayer } from './projections.js';

const JOIN_URL = 'http://192.168.1.2:5173/join?code=1234';

/** Комната с двумя игроками и открытым вопросом «Кино за 300». */
function stateWithQuestion(revealed = false): RoomState {
  let state = createRoomState({
    code: '1234',
    pack: demoClassicPack,
    settings: DEFAULT_SETTINGS,
    hostToken: 'host-token',
    now: 1000,
  });
  state = reduce(state, { type: 'PLAYER_JOIN', playerId: 'p1', name: 'Вася', sessionToken: 'secret-token-1', at: 2000 }).state;
  state = reduce(state, { type: 'PLAYER_JOIN', playerId: 'p2', name: 'Петя', sessionToken: 'secret-token-2', at: 2100 }).state;

  return {
    ...state,
    phase: 'reading',
    controlPlayerId: 'p1',
    active: {
      themeId: 'r1-kino',
      themeTitle: 'Кино',
      questionId: 'r1-kino-q3',
      price: 300,
      nominalPrice: 300,
      type: 'normal',
      spentPlayerIds: [],
      soloPlayerId: null,
      answerRevealed: revealed,
    },
  };
}

const ANSWER = 'Фрэнсис Форд Коппола';
const HOST_COMMENT = '2020 год, режиссёр Пон Джун Хо.';

describe('проекция игрока', () => {
  it('не содержит правильного ответа до раскрытия', () => {
    const serialized = JSON.stringify(projectForPlayer(stateWithQuestion(), 'p2'));
    expect(serialized).not.toContain(ANSWER);
    expect(serialized).not.toContain('Коппола');
  });

  it('не содержит комментариев ведущего ни к одному вопросу пака', () => {
    const serialized = JSON.stringify(projectForPlayer(stateWithQuestion(), 'p2'));
    expect(serialized).not.toContain(HOST_COMMENT);
  });

  it('не содержит токенов сессий', () => {
    const serialized = JSON.stringify(projectForPlayer(stateWithQuestion(), 'p2'));
    expect(serialized).not.toContain('secret-token-1');
    expect(serialized).not.toContain('secret-token-2');
    expect(serialized).not.toContain('host-token');
  });

  it('показывает текст вопроса и его стоимость', () => {
    const view = projectForPlayer(stateWithQuestion(), 'p2');
    expect(view.question?.text).toContain('Крёстного отца');
    expect(view.question?.price).toBe(300);
  });

  it('после раскрытия ответ появляется', () => {
    const view = projectForPlayer(stateWithQuestion(true), 'p2');
    expect(view.question?.revealedAnswer).toBe(ANSWER);
  });

  it('показывает свой счёт и счёт остальных, но не чужие секреты', () => {
    const view = projectForPlayer(stateWithQuestion(), 'p2');
    expect(view.meId).toBe('p2');
    expect(view.players.map((player) => player.name)).toEqual(['Вася', 'Петя']);
    expect(view.players[0]).not.toHaveProperty('sessionToken');
  });
});

describe('спецвопросы: текст до времени скрыт', () => {
  it('во время передачи кота игроки не видят текста вопроса', () => {
    const state: RoomState = { ...stateWithQuestion(), phase: 'cat_transfer' };
    const view = projectForPlayer(state, 'p1');
    expect(view.question?.hidden).toBe(true);
    expect(view.question?.text).toBe('');
    expect(JSON.stringify(view)).not.toContain('Крёстного отца');
  });

  it('во время торгов игроки не видят текста вопроса', () => {
    const state: RoomState = { ...stateWithQuestion(), phase: 'auction_bidding' };
    const serialized = JSON.stringify(projectForBoard(state, JOIN_URL));
    expect(serialized).not.toContain('Крёстного отца');
  });

  it('ведущему текст виден всегда: ему его читать', () => {
    const state: RoomState = { ...stateWithQuestion(), phase: 'cat_transfer' };
    expect(projectForHost(state, JOIN_URL).question?.text).toContain('Крёстного отца');
  });

  it('после передачи текст появляется', () => {
    const state: RoomState = { ...stateWithQuestion(), phase: 'cat_answer' };
    expect(projectForPlayer(state, 'p2').question?.text).toContain('Крёстного отца');
  });
});

describe('проекция ведущего', () => {
  it('содержит правильный ответ и альтернативы', () => {
    const view = projectForHost(stateWithQuestion(), JOIN_URL);
    expect(view.question?.answer).toBe(ANSWER);
    expect(view.question?.altAnswers).toContain('Коппола');
  });

  it('содержит ссылку для подключения и настройки комнаты', () => {
    const view = projectForHost(stateWithQuestion(), JOIN_URL);
    expect(view.joinUrl).toBe(JOIN_URL);
    expect(view.settings.buzzOpenMs).toBe(DEFAULT_SETTINGS.buzzOpenMs);
  });

  it('не отдаёт токены игроков', () => {
    const serialized = JSON.stringify(projectForHost(stateWithQuestion(), JOIN_URL));
    expect(serialized).not.toContain('secret-token-1');
  });
});

describe('фальстарт в проекции игрока', () => {
  const PRESS_AT = 5000;

  /** Комната в паузе на чтение, где p1 уже ткнул раньше времени. */
  function afterFalseStart(): RoomState {
    return reduce(stateWithQuestion(), {
      type: 'BUZZ',
      playerId: 'p1',
      atServerTime: PRESS_AT,
      receivedAt: PRESS_AT,
    }).state;
  }

  it('нажавшему показывает блокировку сразу, ещё до открытия кнопки', () => {
    const view = projectForPlayer(afterFalseStart(), 'p1', PRESS_AT + 100);
    expect(view.prompt).toMatchObject({
      kind: 'buzz',
      open: false,
      lockedUntil: PRESS_AT + DEFAULT_SETTINGS.falseStartLockMs,
    });
  });

  it('остальным ничего не приписывает', () => {
    const view = projectForPlayer(afterFalseStart(), 'p2', PRESS_AT + 100);
    expect(view.prompt).toMatchObject({ kind: 'buzz', lockedUntil: null });
  });

  it('открытие кнопки блокировку не обновляет', () => {
    const opensAt = PRESS_AT + 1000;
    const opened = reduce(afterFalseStart(), { type: 'OPEN_BUZZER', at: opensAt }).state;

    const punished = projectForPlayer(opened, 'p1', opensAt + 100);
    const clean = projectForPlayer(opened, 'p2', opensAt + 100);

    // Кнопка открыта для всех, но нажавшего рано держит его же блокировка.
    expect(punished.prompt).toMatchObject({
      kind: 'buzz',
      open: true,
      lockedUntil: PRESS_AT + DEFAULT_SETTINGS.falseStartLockMs,
    });
    expect(clean.prompt).toMatchObject({ kind: 'buzz', open: true, lockedUntil: null });
  });

  it('когда блокировка истекла, игрок в проекции чист', () => {
    const view = projectForPlayer(
      afterFalseStart(),
      'p1',
      PRESS_AT + DEFAULT_SETTINGS.falseStartLockMs + 1,
    );
    expect(view.prompt).toMatchObject({ kind: 'buzz', lockedUntil: null });
  });
});

describe('проекция общего экрана', () => {
  it('не содержит правильного ответа до раскрытия', () => {
    const serialized = JSON.stringify(projectForBoard(stateWithQuestion(), JOIN_URL));
    expect(serialized).not.toContain(ANSWER);
  });

  it('показывает код комнаты и игроков', () => {
    const view = projectForBoard(stateWithQuestion(), JOIN_URL);
    expect(view.code).toBe('1234');
    expect(view.players).toHaveLength(2);
  });
});
