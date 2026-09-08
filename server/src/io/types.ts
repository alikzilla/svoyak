import type { ClientToServerEvents, Role, ServerToClientEvents } from '@svoyak/shared';
import type { Server, Socket } from 'socket.io';

/** Данные, которые сервер держит на сокете. Клиент их не присылает и не меняет. */
export interface SocketData {
  role: Role | null;
  code: string | null;
  playerId: string | null;
}

export type AppServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

export type AppSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;
