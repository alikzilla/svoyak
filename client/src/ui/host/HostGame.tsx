import type { HostView } from '@svoyak/shared';
import { ask } from '../../net/socket.js';
import { BoardGrid } from '../BoardGrid.js';
import { PlayerLedger } from '../PlayerLedger.js';
import { TimerBar } from '../Timer.js';
import { FinalHost } from './FinalHost.js';
import { Standings } from '../Standings.js';

interface HostGameProps {
  view: HostView;
}

const send = (event: Parameters<typeof ask>[0], payload?: unknown): void => {
  void ask(event, payload);
};

export function HostGame({ view }: HostGameProps) {
  const answering = view.players.find((player) => player.isAnswering);
  const control = view.players.find((player) => player.isControl);
  const question = view.question;
  const canPick = view.phase === 'picking' || view.phase === 'round_intro';
  const inFinal = view.final !== null && view.phase !== 'results';

  return (
    <div className="mx-auto flex w-full max-w-[110rem] flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{view.roundTitle}</h1>
          <p className="text-sm text-muted">
            {control ? `Ход: ${control.name}` : 'Право хода не назначено'} · комната{' '}
            <span className="tabular-nums">{view.code}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => send('host:pause', { paused: !view.paused })}
            className="rounded-xl border border-line px-4 py-2 text-sm hover:border-gold"
          >
            {view.paused ? 'Продолжить' : 'Пауза'}
          </button>
          <button
            disabled={!view.canUndo}
            onClick={() => send('host:undo')}
            className="rounded-xl border border-line px-4 py-2 text-sm hover:border-gold disabled:opacity-40"
          >
            Отменить
          </button>
        </div>
      </header>

      {/* Слева управление, справа табло: ведущий всегда видит поле целиком. */}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(24rem,5fr)_minmax(0,6fr)]">
        <div className="grid gap-4">
          <TimerBar timer={view.timer} paused={view.paused} />

          {inFinal ? (
            <FinalHost
              view={view}
              onJudge={(correct) => send('host:finalJudge', { correct })}
              onForce={() => send('host:continue')}
            />
          ) : question ? (
            <section className="grid gap-3 rounded-3xl border border-line bg-surface p-5">
              <p className="text-sm text-muted">
                {question.themeTitle} · <span className="tabular-nums">{question.price}</span>
              </p>
              <p className="text-xl leading-snug text-pretty">{question.text}</p>

              <div className="rounded-2xl border border-gold/40 bg-gold/10 p-4">
                <p className="text-sm text-gold">Ответ — виден только вам</p>
                <p className="mt-1 text-lg font-bold">{question.answer}</p>
                {question.altAnswers.length > 0 && (
                  <p className="mt-1 text-sm text-muted">
                    Также принимается: {question.altAnswers.join(', ')}
                  </p>
                )}
                {question.hostComment && (
                  <p className="mt-2 text-sm text-muted text-pretty">{question.hostComment}</p>
                )}
              </div>

              {view.cat && (
                <p className="rounded-xl border border-gold/40 bg-gold/10 px-3 py-2 text-sm">
                  Кот в мешке · тема «{view.cat.theme || 'не задана'}» за{' '}
                  <span className="tabular-nums">{view.cat.price}</span>
                  {view.cat.toPlayerId ? (
                    <>
                      {' '}
                      → отвечает{' '}
                      <span className="font-bold text-gold">
                        {view.players.find((player) => player.id === view.cat?.toPlayerId)?.name}
                      </span>
                    </>
                  ) : (
                    <>
                      {' '}
                      · передаёт{' '}
                      {view.players.find((player) => player.id === view.cat?.fromPlayerId)?.name}
                    </>
                  )}
                </p>
              )}

              {view.auction && (
                <div className="rounded-xl border border-gold/40 bg-gold/10 px-3 py-2 text-sm">
                  <p>
                    Аукцион · ставка{' '}
                    <span className="font-bold tabular-nums text-gold">{view.auction.currentBid}</span>
                    {view.auction.leaderId && (
                      <>
                        {' '}
                        — {view.players.find((player) => player.id === view.auction?.leaderId)?.name}
                      </>
                    )}
                  </p>
                  {view.auction.turnPlayerId ? (
                    <p className="text-muted">
                      ходит{' '}
                      {view.players.find((player) => player.id === view.auction?.turnPlayerId)?.name}
                    </p>
                  ) : (
                    <p className="text-muted">торги закончены</p>
                  )}
                  {view.auction.passedIds.length > 0 && (
                    <p className="text-muted">
                      спасовали:{' '}
                      {view.auction.passedIds
                        .map((id) => view.players.find((player) => player.id === id)?.name)
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  )}
                </div>
              )}

              {answering && (
                <p className="text-lg">
                  Отвечает <span className="font-bold text-gold">{answering.name}</span>
                  <span className="ml-2 text-sm text-muted">времени столько, сколько нужно</span>
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {view.phase === 'reading' && (
                  <button
                    onClick={() => send('host:openBuzzer')}
                    className="rounded-xl bg-gold px-5 py-3 font-bold text-bg"
                  >
                    Открыть кнопку
                  </button>
                )}
                {(view.phase === 'answering' ||
                  view.phase === 'cat_answer' ||
                  view.phase === 'auction_answer') && (
                  <>
                    <button
                      onClick={() => send('host:judge', { verdict: 'correct' })}
                      className="rounded-xl bg-good px-6 py-3 font-bold text-bg"
                    >
                      Верно
                    </button>
                    <button
                      onClick={() => send('host:judge', { verdict: 'wrong' })}
                      className="rounded-xl bg-bad px-6 py-3 font-bold text-bg"
                    >
                      Неверно
                    </button>
                  </>
                )}
                {view.phase === 'buzzer_open' && (
                  <button
                    onClick={() => send('host:extendTime')}
                    className="rounded-xl border border-line px-4 py-3 hover:border-gold"
                  >
                    Ещё время
                  </button>
                )}
                {view.phase === 'answer_reveal' ? (
                  <button
                    onClick={() => send('host:continue')}
                    className="rounded-xl bg-gold px-6 py-3 font-bold text-bg"
                  >
                    Дальше
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => send('host:revealAnswer')}
                      className="rounded-xl border border-line px-4 py-3 hover:border-gold"
                    >
                      Показать ответ
                    </button>
                    <button
                      onClick={() => send('host:skipQuestion')}
                      className="rounded-xl border border-line px-4 py-3 text-muted hover:border-bad hover:text-bad"
                    >
                      Снять вопрос
                    </button>
                  </>
                )}
              </div>
            </section>
          ) : view.phase === 'round_end' || view.phase === 'results' ? (
            <section className="grid gap-4 rounded-3xl border border-line bg-surface p-6 text-center">
              <h2 className="text-2xl font-bold">
                {view.phase === 'results' ? 'Игра окончена' : 'Раунд сыгран'}
              </h2>
              {view.phase === 'round_end' && (
                <button
                  onClick={() => send('host:nextRound')}
                  className="mx-auto rounded-xl bg-gold px-6 py-3 font-bold text-bg"
                >
                  Следующий раунд
                </button>
              )}
            </section>
          ) : (
            <section className="rounded-3xl border border-line bg-surface p-5">
              <p className="text-pretty">
                {control ? <span className="font-bold text-gold">{control.name}</span> : 'Игрок'}{' '}
                называет тему и цену — откройте её на табло справа.
              </p>
            </section>
          )}

          <section className="rounded-3xl border border-line bg-surface p-5">
            <PlayerLedger
              players={view.players}
              highlightId={view.controlPlayerId}
              onScoreChange={(playerId, score) => send('host:adjustScore', { playerId, score })}
              onKick={(playerId) => send('host:kick', { playerId })}
              onSetControl={(playerId) => send('host:setControl', { playerId })}
            />
          </section>
        </div>

        <section className="rounded-3xl border border-line bg-surface/50 p-4 xl:sticky xl:top-4">
          {view.phase === 'results' ? (
            <div className="grid gap-3">
              <h2 className="text-center text-2xl font-black text-gold">Итог</h2>
              <Standings players={view.players} />
            </div>
          ) : inFinal ? (
            <div className="grid gap-2">
              <h2 className="text-lg font-bold">Темы финала</h2>
              <ul className="grid gap-1">
                {view.final?.themes.map((theme) => (
                  <li
                    key={theme.id}
                    className={`rounded-xl border px-3 py-2 ${
                      theme.removedByPlayerId
                        ? 'border-transparent text-muted line-through'
                        : 'border-gold text-gold'
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
              ? { onPick: (themeId: string, questionId: string) => send('host:pickQuestion', { themeId, questionId }) }
              : {})}
          />
          {!canPick && (
            <p className="mt-3 text-center text-sm text-muted">
              Идёт вопрос — закончите его, чтобы открыть следующий
            </p>
          )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
