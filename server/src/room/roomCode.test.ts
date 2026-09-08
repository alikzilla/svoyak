import { describe, it, expect } from 'vitest';
import { generateRoomCode } from './roomCode.js';

describe('generateRoomCode', () => {
  it('по умолчанию выдаёт код из четырёх цифр', () => {
    expect(generateRoomCode(new Set())).toMatch(/^\d{4}$/);
  });

  it('не выдаёт уже занятый код', () => {
    const taken = new Set<string>();
    for (let i = 0; i < 200; i += 1) taken.add(generateRoomCode(taken));
    expect(taken.size).toBe(200);
  });

  it('переходит на пять цифр, когда четырёхзначные исчерпаны', () => {
    const taken = new Set<string>();
    for (let code = 1000; code <= 9999; code += 1) taken.add(String(code));
    expect(generateRoomCode(taken)).toMatch(/^\d{5}$/);
  });
});
