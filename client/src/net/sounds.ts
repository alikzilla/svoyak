import type { SoundId } from '@svoyak/shared';

/** Звуки синтезируются на месте: ни одного бинарного файла, работает без интернета. */
interface Blip {
  freq: number;
  durationMs: number;
  type: OscillatorType;
  /** Во сколько раз меняется высота к концу звука. */
  slide?: number;
}

const VOICES: Record<SoundId, Blip[]> = {
  buzz_open: [{ freq: 880, durationMs: 120, type: 'triangle' }],
  buzz_hit: [{ freq: 440, durationMs: 90, type: 'square', slide: 2 }],
  correct: [
    { freq: 660, durationMs: 110, type: 'triangle' },
    { freq: 990, durationMs: 180, type: 'triangle' },
  ],
  wrong: [{ freq: 220, durationMs: 260, type: 'sawtooth', slide: 0.6 }],
  time_up: [
    { freq: 330, durationMs: 140, type: 'square' },
    { freq: 220, durationMs: 220, type: 'square' },
  ],
  round_start: [
    { freq: 523, durationMs: 120, type: 'triangle' },
    { freq: 659, durationMs: 120, type: 'triangle' },
    { freq: 784, durationMs: 220, type: 'triangle' },
  ],
  game_over: [
    { freq: 784, durationMs: 160, type: 'triangle' },
    { freq: 523, durationMs: 320, type: 'triangle' },
  ],
};

const MUTE_KEY = 'svoyak:muted';
let context: AudioContext | null = null;

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
}

/** Браузеры не дают играть звук без действия пользователя: будим контекст по первому касанию. */
export function unlockAudio(): void {
  if (!context) context = new AudioContext();
  if (context.state === 'suspended') void context.resume();
}

export function playSound(sound: SoundId): void {
  if (isMuted()) return;
  if (!context) return; // до первого касания звука нет — это нормально
  if (context.state === 'suspended') void context.resume();

  let startAt = context.currentTime;
  for (const blip of VOICES[sound]) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const seconds = blip.durationMs / 1000;

    oscillator.type = blip.type;
    oscillator.frequency.setValueAtTime(blip.freq, startAt);
    if (blip.slide) {
      oscillator.frequency.exponentialRampToValueAtTime(blip.freq * blip.slide, startAt + seconds);
    }

    // Короткая атака и спад, иначе на границах слышны щелчки.
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.25, startAt + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + seconds);

    oscillator.connect(gain).connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + seconds);
    startAt += seconds;
  }
}
