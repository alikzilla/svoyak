import { useState } from 'react';
import { canVibrate, haptic, needsActivation } from '../net/haptics.js';
import { unlockAudio } from '../net/sounds.js';

/** Одно настоящее нажатие, прежде чем играть. Браузер не даёт ни звука, ни
 *  вибрации странице, которую ещё не нажимали, а кнопка ответа срабатывает на
 *  касании — оно разрешения не даёт. Вошедшему через /join экран не нужен:
 *  там он уже нажал «Войти». */
export function ActivationGate() {
  const [needed, setNeeded] = useState(needsActivation);
  if (!needed) return null;

  return (
    <button
      type="button"
      // Именно click: касание (pointerdown) разрешения не даёт, отпускание — даёт.
      onClick={() => {
        unlockAudio();
        haptic('tap');
        setNeeded(false);
      }}
      className="font-pop fixed inset-0 z-50 grid place-items-center bg-[#2c1c5e]/95 p-8 text-center text-3xl font-black text-white"
    >
      <span className="grid gap-3">
        <span>Нажмите, чтобы включить звук{canVibrate() ? ' и вибрацию' : ''}</span>
        <span className="font-body text-base font-bold opacity-70">один раз, и можно играть</span>
      </span>
    </button>
  );
}
