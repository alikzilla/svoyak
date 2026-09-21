import type { Game, GameResponse, GamesListResponse } from '@svoyak/shared';

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => ({}));
    const message =
      typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string'
        ? body.error
        : `Ошибка ${response.status}`;
    throw new Error(message);
  }
  return (await response.json()) as T;
}

export const listGames = async (): Promise<GamesListResponse['games']> =>
  (await json<GamesListResponse>(await fetch('/api/games'))).games;

export const fetchGame = async (id: string): Promise<Game> =>
  (await json<GameResponse>(await fetch(`/api/games/${id}`))).game;

export const createGame = async (title: string): Promise<Game> =>
  (
    await json<GameResponse>(
      await fetch('/api/games', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title }),
      }),
    )
  ).game;

export const saveGame = async (game: Game): Promise<Game> =>
  (
    await json<GameResponse>(
      await fetch(`/api/games/${game.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ game }),
      }),
    )
  ).game;

export const removeGame = async (id: string): Promise<void> => {
  await json<{ ok: true }>(await fetch(`/api/games/${id}`, { method: 'DELETE' }));
};
