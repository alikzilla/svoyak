import { Howl, Howler } from 'howler';
import type { SoundId } from '@svoyak/shared';

/** Сэмплы синтезированы скриптом client/scripts/makeSounds.mjs и лежат рядом с игрой:
 *  никаких внешних сервисов, работает в локальной сети без интернета. */
const VOLUME: Partial<Record<SoundId, number>> = {
  buzz_open: 0.9,
  buzz_hit: 0.8,
  correct: 0.85,
  wrong: 0.8,
  time_up: 0.7,
  round_start: 0.8,
  game_over: 0.8,
  cat: 0.85,
  bid: 0.6,
  all_in: 0.9,
  drumroll: 0.7,
  victory: 0.9,
};

const cache = new Map<SoundId, Howl>();
const MUTE_KEY = 'svoyak:muted';
let unlocked = false;

function load(sound: SoundId): Howl {
  const existing = cache.get(sound);
  if (existing) return existing;

  const howl = new Howl({
    src: [`/sounds/${sound}.wav`],
    volume: VOLUME[sound] ?? 0.8,
    preload: true,
  });
  cache.set(sound, howl);
  return howl;
}

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // приватный режим — просто не запомним выбор
  }
  Howler.mute(muted);
}

/** Браузеры не дают играть звук без действия пользователя: будим по первому касанию. */
export function unlockAudio(): void {
  if (unlocked) return;
  unlocked = true;
  Howler.mute(isMuted());
  // Прогреваем частые звуки, чтобы первый «чпок» не опоздал.
  for (const sound of ['buzz_open', 'buzz_hit', 'correct', 'wrong'] as SoundId[]) load(sound);
}

export function playSound(sound: SoundId): void {
  if (isMuted()) return;
  try {
    load(sound).play();
  } catch {
    // звук — не повод ронять игру
  }
}

/** Барабанная дробь длинная: её нужно уметь остановить, когда вскрытие началось. */
export function stopSound(sound: SoundId): void {
  cache.get(sound)?.stop();
}
