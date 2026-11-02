import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { GameResult, RoomState } from '@svoyak/shared';
import { DEFAULT_SETTINGS } from '@svoyak/shared';
import { demoClassicPack } from '../packs/demo/classic.js';
import { createRoomState } from '../engine/createRoom.js';

// Хранилище берёт путь из окружения на импорте — подменяем до загрузки модулей.
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'svoyak-history-'));
process.env['DATA_DIR'] = tempDir;
const { listResults, saveResult } = await import('./historyRepo.js');
const { saveRoom } = await import('./roomsRepo.js');
const { RoomManager } = await import('../room/RoomManager.js');

afterAll(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

const result = (id: string, finishedAt: number, score = 100): GameResult => ({
  id,
  code: id,
  packTitle: 'Пак',
  startedAt: 1,
  finishedAt,
  players: [{ name: 'Аня', score }],
});

describe('история игр на диске', () => {
  it('сохраняет итоги и отдаёт их от новых к старым', () => {
    saveResult(result('old', 10));
    saveResult(result('new', 20));
    expect(listResults().map((entry) => entry.id).slice(0, 2)).toEqual(['new', 'old']);
  });

  it('повторная запись той же игры обновляет счёт, но не время окончания', () => {
    saveResult(result('again', 30, 100));
    saveResult(result('again', 99, 700));
    const saved = listResults().find((entry) => entry.id === 'again');
    expect(saved?.finishedAt).toBe(30);
    expect(saved?.players[0]?.score).toBe(700);
  });
});

describe('комната записывает итог сама', () => {
  it('дошедшая до итогов комната попадает в историю', () => {
    const base = createRoomState({
      code: '5151',
      pack: demoClassicPack,
      settings: DEFAULT_SETTINGS,
      hostToken: 'h',
      now: Date.now(),
    });
    const finished: RoomState = {
      ...base,
      phase: 'results',
      players: [
        { id: 'p1', name: 'Вера', score: 1500, connected: false, joinedAt: 1, sessionToken: 't1', hints: 0 },
      ],
    };
    saveRoom(finished);

    const rooms = new RoomManager({ clientBaseUrl: () => 'http://test' });
    rooms.restoreFromDisk();
    rooms.get('5151')?.dispatch({ type: 'HOST_PRESENCE', connected: true });

    const recorded = listResults().find((entry) => entry.code === '5151');
    expect(recorded?.players).toEqual([{ name: 'Вера', score: 1500 }]);
  });
});
