import { randomUUID } from 'node:crypto';
import type { Ack, RoomSettings } from '@svoyak/shared';
import { validatePack } from '@svoyak/shared';
import type { Effect, GameAction } from '../engine/actions.js';
import type { RoomManager } from '../room/RoomManager.js';
import type { RoomRuntime } from '../room/RoomRuntime.js';
import { adjustBuzzTime } from '../engine/buzz.js';
import { getPack } from '../storage/packsRepo.js';
import type { AppServer, AppSocket } from './types.js';

const MAX_NAME_LENGTH = 20;

export function registerSocketHandlers(io: AppServer, rooms: RoomManager): void {
  /** Каждому сокету — своя проекция: игрок не должен получить данные ведущего. */
  const broadcast = (code: string): void => {
    const room = rooms.get(code);
    if (!room) return;
    for (const socket of io.sockets.sockets.values()) {
      if (socket.data.code !== code) continue;
      if (socket.data.role === 'host') socket.emit('state:sync', room.hostView());
      else if (socket.data.role === 'board') socket.emit('state:sync', room.boardView());
      else if (socket.data.playerId) socket.emit('state:sync', room.playerView(socket.data.playerId));
    }
  };

  const emitEffect = (code: string, effect: Effect): void => {
    if (effect.type === 'sound') {
      io.to(`room:${code}`).emit('sound:play', effect.sound);
      return;
    }
    if (effect.type !== 'toast') return;
    const payload = { text: effect.text, tone: effect.tone };
    if (effect.to === 'all') io.to(`room:${code}`).emit('toast', payload);
    else if (effect.to === 'host') {
      for (const socket of io.sockets.sockets.values()) {
        if (socket.data.code === code && socket.data.role === 'host') socket.emit('toast', payload);
      }
    } else {
      const { playerId } = effect.to;
      for (const socket of io.sockets.sockets.values()) {
        if (socket.data.code === code && socket.data.playerId === playerId) {
          socket.emit('toast', payload);
        }
      }
    }
  };

  rooms.setEmitter(emitEffect);

  /** Комнаты, на изменения которых уже подписан этот сокет-слой. */
  const subscribed = new Set<string>();

  const bind = (socket: AppSocket, room: RoomRuntime, code: string): void => {
    void socket.join(`room:${code}`);
    if (subscribed.has(code)) return;
    subscribed.add(code);
    room.onChange(() => broadcast(code));
  };

  const requireRoom = (socket: AppSocket): RoomRuntime | null => {
    const code = socket.data.code;
    return code ? (rooms.get(code) ?? null) : null;
  };

  const requireHost = <T>(socket: AppSocket, ack: Ack<T>): RoomRuntime | null => {
    const room = requireRoom(socket);
    if (!room) {
      ack({ ok: false, error: 'Комната не найдена' });
      return null;
    }
    if (socket.data.role !== 'host') {
      ack({ ok: false, error: 'Это действие доступно только ведущему' });
      return null;
    }
    return room;
  };

  io.on('connection', (socket: AppSocket) => {
    socket.data = { role: null, code: null, playerId: null };

    socket.on('clock:ping', ({ t0 }, ack) => {
      ack({ t0, tServer: Date.now() });
    });

    socket.on('room:create', ({ packId, settings }, ack) => {
      const pack = getPack(packId);
      if (!pack) {
        ack({ ok: false, error: 'Пак не найден' });
        return;
      }

      // Недоделанный пак можно править, но играть им нельзя.
      const errors = validatePack(pack).filter((issue) => issue.level === 'error');
      if (errors.length > 0) {
        ack({
          ok: false,
          error: `Пак не готов к игре: ${errors[0]?.message ?? ''}${errors.length > 1 ? ` (и ещё ${errors.length - 1})` : ''}`,
        });
        return;
      }
      const { room, hostToken } = rooms.create(pack, settings);
      socket.data = { role: 'host', code: room.state.code, playerId: null };
      bind(socket, room, room.state.code);
      room.dispatch({ type: 'HOST_PRESENCE', connected: true });
      ack({ ok: true, data: { code: room.state.code, hostToken } });
      broadcast(room.state.code);
    });

    socket.on('room:join', ({ code, name }, ack) => {
      const room = rooms.get(code);
      if (!room) {
        ack({ ok: false, error: 'Комната с таким кодом не найдена' });
        return;
      }
      const trimmed = name.trim().slice(0, MAX_NAME_LENGTH);
      const playerId = randomUUID();
      const sessionToken = randomUUID();
      const result = room.dispatch({
        type: 'PLAYER_JOIN',
        playerId,
        name: trimmed,
        sessionToken,
        at: Date.now(),
      });
      if (!result.ok) {
        ack({ ok: false, error: result.error ?? 'Не удалось войти' });
        return;
      }
      const me = room.state.players.find((player) => player.sessionToken === sessionToken);
      socket.data = { role: 'player', code, playerId: me?.id ?? playerId };
      bind(socket, room, code);
      ack({ ok: true, data: { playerId: me?.id ?? playerId, sessionToken } });
      broadcast(code);
    });

    socket.on('room:rejoin', ({ code, token, role }, ack) => {
      const room = rooms.get(code);
      if (!room) {
        ack({ ok: false, error: 'Комната больше не существует' });
        return;
      }

      if (role === 'host') {
        if (token !== room.state.hostToken) {
          ack({ ok: false, error: 'Неверный токен ведущего' });
          return;
        }
        socket.data = { role: 'host', code, playerId: null };
        bind(socket, room, code);
        room.dispatch({ type: 'HOST_PRESENCE', connected: true });
        ack({ ok: true, data: { playerId: null, role: 'host' } });
        broadcast(code);
        return;
      }

      if (role === 'board') {
        socket.data = { role: 'board', code, playerId: null };
        bind(socket, room, code);
        ack({ ok: true, data: { playerId: null, role: 'board' } });
        broadcast(code);
        return;
      }

      const player = room.state.players.find((candidate) => candidate.sessionToken === token);
      if (!player) {
        ack({ ok: false, error: 'Игрок не найден: войдите заново по коду' });
        return;
      }
      const result = room.dispatch({
        type: 'PLAYER_JOIN',
        playerId: player.id,
        name: player.name,
        sessionToken: token,
        at: Date.now(),
      });
      if (!result.ok) {
        ack({ ok: false, error: result.error ?? 'Не удалось вернуться в игру' });
        return;
      }
      socket.data = { role: 'player', code, playerId: player.id };
      bind(socket, room, code);
      ack({ ok: true, data: { playerId: player.id, role: 'player' } });
      broadcast(code);
    });

    socket.on('room:watch', ({ code }, ack) => {
      const room = rooms.get(code);
      if (!room) {
        ack({ ok: false, error: 'Комната не найдена' });
        return;
      }
      socket.data = { role: 'board', code, playerId: null };
      bind(socket, room, code);
      ack({ ok: true, data: null });
      broadcast(code);
    });

    socket.on('room:leave', (ack) => {
      const code = socket.data.code;
      if (code) void socket.leave(`room:${code}`);
      socket.data = { role: null, code: null, playerId: null };
      ack({ ok: true, data: null });
    });

    /** Действие ведущего без параметров: одна строчка вместо десяти одинаковых обработчиков. */
    const hostAction = (
      event: 'host:startGame' | 'host:openBuzzer' | 'host:revealAnswer' | 'host:skipQuestion'
        | 'host:extendTime' | 'host:continue' | 'host:nextRound',
      makeAction: () => GameAction,
    ): void => {
      socket.on(event, (ack) => {
        const room = requireHost(socket, ack);
        if (!room) return;
        const result = room.dispatch(makeAction());
        ack(result.ok ? { ok: true, data: null } : { ok: false, error: result.error ?? 'Ошибка' });
      });
    };

    hostAction('host:startGame', () => ({ type: 'START_GAME', at: Date.now() }));
    hostAction('host:openBuzzer', () => ({ type: 'OPEN_BUZZER', at: Date.now() }));
    hostAction('host:revealAnswer', () => ({ type: 'REVEAL_ANSWER', at: Date.now() }));
    hostAction('host:skipQuestion', () => ({ type: 'SKIP_QUESTION', at: Date.now() }));
    hostAction('host:extendTime', () => ({ type: 'EXTEND_TIME', at: Date.now() }));
    hostAction('host:continue', () => ({ type: 'CONTINUE', at: Date.now() }));
    hostAction('host:nextRound', () => ({ type: 'NEXT_ROUND', at: Date.now() }));

    socket.on('host:pickQuestion', ({ themeId, questionId }, ack) => {
      const room = requireHost(socket, ack);
      if (!room) return;
      const result = room.dispatch({ type: 'PICK_QUESTION', themeId, questionId, at: Date.now() });
      ack(result.ok ? { ok: true, data: null } : { ok: false, error: result.error ?? 'Ошибка' });
    });

    socket.on('host:judge', ({ verdict }, ack) => {
      const room = requireHost(socket, ack);
      if (!room) return;
      const result = room.dispatch({ type: 'JUDGE', verdict, at: Date.now() });
      ack(result.ok ? { ok: true, data: null } : { ok: false, error: result.error ?? 'Ошибка' });
    });

    socket.on('host:setControl', ({ playerId }, ack) => {
      const room = requireHost(socket, ack);
      if (!room) return;
      const result = room.dispatch({ type: 'SET_CONTROL', playerId });
      ack(result.ok ? { ok: true, data: null } : { ok: false, error: result.error ?? 'Ошибка' });
    });

    socket.on('host:pause', ({ paused }, ack) => {
      const room = requireHost(socket, ack);
      if (!room) return;
      const result = room.dispatch({ type: 'PAUSE', paused });
      ack(result.ok ? { ok: true, data: null } : { ok: false, error: result.error ?? 'Ошибка' });
    });

    socket.on('player:catTransfer', ({ toPlayerId }, ack) => {
      const room = requireRoom(socket);
      const playerId = socket.data.playerId;
      if (!room || socket.data.role !== 'player' || !playerId) {
        ack({ ok: false, error: 'Вы не в игре' });
        return;
      }
      if (room.state.cat?.fromPlayerId !== playerId) {
        ack({ ok: false, error: 'Кота передаёт тот, кто его открыл' });
        return;
      }
      const result = room.dispatch({ type: 'CAT_TRANSFER', toPlayerId, at: Date.now() });
      ack(result.ok ? { ok: true, data: null } : { ok: false, error: result.error ?? 'Ошибка' });
    });

    socket.on('player:bid', ({ amount }, ack) => {
      const room = requireRoom(socket);
      const playerId = socket.data.playerId;
      if (!room || socket.data.role !== 'player' || !playerId) {
        ack({ ok: false, error: 'Вы не в игре' });
        return;
      }
      const result = room.dispatch({ type: 'BID', playerId, amount, at: Date.now() });
      ack(result.ok ? { ok: true, data: null } : { ok: false, error: result.error ?? 'Ошибка' });
    });

    socket.on('player:finalRemoveTheme', ({ themeId }, ack) => {
      const room = requireRoom(socket);
      const playerId = socket.data.playerId;
      if (!room || socket.data.role !== 'player' || !playerId) {
        ack({ ok: false, error: 'Вы не в игре' });
        return;
      }
      const result = room.dispatch({ type: 'FINAL_REMOVE_THEME', playerId, themeId, at: Date.now() });
      ack(result.ok ? { ok: true, data: null } : { ok: false, error: result.error ?? 'Ошибка' });
    });

    socket.on('player:finalBet', ({ bet }, ack) => {
      const room = requireRoom(socket);
      const playerId = socket.data.playerId;
      if (!room || socket.data.role !== 'player' || !playerId) {
        ack({ ok: false, error: 'Вы не в игре' });
        return;
      }
      const result = room.dispatch({ type: 'FINAL_BET', playerId, bet, at: Date.now() });
      ack(result.ok ? { ok: true, data: null } : { ok: false, error: result.error ?? 'Ошибка' });
    });

    socket.on('player:finalAnswer', ({ answer }, ack) => {
      const room = requireRoom(socket);
      const playerId = socket.data.playerId;
      if (!room || socket.data.role !== 'player' || !playerId) {
        ack({ ok: false, error: 'Вы не в игре' });
        return;
      }
      const result = room.dispatch({ type: 'FINAL_ANSWER', playerId, answer, at: Date.now() });
      ack(result.ok ? { ok: true, data: null } : { ok: false, error: result.error ?? 'Ошибка' });
    });

    socket.on('host:finalJudge', ({ correct }, ack) => {
      const room = requireHost(socket, ack);
      if (!room) return;
      const result = room.dispatch({ type: 'FINAL_JUDGE', correct, at: Date.now() });
      ack(result.ok ? { ok: true, data: null } : { ok: false, error: result.error ?? 'Ошибка' });
    });

    socket.on('player:buzz', ({ clientTime, clockOffset, minRtt }, ack) => {
      const room = requireRoom(socket);
      const playerId = socket.data.playerId;
      if (!room || socket.data.role !== 'player' || !playerId) {
        ack({ ok: false, error: 'Вы не в игре' });
        return;
      }
      const receivedAt = Date.now();
      // Метке клиента не доверяем: сервер приводит её к своему времени и зажимает.
      const atServerTime = adjustBuzzTime({ clientTime, clockOffset, minRtt, receivedAt });
      const result = room.dispatch({ type: 'BUZZ', playerId, atServerTime, receivedAt });
      ack(result.ok ? { ok: true, data: null } : { ok: false, error: result.error ?? 'Ошибка' });
    });

    socket.on('host:adjustScore', ({ playerId, score }, ack) => {
      const room = requireHost(socket, ack);
      if (!room) return;
      const result = room.dispatch({ type: 'SET_SCORE', playerId, score });
      ack(result.ok ? { ok: true, data: null } : { ok: false, error: result.error ?? 'Ошибка' });
    });

    socket.on('host:kick', ({ playerId }, ack) => {
      const room = requireHost(socket, ack);
      if (!room) return;
      const result = room.dispatch({ type: 'PLAYER_KICK', playerId });
      if (result.ok) {
        for (const other of io.sockets.sockets.values()) {
          if (other.data.code === socket.data.code && other.data.playerId === playerId) {
            other.emit('room:closed', { reason: 'Ведущий удалил вас из игры' });
            other.data = { role: null, code: null, playerId: null };
          }
        }
      }
      ack(result.ok ? { ok: true, data: null } : { ok: false, error: result.error ?? 'Ошибка' });
    });

    socket.on('host:updateSettings', (settings: Partial<RoomSettings>, ack) => {
      const room = requireHost(socket, ack);
      if (!room) return;
      const result = room.dispatch({ type: 'SET_SETTINGS', settings });
      ack(result.ok ? { ok: true, data: null } : { ok: false, error: result.error ?? 'Ошибка' });
    });

    socket.on('host:undo', (ack) => {
      const room = requireHost(socket, ack);
      if (!room) return;
      const undone = room.undo();
      ack(undone ? { ok: true, data: null } : { ok: false, error: 'Отменять нечего' });
    });

    socket.on('disconnect', () => {
      const { code, role, playerId } = socket.data;
      if (!code) return;
      const room = rooms.get(code);
      if (!room) return;

      if (role === 'host') room.dispatch({ type: 'HOST_PRESENCE', connected: false });
      else if (role === 'player' && playerId) room.dispatch({ type: 'PLAYER_DISCONNECT', playerId });
      broadcast(code);
    });
  });
}
