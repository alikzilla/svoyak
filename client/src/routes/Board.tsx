import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ask } from '../net/socket.js';
import { useBoardRoom } from '../net/useRoom.js';
import { QrCode } from '../ui/QrCode.js';
import { RoomCode } from '../ui/RoomCode.js';

export default function Board() {
  const [params, setParams] = useSearchParams();
  const code = params.get('code') ?? '';
  const { view, connected } = useBoardRoom();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    void ask('room:watch', { code }).then((result) => {
      if (!result.ok) setError(result.error);
    });
  }, [code, connected]);

  if (!code || (error && !view)) {
    return (
      <div className="app-shell flex flex-col items-center justify-center gap-4 p-6">
        <h1 className="text-3xl font-black text-gold">Общий экран</h1>
        <p className="text-muted">Введите код комнаты, чтобы вывести табло.</p>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            setParams({ code: draft });
          }}
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            placeholder="1234"
            className="w-40 rounded-xl border border-line bg-surface px-4 py-3 text-center text-2xl tabular-nums tracking-[0.2em] focus:border-gold"
          />
          <button className="rounded-xl bg-gold px-5 py-3 font-bold text-bg">Показать</button>
        </form>
        {error && <p className="text-bad">{error}</p>}
      </div>
    );
  }

  if (!view) {
    return (
      <div className="app-shell flex items-center justify-center p-6 text-muted">
        Подключаемся к комнате {code}…
      </div>
    );
  }

  return (
    <div className="app-shell flex flex-col gap-8 p-8">
      <header className="flex items-start justify-between gap-8">
        <div>
          <p className="text-muted">{view.packTitle}</p>
          <h1 className="mt-2 text-3xl font-bold">Ждём игроков</h1>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-muted">Код комнаты</p>
            <RoomCode code={view.code} size="xl" />
          </div>
          <QrCode value={view.joinUrl} size={180} className="rounded-2xl" />
        </div>
      </header>

      <section className="mt-auto grid auto-cols-fr grid-flow-col gap-4">
        {view.players.map((player) => (
          <article
            key={player.id}
            className={`rounded-2xl border p-5 text-center ${
              player.isControl ? 'border-gold bg-surface-2' : 'border-line bg-surface'
            }`}
          >
            <p className="truncate text-lg">{player.name}</p>
            <p className="text-[clamp(2rem,1rem+4vw,4rem)] leading-tight font-black tabular-nums text-gold">
              {player.score}
            </p>
          </article>
        ))}
        {view.players.length === 0 && (
          <p className="text-center text-2xl text-muted">Наведите камеру на QR-код</p>
        )}
      </section>
    </div>
  );
}
