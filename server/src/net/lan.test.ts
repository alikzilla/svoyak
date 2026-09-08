import { describe, it, expect } from 'vitest';
import { pickLanAddress } from './lan.js';

describe('pickLanAddress', () => {
  it('выбирает внешний IPv4 и игнорирует loopback', () => {
    expect(
      pickLanAddress({
        lo0: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
        en0: [{ address: '192.168.1.42', family: 'IPv4', internal: false }],
      }),
    ).toBe('192.168.1.42');
  });

  it('предпочитает частную сеть публичному адресу', () => {
    expect(
      pickLanAddress({
        utun3: [{ address: '100.64.3.7', family: 'IPv4', internal: false }],
        en0: [{ address: '192.168.1.42', family: 'IPv4', internal: false }],
      }),
    ).toBe('192.168.1.42');
  });

  it('игнорирует IPv6 и возвращает null, если внешних IPv4 нет', () => {
    expect(pickLanAddress({ lo0: [{ address: '::1', family: 'IPv6', internal: true }] })).toBeNull();
  });
});
