import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { CreateRoomResult, PackSummary, PacksListResponse } from '@svoyak/shared';
import { ask } from '../net/socket.js';
import { clearSession, saveSession } from '../net/session.js';
import { useHostRoom } from '../net/useRoom.js';
import { QrCode } from '../ui/QrCode.js';
import { PlayerLedger } from '../ui/PlayerLedger.js';
import { HostGame } from '../ui/host/HostGame.js';
import { SoundToggle } from '../ui/SoundToggle.js';
import { DoodleButton } from '../design/DoodleButton.js';
import { DoodleField } from '../design/Doodles.js';
import { RoughFrame } from '../design/rough.js';

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
      <div className="app-shell relative mx-auto flex w-full max-w-3xl flex-col gap-6 overflow-y-auto p-6">
        <DoodleField density="light" night />

        <header className="relative">
          <h1
            className="font-pop text-5xl font-black"
            style={{ WebkitTextStroke: '4px #1a1a1a', paintOrder: 'stroke fill', color: '#fff6e9' }}
          >
            Ведущий
          </h1>
          <p className="font-body mt-1 text-lg font-bold opacity-80">
            Выберите пак — комната создастся сразу
          </p>
        </header>

        {closed && <Alert>{closed}</Alert>}
        {error && <Alert>{error}</Alert>}

        {packs.length === 0 ? (
          <p className="font-body relative font-bold opacity-80">
            Паков пока нет. Соберите свой в{' '}
            <Link to="/editor" className="text-p4 underline underline-offset-4">
              редакторе
            </Link>{' '}
            или выполните <code>npm run build:packs</code>.
          </p>
        ) : (
          <ul className="relative grid gap-3">
            {packs.map((pack, index) => (
              <motion.li
                key={pack.id}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 20, delay: index * 0.06 }}
              >
                <motion.button
                  disabled={creating || !connected}
                  onClick={() => void createRoom(pack.id)}
                  whileHover={{ scale: 1.02, y: -4, rotate: index % 2 ? 0.8 : -0.8 }}
                  whileTap={{ scale: 0.98, x: 4, y: 5, boxShadow: '0px 0px 0 #1a1a1a' }}
                  style={{ boxShadow: '6px 6px 0 #1a1a1a' }}
                  className="ink-border bg-card text-ink w-full rounded-3xl px-5 py-4 text-left disabled:opacity-50"
                >
                  <span className="font-pop block text-2xl font-black">{pack.title}</span>
                  <span className="font-body block text-sm font-bold opacity-70">
                    {pack.roundsCount} раунда · {pack.questionsCount} вопросов · финал из{' '}
                    {pack.finalThemesCount} тем
                  </span>
                </motion.button>
              </motion.li>
            ))}
          </ul>
        )}

        <Link to="/" className="font-body relative text-sm font-bold underline underline-offset-4 opacity-70">
          на главную
        </Link>
      </div>
    );
  }

  if (view.phase !== 'lobby') {
    return (
      <div className="app-shell relative overflow-y-auto">
        <DoodleField density="light" night />
        <HostGame view={view} />
      </div>
    );
  }

  const canStart = view.players.length > 0;

  return (
    <div className="app-shell relative mx-auto flex w-full max-w-5xl flex-col gap-5 overflow-y-auto p-6">
      <DoodleField density="light" night />

      <header className="relative flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-pop text-2xl font-black">{view.packTitle}</h1>
        <div className="flex items-center gap-3">
          <span className="font-body text-sm font-bold opacity-75">
            {connected ? 'сервер на связи' : 'связь потеряна…'}
          </span>
          <SoundToggle />
        </div>
      </header>

      <section className="relative grid gap-5 sm:grid-cols-[1fr_auto]">
        <RoughFrame
          fill="var(--color-card)"
          seed={5}
          contentClassName="text-ink grid content-center gap-2 px-6 py-6"
        >
          <p className="font-body text-sm font-bold opacity-70">код комнаты</p>
          <p
            className="font-pop text-[clamp(3.5rem,10vw,6rem)] leading-none font-black tabular-nums"
            style={{ WebkitTextStroke: '4px #1a1a1a', paintOrder: 'stroke fill', color: 'var(--color-p1)' }}
          >
            {view.code}
          </p>
          <p className="font-body text-xs font-bold break-all opacity-60">{view.joinUrl}</p>
        </RoughFrame>

        <motion.div
          animate={{ rotate: [-2, 2, -2] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          className="ink-border bg-card justify-self-center rounded-3xl p-3"
          style={{ boxShadow: '6px 6px 0 #1a1a1a' }}
        >
          <QrCode value={view.joinUrl} size={190} />
        </motion.div>
      </section>

      <section className="relative">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-pop text-xl font-black">Кто в игре</h2>
          <span className="font-pop text-lg font-black tabular-nums">{view.players.length}</span>
        </div>
        <PlayerLedger
          players={view.players}
          highlightId={view.controlPlayerId}
          onScoreChange={(playerId, score) => void ask('host:adjustScore', { playerId, score })}
          onKick={(playerId) => void ask('host:kick', { playerId })}
          onSetControl={(playerId) => void ask('host:setControl', { playerId })}
        />
      </section>

      <footer className="relative flex flex-wrap items-center gap-3">
        <DoodleButton
          tone="p5"
          size="lg"
          idle={canStart}
          disabled={!canStart}
          onClick={() => void ask('host:startGame')}
        >
          Начать игру
        </DoodleButton>
        <DoodleButton
          tone="paper"
          size="sm"
          tilt={0.8}
          disabled={!view.canUndo}
          onClick={() => void ask('host:undo')}
        >
          Отменить
        </DoodleButton>
        <button
          onClick={() => {
            clearSession();
            location.reload();
          }}
          className="font-body ml-auto text-sm font-bold underline underline-offset-4 opacity-70"
        >
          закрыть комнату
        </button>
      </footer>
    </div>
  );
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <p className="ink-border bg-no font-body relative rounded-2xl px-4 py-3 font-bold text-white">
      {children}
    </p>
  );
}
