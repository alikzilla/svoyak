import type { HostView } from '@svoyak/shared';

interface FinalHostProps {
  view: HostView;
  onJudge: (correct: boolean) => void;
  onForce: () => void;
}

const nameOf = (view: HostView, playerId: string): string =>
  view.players.find((player) => player.id === playerId)?.name ?? '—';

/** Финал глазами ведущего: кто что сдал, вопрос с ответом и вскрытие по одному. */
export function FinalHost({ view, onJudge, onForce }: FinalHostProps) {
  const final = view.final;
  if (!final) return null;

  const waiting =
    view.phase === 'final_bets'
      ? final.participantIds.filter((id) => !final.betPlacedIds.includes(id))
      : view.phase === 'final_answers'
        ? final.participantIds.filter((id) => !final.answerPlacedIds.includes(id))
        : [];

  const current = final.currentRevealPlayerId;

  return (
    <section className="grid gap-4 rounded-3xl border border-line bg-surface p-5">
      <header>
        <p className="text-sm text-muted">Финал</p>
        <h2 className="text-2xl font-bold text-gold">{final.themeTitle ?? 'Убирают темы'}</h2>
      </header>

      {view.phase === 'final_theme_removal' && (
        <>
          <p className="text-muted">
            Убирает{' '}
            <span className="font-bold text-ink">
              {final.removalTurnPlayerId ? nameOf(view, final.removalTurnPlayerId) : '—'}
            </span>
          </p>
          <ul className="grid gap-1">
            {final.themes.map((theme) => (
              <li
                key={theme.id}
                className={theme.removedByPlayerId ? 'text-muted line-through' : 'text-ink'}
              >
                {theme.title}
                {theme.removedByPlayerId && (
                  <span className="ml-2 text-xs">убрал {nameOf(view, theme.removedByPlayerId)}</span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {final.questionText && (
        <div className="rounded-2xl border border-line bg-surface-2 p-4">
          <p className="text-lg text-pretty">{final.questionText}</p>
          <div className="mt-3 rounded-xl border border-gold/40 bg-gold/10 p-3">
            <p className="text-sm text-gold">Ответ — виден только вам</p>
            <p className="text-lg font-bold">{final.answer}</p>
            {final.altAnswers.length > 0 && (
              <p className="text-sm text-muted">Также принимается: {final.altAnswers.join(', ')}</p>
            )}
          </div>
        </div>
      )}

      {(view.phase === 'final_bets' || view.phase === 'final_answers') && (
        <div className="grid gap-2">
          <p className="text-muted">
            {view.phase === 'final_bets' ? 'Ставки' : 'Ответы'}:{' '}
            {waiting.length === 0
              ? 'все сдали'
              : `ждём ${waiting.map((id) => nameOf(view, id)).join(', ')}`}
          </p>
          {waiting.length > 0 && (
            <button
              onClick={onForce}
              className="justify-self-start rounded-xl border border-line px-4 py-2 text-sm hover:border-gold"
            >
              Не ждать отставших
            </button>
          )}
        </div>
      )}

      {view.phase === 'final_reveal' && current && (
        <div className="grid gap-3">
          <p className="text-muted">Вскрываем: {nameOf(view, current)}</p>
          <p className="text-2xl font-bold text-pretty">
            {final.answers[current] || <span className="text-muted">без ответа</span>}
          </p>
          <p className="text-muted">
            ставка <span className="tabular-nums text-gold">{final.bets[current] ?? 0}</span>
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => onJudge(true)}
              className="rounded-xl bg-good px-6 py-3 font-bold text-bg"
            >
              Верно
            </button>
            <button
              onClick={() => onJudge(false)}
              className="rounded-xl bg-bad px-6 py-3 font-bold text-bg"
            >
              Неверно
            </button>
          </div>
        </div>
      )}

      {final.revealed.length > 0 && (
        <ul className="grid gap-1 border-t border-line pt-3 text-sm">
          {final.revealed.map((entry) => (
            <li key={entry.playerId} className="flex items-center gap-2">
              <span className={entry.correct ? 'text-good' : 'text-bad'}>
                {entry.correct ? '✓' : '✕'}
              </span>
              <span className="flex-1 truncate">
                {nameOf(view, entry.playerId)}: {entry.answer || '—'}
              </span>
              <span className="tabular-nums text-muted">{entry.bet}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
