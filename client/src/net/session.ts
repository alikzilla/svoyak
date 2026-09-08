import type { Role } from '@svoyak/shared';

export interface Session {
  role: Role;
  code: string;
  token: string;
  playerId: string | null;
  name?: string;
}

const KEY = 'svoyak:session';

export function saveSession(session: Session): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // приватный режим браузера — переживём, просто не переподключимся автоматически
  }
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const session = parsed as Partial<Session>;
    if (!session.role || !session.code || !session.token) return null;
    return {
      role: session.role,
      code: session.code,
      token: session.token,
      playerId: session.playerId ?? null,
      ...(session.name !== undefined ? { name: session.name } : {}),
    };
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // нечего чистить
  }
}
