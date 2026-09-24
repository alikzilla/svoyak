import { useEffect, useRef } from 'react';
import type { PlayerView } from '@svoyak/shared';

/** Телефон лежит экраном вниз или в руке, а глаза — на ведущем: о том, что
 *  случилось с тобой, сообщаем вибрацией, и у каждого события свой ритм.
 *  Массив читается как «вибрация, пауза, вибрация…» — первым идёт жужжание,
 *  а не пауза. Короче ~40 мс многие моторы не ощущаются вовсе. */
const PATTERNS = {
  /** Любое нажатие на экране. */
  tap: 40,
  /** Нажата кнопка ответа. */
  buzz: 60,
  /** Кнопка открылась. */
  open: [80, 60, 80],
  /** Ты нажал первым — отвечай. */
  answering: [200, 80, 200],
  /** Твой ход: выбрать вопрос, отдать кота, сделать ставку. */
  attention: [120, 80, 120, 80, 120],
  /** Фальстарт: одна длинная и неприятная. */
  falseStart: 400,
  gain: [60, 50, 60],
  loss: 250,
  reveal: 50,
} satisfies Record<string, number | number[]>;

export type HapticKind = keyof typeof PATTERNS;

/** Safari на iPhone не знает `navigator.vibrate`. На iOS 17.4–26.4 таптик
 *  щёлкал, если в ответ на касание переключить `<input switch>` через его
 *  label; в iOS 26.5 Apple это закрыла. Оставлено для старых iOS — на новых
 *  вызов просто ничего не делает, и игрок узнаёт о событиях по звуку. */
function iosTick(): void {
  if (typeof document === 'undefined') return;
  const label = document.createElement('label');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  label.append(input);
  label.setAttribute('aria-hidden', 'true');
  label.style.display = 'none';
  document.head.append(label);
  label.click();
  label.remove();
}

/** Умеет ли этот браузер вибрировать по-настоящему. */
export function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

/** Chrome глушит вибрацию, пока страницу ни разу не нажимали по-настоящему:
 *  касание (touchstart, pointerdown) не считается — только отпускание, клик.
 *  Телефон, открывший /play сразу по ссылке или после перезагрузки, первым
 *  делом жмёт кнопку ответа на pointerdown, и эта вибрация пропадает. */
export function needsActivation(): boolean {
  if (typeof navigator === 'undefined' || !navigator.userActivation) return false;
  return !navigator.userActivation.hasBeenActive;
}

export function haptic(kind: HapticKind): void {
  if (canVibrate()) {
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
