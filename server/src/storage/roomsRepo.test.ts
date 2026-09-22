import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_SETTINGS } from '@svoyak/shared';
import { demoClassicPack } from '../packs/demo/classic.js';
import { createRoomState } from '../engine/createRoom.js';
import { reduce } from '../engine/reducer.js';

// Хранилище берёт путь из окружения на импорте — подменяем до загрузки модуля.
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'svoyak-rooms-'));
process.env['DATA_DIR'] = tempDir;
const { saveRoom, loadRooms } = await import('./roomsRepo.js');

function roomWithPlayer(now: number) {
  const base = createRoomState({
    code: '4321',
    pack: demoClassicPack,
    settings: DEFAULT_SETTINGS,
    hostToken: 'host-token',
    now,
  });
  const joined = reduce(base, {
    type: 'PLAYER_JOIN',
    playerId: 'p1',
    name: 'Вася',
    sessionToken: 't1',
    at: now,
  }).state;
  return reduce(joined, { type: 'SET_SCORE', playerId: 'p1', score: 700 }).state;
}

describe('хранилище комнат', () => {
  it('сохранённая комната читается обратно вместе со счётом игрока', () => {
    saveRoom(roomWithPlayer(Date.now()));
    const restored = loadRooms(60_000);
    expect(restored).toHaveLength(1);
    expect(restored[0]!.code).toBe('4321');
    expect(restored[0]!.players[0]).toMatchObject({ name: 'Вася', score: 700 });
  });

  it('после восстановления все считаются отключёнными, пока не зайдут заново', () => {
    saveRoom(roomWithPlayer(Date.now()));
    const restored = loadRooms(60_000);
    expect(restored[0]!.players[0]!.connected).toBe(false);
    expect(restored[0]!.hostConnected).toBe(false);
    expect(restored[0]!.timer).toBeNull();
  });

  it('просроченная комната удаляется с диска', () => {
    const old = roomWithPlayer(Date.now() - 10_000);
    saveRoom(old);
    expect(loadRooms(1000)).toHaveLength(0);
    expect(fs.existsSync(path.join(tempDir, 'rooms', '4321.json'))).toBe(false);
  });

  it('битый файл не роняет загрузку и удаляется', () => {
    fs.mkdirSync(path.join(tempDir, 'rooms'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'rooms', 'broken.json'), '{ это не json', 'utf8');
    expect(() => loadRooms(60_000)).not.toThrow();
    expect(fs.existsSync(path.join(tempDir, 'rooms', 'broken.json'))).toBe(false);
  });

  it('игрок без жетонов подсказки в сохранённом файле получает hints: 0 при загрузке', () => {
    // Комната, сохранённая до появления поля hints в Player, — файл на диске
    // его не содержит, хотя тип на это рассчитывает.
    const state = roomWithPlayer(Date.now());
    const raw = JSON.parse(JSON.stringify(state)) as { players: Array<Record<string, unknown>> };
    for (const player of raw.players) delete player['hints'];
    fs.mkdirSync(path.join(tempDir, 'rooms'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'rooms', `${state.code}.json`), JSON.stringify(raw), 'utf8');

    const restored = loadRooms(60_000);
    expect(restored).toHaveLength(1);
    expect(restored[0]!.players[0]!.hints).toBe(0);
  });

  it('комната без modifierCells в сохранённом файле получает modifierCells: {} при загрузке', () => {
    // Комната, сохранённая до появления клеток-модификаторов, — файл на диске
    // не содержит этого поля вовсе, а не содержит его равным undefined.
    const state = roomWithPlayer(Date.now());
    const raw = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
    delete raw['modifierCells'];
    fs.mkdirSync(path.join(tempDir, 'rooms'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'rooms', `${state.code}.json`), JSON.stringify(raw), 'utf8');

    const restored = loadRooms(60_000);
    expect(restored).toHaveLength(1);
    expect(restored[0]!.modifierCells).toEqual({});
  });

  it('комната без modifier в сохранённом файле получает modifier: null при загрузке', () => {
    // Комната, сохранённая до появления сцены модификатора, — файл на диске
    // не содержит этого поля вовсе, а не содержит его равным undefined.
    const state = roomWithPlayer(Date.now());
    const raw = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
    delete raw['modifier'];
    fs.mkdirSync(path.join(tempDir, 'rooms'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'rooms', `${state.code}.json`), JSON.stringify(raw), 'utf8');

    const restored = loadRooms(60_000);
    expect(restored).toHaveLength(1);
    expect(restored[0]!.modifier).toBeNull();
  });

  it('комната без modifierPlan в сохранённом файле получает пустой план при загрузке', () => {
    // Комната, сохранённая до появления плана модификаторов, — файл на диске
    // не содержит этого поля вовсе, а не содержит его равным undefined.
    const state = roomWithPlayer(Date.now());
    const raw = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
    delete raw['modifierPlan'];
    fs.mkdirSync(path.join(tempDir, 'rooms'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'rooms', `${state.code}.json`), JSON.stringify(raw), 'utf8');

    const restored = loadRooms(60_000);
    expect(restored).toHaveLength(1);
    expect(restored[0]!.modifierPlan).toEqual({ perRound: 0, kinds: [] });
  });

  it('комната с неполным settings в сохранённом файле получает дефолты недостающих полей', () => {
    // Комната, сохранённая до появления настройки (например, modifierMs), —
    // файл на диске не содержит этого ключа внутри settings вовсе.
    const state = roomWithPlayer(Date.now());
    const raw = JSON.parse(JSON.stringify(state)) as { settings: Record<string, unknown> };
    delete raw.settings['modifierMs'];
    delete raw.settings['answerRevealMs'];
    fs.mkdirSync(path.join(tempDir, 'rooms'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'rooms', `${state.code}.json`), JSON.stringify(raw), 'utf8');

    const restored = loadRooms(60_000);
    expect(restored).toHaveLength(1);
    expect(restored[0]!.settings.modifierMs).toBe(DEFAULT_SETTINGS.modifierMs);
    expect(restored[0]!.settings.answerRevealMs).toBe(DEFAULT_SETTINGS.answerRevealMs);
  });
});
