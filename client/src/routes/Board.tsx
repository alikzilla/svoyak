import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ask } from '../net/socket.js';
import { useBoardRoom } from '../net/useRoom.js';
import { QrCode } from '../ui/QrCode.js';
import { RoomCode } from '../ui/RoomCode.js';
import { BoardGrid } from '../ui/BoardGrid.js';
import { TimerBar } from '../ui/Timer.js';
import { unlockAudio } from '../net/sounds.js';

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

  const answering = view.players.find((player) => player.isAnswering);
  const inLobby = view.phase === 'lobby';

  return (
    <div className="app-shell flex flex-col gap-6 p-8" onPointerDown={unlockAudio}>
      <header className="flex items-start justify-between gap-8">
        <div>
          <p className="text-muted">{view.packTitle}</p>
          <h1 className="mt-2 text-3xl font-bold">
            {inLobby ? 'Ждём игроков' : view.roundTitle}
          </h1>
        </div>
        {inLobby && (
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-muted">Код комнаты</p>
              <RoomCode code={view.code} size="xl" />
            </div>
            <QrCode value={view.joinUrl} size={180} className="rounded-2xl" />
          </div>
        )}
      </header>

      {!inLobby && (
        <section className="flex flex-1 flex-col justify-center gap-6">
          <TimerBar timer={view.timer} paused={view.paused} />
          {view.question ? (
            <div className="grid gap-6 text-center">
              <p className="text-2xl text-muted">
                {view.question.themeTitle} ·{' '}
                <span className="tabular-nums text-gold">{view.question.price}</span>
              </p>
              <p className="text-[clamp(1.75rem,1rem+3vw,3.5rem)] leading-tight font-bold text-pretty">
                {view.question.hidden ? (
                  <span className="text-muted">Вопрос ещё не читали</span>
                ) : (
                  view.question.text
                )}
              </p>
              {view.question.revealedAnswer && (
                <p className="text-[clamp(1.5rem,1rem+2vw,3rem)] font-black text-gold">
                  {view.question.revealedAnswer}
                </p>
              )}
              {answering && <p className="text-2xl text-good">Отвечает {answering.name}</p>}
            </div>
          ) : (
            <BoardGrid board={view.board} />
          )}
        </section>
      )}

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
