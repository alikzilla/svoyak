import { useEffect, useRef } from 'react';
import type { ClientToServerEvents, HostView, Phase } from '@svoyak/shared';

/** Что от нажатия нужно горячим клавишам. `code` — физическая клавиша:
 *  так клавиши работают и в русской раскладке. */
export interface KeyPress {
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  repeat: boolean;
}

export interface HostCommand {
  event: keyof ClientToServerEvents;
  payload?: unknown;
}

type HostState = Pick<HostView, 'phase' | 'paused' | 'canUndo'>;

/** Пробел и Enter — «дальше»: следующий шаг, который не решает ничью судьбу. */
const FORWARD: Partial<Record<Phase, HostCommand>> = {
  game_intro: { event: 'host:continue' },
  round_intro: { event: 'host:continue' },
  reading: { event: 'host:openBuzzer' },
  announce: { event: 'host:continue' },
  modifier: { event: 'host:continue' },
  answer_reveal: { event: 'host:continue' },
  round_end: { event: 'host:nextRound' },
};

const JUDGING: ReadonlySet<Phase> = new Set(['answering', 'cat_answer', 'auction_answer']);
const PLUS = new Set(['Equal', 'NumpadAdd']);
const MINUS = new Set(['Minus', 'NumpadSubtract']);

/**
 * Клавиша → действие ведущего. Ведущий читает вопрос вслух и смотрит на
 * гостей, а не на мышь: основной ход игры доступен с клавиатуры. Вердикт —
 * только отдельными клавишами (плюс и минус), чтобы случайный пробел не
 * засчитал ответ.
 */
export function hostCommandFor(key: KeyPress, state: HostState): HostCommand | null {
  if (key.repeat || key.altKey) return null;

  if (key.code === 'KeyZ' && (key.metaKey || key.ctrlKey)) {
    return state.canUndo ? { event: 'host:undo' } : null;
  }
  if (key.metaKey || key.ctrlKey) return null;

  if (key.code === 'Space' || key.code === 'Enter' || key.code === 'NumpadEnter') {
    return FORWARD[state.phase] ?? null;
  }

  if (PLUS.has(key.code) || MINUS.has(key.code)) {
    const correct = PLUS.has(key.code);
    if (JUDGING.has(state.phase)) {
      return { event: 'host:judge', payload: { verdict: correct ? 'correct' : 'wrong' } };
    }
    if (state.phase === 'final_reveal') return { event: 'host:finalJudge', payload: { correct } };
    return null;
  }

  if (key.code === 'KeyP') return { event: 'host:pause', payload: { paused: !state.paused } };
  return null;
}

/** Поле ввода забирает клавиши себе: правка счёта не должна судить вопрос. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/** Горячие клавиши на экране ведущего. */
export function useHostHotkeys(
  view: HostState,
  send: (event: HostCommand['event'], payload?: unknown) => void,
): void {
  const state = useRef(view);
  state.current = view;
  const sendRef = useRef(send);
  sendRef.current = send;

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (isTyping(event.target)) return;
      // В окне подтверждения пробел и Enter нажимают его кнопки, а не ход игры.
      if (event.target instanceof Element && event.target.closest('dialog')) return;
      const command = hostCommandFor(event, state.current);
      if (!command) return;
      event.preventDefault();
      // Пробел по сфокусированной кнопке ещё и нажал бы её: снимаем фокус,
      // чтобы действие случилось один раз.
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      sendRef.current(command.event, command.payload);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
