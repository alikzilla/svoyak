import { randomInt } from 'node:crypto';

/** Код комнаты: четыре цифры, чтобы легко надиктовать. При исчерпании — пять. */
export function generateRoomCode(taken: ReadonlySet<string>): string {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const code = String(randomInt(1000, 10000));
    if (!taken.has(code)) return code;
  }
  for (let attempt = 0; attempt < 5000; attempt += 1) {
    const code = String(randomInt(10000, 100000));
    if (!taken.has(code)) return code;
  }
  throw new Error('Не удалось подобрать свободный код комнаты');
}
