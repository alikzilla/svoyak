/** Всё, что нужно от сокета для подписки. */
export interface Listenable {
  on(event: string, handler: (...args: never[]) => void): unknown;
  off(event: string, handler: (...args: never[]) => void): unknown;
}

type Handlers = Record<string, (...args: never[]) => void>;

/**
 * Подписывает обработчики и возвращает отписку ровно от них. `socket.off(event)`
 * без обработчика снял бы с события всех слушателей, в том числе чужих.
 */
export function listen(target: Listenable, handlers: Handlers): () => void {
  const entries = Object.entries(handlers);
  for (const [event, handler] of entries) target.on(event, handler);
  return () => {
    for (const [event, handler] of entries) target.off(event, handler);
  };
}
