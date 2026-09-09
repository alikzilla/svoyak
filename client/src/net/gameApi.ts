import type { ComposeRequest, ComposeResponse, PackSummary } from '@svoyak/shared';

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

export const fetchPacks = async (): Promise<PackSummary[]> =>
  (await json<{ packs: PackSummary[] }>(await fetch('/api/packs'))).packs;

/** Черновик состава игры. Считает сервер: только он знает содержимое паков. */
export const composeGame = async (request: ComposeRequest): Promise<ComposeResponse> =>
  json<ComposeResponse>(
    await fetch('/api/compose', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    }),
  );
