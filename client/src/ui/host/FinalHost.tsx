import { Check, X } from 'lucide-react';
import type { AnswerMatch, HostView } from '@svoyak/shared';
import { matchAnswer } from '@svoyak/shared';
import { Kbd } from '../../workspace/ui.js';
import { LiveTimer } from '../Timer.js';
import { Ticket } from './Ticket.js';

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
  const suggestion =
    current && final.answer !== null
      ? matchAnswer(final.answers[current] ?? '', [final.answer, ...final.altAnswers])
      : null;

  const header = (
    <>
      <span className="ws-badge ws-badge-accent">Финал</span>
      <span className="text-[0.9375rem] font-semibold">{final.themeTitle ?? 'Игроки убирают темы'}</span>
      {view.timer && (
        <span className="ml-auto">
          <LiveTimer timer={view.timer} paused={view.paused} />
        </span>
      )}
    </>
  );

  return (
    <div className="grid gap-4">
      {view.phase === 'final_theme_removal' ? (
        <section className="ws-ticket grid gap-3 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-3">{header}</div>
          <p className="text-[1.25rem] font-medium">
            Тему убирает{' '}
            <strong className="font-semibold">
              {final.removalTurnPlayerId ? nameOf(view, final.removalTurnPlayerId) : '—'}
            </strong>
          </p>
          <p className="text-ws-soft text-sm">
            Игроки по очереди вычёркивают темы на телефонах, пока не останется одна.
          </p>
        </section>
      ) : (
        <Ticket
          header={header}
          text={final.questionText}
          media={final.questionMedia}
          answer={final.questionText ? final.answer : null}
          altAnswers={final.altAnswers}
          hostComment={final.hostComment}
        >
          {(view.phase === 'final_bets' || view.phase === 'final_answers') && (
            <div className="flex flex-wrap items-center gap-3">
              <p className="min-w-0 flex-1 text-[0.9375rem]">
                <span className="font-semibold">{view.phase === 'final_bets' ? 'Ставки' : 'Ответы'}: </span>
                {waiting.length === 0 ? (
                  'все сдали'
                ) : (
                  <span className="text-ws-soft">ждём {waiting.map((id) => nameOf(view, id)).join(', ')}</span>
                )}
              </p>
              {waiting.length > 0 && (
                <button type="button" onClick={onForce} className="ws-btn">
                  Не ждать отставших
                </button>
              )}
            </div>
          )}

          {view.phase === 'final_reveal' && current && (
            <div className="grid gap-4">
              <div className="grid gap-1">
                <span className="text-ws-soft text-sm">
                  Вскрываем: <span className="text-ws-fg font-semibold">{nameOf(view, current)}</span> · ставка{' '}
                  <span className="num text-ws-fg font-semibold">{final.bets[current] ?? 0}</span>
                </span>
                <p className="text-[1.5rem] leading-snug font-semibold text-pretty">
                  {final.answers[current] || <span className="text-ws-faint font-normal">без ответа</span>}
                </p>
                {suggestion && <SuggestionNote suggestion={suggestion} />}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onJudge(true)}
                  className={`ws-btn ws-btn-yes ws-btn-xl ${suggestion?.kind === 'exact' ? 'ring-ws-yes ring-2 ring-offset-2' : ''}`}
                >
                  <Check aria-hidden />
                  Верно
                  <Kbd label="клавиша плюс">+</Kbd>
                </button>
                <button
                  type="button"
                  onClick={() => onJudge(false)}
                  className={`ws-btn ws-btn-no ws-btn-xl ${suggestion?.kind === 'none' ? 'ring-ws-no ring-2 ring-offset-2' : ''}`}
                >
                  <X aria-hidden />
                  Неверно
                  <Kbd label="клавиша минус">−</Kbd>
                </button>
              </div>
            </div>
          )}
        </Ticket>
      )}

      {final.revealed.length > 0 && (
        <section className="ws-card">
          <header className="ws-card-head">
            <h2 className="ws-card-title">Вскрытые ответы</h2>
          </header>
          <ul className="divide-ws-line grid divide-y">
            {final.revealed.map((entry) => (
              <li key={entry.playerId} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                {entry.correct ? (
                  <Check size={16} className="text-ws-yes-ink shrink-0" aria-label="верно" />
                ) : (
                  <X size={16} className="text-ws-no-ink shrink-0" aria-label="неверно" />
                )}
                <span className="font-semibold">{nameOf(view, entry.playerId)}</span>
                <span className="text-ws-soft min-w-0 flex-1 truncate">{entry.answer || '—'}</span>
                <span className="num text-ws-soft">{entry.bet}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Подсказка, а не вердикт: судит всё равно ведущий. Кнопка, которую
 *  подсказка советует, обведена, а «похоже» не выделяет ни одну. */
function SuggestionNote({ suggestion }: { suggestion: AnswerMatch }) {
  if (suggestion.kind === 'exact') {
    return <p className="text-ws-yes-ink text-sm font-medium">Совпадает с «{suggestion.matched}»</p>;
  }
  if (suggestion.kind === 'close') {
    return (
      <p className="text-ws-warn-ink text-sm font-medium">
        Похоже на «{suggestion.matched}» — решайте сами
      </p>
    );
  }
  return <p className="text-ws-no-ink text-sm font-medium">Не похоже на правильный ответ</p>;
}
