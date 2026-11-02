import type { ReactNode } from 'react';
import {
  ArrowRight,
  Check,
  Clock,
  Eye,
  Keyboard,
  Pause,
  Play,
  SkipForward,
  Undo2,
  X,
} from 'lucide-react';
import type { HostView, PlayerPublic } from '@svoyak/shared';
import { MODIFIER_HINTS, MODIFIER_TITLES, modifierApplies } from '@svoyak/shared';
import { ask } from '../../net/socket.js';
import { clearSession } from '../../net/session.js';
import { PlayerLedger } from '../PlayerLedger.js';
import { Standings } from '../Standings.js';
import { LiveTimer } from '../Timer.js';
import { Avatar, colorForIndex } from '../../design/Avatar.js';
import { Shell } from '../../workspace/Shell.js';
import { ConnectionStatus, Kbd, Notice, SoundButton } from '../../workspace/ui.js';
import { CheatSheet } from './CheatSheet.js';
import { FinalHost } from './FinalHost.js';
import { HostBoard } from './HostBoard.js';
import { Ticket } from './Ticket.js';
import { useHostHotkeys } from './hotkeys.js';

interface HostGameProps {
  view: HostView;
  connected: boolean;
}

const send = (event: Parameters<typeof ask>[0], payload?: unknown): void => {
  void ask(event, payload);
};

const nameOf = (view: HostView, id: string | null): string =>
  view.players.find((player) => player.id === id)?.name ?? '—';

/**
 * Стол ведущего во время игры. Слева — что происходит сейчас и одно
 * следующее действие с его клавишей, ниже игроки. Справа — табло.
 */
export function HostGame({ view, connected }: HostGameProps) {
  useHostHotkeys(view, send);

  const canPick = view.phase === 'picking';
  const intro = view.phase === 'game_intro' || view.phase === 'round_intro';
  const inFinal = view.final !== null && view.phase !== 'results';

  return (
    <Shell
      bar={<GameBar view={view} />}
      aside={
        <>
          <ConnectionStatus connected={connected} />
          <button
            type="button"
            disabled={!view.canUndo}
            onClick={() => send('host:undo')}
            className="ws-btn ws-btn-ghost ws-btn-sm"
            title="Отменить последнее действие (⌘Z)"
          >
            <Undo2 aria-hidden />
            <span className="hidden md:inline">Отменить</span>
          </button>
          <button
            type="button"
            onClick={() => send('host:pause', { paused: !view.paused })}
            aria-pressed={view.paused}
            className="ws-btn ws-btn-sm"
            title={view.paused ? 'Продолжить игру (P)' : 'Поставить на паузу (P)'}
          >
            {view.paused ? <Play aria-hidden /> : <Pause aria-hidden />}
            <span className="hidden md:inline">{view.paused ? 'Продолжить' : 'Пауза'}</span>
          </button>
          <SoundButton />
          <KeysHelp />
        </>
      }
    >
      {view.paused && (
        <div className="mb-5">
          <Notice
            tone="warn"
            action={
              <button
                type="button"
                onClick={() => send('host:pause', { paused: false })}
                className="ws-btn ws-btn-sm"
              >
                <Play aria-hidden />
                Продолжить
              </button>
            }
          >
            <strong className="font-semibold">Пауза.</strong> Таймеры стоят, кнопки у игроков не
            работают.
          </Notice>
        </div>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(26rem,5fr)_minmax(0,6fr)]">
        <div className="grid min-w-0 gap-6">
          <Stage view={view} />

          <section className="ws-card">
            <header className="ws-card-head">
              <h2 className="ws-card-title">Игроки</h2>
              <span className="text-ws-faint text-[0.8125rem]">счёт можно поправить вручную</span>
            </header>
            <PlayerLedger
              players={view.players}
              highlightId={view.controlPlayerId}
              onScoreChange={(playerId, score) => send('host:adjustScore', { playerId, score })}
              onKick={(playerId) => send('host:kick', { playerId })}
              onSetControl={(playerId) => send('host:setControl', { playerId })}
              onGiveHint={(playerId) => send('host:giveHint', { playerId })}
            />
          </section>
        </div>

        <div className="grid min-w-0 gap-6 xl:sticky xl:top-20">
          {view.phase === 'results' ? (
            <section className="ws-card">
              <header className="ws-card-head">
                <h2 className="ws-card-title">Итог</h2>
              </header>
              <Standings players={view.players} />
            </section>
          ) : inFinal ? (
            <section className="ws-card">
              <header className="ws-card-head">
                <h2 className="ws-card-title">Темы финала</h2>
              </header>
              <ul className="divide-ws-line grid divide-y">
                {view.final?.themes.map((theme) => (
                  <li key={theme.id} className="flex items-center gap-3 px-5 py-3">
                    <span
                      className={`min-w-0 flex-1 font-medium ${
                        theme.removedByPlayerId ? 'text-ws-faint line-through' : ''
                      }`}
                    >
                      {theme.title}
                    </span>
                    {theme.removedByPlayerId && (
                      <span className="text-ws-faint text-[0.8125rem]">
                        убрал(а) {nameOf(view, theme.removedByPlayerId)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <>
              <section className="ws-card">
                <header className="ws-card-head">
                  <h2 className="ws-card-title">Табло</h2>
                  <span className="text-ws-faint ml-auto text-[0.8125rem]">
                    {canPick
                      ? 'нажмите цену, которую назвал игрок'
                      : intro
                        ? 'откроется после заставки'
                        : 'идёт вопрос — закончите его'}
                  </span>
                </header>
                <div className="overflow-x-auto p-4 sm:p-5">
                  <HostBoard
                    board={view.board}
                    currentId={view.question?.questionId ?? null}
                    {...(canPick
                      ? {
                          onPick: (themeId: string, questionId: string) =>
                            send('host:pickQuestion', { themeId, questionId }),
                        }
                      : {})}
                  />
                </div>
              </section>
              <CheatSheet themes={view.cheatSheet} />
            </>
          )}
        </div>
      </div>
    </Shell>
  );
}

function GameBar({ view }: { view: HostView }) {
  const final = view.final !== null;
  return (
    <div className="flex min-w-0 items-center gap-3 text-sm">
      <span className="text-ws-line hidden sm:inline" aria-hidden>
        /
      </span>
      <span className="truncate font-medium">{final ? 'Финал' : view.roundTitle}</span>
      {!final && view.roundsTotal > 0 && (
        <span className="text-ws-faint num hidden shrink-0 sm:inline">
          раунд {view.roundIndex + 1} из {view.roundsTotal}
        </span>
      )}
      <span className="ws-badge num shrink-0" title="Код комнаты для входа">
        {view.code}
      </span>
    </div>
  );
}

/** Шпаргалка по клавишам: открывается поверх, закрывается кликом мимо или Esc. */
function KeysHelp() {
  const rows: Array<[ReactNode, string]> = [
    [<Kbd key="space">Пробел</Kbd>, 'Дальше: открыть кнопку, следующий шаг'],
    [<Kbd key="plus">+</Kbd>, 'Верно'],
    [<Kbd key="minus">−</Kbd>, 'Неверно'],
    [<Kbd key="p">P</Kbd>, 'Пауза / продолжить'],
    [
      <span key="undo" className="flex gap-1">
        <Kbd>⌘</Kbd>
        <Kbd>Z</Kbd>
      </span>,
      'Отменить последнее действие',
    ],
  ];
  return (
    <>
      <button
        type="button"
        popoverTarget="host-keys"
        className="ws-btn ws-btn-ghost ws-btn-sm ws-btn-icon hidden lg:inline-flex"
        title="Горячие клавиши"
        aria-label="Горячие клавиши"
      >
        <Keyboard aria-hidden />
      </button>
      <div id="host-keys" popover="auto" className="ws-popover w-[22rem] max-w-[calc(100vw-2rem)]">
        <div className="border-ws-line border-b px-5 py-3.5">
          <h2 className="font-semibold">Горячие клавиши</h2>
          <p className="text-ws-soft text-sm">Работают в любой раскладке, пока курсор не в поле ввода.</p>
        </div>
        <dl className="grid gap-2.5 px-5 py-4">
          {rows.map(([keys, label]) => (
            <div key={label} className="flex items-center justify-between gap-4 text-sm">
              <dt className="text-ws-soft">{label}</dt>
              <dd className="shrink-0">{keys}</dd>
            </div>
          ))}
        </dl>
      </div>
    </>
  );
}

/** Что происходит сейчас — в зависимости от фазы. */
function Stage({ view }: { view: HostView }) {
  const control = view.players.find((player) => player.isControl) ?? null;
  const question = view.question;

  if (view.final !== null && view.phase !== 'results') {
    return (
      <FinalHost
        view={view}
        onJudge={(correct) => send('host:finalJudge', { correct })}
        onForce={() => send('host:continue')}
      />
    );
  }

  if (view.phase === 'modifier' && view.modifier) {
    const applies = modifierApplies(view.modifier.kind, view.players.length);
    return (
      <section className="ws-ticket grid gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="ws-badge ws-badge-accent">Модификатор вместо вопроса</span>
          {view.timer && (
            <span className="ml-auto">
              <LiveTimer timer={view.timer} paused={view.paused} />
            </span>
          )}
        </div>
        <div className="grid gap-1">
          <h2 className="text-[1.5rem] leading-tight font-semibold">{MODIFIER_TITLES[view.modifier.kind]}</h2>
          <p className="text-ws-soft">
            {applies ? MODIFIER_HINTS[view.modifier.kind] : 'Не сработало — в комнате больше никого нет.'} ·{' '}
            <span className="text-ws-fg font-medium">{nameOf(view, view.modifier.playerId)}</span>
          </p>
          {view.modifier.kind === 'swap' && view.modifier.targetPlayerId === null && applies && (
            <p className="text-ws-soft text-sm">Ждём, пока игрок выберет соперника на телефоне.</p>
          )}
        </div>
        <ActionRow>
          <PrimaryNext label="Дальше" onClick={() => send('host:continue')} />
        </ActionRow>
      </section>
    );
  }

  if (question) {
    return (
      <Ticket
        header={
          <>
            <span className="text-[0.9375rem] font-semibold">{question.themeTitle}</span>
            <span className="ws-badge ws-badge-accent num">{question.price}</span>
            {question.type === 'cat' && <span className="ws-badge">кот в мешке</span>}
            {question.type === 'auction' && <span className="ws-badge">аукцион</span>}
            {view.timer && (
              <span className="ml-auto">
                <LiveTimer timer={view.timer} paused={view.paused} />
              </span>
            )}
          </>
        }
        text={question.text}
        media={question.media}
        answer={question.answer}
        altAnswers={question.altAnswers}
        answerMedia={question.answerMedia}
        hostComment={question.hostComment}
        revealed={question.answerRevealed || view.phase === 'answer_reveal'}
      >
        <QuestionControls view={view} />
      </Ticket>
    );
  }

  if (view.phase === 'game_intro' || view.phase === 'round_intro') {
    return (
      <section className="ws-ticket grid gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="ws-badge ws-badge-accent">Заставка</span>
          {view.timer && (
            <span className="ml-auto">
              <LiveTimer timer={view.timer} paused={view.paused} />
            </span>
          )}
        </div>
        <div className="grid gap-1">
          <h2 className="text-[1.5rem] leading-tight font-semibold">
            {view.phase === 'game_intro' ? 'На общем экране — темы игры' : `${view.roundTitle}: темы раунда`}
          </h2>
          <p className="text-ws-soft">Табло откроется само, когда заставка закончится.</p>
        </div>
        <ActionRow>
          <PrimaryNext label="Пропустить" onClick={() => send('host:continue')} />
        </ActionRow>
      </section>
    );
  }

  if (view.phase === 'round_end') {
    return (
      <section className="ws-ticket grid gap-4 p-5 sm:p-6">
        <div className="grid gap-1">
          <h2 className="text-[1.5rem] leading-tight font-semibold">Раунд сыгран</h2>
          <p className="text-ws-soft">
            {view.roundIndex + 1 < view.roundsTotal
              ? 'Объявите счёт и переходите к следующему раунду.'
              : 'Объявите счёт — дальше финал.'}
          </p>
        </div>
        <ActionRow>
          <PrimaryNext
            label={view.roundIndex + 1 < view.roundsTotal ? 'Следующий раунд' : 'К финалу'}
            onClick={() => send('host:nextRound')}
          />
        </ActionRow>
      </section>
    );
  }

  if (view.phase === 'results') {
    return (
      <section className="ws-ticket grid gap-4 p-5 sm:p-6">
        <div className="grid gap-1">
          <h2 className="text-[1.5rem] leading-tight font-semibold">Игра окончена</h2>
          <p className="text-ws-soft">Итог — на общем экране и справа. Спасибо за вечер!</p>
        </div>
        <ActionRow>
          <button
            type="button"
            onClick={() => {
              clearSession('host');
              location.reload();
            }}
            className="ws-btn ws-btn-lg"
          >
            Закрыть комнату и собрать новую игру
          </button>
        </ActionRow>
      </section>
    );
  }

  // Выбор вопроса: заставка раунда или ожидание хода.
  return (
    <section className="ws-ticket grid gap-3 p-5 sm:p-6">
      <h2 className="text-[1.5rem] leading-tight font-semibold">
        {control ? (
          <span className="flex items-center gap-3">
            <PlayerAvatar view={view} player={control} size={40} />
            {control.name} выбирает вопрос
          </span>
        ) : (
          'Кто выбирает вопрос?'
        )}
      </h2>
      <p className="text-ws-soft">
        {control
          ? 'Игрок называет тему и цену вслух — нажмите эту клетку на табло.'
          : 'Право хода ещё ни у кого: нажмите «Дать ход» у игрока или просто откройте клетку на табло.'}
      </p>
    </section>
  );
}

/** Подсказка фазы и кнопки под билетом. */
function QuestionControls({ view }: { view: HostView }) {
  const answering = view.players.find((player) => player.isAnswering) ?? null;
  const phase = view.phase;
  const judging = phase === 'answering' || phase === 'cat_answer' || phase === 'auction_answer';

  let hint: ReactNode = null;
  if (phase === 'announce') hint = 'На общем экране тема и цена. Вопрос откроется сам.';
  if (phase === 'reading') {
    hint = view.settings.autoOpenBuzzer
      ? 'Читайте вопрос вслух — кнопка откроется сама.'
      : 'Прочитайте вопрос вслух и откройте кнопку.';
  }
  if (phase === 'buzzer_open') hint = 'Кнопка открыта — ждём, кто нажмёт первым.';
  if (phase === 'cat_transfer' && view.cat) {
    hint = `Кот в мешке: ${nameOf(view, view.cat.fromPlayerId)} выбирает, кому отдать вопрос.`;
  }
  if (phase === 'auction_bidding') hint = 'Аукцион: игроки торгуются на телефонах.';
  if (phase === 'answer_reveal') hint = 'Ответ на общем экране.';

  return (
    <>
      {judging && answering ? (
        <div className="flex items-center gap-3">
          <PlayerAvatar view={view} player={answering} size={40} />
          <div className="grid">
            <span className="text-[1.125rem] font-semibold">Отвечает {answering.name}</span>
            <span className="text-ws-soft flex items-center gap-1.5 text-sm">
              <Clock size={14} aria-hidden />
              времени столько, сколько нужно
            </span>
          </div>
        </div>
      ) : (
        hint && <p className="text-[0.9375rem] font-medium">{hint}</p>
      )}

      {view.cat && <SpecialNote view={view} kind="cat" />}
      {view.auction && <SpecialNote view={view} kind="auction" />}

      <ActionRow>
        {phase === 'announce' && (
          <PrimaryNext label="Сразу к вопросу" onClick={() => send('host:continue')} />
        )}
        {phase === 'reading' && <PrimaryNext label="Открыть кнопку" onClick={() => send('host:openBuzzer')} />}
        {judging && (
          <>
            <button
              type="button"
              onClick={() => send('host:judge', { verdict: 'correct' })}
              className="ws-btn ws-btn-yes ws-btn-xl"
            >
              <Check aria-hidden />
              Верно
              <Kbd label="клавиша плюс">+</Kbd>
            </button>
            <button
              type="button"
              onClick={() => send('host:judge', { verdict: 'wrong' })}
              className="ws-btn ws-btn-no ws-btn-xl"
            >
              <X aria-hidden />
              Неверно
              <Kbd label="клавиша минус">−</Kbd>
            </button>
          </>
        )}
        {phase === 'buzzer_open' && (
          <button type="button" onClick={() => send('host:extendTime')} className="ws-btn ws-btn-lg">
            <Clock aria-hidden />
            Ещё время
          </button>
        )}
        {phase === 'answer_reveal' && <PrimaryNext label="Дальше" onClick={() => send('host:continue')} />}

        {phase !== 'answer_reveal' && (
          <span className="flex flex-wrap gap-1 sm:ml-auto">
            <button
              type="button"
              onClick={() => send('host:revealAnswer')}
              className="ws-btn ws-btn-ghost"
              title="Показать ответ на общем экране — вопрос закончится"
            >
              <Eye aria-hidden />
              Показать ответ
            </button>
            <button
              type="button"
              onClick={() => send('host:skipQuestion')}
              className="ws-btn ws-btn-ghost"
              title="Убрать вопрос без ответа"
            >
              <SkipForward aria-hidden />
              Снять вопрос
            </button>
          </span>
        )}
      </ActionRow>
    </>
  );
}

function ActionRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

function PrimaryNext({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="ws-btn ws-btn-primary ws-btn-xl">
      {label}
      <ArrowRight aria-hidden />
      <Kbd label="клавиша пробел">Пробел</Kbd>
    </button>
  );
}

function PlayerAvatar({ view, player, size }: { view: HostView; player: PlayerPublic; size: number }) {
  const index = view.players.findIndex((candidate) => candidate.id === player.id);
  return (
    <Avatar
      seed={player.name}
      color={colorForIndex(index)}
      size={size}
      mood={player.isAnswering ? 'answering' : 'idle'}
    />
  );
}

function SpecialNote({ view, kind }: { view: HostView; kind: 'cat' | 'auction' }) {
  if (kind === 'cat' && view.cat) {
    return (
      <p className="bg-ws-sunken rounded-lg px-3.5 py-2.5 text-sm">
        <span className="font-semibold">Кот в мешке</span> · тема «{view.cat.theme || 'не задана'}» за{' '}
        <span className="num font-semibold">{view.cat.price}</span>
        {view.cat.toPlayerId
          ? ` · отвечает ${nameOf(view, view.cat.toPlayerId)}`
          : ` · передаёт ${nameOf(view, view.cat.fromPlayerId)}`}
      </p>
    );
  }

  if (kind === 'auction' && view.auction) {
    return (
      <div className="bg-ws-sunken grid gap-0.5 rounded-lg px-3.5 py-2.5 text-sm">
        <p>
          <span className="font-semibold">Аукцион</span> · ставка{' '}
          <span className="num font-semibold">{view.auction.currentBid}</span>
          {view.auction.leaderId && ` — ${nameOf(view, view.auction.leaderId)}`}
        </p>
        <p className="text-ws-soft">
          {view.auction.turnPlayerId ? `ходит ${nameOf(view, view.auction.turnPlayerId)}` : 'торги закончены'}
          {view.auction.passedIds.length > 0 &&
            ` · спасовали: ${view.auction.passedIds.map((id) => nameOf(view, id)).join(', ')}`}
        </p>
      </div>
    );
  }

  return null;
}
