import type { AnyView, BoardView, HostView, PlayerView, RoomState, TimerKind } from '@svoyak/shared';
import type { Effect, GameAction } from '../engine/actions.js';
import { isUndoable } from '../engine/actions.js';
import { reduce } from '../engine/reducer.js';
import { projectForBoard, projectForHost, projectForPlayer } from './projections.js';
import { cloneState, UndoStack } from './undo.js';

export interface RoomRuntimeDeps {
  /** Сохранение на диск: RoomManager передаёт сюда дебаунсер. */
  persist: (state: RoomState) => void;
  joinUrlFor: (code: string) => string;
  /** Звуки и всплывающие сообщения уходят в сокет-слой. */
  emit?: (effect: Effect) => void;
}

export interface DispatchResult {
  ok: boolean;
  error?: string;
}

/** Оболочка вокруг чистого редьюсера: таймеры, undo, сохранение и рассылка. */
export class RoomRuntime {
  private current: RoomState;
  private readonly undoStack = new UndoStack();
  private readonly listeners = new Set<() => void>();
  private timerHandle: NodeJS.Timeout | null = null;
  /** Действие, которое нужно отправить в редьюсер по истечении таймера. */
  private pendingExpire: GameAction | null = null;

  constructor(
    initial: RoomState,
    private readonly deps: RoomRuntimeDeps,
  ) {
    this.current = initial;
  }

  get state(): RoomState {
    return this.current;
  }

  get canUndo(): boolean {
    return this.undoStack.size > 0;
  }

  /** Только для тестов: снимок изменяемой части состояния. */
  snapshotForTest(): RoomState {
    return cloneState(this.current);
  }

  dispatch(action: GameAction): DispatchResult {
    const undoable = isUndoable(action);
    const before = undoable ? cloneState(this.current) : null;

    const result = reduce(this.current, action);
    if (result.error !== undefined) return { ok: false, error: result.error };

    if (before) this.undoStack.push(before);
    this.current = result.state;
    this.applyEffects(result.effects);
    this.notify();
    return { ok: true };
  }

  undo(): boolean {
    const previous = this.undoStack.pop();
    if (!previous) return false;
    this.clearTimer();
    this.current = previous;
    this.deps.persist(this.current);
    this.notify();
    return true;
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  hostView(): HostView {
    return projectForHost(this.current, this.deps.joinUrlFor(this.current.code), {
      canUndo: this.canUndo,
    });
  }

  playerView(playerId: string): PlayerView {
    return projectForPlayer(this.current, playerId);
  }

  boardView(): BoardView {
    return projectForBoard(this.current, this.deps.joinUrlFor(this.current.code));
  }

  viewFor(role: 'host' | 'board'): AnyView;
  viewFor(role: 'player', playerId: string): AnyView;
  viewFor(role: 'host' | 'player' | 'board', playerId?: string): AnyView {
    if (role === 'host') return this.hostView();
    if (role === 'board') return this.boardView();
    return this.playerView(playerId ?? '');
  }

  dispose(): void {
    this.clearTimer();
    this.listeners.clear();
  }

  private applyEffects(effects: Effect[]): void {
    for (const effect of effects) {
      switch (effect.type) {
        case 'persist':
          this.deps.persist(this.current);
          break;
        case 'setTimer':
          this.startTimer(effect.kind, effect.durationMs, effect.onExpire);
          break;
        case 'clearTimer':
          this.clearTimer();
          break;
        case 'pauseTimer':
          this.pauseTimer();
          break;
        case 'resumeTimer':
          this.resumeTimer();
          break;
        case 'sound':
        case 'toast':
          this.deps.emit?.(effect);
          break;
      }
    }
  }

  private startTimer(kind: TimerKind, durationMs: number, onExpire: GameAction): void {
    this.clearTimer();
    this.pendingExpire = onExpire;
    const endsAt = Date.now() + durationMs;
    this.current = {
      ...this.current,
      timer: { kind, endsAt, totalMs: durationMs, remainingMs: null },
    };
    this.timerHandle = setTimeout(() => {
      this.timerHandle = null;
      this.dispatch(onExpire);
    }, durationMs);
  }

  private clearTimer(): void {
    if (this.timerHandle) clearTimeout(this.timerHandle);
    this.timerHandle = null;
    this.pendingExpire = null;
    if (this.current.timer) this.current = { ...this.current, timer: null };
  }

  /** Пауза замораживает остаток: таймер снимается, но состояние помнит, сколько осталось. */
  private pauseTimer(): void {
    const timer = this.current.timer;
    if (!timer || timer.remainingMs !== null) return;
    if (this.timerHandle) clearTimeout(this.timerHandle);
    this.timerHandle = null;
    this.current = {
      ...this.current,
      timer: { ...timer, remainingMs: Math.max(0, timer.endsAt - Date.now()) },
    };
  }

  private resumeTimer(): void {
    const timer = this.current.timer;
    const onExpire = this.pendingExpire;
    if (!timer || timer.remainingMs === null || !onExpire) return;
    const remaining = timer.remainingMs;
    this.current = {
      ...this.current,
      timer: { ...timer, endsAt: Date.now() + remaining, remainingMs: null },
    };
    this.timerHandle = setTimeout(() => {
      this.timerHandle = null;
      this.dispatch(onExpire);
    }, remaining);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}
