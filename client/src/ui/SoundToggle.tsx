import { useState } from 'react';
import { isMuted, setMuted, unlockAudio } from '../net/sounds.js';

interface SoundToggleProps {
  className?: string;
}

/** Выключатель звука. Первое нажатие заодно будит аудио — браузеры требуют жеста. */
export function SoundToggle({ className = '' }: SoundToggleProps) {
  const [muted, setMutedState] = useState(isMuted);

  return (
    <button
      type="button"
      onClick={() => {
        const next = !muted;
        setMuted(next);
        setMutedState(next);
        if (!next) unlockAudio();
      }}
      title={muted ? 'Включить звук' : 'Выключить звук'}
      aria-pressed={muted}
      className={`rounded-xl border border-line px-3 py-2 text-sm text-muted hover:border-gold hover:text-ink ${className}`}
    >
      {muted ? '🔇 звук выключен' : '🔊 звук'}
    </button>
  );
}
