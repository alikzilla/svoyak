import type { HostView } from '@svoyak/shared';
import { ask } from '../../net/socket.js';
import { BoardGrid } from '../BoardGrid.js';
import { PlayerLedger } from '../PlayerLedger.js';
import { TimerBar } from '../Timer.js';

interface HostGameProps {
  view: HostView;
}

const send = (event: Parameters<typeof ask>[0], payload?: unknown): void => {
  void ask(event, payload);
};

export function HostGame({ view }: HostGameProps) {
  const answering = view.players.find((player) => player.isAnswering);
  const control = view.players.find((player) => player.isControl);
  const questionOpen = view.question !== null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-5">
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

      <TimerBar timer={view.timer} paused={view.paused} />

      {questionOpen && view.question ? (
        <section className="grid gap-4 rounded-3xl border border-line bg-surface p-6">
          <p className="text-sm text-muted">
            {view.question.themeTitle} · <span className="tabular-nums">{view.question.price}</span>
          </p>
          <p className="text-2xl leading-snug text-pretty">{view.question.text}</p>

          <div className="rounded-2xl border border-gold/40 bg-gold/10 p-4">
            <p className="text-sm text-gold">Ответ — виден только вам</p>
            <p className="mt-1 text-xl font-bold">{view.question.answer}</p>
            {view.question.altAnswers.length > 0 && (
              <p className="mt-1 text-sm text-muted">
                Также принимается: {view.question.altAnswers.join(', ')}
              </p>
            )}
            {view.question.hostComment && (
              <p className="mt-2 text-sm text-muted text-pretty">{view.question.hostComment}</p>
            )}
          </div>

          {answering && (
            <p className="text-lg">
              Отвечает <span className="font-bold text-gold">{answering.name}</span>
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
            {view.phase === 'answering' && (
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
                <button
                  onClick={() => send('host:extendTime')}
                  className="rounded-xl border border-line px-4 py-3 hover:border-gold"
                >
                  Ещё время
                </button>
              </>
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
        <section className="grid gap-4 rounded-3xl border border-line bg-surface p-8 text-center">
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
        <section className="grid gap-3">
          <p className="text-sm text-muted">
            Выбирает {control?.name ?? 'игрок'} — можно нажать за него.
          </p>
          <BoardGrid
            board={view.board}
            onPick={(themeId, questionId) => send('host:pickQuestion', { themeId, questionId })}
          />
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
  );
}
