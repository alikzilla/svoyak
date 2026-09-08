import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayerRoom } from '../net/useRoom.js';
import { useClock } from '../net/useClock.js';
import { loadSession } from '../net/session.js';
import { ask } from '../net/socket.js';
import { unlockAudio } from '../net/sounds.js';
import { Buzzer } from '../ui/Buzzer.js';
import { BoardGrid } from '../ui/BoardGrid.js';
import { CatPick } from '../ui/CatPick.js';
import { BidPanel } from '../ui/BidPanel.js';

const WAIT_HINT: Partial<Record<string, string>> = {
  answering: 'Отвечают',
  cat_transfer: 'Кота передают другому игроку',
  cat_answer: 'Отвечает получивший кота',
  auction_bidding: 'Идут торги',
  auction_answer: 'Отвечает победитель торгов',
  lobby: 'Ждём, когда ведущий начнёт игру',
  round_intro: 'Ведущий объявляет темы',
  picking: 'Выбирают вопрос',
  answer_reveal: 'Ведущий раскрывает ответ',
  round_end: 'Раунд сыгран',
  results: 'Игра окончена',
};

export default function Play() {
  const navigate = useNavigate();
  const { view, connected, closed, toast } = usePlayerRoom();
  const clock = useClock();

  useEffect(() => {
    if (!loadSession()) void navigate('/join');
  }, [navigate]);

  if (closed) {
    return (
      <div className="app-shell flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-xl">{closed}</p>
        <button
          onClick={() => void navigate('/join')}
          className="rounded-xl bg-gold px-5 py-3 font-bold text-bg"
        >
          Войти заново
        </button>
      </div>
    );
  }

  if (!view) {
    return (
      <div className="app-shell flex items-center justify-center p-6 text-muted">
        {connected ? 'Возвращаемся в комнату…' : 'Нет связи с сервером'}
      </div>
    );
  }

  const me = view.players.find((player) => player.id === view.meId);
  const answering = view.players.find((player) => player.isAnswering);
  const others = view.players.filter((player) => player.id !== view.meId);

  const buzz = (): void => {
    unlockAudio();
    const { offset, minRtt } = clock.read();
    void ask('player:buzz', { clientTime: Date.now(), clockOffset: offset, minRtt });
  };

  return (
    <div className="app-shell flex flex-col gap-3 p-3" onPointerDown={unlockAudio}>
      <header className="flex items-center justify-between gap-3 text-sm">
        <span className="truncate text-muted">{me?.name ?? 'Игрок'}</span>
        <span className="text-xl font-black tabular-nums text-gold">{view.myScore}</span>
      </header>

      {view.question && (
        <p className="rounded-2xl border border-line bg-surface p-3 text-center text-pretty">
          <span className="block text-xs text-muted">
            {view.question.themeTitle} · <span className="tabular-nums">{view.question.price}</span>
          </span>
          {view.question.hidden ? (
            <span className="text-muted">Вопрос ещё не читали</span>
          ) : (
            view.question.text
          )}
          {view.question.revealedAnswer && (
            <span className="mt-2 block font-bold text-gold">{view.question.revealedAnswer}</span>
          )}
        </p>
      )}

      {view.prompt.kind === 'buzz' ? (
        <Buzzer
          open={view.prompt.open}
          lockedUntil={view.prompt.lockedUntil}
          answeringName={answering?.name ?? null}
          onBuzz={buzz}
        />
      ) : view.prompt.kind === 'cat_pick' ? (
        <CatPick
          theme={view.cat?.theme ?? ''}
          price={view.cat?.price ?? 0}
          candidates={view.prompt.candidates}
          canKeep={view.prompt.canKeep}
          onPick={(playerId) => void ask('player:catTransfer', { toPlayerId: playerId })}
        />
      ) : view.prompt.kind === 'auction_bid' ? (
        <BidPanel
          currentBid={view.prompt.currentBid}
          minBid={view.prompt.minBid}
          maxBid={view.prompt.maxBid}
          canPass={view.prompt.canPass}
          onBid={(amount) => void ask('player:bid', { amount })}
        />
      ) : view.prompt.kind === 'solo_answer' ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <p className="text-2xl font-bold text-gold">Отвечаете вы</p>
          <p className="text-muted text-pretty">Скажите ответ вслух — ведущий рассудит</p>
        </div>
      ) : view.prompt.kind === 'your_turn' ? (
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
          <p className="text-center text-lg text-gold text-pretty">
            Ваш ход — назовите ведущему тему и цену
          </p>
          {/* Табло только для чтения: выбирает ведущий, игрок его озвучивает. */}
          <BoardGrid board={view.board} compact />
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center text-center text-lg text-muted text-pretty">
          {answering ? `Отвечает ${answering.name}` : (WAIT_HINT[view.phase] ?? 'Идёт игра')}
        </div>
      )}

      {toast && Date.now() - toast.at < 4000 && (
        <p
          className={`rounded-xl px-3 py-2 text-center text-sm ${
            toast.tone === 'error' || toast.tone === 'warn'
              ? 'bg-bad/20 text-bad'
              : 'bg-surface text-muted'
          }`}
        >
          {toast.text}
        </p>
      )}

      <ul className="flex shrink-0 gap-2 overflow-x-auto">
        {others.map((player) => (
          <li
            key={player.id}
            className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-1.5 text-sm ${
              player.isControl ? 'border-gold' : 'border-line'
            } ${player.connected ? 'bg-surface' : 'bg-surface/50 opacity-60'}`}
          >
            <span className="max-w-24 truncate">{player.name}</span>
            <span className="tabular-nums text-muted">{player.score}</span>
          </li>
        ))}
      </ul>

      {!connected && <p className="text-center text-sm text-bad">Связь потеряна, ждём…</p>}
    </div>
  );
}
