import type { Pack, RoomSettings, RoomState } from '@svoyak/shared';
import { DEFAULT_SETTINGS } from '@svoyak/shared';
import { randomUUID } from 'node:crypto';
import type { Effect } from '../engine/actions.js';
import { createRoomState } from '../engine/createRoom.js';
import { deleteRoom, loadRooms, saveRoom } from '../storage/roomsRepo.js';
import { RoomRuntime } from './RoomRuntime.js';
import { generateRoomCode } from './roomCode.js';

/** Комнаты старше суток при старте не восстанавливаем. */
export const ROOM_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const PERSIST_DEBOUNCE_MS = 200;

export interface RoomManagerDeps {
  /** Базовый адрес клиента, например http://192.168.1.5:5173 */
  clientBaseUrl: () => string;
  emit?: (code: string, effect: Effect) => void;
}

export class RoomManager {
  private readonly rooms = new Map<string, RoomRuntime>();
  private readonly pending = new Map<string, NodeJS.Timeout>();

  constructor(private readonly deps: RoomManagerDeps) {}

  get codes(): Set<string> {
    return new Set(this.rooms.keys());
  }

  create(pack: Pack, settings?: Partial<RoomSettings>): { room: RoomRuntime; hostToken: string } {
    const code = generateRoomCode(this.codes);
    const hostToken = randomUUID();
    const state = createRoomState({
      code,
      pack,
      settings: { ...DEFAULT_SETTINGS, ...settings },
      hostToken,
    });
    const room = this.attach(state);
    saveRoom(state);
    return { room, hostToken };
  }

  get(code: string): RoomRuntime | undefined {
    return this.rooms.get(code);
  }

  close(code: string): void {
    this.rooms.get(code)?.dispose();
    this.rooms.delete(code);
    this.flush(code);
    deleteRoom(code);
  }

  /** Восстановление после перезапуска сервера. */
  restoreFromDisk(): number {
    const states = loadRooms(ROOM_MAX_AGE_MS);
    for (const state of states) this.attach(state);
    return states.length;
  }

  joinUrl(code: string): string {
    return `${this.deps.clientBaseUrl()}/join?code=${code}`;
  }

  /** Сбрасывает отложенные сохранения — вызывается при остановке процесса. */
  flushAll(): void {
    for (const code of [...this.pending.keys()]) this.flush(code);
  }

  private attach(state: RoomState): RoomRuntime {
    const room = new RoomRuntime(state, {
      persist: (next) => this.schedulePersist(next),
      joinUrlFor: (code) => this.joinUrl(code),
      ...(this.deps.emit ? { emit: (effect: Effect) => this.deps.emit?.(state.code, effect) } : {}),
    });
    this.rooms.set(state.code, room);
    return room;
  }

  private schedulePersist(state: RoomState): void {
    const existing = this.pending.get(state.code);
    if (existing) clearTimeout(existing);
    this.pending.set(
      state.code,
      setTimeout(() => {
        this.pending.delete(state.code);
        saveRoom(state);
      }, PERSIST_DEBOUNCE_MS),
    );
  }

  private flush(code: string): void {
    const timer = this.pending.get(code);
    if (!timer) return;
    clearTimeout(timer);
    this.pending.delete(code);
    const room = this.rooms.get(code);
    if (room) saveRoom(room.state);
  }
}
