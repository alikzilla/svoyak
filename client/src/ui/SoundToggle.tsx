import { useState } from 'react';
import { Doodle } from '../design/Doodles.js';
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
      className={`ink-border bg-card grid place-items-center rounded-xl p-1.5 ${className}`}
      style={{ boxShadow: '3px 3px 0 #1a1a1a' }}
    >
      <Doodle name={muted ? 'mute' : 'speaker'} size={22} strokeWidth={5} />
    </button>
  );
}
