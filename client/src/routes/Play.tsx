import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayerRoom } from '../net/useRoom.js';
import { loadSession } from '../net/session.js';

const PHASE_HINT: Record<string, string> = {
  lobby: 'Ждём, когда ведущий начнёт игру',
  round_intro: 'Ведущий объявляет темы',
  picking: 'Выбирают вопрос',
  reading: 'Читают вопрос — кнопка вот-вот откроется',
};

export default function Play() {
  const navigate = useNavigate();
  const { view, connected, closed } = usePlayerRoom();

  useEffect(() => {
    if (!loadSession()) void navigate('/join');
  }, [navigate]);

  if (closed) {
    return (
      <div className="app-shell flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-xl">{closed}</p>
        <button
          onClick={() => void navigate('/join')}
          className="rounded-xl bg-gold px-5 py-3 font-bold text-bg"
        >
          Войти заново
        </button>
      </div>
    );
  }

  if (!view) {
    return (
      <div className="app-shell flex items-center justify-center p-6 text-muted">
        {connected ? 'Возвращаемся в комнату…' : 'Нет связи с сервером'}
      </div>
    );
  }

  const others = view.players.filter((player) => player.id !== view.meId);
  const me = view.players.find((player) => player.id === view.meId);

  return (
    <div className="app-shell flex flex-col gap-4 p-4">
      <header className="flex items-baseline justify-between">
        <span className="text-sm text-muted">{me?.name ?? 'Игрок'}</span>
        <span className="text-sm text-muted tabular-nums">комната {view.code}</span>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center gap-2">
        <p className="text-muted">Ваш счёт</p>
        <p className="text-[clamp(3.5rem,2rem+14vw,7rem)] leading-none font-black tabular-nums text-gold">
          {view.myScore}
        </p>
        <p className="mt-4 max-w-xs text-center text-lg text-pretty">
          {PHASE_HINT[view.phase] ?? 'Идёт игра'}
        </p>
        {!connected && <p className="text-sm text-bad">Связь потеряна, переподключаемся…</p>}
      </section>

      <section className="rounded-2xl border border-line bg-surface p-3">
        <ul className="grid gap-1">
          {others.map((player) => (
            <li key={player.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className={`size-1.5 shrink-0 rounded-full ${player.connected ? 'bg-good' : 'bg-line'}`}
                />
                <span className="truncate">{player.name}</span>
              </span>
              <span className="tabular-nums text-muted">{player.score}</span>
            </li>
          ))}
          {others.length === 0 && <li className="text-sm text-muted">Других игроков пока нет</li>}
        </ul>
      </section>
    </div>
  );
}
