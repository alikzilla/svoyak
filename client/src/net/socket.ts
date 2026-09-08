import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, Result, ServerToClientEvents } from '@svoyak/shared';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export const socket: AppSocket = io({ transports: ['websocket'], autoConnect: true });

type EmitWithAck = (event: string, ...args: unknown[]) => void;

/** Запрос с подтверждением. Ошибка сервера — это значение, а не исключение. */
export function ask<T>(event: keyof ClientToServerEvents, payload?: unknown): Promise<Result<T>> {
  return new Promise((resolve) => {
    const emit = socket.emit.bind(socket) as unknown as EmitWithAck;
    const done = (result: Result<T>): void => resolve(result);
    if (payload === undefined) emit(event, done);
    else emit(event, payload, done);
  });
}
