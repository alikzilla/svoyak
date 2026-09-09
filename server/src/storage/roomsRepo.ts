import fs from 'node:fs';
import path from 'node:path';
import type { RoomState } from '@svoyak/shared';
import { ROOMS_DIR } from '../config.js';
import { readJson, writeJsonAtomic } from './atomicWrite.js';

const roomFile = (code: string): string => path.join(ROOMS_DIR, `${code}.json`);

export function saveRoom(state: RoomState): void {
  writeJsonAtomic(roomFile(state.code), state);
}

export function deleteRoom(code: string): void {
  fs.rmSync(roomFile(code), { force: true });
}

/** Читает сохранённые комнаты, выбрасывая просроченные и битые файлы. */
export function loadRooms(maxAgeMs: number, now = Date.now()): RoomState[] {
  if (!fs.existsSync(ROOMS_DIR)) return [];

  const rooms: RoomState[] = [];
  for (const file of fs.readdirSync(ROOMS_DIR)) {
    if (!file.endsWith('.json')) continue;
    const full = path.join(ROOMS_DIR, file);
    const state = readJson<RoomState>(full);

    if (!state || typeof state.code !== 'string' || !Array.isArray(state.players)) {
      fs.rmSync(full, { force: true });
      continue;
    }
    if (now - state.createdAt > maxAgeMs) {
      fs.rmSync(full, { force: true });
      continue;
    }
    // Никто ещё не подключился после перезапуска.
    rooms.push({
      ...state,
      hostConnected: false,
      players: state.players.map((player) => ({ ...player, connected: false })),
      timer: null,
      // Комнаты, сохранённые прошлой версией, приходят без счётчика фальстартов.
      buzz: { ...state.buzz, falseStarts: state.buzz?.falseStarts ?? {} },
    });
  }
  return rooms;
}
