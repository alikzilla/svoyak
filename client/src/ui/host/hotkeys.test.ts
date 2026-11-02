import { describe, it, expect } from 'vitest';
import type { Phase } from '@svoyak/shared';
import { hostCommandFor, type KeyPress } from './hotkeys.js';

const press = (code: string, extra: Partial<KeyPress> = {}): KeyPress => ({
  code,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  repeat: false,
  ...extra,
});

const at = (phase: Phase, extra: { paused?: boolean; canUndo?: boolean } = {}) => ({
  phase,
  paused: false,
  canUndo: true,
  ...extra,
});

describe('горячие клавиши ведущего', () => {
  it('пробел открывает кнопку, пока ведущий читает вопрос', () => {
    expect(hostCommandFor(press('Space'), at('reading'))).toEqual({ event: 'host:openBuzzer' });
  });

  it('пробел и Enter ведут дальше после ответа, объявления, модификатора и раунда', () => {
    expect(hostCommandFor(press('Space'), at('answer_reveal'))).toEqual({ event: 'host:continue' });
    expect(hostCommandFor(press('Enter'), at('announce'))).toEqual({ event: 'host:continue' });
    expect(hostCommandFor(press('Space'), at('modifier'))).toEqual({ event: 'host:continue' });
    expect(hostCommandFor(press('Space'), at('round_end'))).toEqual({ event: 'host:nextRound' });
  });

  it('пробел не судит: вердикт — только отдельной клавишей', () => {
    expect(hostCommandFor(press('Space'), at('answering'))).toBeNull();
    expect(hostCommandFor(press('Space'), at('final_reveal'))).toBeNull();
  });

  it('плюс — верно, минус — неверно; и на основной клавиатуре, и на цифровой', () => {
    expect(hostCommandFor(press('Equal'), at('answering'))).toEqual({
      event: 'host:judge',
      payload: { verdict: 'correct' },
    });
    expect(hostCommandFor(press('NumpadSubtract'), at('cat_answer'))).toEqual({
      event: 'host:judge',
      payload: { verdict: 'wrong' },
    });
    expect(hostCommandFor(press('Minus'), at('auction_answer'))).toEqual({
      event: 'host:judge',
      payload: { verdict: 'wrong' },
    });
  });

  it('в финале плюс и минус судят вскрытый ответ', () => {
    expect(hostCommandFor(press('NumpadAdd'), at('final_reveal'))).toEqual({
      event: 'host:finalJudge',
      payload: { correct: true },
    });
  });

  it('вне ответа плюс и минус ничего не делают', () => {
    expect(hostCommandFor(press('Equal'), at('picking'))).toBeNull();
  });

  it('P ставит паузу и снимает её', () => {
    expect(hostCommandFor(press('KeyP'), at('picking'))).toEqual({
      event: 'host:pause',
      payload: { paused: true },
    });
    expect(hostCommandFor(press('KeyP'), at('picking', { paused: true }))).toEqual({
      event: 'host:pause',
      payload: { paused: false },
    });
  });

  it('⌘Z или Ctrl+Z отменяет последнее действие, если есть что', () => {
    expect(hostCommandFor(press('KeyZ', { metaKey: true }), at('picking'))).toEqual({ event: 'host:undo' });
    expect(hostCommandFor(press('KeyZ', { ctrlKey: true }), at('picking'))).toEqual({ event: 'host:undo' });
    expect(hostCommandFor(press('KeyZ', { metaKey: true }), at('picking', { canUndo: false }))).toBeNull();
    expect(hostCommandFor(press('KeyZ'), at('picking'))).toBeNull();
  });

  it('с модификатором или при удержании клавиши — ничего', () => {
    expect(hostCommandFor(press('Space', { repeat: true }), at('reading'))).toBeNull();
    expect(hostCommandFor(press('Space', { metaKey: true }), at('reading'))).toBeNull();
    expect(hostCommandFor(press('KeyP', { altKey: true }), at('picking'))).toBeNull();
  });
});
