import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { FameEntry, GameResult, HistoryResponse } from '@svoyak/shared';
import { DoodleField } from '../design/Doodles.js';
import { Avatar, colorForIndex } from '../design/Avatar.js';
import { plural, pluralWord } from '../history/plural.js';

const DATE = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long', year: 'numeric' });

async function fetchHistory(): Promise<HistoryResponse> {
  const response = await fetch('/api/history');
  if (!response.ok) throw new Error('Не удалось загрузить историю');
  return (await response.json()) as HistoryResponse;
}

/** «Зал славы»: кто сколько раз побеждал за все вечера и чем кончилась каждая игра. */
export default function History() {
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchHistory()
      .then(setHistory)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Ошибка'));
  }, []);

  return (
    <div className="app-shell on-scene relative isolate mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <DoodleField density="light" night />
      <header className="relative">
        <Link to="/" className="btn btn-quiet font-body mb-2 inline-block text-sm">
          ← на главную
        </Link>
        <h1
          className="font-pop text-4xl font-black"
          style={{ WebkitTextStroke: '4px #1a1a1a', paintOrder: 'stroke fill', color: '#fff6e9' }}
        >
          Зал славы
        </h1>
        <p className="font-body font-bold opacity-80">Кто сколько раз побеждал за все вечера</p>
      </header>

      {error && (
        <p role="alert" className="notice notice-error font-body relative">
          {error}
        </p>
      )}

      {history === null ? (
        !error && <p className="text-soft font-body relative font-bold">Загружаем…</p>
      ) : history.evenings.length === 0 ? (
        <p className="text-soft font-body relative font-bold">
          Здесь появятся итоги, когда вы доиграете первую игру до конца.
        </p>
      ) : (
        <>
          <section className="relative grid gap-3">
            <h2 className="font-pop text-xl font-black">Лучшие</h2>
            <ol className="grid gap-3">
              {history.fame.map((entry, index) => (
                <FameRow key={entry.name} entry={entry} place={index} />
              ))}
            </ol>
          </section>

          <section className="relative grid gap-3">
            <h2 className="font-pop text-xl font-black">Вечера</h2>
            <ul className="grid gap-3">
              {history.evenings.map((evening) => (
                <EveningRow key={evening.id} evening={evening} />
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function FameRow({ entry, place }: { entry: FameEntry; place: number }) {
  const champion = place === 0 && entry.wins > 0;
  return (
    <li
      className="on-paper ink-border bg-card text-ink flex items-center gap-3 rounded-3xl px-5 py-3"
      style={{ boxShadow: '5px 5px 0 #1a1a1a' }}
    >
      <span
        className={`ink-border font-pop grid size-10 shrink-0 place-items-center rounded-full text-lg font-black tabular-nums ${
          champion ? 'bg-gold' : 'bg-card'
        }`}
      >
        {place + 1}
      </span>
      <Avatar seed={entry.name} color={colorForIndex(place)} size={48} />
      <div className="min-w-0 flex-1">
        <span className="font-pop block truncate text-xl font-black">{entry.name}</span>
        <span className="text-soft font-body block text-sm font-bold">
          {plural(entry.games, ['игра', 'игры', 'игр'])} · рекорд{' '}
          <span className="font-pop tabular-nums">{entry.bestScore}</span>
        </span>
      </div>
      <div className="shrink-0 text-right">
        <span className="font-pop block text-3xl leading-none font-black tabular-nums">{entry.wins}</span>
        <span className="text-soft font-body text-xs font-bold">
          {pluralWord(entry.wins, ['победа', 'победы', 'побед'])}
        </span>
      </div>
    </li>
  );
}

function EveningRow({ evening }: { evening: GameResult }) {
  const best = evening.players[0]?.score ?? 0;
  return (
    <li
      className="on-paper ink-border bg-card text-ink grid gap-2 rounded-3xl px-5 py-4"
      style={{ boxShadow: '5px 5px 0 #1a1a1a' }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="font-pop text-lg font-black break-words">{evening.packTitle}</span>
        <span className="text-soft font-body text-sm font-bold">{DATE.format(evening.finishedAt)}</span>
      </div>
      <ol className="flex flex-wrap gap-2">
        {evening.players.map((player, index) => {
          const winner = player.score === best && best > 0;
          return (
            <li
              key={`${player.name}-${index}`}
              className={`ink-border font-body flex items-baseline gap-1.5 rounded-xl px-2.5 py-1 text-sm font-bold ${
                winner ? 'bg-gold' : 'bg-card'
              }`}
            >
              {player.name}
              <span className="font-pop tabular-nums">{player.score}</span>
            </li>
          );
        })}
      </ol>
    </li>
  );
}
