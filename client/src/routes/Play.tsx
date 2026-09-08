import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import type { PlayerPublic, PlayerView } from '@svoyak/shared';
import { usePlayerRoom } from '../net/useRoom.js';
import { useClock } from '../net/useClock.js';
import { loadSession } from '../net/session.js';
import { ask } from '../net/socket.js';
import { unlockAudio } from '../net/sounds.js';
import { Avatar, colorForIndex } from '../design/Avatar.js';
import { BigBuzzer, type BuzzerState } from '../design/BigBuzzer.js';
import { DoodleButton } from '../design/DoodleButton.js';
import { DoodleField } from '../design/Doodles.js';
import { RoughFrame } from '../design/rough.js';
import { SoundToggle } from '../ui/SoundToggle.js';
import { CatPick } from '../ui/CatPick.js';
import { BidPanel } from '../ui/BidPanel.js';
import { FinalPlayer } from '../ui/FinalPlayer.js';

/** Подписи ожидания: пустой экран не должен быть немым. */
const WAIT_HINT: Partial<Record<string, string>> = {
  lobby: 'Ждём остальных',
  round_intro: 'Сейчас объявят темы',
  picking: 'Выбирают вопрос',
  reading: 'Слушайте вопрос',
  answering: 'Кто-то отвечает',
  answer_reveal: 'Раскрывают ответ',
  cat_transfer: 'Кота кому-то передают',
  cat_answer: 'Отвечает тот, кому достался кот',
  auction_bidding: 'Идут торги',
  auction_answer: 'Отвечает победитель торгов',
  final_theme_removal: 'Убирают темы финала',
  final_bets: 'Все ставят',
  final_answers: 'Все пишут ответы',
  final_reveal: 'Вскрывают ответы',
  round_end: 'Раунд сыгран',
  results: 'Игра окончена',
};

/** Цвет всей сцены под фазу: состояние должно читаться с вытянутой руки. */
function sceneColor(view: PlayerView, myColor: string): string {
  if (view.prompt.kind === 'buzz' && view.prompt.lockedUntil !== null) return '#7a1f2b';
  if (view.prompt.kind === 'buzz' && view.prompt.open) return '#14663a';
  if (view.players.some((player) => player.isAnswering && player.id === view.meId)) return myColor;
  if (view.phase === 'results') return '#2c1c5e';
  return '#4a3aa8';
}

export default function Play() {
  const navigate = useNavigate();
  const { view, connected, closed, toast } = usePlayerRoom();
  const clock = useClock();
  const lastPhase = useRef<string | null>(null);

  useEffect(() => {
    if (!loadSession()) void navigate('/join');
  }, [navigate]);

  const myIndex = useMemo(
    () => (view ? view.players.findIndex((player) => player.id === view.meId) : -1),
    [view],
  );
  const myColor = colorForIndex(Math.max(0, myIndex));

  // Телефон лежит экраном вниз или в кармане — про открытие кнопки и вердикт сообщаем вибрацией.
  useEffect(() => {
    if (!view) return;
    const previous = lastPhase.current;
    lastPhase.current = view.phase;
    if (previous === view.phase) return;

    if (view.phase === 'buzzer_open') navigator.vibrate?.([0, 40, 60, 40]);
    if (view.phase === 'answer_reveal') navigator.vibrate?.(25);
  }, [view]);

  const myScore = view?.myScore ?? 0;
  const previousScore = useRef<number | null>(null);
  useEffect(() => {
    if (!view) return;
    // Первое состояние — не событие: иначе вход в комнату салютовал бы сам себе.
    if (previousScore.current === null) {
      previousScore.current = myScore;
      return;
    }
    if (myScore > previousScore.current) {
      navigator.vibrate?.([0, 30, 40, 30]);
      void confetti({
        particleCount: 70,
        spread: 70,
        origin: { y: 0.7 },
        colors: [myColor, '#fff6e9', '#1a1a1a'],
      });
    } else if (myScore < previousScore.current) {
      navigator.vibrate?.(120);
    }
    previousScore.current = myScore;
  }, [myScore, myColor, view]);

  if (closed) {
    return (
      <div className="paper-scene app-shell grid place-items-center gap-5 p-6 text-center">
        <p className="font-pop text-2xl font-black">{closed}</p>
        <DoodleButton tone="p1" onClick={() => void navigate('/join')}>
          Войти заново
        </DoodleButton>
      </div>
    );
  }

  if (!view) {
    return (
      <div className="paper-scene app-shell grid place-items-center p-6">
        <motion.p
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          className="font-pop text-xl font-black"
        >
          {connected ? 'заходим в комнату…' : 'ищем сервер…'}
        </motion.p>
      </div>
    );
  }

  const me = view.players.find((player) => player.id === view.meId);
  const others = view.players.filter((player) => player.id !== view.meId);
  const answering = view.players.find((player) => player.isAnswering);
  const iAnswer = answering?.id === view.meId;

  const buzzerState: BuzzerState =
    view.prompt.kind !== 'buzz'
      ? 'closed'
      : view.prompt.lockedUntil !== null
        ? 'locked'
        : iAnswer
          ? 'mine'
          : answering
            ? 'taken'
            : view.prompt.open
              ? 'open'
              : 'closed';

  const buzz = (): void => {
    unlockAudio();
    const { offset, minRtt } = clock.read();
    void ask('player:buzz', { clientTime: Date.now(), clockOffset: offset, minRtt });
  };

  return (
    <motion.div
      className="app-shell relative flex flex-col gap-3 overflow-hidden p-3 select-none"
      onPointerDown={unlockAudio}
      animate={{ backgroundColor: sceneColor(view, myColor) }}
      transition={{ duration: 0.45 }}
      style={{ color: '#f6f1ff' }}
    >
      <DoodleField density="light" night />

      <header className="relative flex shrink-0 items-center gap-3">
        <Avatar seed={me?.name ?? 'игрок'} color={myColor} size={44} mood={iAnswer ? 'answering' : 'idle'} />
        <span className="font-pop min-w-0 flex-1 truncate text-lg font-black">{me?.name}</span>
        <SoundToggle />
        <span
          className="font-pop text-3xl font-black tabular-nums"
          style={{ WebkitTextStroke: '2.5px #1a1a1a', paintOrder: 'stroke fill' }}
        >
          {myScore}
        </span>
      </header>

      {view.question && (
        <RoughFrame
          fill="var(--color-paper-2)"
          seed={11}
          className="relative shrink-0"
          contentClassName="text-ink px-4 py-3 text-center"
        >
          <p className="font-body text-ink/60 text-xs font-bold">
            {view.question.themeTitle} · <span className="tabular-nums">{view.question.price}</span>
          </p>
          <p className="font-body mt-1 text-lg leading-snug font-bold text-pretty">
            {view.question.hidden ? 'вопрос ещё не читали' : view.question.text}
          </p>
          {view.question.revealedAnswer && (
            <p className="font-pop text-yes mt-2 text-xl font-black">{view.question.revealedAnswer}</p>
          )}
        </RoughFrame>
      )}

      <main className="relative flex min-h-0 flex-1 flex-col">
        {view.prompt.kind === 'buzz' ? (
          <BigBuzzer
            state={buzzerState}
            lockedUntil={view.prompt.lockedUntil}
            answeringName={answering?.name ?? null}
            color={myColor}
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
        ) : view.prompt.kind === 'final_remove_theme' ||
          view.prompt.kind === 'final_bet' ||
          view.prompt.kind === 'final_answer' ? (
          <FinalPlayer
            view={view}
            prompt={view.prompt}
            onRemoveTheme={(themeId) => void ask('player:finalRemoveTheme', { themeId })}
            onBet={(bet) => void ask('player:finalBet', { bet })}
            onAnswer={(answer) => void ask('player:finalAnswer', { answer })}
          />
        ) : (
          <WaitScreen view={view} answering={answering ?? null} />
        )}
      </main>

      <AnimatePresence>
        {toast && Date.now() - toast.at < 4000 && (
          <motion.p
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            className={`ink-border font-body relative shrink-0 rounded-2xl px-3 py-2 text-center font-bold ${
              toast.tone === 'info' ? 'bg-paper-2 text-ink' : 'bg-no text-white'
            }`}
          >
            {toast.text}
          </motion.p>
        )}
      </AnimatePresence>

      <ul className="relative flex shrink-0 gap-2 overflow-x-auto pb-1">
        {others.map((player) => (
          <OtherPlayer key={player.id} player={player} players={view.players} />
        ))}
      </ul>

      {!connected && (
        <p className="font-body relative shrink-0 text-center text-sm font-bold">
          связь потеряна, возвращаемся…
        </p>
      )}
    </motion.div>
  );
}

function WaitScreen({ view, answering }: { view: PlayerView; answering: PlayerPublic | null }) {
  const myTurn = view.prompt.kind === 'your_turn';
  const hint = myTurn
    ? 'Ваш ход'
    : answering
      ? `отвечает ${answering.name}`
      : (WAIT_HINT[view.phase] ?? 'идёт игра');

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <motion.div
        animate={{ y: [0, -14, 0], rotate: [-3, 3, -3] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Avatar seed={view.code} color={myTurn ? '#93d93a' : '#ffc53d'} size={96} />
      </motion.div>
      <p className="font-pop text-3xl font-black text-pretty">{hint}</p>
      {myTurn && (
        <p className="font-body max-w-xs text-lg font-bold text-pretty">
          Назовите ведущему тему и цену вслух
        </p>
      )}
    </div>
  );
}

function OtherPlayer({ player, players }: { player: PlayerPublic; players: PlayerPublic[] }) {
  const color = colorForIndex(players.findIndex((candidate) => candidate.id === player.id));

  return (
    <li
      className={`ink-border flex shrink-0 items-center gap-2 rounded-2xl px-2 py-1 ${
        player.connected ? 'bg-paper-2' : 'bg-paper-2/50'
      }`}
      style={{ boxShadow: '3px 3px 0 #1a1a1a' }}
    >
      <Avatar
        seed={player.name}
        color={color}
        size={30}
        mood={player.isAnswering ? 'answering' : 'idle'}
      />
      <span className="font-body text-ink max-w-20 truncate text-sm font-bold">{player.name}</span>
      <span className="font-pop text-ink text-sm font-black tabular-nums">{player.score}</span>
    </li>
  );
}
