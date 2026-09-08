import type { RoomState } from '@svoyak/shared';

export const UNDO_DEPTH = 50;

/** Копия изменяемой части состояния. Пак неизменяем — переиспользуем по ссылке,
 *  иначе каждый снимок тащил бы весь текст вопросов. */
export function cloneState(state: RoomState): RoomState {
  const { pack, ...mutable } = state;
  return { ...structuredClone(mutable), pack };
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
