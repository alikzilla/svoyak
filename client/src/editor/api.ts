import type { Pack, PackIssue, PackSummary } from '@svoyak/shared';

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

export const listPacks = async (): Promise<PackSummary[]> =>
  (await json<{ packs: PackSummary[] }>(await fetch('/api/packs'))).packs;

export const fetchPack = async (id: string): Promise<Pack> =>
  (await json<{ pack: Pack }>(await fetch(`/api/packs/${id}`))).pack;

export const createPack = async (title: string): Promise<Pack> =>
  (
    await json<{ pack: Pack }>(
      await fetch('/api/packs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title }),
      }),
    )
  ).pack;

export const savePack = async (pack: Pack): Promise<{ pack: Pack; issues: PackIssue[] }> =>
  json<{ pack: Pack; issues: PackIssue[] }>(
    await fetch(`/api/packs/${pack.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pack }),
    }),
  );

export const removePack = async (id: string): Promise<void> => {
  await json<{ ok: boolean }>(await fetch(`/api/packs/${id}`, { method: 'DELETE' }));
};

export const uploadMedia = async (packId: string, file: File) => {
  const form = new FormData();
  form.append('file', file);
  const response = await fetch(`/api/packs/${packId}/media`, { method: 'POST', body: form });
  return (await json<{ media: { kind: 'image' | 'audio' | 'video'; src: string } }>(response)).media;
};

/** Импорт: чужой JSON сохраняем как новый пак, чтобы не затереть существующий. */
export async function importPackFile(file: File): Promise<Pack> {
  const parsed: unknown = JSON.parse(await file.text());
  if (typeof parsed !== 'object' || parsed === null || !('rounds' in parsed)) {
    throw new Error('Это не похоже на пак: нет раундов');
  }
  const incoming = parsed as Pack;
  const created = await createPack(incoming.title || 'Импортированный пак');
  const merged: Pack = { ...incoming, id: created.id, createdAt: created.createdAt };
  await savePack(merged);
  return merged;
}

export function downloadPack(pack: Pack): void {
  const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${pack.id}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
