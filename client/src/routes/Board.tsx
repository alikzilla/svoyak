import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { BoardView, PlayerPublic } from '@svoyak/shared';
import { ask } from '../net/socket.js';
import { useBoardRoom } from '../net/useRoom.js';
import { unlockAudio } from '../net/sounds.js';
import { QrCode } from '../ui/QrCode.js';
import { BoardGrid } from '../ui/BoardGrid.js';
import { Standings } from '../ui/Standings.js';
import { Avatar, colorForIndex } from '../design/Avatar.js';
import { DoodleButton } from '../design/DoodleButton.js';
import { DoodleField } from '../design/Doodles.js';
import { RoughFrame } from '../design/rough.js';

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
      <div className="app-shell relative grid place-items-center gap-5 p-8">
        <DoodleField density="light" night />
        <h1
          className="font-pop relative text-5xl font-black"
          style={{ WebkitTextStroke: '4px #1a1a1a', paintOrder: 'stroke fill', color: '#fff6e9' }}
        >
          Общий экран
        </h1>
        <p className="font-body relative font-bold opacity-80">Введите код комнаты</p>
        <form
          className="relative flex gap-3"
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
            className="ink-border font-pop bg-card text-ink w-44 rounded-2xl px-4 py-3 text-center text-3xl font-black tabular-nums"
            style={{ boxShadow: '5px 5px 0 #1a1a1a' }}
          />
          <DoodleButton tone="p5" onClick={() => setParams({ code: draft })}>
            Показать
          </DoodleButton>
        </form>
        {error && <p className="ink-border bg-no relative rounded-2xl px-4 py-2 font-bold">{error}</p>}
      </div>
    );
  }

  if (!view) {
    return (
      <div className="app-shell grid place-items-center p-8">
        <motion.p
          animate={{ y: [0, -12, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          className="font-pop text-2xl font-black"
        >
          подключаемся к комнате {code}…
        </motion.p>
      </div>
    );
  }

  const answering = view.players.find((player) => player.isAnswering);

  return (
    <div className="app-shell relative flex flex-col gap-6 overflow-hidden p-8" onPointerDown={unlockAudio}>
      <DoodleField density="light" night />

      {view.phase === 'lobby' ? (
        <Lobby view={view} />
      ) : view.phase === 'results' ? (
        <section className="relative grid flex-1 content-center gap-6">
          <h2
            className="font-pop text-center text-6xl font-black"
            style={{ WebkitTextStroke: '4px #1a1a1a', paintOrder: 'stroke fill', color: '#ffc53d' }}
          >
            Игра окончена
          </h2>
          <div className="mx-auto w-full max-w-2xl">
            <Standings players={view.players} />
          </div>
        </section>
      ) : view.final ? (
        <FinalScene view={view} />
      ) : (
        <section className="relative flex flex-1 flex-col justify-center gap-6">
          <AnimatePresence mode="wait">
            {view.question ? (
              <motion.div
                key={view.question.text}
                initial={{ scale: 0.85, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              >
                <RoughFrame
                  fill="var(--color-card)"
                  seed={17}
                  contentClassName="text-ink grid gap-5 px-10 py-10 text-center"
                >
                  <p className="font-body text-2xl font-bold opacity-70">
                    {view.question.themeTitle} ·{' '}
                    <span className="font-pop text-p1 tabular-nums">{view.question.price}</span>
                  </p>
                  <p className="font-body text-[clamp(1.8rem,4vw,3.5rem)] leading-tight font-bold text-pretty">
                    {view.question.hidden ? 'вопрос ещё не читали' : view.question.text}
                  </p>
                  {view.question.revealedAnswer && (
                    <motion.p
                      initial={{ scale: 0.6, rotate: -6, opacity: 0 }}
                      animate={{ scale: 1, rotate: -2, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 14 }}
                      className="font-pop text-yes text-[clamp(1.6rem,3vw,2.8rem)] font-black"
                    >
                      {view.question.revealedAnswer}
                    </motion.p>
                  )}
                </RoughFrame>
              </motion.div>
            ) : (
              // Доска — фон, а не событие: она не проявляется, а просто есть.
              <div key="board">
                <BoardGrid board={view.board} />
              </div>
            )}
          </AnimatePresence>

          {answering && (
            <motion.p
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="font-pop text-center text-3xl font-black"
            >
              отвечает {answering.name}
            </motion.p>
          )}
        </section>
      )}

      <PlayerStrip players={view.players} />
    </div>
  );
}

function Lobby({ view }: { view: BoardView }) {
  return (
    <section className="relative flex flex-1 flex-col items-center justify-center gap-8">
      <p className="font-body text-xl font-bold opacity-80">{view.packTitle}</p>

      <div className="flex flex-wrap items-center justify-center gap-10">
        <div className="grid justify-items-center gap-2">
          <p className="font-body text-lg font-bold opacity-70">код комнаты</p>
          <p
            className="font-pop text-[clamp(5rem,14vw,10rem)] leading-none font-black tabular-nums"
            style={{ WebkitTextStroke: '6px #1a1a1a', paintOrder: 'stroke fill', color: '#ffc53d' }}
          >
            {view.code}
          </p>
        </div>

        <motion.div
          animate={{ rotate: [-2.5, 2.5, -2.5] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          className="ink-border bg-card rounded-3xl p-4"
          style={{ boxShadow: '8px 8px 0 #1a1a1a' }}
        >
          <QrCode value={view.joinUrl} size={230} />
        </motion.div>
      </div>

      <p className="font-pop text-2xl font-black">
        {view.players.length === 0 ? 'наведите камеру на код' : 'ждём ведущего'}
      </p>
    </section>
  );
}

function FinalScene({ view }: { view: BoardView }) {
  const final = view.final;
  if (!final) return null;

  return (
    <section className="relative grid flex-1 content-center gap-6 text-center">
      <p className="font-body text-2xl font-bold opacity-70">
        финал · {final.themeTitle ?? 'убирают темы'}
      </p>

      {final.questionText ? (
        <RoughFrame
          fill="var(--color-card)"
          seed={23}
          contentClassName="text-ink px-10 py-10"
        >
          <p className="font-body text-[clamp(1.8rem,4vw,3.2rem)] leading-tight font-bold text-pretty">
            {final.questionText}
          </p>
        </RoughFrame>
      ) : (
        <ul className="mx-auto grid w-full max-w-3xl gap-3">
          {final.themes.map((theme) => (
            <motion.li
              key={theme.id}
              layout
              animate={theme.removedByPlayerId ? { opacity: 0.35, scale: 0.97 } : { opacity: 1, scale: 1 }}
              className={`ink-border font-pop rounded-2xl px-6 py-4 text-3xl font-black ${
                theme.removedByPlayerId ? 'bg-card/40 text-card line-through' : 'bg-card text-ink'
              }`}
              style={{ boxShadow: '6px 6px 0 #1a1a1a' }}
            >
              {theme.title}
            </motion.li>
          ))}
        </ul>
      )}

      {final.revealed.length > 0 && (
        <ul className="mx-auto grid w-full max-w-3xl gap-2">
          <AnimatePresence>
            {final.revealed.map((entry) => (
              <motion.li
                key={entry.playerId}
                // Ответ вскрывается переворотом карточки.
                initial={{ rotateX: 90, opacity: 0 }}
                animate={{ rotateX: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                className={`ink-border font-pop flex items-center gap-3 rounded-2xl px-5 py-3 text-2xl font-black ${
                  entry.correct ? 'bg-yes' : 'bg-no'
                } text-white`}
                style={{ boxShadow: '5px 5px 0 #1a1a1a' }}
              >
                <span className="flex-1 text-left">
                  {view.players.find((player) => player.id === entry.playerId)?.name}: {entry.answer || '—'}
                </span>
                <span className="tabular-nums">{entry.bet}</span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}

function PlayerStrip({ players }: { players: PlayerPublic[] }) {
  if (players.length === 0) return null;

  return (
    <section className="relative grid auto-cols-fr grid-flow-col gap-4">
      {players.map((player, index) => {
        const color = colorForIndex(index);
        return (
          <motion.article
            key={player.id}
            layout
            animate={player.isControl ? { y: -6 } : { y: 0 }}
            className={`ink-border grid justify-items-center gap-1 rounded-3xl px-4 py-3 ${
              player.isControl ? 'bg-p4' : 'bg-card'
            }`}
            style={{ boxShadow: '6px 6px 0 #1a1a1a' }}
          >
            <Avatar
              seed={player.name}
              color={color}
              size={64}
              mood={player.isAnswering ? 'answering' : 'idle'}
            />
            <p className="font-pop text-ink truncate text-xl font-black">{player.name}</p>
            <p
              className="font-pop text-[clamp(1.5rem,3vw,2.5rem)] leading-none font-black tabular-nums"
              style={{ WebkitTextStroke: '3px #1a1a1a', paintOrder: 'stroke fill', color }}
            >
              {player.score}
            </p>
          </motion.article>
        );
      })}
    </section>
  );
}
