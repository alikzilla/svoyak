import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS } from '@svoyak/shared';
import { checkPacket, isSettingsPatch } from './payloads.js';

const ack = (): void => {};

describe('проверка сокет-пакетов', () => {
  it('настоящие запросы клиента проходят без изменений', () => {
    expect(checkPacket('room:join', [{ code: '1234', name: 'Вася' }, ack])).toEqual({
      ok: true,
      args: [{ code: '1234', name: 'Вася' }, ack],
    });
    expect(checkPacket('host:startGame', [ack])).toEqual({ ok: true, args: [ack] });
    expect(checkPacket('player:bid', [{ amount: 'all-in' }, ack]).ok).toBe(true);
    expect(checkPacket('player:bid', [{ amount: 300 }, ack]).ok).toBe(true);
  });

  it('мастер создания комнаты шлёт все настройки разом — это допустимо', () => {
    expect(isSettingsPatch(DEFAULT_SETTINGS)).toBe(true);
    expect(isSettingsPatch({ autoOpenBuzzer: false, readingMs: 0 })).toBe(true);
  });

  it('без колбэка обработчик получает заглушку, а не undefined', () => {
    const checked = checkPacket('room:watch', [{ code: '1234' }]);
    expect(checked.ok).toBe(true);
    if (checked.ok) expect(typeof checked.args[1]).toBe('function');
  });

  it('неизвестное событие отбрасывается', () => {
    expect(checkPacket('admin:dropDatabase', [{}, ack])).toEqual({ ok: false, ack });
  });

  it('ставка строкой-числом не проходит', () => {
    expect(checkPacket('player:finalBet', [{ bet: '500' }, ack]).ok).toBe(false);
    expect(checkPacket('player:bid', [{ amount: Number.NaN }, ack]).ok).toBe(false);
  });
});
