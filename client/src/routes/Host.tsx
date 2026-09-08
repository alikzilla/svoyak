import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CreateRoomResult, PackSummary, PacksListResponse } from '@svoyak/shared';
import { ask } from '../net/socket.js';
import { clearSession, saveSession } from '../net/session.js';
import { useHostRoom } from '../net/useRoom.js';
import { QrCode } from '../ui/QrCode.js';
import { RoomCode } from '../ui/RoomCode.js';
import { PlayerLedger } from '../ui/PlayerLedger.js';
import { HostGame } from '../ui/host/HostGame.js';
import { SoundToggle } from '../ui/SoundToggle.js';

export default function Host() {
  const { view, connected, closed } = useHostRoom();
  const [packs, setPacks] = useState<PackSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    void fetch('/api/packs')
      .then((response) => response.json() as Promise<PacksListResponse>)
      .then((body) => setPacks(body.packs))
      .catch(() => setError('Не удалось загрузить список паков'));
  }, []);

  const createRoom = async (packId: string): Promise<void> => {
    setCreating(true);
    setError(null);
    const result = await ask<CreateRoomResult>('room:create', { packId });
    setCreating(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    saveSession({
      role: 'host',
      code: result.data.code,
      token: result.data.hostToken,
      playerId: null,
    });
  };

  if (!view) {
    return (
      <div className="app-shell mx-auto flex max-w-3xl flex-col gap-8 p-6">
        <header>
          <h1 className="text-4xl font-black tracking-tight text-gold">Ведущий</h1>
          <p className="mt-1 text-muted">Выберите пак — комната создастся сразу.</p>
        </header>

        {closed && <p className="rounded-xl border border-bad/50 bg-bad/10 p-3 text-bad">{closed}</p>}
        {error && <p className="rounded-xl border border-bad/50 bg-bad/10 p-3 text-bad">{error}</p>}

        {packs.length === 0 ? (
          <p className="text-muted">
            Паков пока нет. Соберите свой в{' '}
            <Link to="/editor" className="text-gold underline underline-offset-4">
              редакторе
            </Link>{' '}
            или выполните <code className="text-ink">npm run build:packs</code>.
          </p>
        ) : (
          <ul className="grid gap-3">
            {packs.map((pack) => (
              <li key={pack.id}>
                <button
                  disabled={creating || !connected}
                  onClick={() => void createRoom(pack.id)}
                  className="w-full rounded-2xl border border-line bg-surface px-5 py-4 text-left transition hover:border-gold hover:bg-surface-2 disabled:opacity-50"
                >
                  <span className="block text-lg font-semibold">{pack.title}</span>
                  <span className="block text-sm text-muted">
                    {pack.roundsCount} раунда · {pack.questionsCount} вопросов · финал из{' '}
                    {pack.finalThemesCount} тем
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <Link to="/" className="text-sm text-muted underline underline-offset-4">
          на главную
        </Link>
      </div>
    );
  }

  if (view.phase !== 'lobby') {
    return (
      <div className="app-shell">
        <HostGame view={view} />
      </div>
    );
  }

  return (
    <div className="app-shell mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">{view.packTitle}</h1>
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted">
            {connected ? 'сервер на связи' : 'связь потеряна, переподключаемся…'}
          </p>
          <SoundToggle />
        </div>
      </header>

      <section className="grid gap-6 rounded-3xl border border-line bg-surface p-6 sm:grid-cols-[1fr_auto]">
        <div className="flex flex-col justify-center gap-3">
          <p className="text-muted">Код комнаты</p>
          <RoomCode code={view.code} />
          <p className="break-all text-sm text-muted">{view.joinUrl}</p>
        </div>
        <QrCode value={view.joinUrl} size={200} className="justify-self-center rounded-2xl" />
      </section>

      <section className="rounded-3xl border border-line bg-surface p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">Игроки</h2>
          <span className="text-sm text-muted tabular-nums">{view.players.length}</span>
        </div>
        <PlayerLedger
          players={view.players}
          highlightId={view.controlPlayerId}
          onScoreChange={(playerId, score) => void ask('host:adjustScore', { playerId, score })}
          onKick={(playerId) => void ask('host:kick', { playerId })}
          onSetControl={(playerId) => void ask('host:setControl', { playerId })}
        />
      </section>

      <footer className="flex flex-wrap items-center gap-3">
        <button
          disabled={view.players.length === 0}
          onClick={() => void ask('host:startGame')}
          className="rounded-xl bg-gold px-5 py-3 font-bold text-bg disabled:opacity-40"
        >
          Начать игру
        </button>
        <button
          disabled={!view.canUndo}
          onClick={() => void ask('host:undo')}
          className="rounded-xl border border-line px-5 py-3 text-muted hover:border-gold hover:text-ink disabled:opacity-40"
        >
          Отменить последнее
        </button>
        <button
          onClick={() => {
            clearSession();
            location.reload();
          }}
          className="ml-auto text-sm text-muted underline underline-offset-4"
        >
          Закрыть комнату
        </button>
      </footer>
    </div>
  );
}
