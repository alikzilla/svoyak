import { describe, it, expect } from 'vitest';
import { listen, type Listenable } from './listen.js';

/** Минимальный эмиттер с тем же on/off, что у сокета. */
function fakeSocket(): Listenable & { emit: (event: string) => void } {
  const handlers = new Map<string, Array<(...args: never[]) => void>>();
  return {
    on(event, handler) {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
    },
    off(event, handler) {
      handlers.set(event, (handlers.get(event) ?? []).filter((candidate) => candidate !== handler));
    },
    emit(event) {
      for (const handler of handlers.get(event) ?? []) (handler as () => void)();
    },
  };
}

describe('listen', () => {
  it('отписка снимает только свои обработчики, чужие на том же событии остаются', () => {
    const socket = fakeSocket();
    const calls: string[] = [];
    socket.on('connect', () => calls.push('чужой'));

    const stop = listen(socket, { connect: () => calls.push('свой') });
    socket.emit('connect');
    stop();
    socket.emit('connect');

    expect(calls).toEqual(['чужой', 'свой', 'чужой']);
  });
});
