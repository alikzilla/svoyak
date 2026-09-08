import { useEffect, useState } from 'react';
import type { AnyView, BoardView, HostView, PlayerView, Result, Role } from '@svoyak/shared';
import { ask, socket } from './socket.js';
import { clearSession, loadSession, type Session } from './session.js';

export interface Toast {
  text: string;
  tone: 'info' | 'warn' | 'error';
  at: number;
}

export interface RoomConnection<V extends AnyView> {
  view: V | null;
  connected: boolean;
  toast: Toast | null;
  /** Причина, по которой участник выбыл из комнаты. */
  closed: string | null;
}

/** Подписка на проекцию своей роли с автоматическим возвратом в комнату после перезагрузки. */
function useRoomView<V extends AnyView>(role: Role): RoomConnection<V> {
  const [view, setView] = useState<V | null>(null);
  const [connected, setConnected] = useState(socket.connected);
  const [toast, setToast] = useState<Toast | null>(null);
  const [closed, setClosed] = useState<string | null>(null);

  useEffect(() => {
    const onSync = (next: AnyView): void => {
      if (next.role === role) setView(next as V);
    };
    const onToast = (payload: { text: string; tone: 'info' | 'warn' | 'error' }): void => {
      setToast({ ...payload, at: Date.now() });
    };
    const onClosed = (payload: { reason: string }): void => {
      clearSession();
      setClosed(payload.reason);
      setView(null);
    };

    const rejoin = async (): Promise<void> => {
      setConnected(true);
      const session = loadSession();
      if (!session || session.role !== role) return;
      const result = await ask<{ playerId: string | null }>('room:rejoin', {
        code: session.code,
        token: session.token,
        role: session.role,
      });
      if (!result.ok) {
        clearSession();
        setClosed(result.error);
      }
    };

    socket.on('state:sync', onSync);
    socket.on('toast', onToast);
    socket.on('room:closed', onClosed);
    socket.on('connect', () => void rejoin());
    socket.on('disconnect', () => setConnected(false));

    if (socket.connected) void rejoin();

    return () => {
      socket.off('state:sync', onSync);
      socket.off('toast', onToast);
      socket.off('room:closed', onClosed);
      socket.off('connect');
      socket.off('disconnect');
    };
  }, [role]);

  return { view, connected, toast, closed };
}

export const useHostRoom = (): RoomConnection<HostView> => useRoomView<HostView>('host');
export const usePlayerRoom = (): RoomConnection<PlayerView> => useRoomView<PlayerView>('player');
export const useBoardRoom = (): RoomConnection<BoardView> => useRoomView<BoardView>('board');

export async function rejoinAs(session: Session): Promise<Result<{ playerId: string | null }>> {
  return ask<{ playerId: string | null }>('room:rejoin', {
    code: session.code,
    token: session.token,
    role: session.role,
  });
}
