import { useEffect, useRef, useState } from 'react';
import type { Media } from '@svoyak/shared';

/** Где показываем медиа. От этого зависит, звучит оно или молчит.
 *  Звук в комнате один — общий экран. Телефоны и ведущий молчат, иначе каша. */
type Variant = 'board' | 'player' | 'host';

interface QuestionMediaProps {
  media: Media;
  variant: Variant;
  /** Подпись для картинки. Обычно — текст вопроса. */
  alt?: string;
}

const FRAME = 'ink-border overflow-hidden rounded-2xl bg-black/20';

export function QuestionMedia({ media, variant, alt = '' }: QuestionMediaProps) {
  if (media.kind === 'image') return <ImageMedia media={media} variant={variant} alt={alt} />;
  if (media.kind === 'video') return <VideoMedia media={media} variant={variant} />;
  return <AudioMedia media={media} variant={variant} />;
}

function ImageMedia({ media, variant, alt }: Required<QuestionMediaProps>) {
  return (
    <div className={`${FRAME} mx-auto grid place-items-center`}>
      <img src={media.src} alt={alt} className={`${sizing(variant)} object-contain`} />
    </div>
  );
}

/** Высоту задаём явно: кадры из видео небольшие, и без этого картинка
 *  на общем экране остаётся марочкой в углу. */
function sizing(variant: Variant): string {
  if (variant === 'board') return 'h-[40dvh] max-h-[46dvh] w-auto max-w-full';
  if (variant === 'player') return 'h-[18dvh] max-h-[22dvh] w-auto max-w-full';
  return 'h-32 w-auto max-w-full';
}

function VideoMedia({ media, variant }: Omit<QuestionMediaProps, 'alt'>) {
  const ref = useRef<HTMLVideoElement>(null);
  const muted = variant !== 'board';
  const blocked = useAutoplay(ref, media.src, muted);

  return (
    <div className={`${FRAME} relative mx-auto grid place-items-center`}>
      <video
        ref={ref}
        src={media.src}
        className={`${sizing(variant)} object-contain`}
        loop
        playsInline
        muted={muted}
        controls={variant === 'host'}
      />
      {blocked && <SoundGate onUnlock={() => void unmuteAndPlay(ref.current)} />}
    </div>
  );
}

function AudioMedia({ media, variant }: Omit<QuestionMediaProps, 'alt'>) {
  const ref = useRef<HTMLAudioElement>(null);
  // На телефонах и у ведущего аудиовопрос не звучит — его слышно с общего экрана.
  const silent = variant !== 'board';
  const blocked = useAutoplay(ref, media.src, silent);

  if (silent) {
    return (
      <div className="ink-border bg-card/60 text-ink flex items-center gap-3 rounded-2xl px-4 py-3">
        <Equalizer animated={false} />
        <span className="font-body text-sm font-bold opacity-70">
          {variant === 'host' ? 'аудиовопрос — звучит на общем экране' : 'слушайте общий экран'}
        </span>
        {variant === 'host' && <audio src={media.src} controls className="ml-auto max-w-[50%]" />}
      </div>
    );
  }

  return (
    <div className={`${FRAME} relative mx-auto grid place-items-center bg-black/30 px-10 py-8`}>
      <audio ref={ref} src={media.src} loop />
      <Equalizer animated={!blocked} />
      {blocked && <SoundGate onUnlock={() => void unmuteAndPlay(ref.current)} />}
    </div>
  );
}

/** Полоски-эквалайзер: у аудиовопроса нет картинки, а пустая сцена выглядит как баг. */
function Equalizer({ animated }: { animated: boolean }) {
  const bars = [0, 1, 2, 3, 4, 5, 6];
  return (
    <div className="flex h-16 items-end gap-1.5" aria-hidden>
      {bars.map((bar) => (
        <span
          key={bar}
          className="bg-p4 ink-border w-3 rounded-full"
          style={{
            height: `${30 + ((bar * 37) % 70)}%`,
            animation: animated ? `eq 900ms ${bar * 90}ms ease-in-out infinite alternate` : 'none',
          }}
        />
      ))}
    </div>
  );
}

/** Браузер не дал автозапуск со звуком — нужен клик. Общий экран всё равно кликают. */
function SoundGate({ onUnlock }: { onUnlock: () => void }) {
  return (
    <button
      type="button"
      onClick={onUnlock}
      className="font-body absolute inset-0 grid place-items-center bg-black/50 text-lg font-bold text-white"
    >
      нажмите, чтобы включить звук
    </button>
  );
}

async function unmuteAndPlay(el: HTMLMediaElement | null): Promise<void> {
  if (!el) return;
  el.muted = false;
  el.currentTime = 0;
  try {
    await el.play();
  } catch {
    // не вышло — значит, не вышло; вопрос всё равно читает ведущий
  }
}

/** Запускает медиа при появлении вопроса. Возвращает true, если звук заблокирован
 *  автополитикой браузера и нужен клик. */
function useAutoplay(
  ref: { current: HTMLMediaElement | null },
  src: string,
  startMuted: boolean,
): boolean {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setBlocked(false);
    el.muted = startMuted;
    el.currentTime = 0;

    let cancelled = false;
    void el.play().catch(() => {
      if (cancelled || startMuted) return;
      // Со звуком нельзя — покажем картинку молча и попросим клик.
      el.muted = true;
      void el.play().then(() => {
        if (!cancelled) setBlocked(true);
      });
    });

    return () => {
      cancelled = true;
      el.pause();
    };
  }, [ref, src, startMuted]);

  return blocked;
}
