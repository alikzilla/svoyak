import { useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import type { Media } from '@svoyak/shared';
import { uploadMedia } from './api.js';

interface MediaFieldProps {
  label: string;
  packId: string;
  media: Media | undefined;
  onChange: (media: Media | undefined) => void;
  /** Под линией отрыва подпись берёт цвет ключа. */
  tone?: 'plain' | 'key';
}

export function MediaField({ label, packId, media, onChange, tone = 'plain' }: MediaFieldProps) {
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
      <span className={tone === 'key' ? 'ws-key-label' : 'ws-label'}>{label}</span>
      {media ? (
        <div className="border-ws-line bg-ws-surface flex items-center gap-3 rounded-lg border p-2">
          {media.kind === 'image' && <img src={media.src} alt="" className="max-h-24 rounded-md" />}
          {media.kind === 'audio' && <audio src={media.src} controls className="h-9 max-w-full" />}
          {media.kind === 'video' && <video src={media.src} controls className="max-h-32 rounded-md" />}
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="ws-btn ws-btn-ghost ws-btn-sm ws-btn-quiet-danger ml-auto"
          >
            <X aria-hidden />
            Убрать
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
            className="border-ws-line-strong text-ws-soft hover:border-ws-accent hover:text-ws-accent-ink inline-flex h-9 w-fit items-center gap-2 rounded-lg border border-dashed px-3 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <ImagePlus size={16} aria-hidden />}
            {busy ? 'Загружаем…' : 'Выбрать файл'}
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
      {error && (
        <p role="alert" className="text-ws-no-ink text-[0.8125rem] font-medium">
          {error}
        </p>
      )}
    </div>
  );
}
