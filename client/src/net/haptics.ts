import { useEffect, useRef } from 'react';
import type { PlayerView } from '@svoyak/shared';

/** Телефон лежит экраном вниз или в руке, а глаза — на ведущем: о том, что
 *  случилось с тобой, сообщаем вибрацией, и у каждого события свой ритм. */
const PATTERNS = {
  /** Любое нажатие на экране. */
  tap: 15,
  /** Нажата кнопка ответа. */
  buzz: 35,
  /** Кнопка открылась. */
  open: [0, 40, 60, 40],
  /** Ты нажал первым — отвечай. */
  answering: [0, 90, 60, 90],
  /** Твой ход: выбрать вопрос, отдать кота, сделать ставку. */
  attention: [0, 60, 80, 60, 80, 60],
  /** Фальстарт: одна длинная и неприятная. */
  falseStart: [0, 280],
  gain: [0, 30, 40, 30],
  loss: 120,
  reveal: 25,
} satisfies Record<string, number | number[]>;

export type HapticKind = keyof typeof PATTERNS;

/** Safari на iPhone не знает `navigator.vibrate`, но с iOS 18 щёлкает
 *  таптиком, когда переключают `<input switch>`. Срабатывает только в ответ
 *  на касание, поэтому для событий с сервера на iPhone останется тишина —
 *  там звук. */
let iosSwitch: HTMLLabelElement | null = null;

function iosTick(): void {
  if (typeof document === 'undefined') return;
  if (!iosSwitch) {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    label.append(input);
    label.setAttribute('aria-hidden', 'true');
    label.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px';
    document.body.append(label);
    iosSwitch = label;
  }
  iosSwitch.click();
}

export function haptic(kind: HapticKind): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(PATTERNS[kind]);
    return;
  }
  iosTick();
}

/** Что сейчас требует от игрока действия. null — ничего, можно смотреть на ведущего. */
function attentionOf(view: PlayerView): HapticKind | null {
  const answering = view.players.some((player) => player.isAnswering && player.id === view.meId);
  if (answering && view.prompt.kind !== 'solo_answer') return 'answering';

  switch (view.prompt.kind) {
    case 'your_turn':
    case 'cat_pick':
    case 'modifier_swap':
    case 'auction_bid':
    case 'solo_answer':
    case 'final_remove_theme':
      return 'attention';
    case 'final_bet':
    case 'final_answer':
      return view.prompt.placed ? null : 'attention';
    default:
      return null;
  }
}

/** Вибрации по переходам проекции. Первое состояние — не событие: иначе вход
 *  в комнату или перезагрузка страницы сами бы зажужжали. */
export function usePlayerHaptics(view: PlayerView | null): void {
  const previous = useRef<{
    phase: string;
    attention: string | null;
    locked: boolean;
    score: number;
  } | null>(null);

  useEffect(() => {
    if (!view) return;
    const current = {
      phase: view.phase,
      // Ключ с видом подсказки: смена «твой ход» на «ставь» — новое событие.
      attention: attentionOf(view) === null ? null : `${attentionOf(view)}:${view.prompt.kind}`,
      locked: view.prompt.kind === 'buzz' && view.prompt.lockedUntil !== null,
      score: view.myScore,
    };
    const before = previous.current;
    previous.current = current;
    if (!before) return;

    // Одна вибрация на переход: важное перебивает фоновое.
    if (current.locked && !before.locked) haptic('falseStart');
    else if (current.attention !== null && current.attention !== before.attention) {
      haptic(current.attention.startsWith('answering') ? 'answering' : 'attention');
    } else if (current.score > before.score) haptic('gain');
    else if (current.score < before.score) haptic('loss');
    else if (current.phase !== before.phase && current.phase === 'buzzer_open') haptic('open');
    else if (current.phase !== before.phase && current.phase === 'answer_reveal') haptic('reveal');
  }, [view]);
}
