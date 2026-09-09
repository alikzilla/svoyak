/**
 * Генератор звуков игры. Сэмплы синтезируются в WAV, а не скачиваются:
 * так нет вопросов с лицензиями, файлы весят килобайты и игра звучит без интернета.
 *
 * Запуск: node client/scripts/makeSounds.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const RATE = 44100;

const clamp = (value) => Math.max(-1, Math.min(1, value));

/** Огибающая: быстрая атака, спад, удержание, затухание. */
function envelope(t, duration, { attack = 0.008, decay = 0.06, sustain = 0.7, release = 0.12 } = {}) {
  if (t < attack) return t / attack;
  if (t < attack + decay) return 1 - ((1 - sustain) * (t - attack)) / decay;
  const releaseStart = duration - release;
  if (t > releaseStart) return sustain * Math.max(0, (duration - t) / release);
  return sustain;
}

const wave = {
  sine: (phase) => Math.sin(phase),
  square: (phase) => (Math.sin(phase) >= 0 ? 1 : -1),
  saw: (phase) => 1 - (((phase / Math.PI) % 2) + 2) % 2,
  triangle: (phase) => (2 / Math.PI) * Math.asin(Math.sin(phase)),
  noise: () => Math.random() * 2 - 1,
};

/**
 * Слой звука: частота может ехать от `freq` к `to`, амплитуда — своя огибающая.
 */
function renderLayer(buffer, layer, offset) {
  const { type = 'sine', freq = 440, to = freq, duration = 0.2, gain = 0.3, env = {}, detune = 0 } = layer;
  const count = Math.floor(duration * RATE);
  let phase = 0;

  for (let index = 0; index < count; index += 1) {
    const t = index / RATE;
    const progress = t / duration;
    // Частота едет по экспоненте: так «съезд» слышится ровно.
    const current = freq * Math.pow(to / freq, progress) + detune;
    phase += (2 * Math.PI * current) / RATE;

    const sample = type === 'noise' ? wave.noise() : wave[type](phase);
    const target = offset + index;
    if (target < buffer.length) {
      buffer[target] = clamp(buffer[target] + sample * gain * envelope(t, duration, env));
    }
  }
}

/** Смешивает слои в один буфер и пишет 16-битный моно WAV. */
function renderSound(layers) {
  const total = Math.max(...layers.map((layer) => (layer.at ?? 0) + layer.duration));
  const buffer = new Float32Array(Math.ceil((total + 0.05) * RATE));

  for (const layer of layers) {
    renderLayer(buffer, layer, Math.floor((layer.at ?? 0) * RATE));
  }

  const data = Buffer.alloc(44 + buffer.length * 2);
  data.write('RIFF', 0);
  data.writeUInt32LE(36 + buffer.length * 2, 4);
  data.write('WAVE', 8);
  data.write('fmt ', 12);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(RATE, 24);
  data.writeUInt32LE(RATE * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write('data', 36);
  for (let index = 0; index < buffer.length; index += 1) {
    data.writeInt16LE(Math.round(clamp(buffer[index]) * 32000), 44 + index * 2);
  }
  return data;
}

/** Ноты, чтобы аккорды писались словами, а не числами. */
const note = (name) => {
  const table = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const step = table[name[0]] + (name.includes('#') ? 1 : 0);
  const octave = Number(name.at(-1));
  return 440 * Math.pow(2, (step - 9) / 12 + (octave - 4));
};

const SOUNDS = {
  // Кнопка открылась: короткий подъём с призвуком — сигнал «можно жать».
  buzz_open: [
    { type: 'triangle', freq: note('E5'), to: note('B5'), duration: 0.16, gain: 0.35 },
    { type: 'sine', freq: note('E6'), to: note('B6'), duration: 0.16, gain: 0.18 },
    { type: 'noise', duration: 0.05, gain: 0.12, env: { attack: 0.001, decay: 0.02, sustain: 0.1 } },
  ],

  // Нажатие: щелчок и резкий съезд вниз.
  buzz_hit: [
    { type: 'noise', duration: 0.03, gain: 0.35, env: { attack: 0.001, decay: 0.01, sustain: 0 } },
    { type: 'square', freq: note('A4'), to: note('A3'), duration: 0.12, gain: 0.3 },
  ],

  // Верно: восходящее трезвучие с колокольным призвуком.
  correct: [
    { type: 'triangle', freq: note('C5'), duration: 0.12, gain: 0.3, at: 0 },
    { type: 'triangle', freq: note('E5'), duration: 0.12, gain: 0.3, at: 0.09 },
    { type: 'triangle', freq: note('G5'), duration: 0.3, gain: 0.32, at: 0.18 },
    { type: 'sine', freq: note('C6'), duration: 0.42, gain: 0.14, at: 0.18 },
  ],

  // Неверно: низкий съезд с дребезгом.
  wrong: [
    { type: 'saw', freq: note('G3'), to: note('D3'), duration: 0.34, gain: 0.28 },
    { type: 'square', freq: note('G3'), to: note('C3'), duration: 0.34, gain: 0.14, detune: 4 },
  ],

  // Время вышло: два тревожных гудка.
  time_up: [
    { type: 'square', freq: note('E4'), duration: 0.16, gain: 0.26, at: 0 },
    { type: 'square', freq: note('C4'), duration: 0.28, gain: 0.26, at: 0.2 },
  ],

  // Начало раунда: короткая фанфара.
  round_start: [
    { type: 'triangle', freq: note('C5'), duration: 0.12, gain: 0.28, at: 0 },
    { type: 'triangle', freq: note('E5'), duration: 0.12, gain: 0.28, at: 0.1 },
    { type: 'triangle', freq: note('G5'), duration: 0.12, gain: 0.28, at: 0.2 },
    { type: 'triangle', freq: note('C6'), duration: 0.45, gain: 0.32, at: 0.3 },
    { type: 'sine', freq: note('E6'), duration: 0.45, gain: 0.16, at: 0.3 },
  ],

  // Конец игры: широкий торжественный аккорд.
  game_over: [
    { type: 'triangle', freq: note('C4'), duration: 0.9, gain: 0.22, env: { release: 0.5 } },
    { type: 'triangle', freq: note('E4'), duration: 0.9, gain: 0.2, env: { release: 0.5 }, at: 0.05 },
    { type: 'triangle', freq: note('G4'), duration: 0.9, gain: 0.2, env: { release: 0.5 }, at: 0.1 },
    { type: 'sine', freq: note('C5'), duration: 1.0, gain: 0.18, env: { release: 0.6 }, at: 0.15 },
  ],

  // Кот в мешке: пружинистый «бойнг».
  cat: [
    { type: 'sine', freq: note('C4'), to: note('C6'), duration: 0.18, gain: 0.3 },
    { type: 'sine', freq: note('C6'), to: note('G4'), duration: 0.22, gain: 0.26, at: 0.18 },
    { type: 'triangle', freq: note('E5'), to: note('E6'), duration: 0.14, gain: 0.16, at: 0.3 },
  ],

  // Ставка на аукционе: короткий «поп».
  bid: [
    { type: 'sine', freq: note('A4'), to: note('E5'), duration: 0.09, gain: 0.3, env: { attack: 0.002, decay: 0.03, sustain: 0.4 } },
  ],

  // Ва-банк: удар молотка и золотая вспышка.
  all_in: [
    { type: 'noise', duration: 0.06, gain: 0.4, env: { attack: 0.001, decay: 0.02, sustain: 0.2 } },
    { type: 'square', freq: note('C3'), to: note('C2'), duration: 0.3, gain: 0.3 },
    { type: 'triangle', freq: note('G5'), to: note('C6'), duration: 0.4, gain: 0.2, at: 0.05 },
  ],

  // Барабанная дробь перед вскрытием финала.
  drumroll: [
    ...Array.from({ length: 26 }, (_, index) => ({
      type: 'noise',
      duration: 0.035,
      gain: 0.1 + index * 0.008,
      at: index * 0.045,
      env: { attack: 0.001, decay: 0.012, sustain: 0.05, release: 0.01 },
    })),
    { type: 'noise', duration: 0.25, gain: 0.4, at: 1.2, env: { attack: 0.001, decay: 0.08, sustain: 0.2 } },
  ],

  // Победа: салют из восходящих искр.
  victory: [
    { type: 'triangle', freq: note('G4'), duration: 0.14, gain: 0.26, at: 0 },
    { type: 'triangle', freq: note('C5'), duration: 0.14, gain: 0.26, at: 0.12 },
    { type: 'triangle', freq: note('E5'), duration: 0.14, gain: 0.26, at: 0.24 },
    { type: 'triangle', freq: note('G5'), duration: 0.5, gain: 0.3, at: 0.36 },
    { type: 'sine', freq: note('C6'), duration: 0.6, gain: 0.2, at: 0.36 },
    { type: 'noise', duration: 0.5, gain: 0.08, at: 0.4, env: { attack: 0.05, decay: 0.2, sustain: 0.3 } },
  ],
};

const outDir = path.join(process.cwd(), 'client/public/sounds');
fs.mkdirSync(outDir, { recursive: true });

for (const [name, layers] of Object.entries(SOUNDS)) {
  const file = path.join(outDir, `${name}.wav`);
  const data = renderSound(layers);
  fs.writeFileSync(file, data);
  console.log(`✓ ${name}.wav — ${(data.length / 1024).toFixed(1)} КБ`);
}
