import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import type { HostView } from '@svoyak/shared';
import { ask } from '../../net/socket.js';
import { BoardGrid } from '../BoardGrid.js';
import { PlayerLedger } from '../PlayerLedger.js';
import { SoundToggle } from '../SoundToggle.js';
import { FinalHost } from './FinalHost.js';
import { Avatar, colorForIndex } from '../../design/Avatar.js';
import { DoodleButton } from '../../design/DoodleButton.js';
import { DoodleTimer } from '../../design/DoodleTimer.js';
import { RoughFrame } from '../../design/rough.js';
import { Stamp } from '../../design/Stamp.js';
import { Standings } from '../Standings.js';

interface HostGameProps {
  view: HostView;
}

const send = (event: Parameters<typeof ask>[0], payload?: unknown): void => {
  void ask(event, payload);
};

/** Текст вопроса проявляется по словам: ведущий читает вслух в том же темпе. */
function TypedQuestion({ text }: { text: string }) {
  const words = text.split(' ');
  return (
    <p className="font-body text-2xl leading-snug font-bold text-pretty">
      {words.map((word, index) => (
        <motion.span
          key={`${word}-${index}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.045, duration: 0.25 }}
          className="inline-block"
        >
          {word}&nbsp;
        </motion.span>
      ))}
    </p>
  );
}

export function HostGame({ view }: HostGameProps) {
  const answering = view.players.find((player) => player.isAnswering);
  const control = view.players.find((player) => player.isControl);
  const question = view.question;
  const canPick = view.phase === 'picking' || view.phase === 'round_intro';
  const inFinal = view.final !== null && view.phase !== 'results';

  const [verdict, setVerdict] = useState<'yes' | 'no' | null>(null);
  const scores = useRef<Record<string, number>>({});

  // Вердикт ловим по изменению счёта: сервер не присылает «верно» отдельным событием.
  useEffect(() => {
    let changed: { id: string; delta: number } | null = null;
    for (const player of view.players) {
      const previous = scores.current[player.id];
      if (previous !== undefined && previous !== player.score) {
        changed = { id: player.id, delta: player.score - previous };
      }
      scores.current[player.id] = player.score;
    }
    if (!changed) return;

    setVerdict(changed.delta > 0 ? 'yes' : 'no');
    if (changed.delta > 0) {
      const index = view.players.findIndex((player) => player.id === changed.id);
      void confetti({
        particleCount: 110,
        spread: 80,
        origin: { y: 0.65 },
        colors: [colorForIndex(index), '#fff6e9', '#1a1a1a'],
      });
    }
    const timer = window.setTimeout(() => setVerdict(null), 1500);
    return () => clearTimeout(timer);
  }, [view.players]);

  return (
    <div className="relative mx-auto flex w-full max-w-[110rem] flex-col gap-4 px-4 pt-6 pb-8">
      <AnimatePresence>
        {verdict && (
          <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center">
            <Stamp shown tone={verdict} text={verdict === 'yes' ? 'ВЕРНО!' : 'МИМО!'} />
          </div>
        )}
      </AnimatePresence>

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-pop text-2xl font-black">{view.roundTitle}</h1>
          <p className="font-body text-sm font-bold opacity-75">
            {control ? `ход: ${control.name}` : 'право хода не назначено'} · комната{' '}
            <span className="tabular-nums">{view.code}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SoundToggle />
          <DoodleButton size="sm" tone="paper" tilt={0.6} onClick={() => send('host:pause', { paused: !view.paused })}>
            {view.paused ? 'Продолжить' : 'Пауза'}
          </DoodleButton>
          <DoodleButton size="sm" tone="paper" tilt={-0.6} disabled={!view.canUndo} onClick={() => send('host:undo')}>
            Отменить
          </DoodleButton>
        </div>
      </header>

      {/* Слева управление, справа табло: ведущий всегда видит поле целиком. */}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(24rem,5fr)_minmax(0,6fr)]">
        <div className="grid gap-4">
          {view.timer && <DoodleTimer
            progress={
              view.timer.remainingMs !== null
                ? view.timer.remainingMs / view.timer.totalMs
                : Math.max(0, view.timer.endsAt - Date.now()) / view.timer.totalMs
            }
            seconds={Math.ceil(
              (view.timer.remainingMs ?? Math.max(0, view.timer.endsAt - Date.now())) / 1000,
            )}
          />}

          {inFinal ? (
            <FinalHost
              view={view}
              onJudge={(correct) => send('host:finalJudge', { correct })}
              onForce={() => send('host:continue')}
            />
          ) : question ? (
            <RoughFrame
              fill="var(--color-card)"
              seed={7}
              contentClassName="text-ink grid gap-3 p-5"
            >
              <p className="font-body text-sm font-bold opacity-70">
                {question.themeTitle} · <span className="tabular-nums">{question.price}</span>
              </p>
              <TypedQuestion text={question.text} />

              <div className="ink-border bg-p4 rounded-2xl px-4 py-3">
                <p className="font-body text-xs font-bold opacity-70">ответ — видите только вы</p>
                <p className="font-pop text-xl font-black">{question.answer}</p>
                {question.altAnswers.length > 0 && (
                  <p className="font-body text-sm font-bold opacity-70">
                    также принимается: {question.altAnswers.join(', ')}
                  </p>
                )}
                {question.hostComment && (
                  <p className="font-body mt-1 text-sm font-bold opacity-70 text-pretty">
                    {question.hostComment}
                  </p>
                )}
              </div>

              {view.cat && <SpecialNote view={view} kind="cat" />}
              {view.auction && <SpecialNote view={view} kind="auction" />}

              {answering && (
                <div className="flex items-center gap-3">
                  <Avatar
                    seed={answering.name}
                    color={colorForIndex(view.players.findIndex((p) => p.id === answering.id))}
                    size={48}
                    mood="answering"
                  />
                  <p className="font-pop text-xl font-black">
                    отвечает {answering.name}
                    <span className="font-body block text-xs font-bold opacity-70">
                      времени столько, сколько нужно
                    </span>
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {view.phase === 'reading' && (
                  <DoodleButton tone="p5" onClick={() => send('host:openBuzzer')}>
                    Открыть кнопку
                  </DoodleButton>
                )}
                {(view.phase === 'answering' ||
                  view.phase === 'cat_answer' ||
                  view.phase === 'auction_answer') && (
                  <>
                    <DoodleButton tone="yes" onClick={() => send('host:judge', { verdict: 'correct' })}>
                      Верно
                    </DoodleButton>
                    <DoodleButton tone="no" tilt={1} onClick={() => send('host:judge', { verdict: 'wrong' })}>
                      Неверно
                    </DoodleButton>
                  </>
                )}
                {view.phase === 'buzzer_open' && (
                  <DoodleButton size="sm" tone="paper" onClick={() => send('host:extendTime')}>
                    Ещё время
                  </DoodleButton>
                )}
                {view.phase === 'answer_reveal' ? (
                  <DoodleButton tone="p1" onClick={() => send('host:continue')}>
                    Дальше
                  </DoodleButton>
                ) : (
                  <>
                    <DoodleButton size="sm" tone="paper" tilt={0.6} onClick={() => send('host:revealAnswer')}>
                      Показать ответ
                    </DoodleButton>
                    <DoodleButton size="sm" tone="paper" tilt={-0.6} onClick={() => send('host:skipQuestion')}>
                      Снять вопрос
                    </DoodleButton>
                  </>
                )}
              </div>
            </RoughFrame>
          ) : view.phase === 'round_end' || view.phase === 'results' ? (
            <RoughFrame fill="var(--color-card)" seed={9} contentClassName="text-ink grid gap-4 p-6 text-center">
              <h2 className="font-pop text-3xl font-black">
                {view.phase === 'results' ? 'Игра окончена' : 'Раунд сыгран'}
              </h2>
              {view.phase === 'round_end' && (
                <DoodleButton tone="p5" className="justify-self-center" onClick={() => send('host:nextRound')}>
                  Следующий раунд
                </DoodleButton>
              )}
            </RoughFrame>
          ) : (
            <RoughFrame fill="var(--color-card)" seed={13} contentClassName="text-ink p-5">
              <p className="font-body text-lg font-bold text-pretty">
                {control ? <span className="font-pop">{control.name}</span> : 'Игрок'} называет тему и
                цену — откройте её на табло справа.
              </p>
            </RoughFrame>
          )}

          <PlayerLedger
            players={view.players}
            highlightId={view.controlPlayerId}
            onScoreChange={(playerId, score) => send('host:adjustScore', { playerId, score })}
            onKick={(playerId) => send('host:kick', { playerId })}
            onSetControl={(playerId) => send('host:setControl', { playerId })}
          />
        </div>

        <section className="xl:sticky xl:top-4">
          {view.phase === 'results' ? (
            <div className="grid gap-3">
              <h2 className="font-pop text-center text-3xl font-black">Итог</h2>
              <Standings players={view.players} />
            </div>
          ) : inFinal ? (
            <div className="grid gap-2">
              <h2 className="font-pop text-xl font-black">Темы финала</h2>
              <ul className="grid gap-2">
                {view.final?.themes.map((theme) => (
                  <li
                    key={theme.id}
                    className={`ink-border font-pop rounded-2xl px-4 py-3 text-lg font-black ${
                      theme.removedByPlayerId
                        ? 'bg-card/40 text-ink/40 line-through'
                        : 'bg-card text-ink'
                    }`}
                  >
                    {theme.title}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <>
              <BoardGrid
                board={view.board}
                {...(canPick
                  ? {
                      onPick: (themeId: string, questionId: string) =>
                        send('host:pickQuestion', { themeId, questionId }),
                    }
                  : {})}
              />
              {!canPick && (
                <p className="font-body mt-3 text-center text-sm font-bold opacity-70">
                  идёт вопрос — закончите его, чтобы открыть следующий
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function SpecialNote({ view, kind }: { view: HostView; kind: 'cat' | 'auction' }) {
  const nameOf = (id: string | null): string =>
    view.players.find((player) => player.id === id)?.name ?? '—';

  if (kind === 'cat' && view.cat) {
    return (
      <p className="ink-border bg-p2 font-body rounded-2xl px-4 py-2 font-bold">
        кот в мешке · тема «{view.cat.theme || 'не задана'}» за{' '}
        <span className="tabular-nums">{view.cat.price}</span>
        {view.cat.toPlayerId ? ` → отвечает ${nameOf(view.cat.toPlayerId)}` : ` · передаёт ${nameOf(view.cat.fromPlayerId)}`}
      </p>
    );
  }

  if (kind === 'auction' && view.auction) {
    return (
      <div className="ink-border bg-gold font-body rounded-2xl px-4 py-2 font-bold">
        <p>
          аукцион · ставка <span className="font-pop tabular-nums">{view.auction.currentBid}</span>
          {view.auction.leaderId && ` — ${nameOf(view.auction.leaderId)}`}
        </p>
        <p className="text-sm opacity-75">
          {view.auction.turnPlayerId ? `ходит ${nameOf(view.auction.turnPlayerId)}` : 'торги закончены'}
          {view.auction.passedIds.length > 0 &&
            ` · спасовали: ${view.auction.passedIds.map(nameOf).join(', ')}`}
        </p>
      </div>
    );
  }

  return null;
}
