import { useRef, useState } from 'react';
import type { Media } from '@svoyak/shared';
import { uploadMedia } from './api.js';

interface MediaFieldProps {
  label: string;
  packId: string;
  media: Media | undefined;
  onChange: (media: Media | undefined) => void;
}

export function MediaField({ label, packId, media, onChange }: MediaFieldProps) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      onChange(await uploadMedia(packId, file));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось загрузить');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-1.5">
      <span className="text-xs text-ink/60">{label}</span>
      {media ? (
        <div className="flex items-center gap-3 ink-border rounded-xl bg-white/70 p-2">
          {media.kind === 'image' && (
            <img src={media.src} alt="" className="max-h-24 rounded-lg" />
          )}
          {media.kind === 'audio' && <audio src={media.src} controls className="max-w-full" />}
          {media.kind === 'video' && <video src={media.src} controls className="max-h-32 rounded-lg" />}
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="ml-auto ink-border rounded-lg px-2 py-1 text-sm text-ink/60 hover:border-no hover:text-no"
          >
            Убрать
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
            className="rounded-xl border border-dashed border-ink px-3 py-2 text-sm text-ink/60 hover:border-p1 hover:text-ink disabled:opacity-50"
          >
            {busy ? 'Загружаем…' : 'Добавить файл'}
          </button>
          <input
            ref={input}
            type="file"
            accept="image/*,audio/*,video/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void pick(file);
              event.target.value = '';
            }}
          />
        </>
      )}
      {error && <p className="text-xs text-no">{error}</p>}
    </div>
  );
}
