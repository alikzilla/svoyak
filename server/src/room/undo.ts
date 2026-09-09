import type { Player, RoomState } from '@svoyak/shared';

export const UNDO_DEPTH = 50;

/** Копия изменяемой части состояния. Пак неизменяем — переиспользуем по ссылке,
 *  иначе каждый снимок тащил бы весь текст вопросов. */
export function cloneState(state: RoomState): RoomState {
  const { pack, ...mutable } = state;
  return { ...structuredClone(mutable), pack };
}

/**
 * Отмена возвращает игровые последствия действия, но не состав комнаты:
 * тот, кто вошёл после снимка, не должен исчезать, а связь не должна «отваливаться».
 */
export function mergePlayers(snapshot: Player[], current: Player[]): Player[] {
  const now = new Map(current.map((player) => [player.id, player]));

  const restored = snapshot.map((player) => {
    const live = now.get(player.id);
    if (!live) return { ...player, connected: false };
    return { ...player, connected: live.connected, sessionToken: live.sessionToken, name: live.name };
  });

  const joinedLater = current.filter(
    (player) => !snapshot.some((candidate) => candidate.id === player.id),
  );
  return [...restored, ...joinedLater];
}

export class UndoStack {
  private snapshots: RoomState[] = [];

  push(state: RoomState): void {
    this.snapshots.push(cloneState(state));
    if (this.snapshots.length > UNDO_DEPTH) this.snapshots.shift();
  }

  pop(): RoomState | undefined {
    return this.snapshots.pop();
  }

  get size(): number {
    return this.snapshots.length;
  }

  clear(): void {
    this.snapshots = [];
  }
}
