import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Game, GameSummary, PackSummary } from '@svoyak/shared';
import { DoodleField } from '../design/Doodles.js';
import { listPacks } from '../editor/api.js';
import { createGame, fetchGame, listGames, removeGame } from '../games/api.js';
import { GameBuilder } from '../games/GameBuilder.js';

/** Игры: пак — это содержимое, игра — состав вечера, собранный из паков. */
export default function Games() {
  const [games, setGames] = useState<GameSummary[] | null>(null);
  const [packs, setPacks] = useState<PackSummary[]>([]);
  const [editing, setEditing] = useState<Game | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = (): void => {
    void listGames()
      .then(setGames)
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Не удалось загрузить игры'),
      );
  };

  useEffect(() => {
    reload();
    void listPacks()
      .then(setPacks)
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Не удалось загрузить паки'),
      );
  }, []);

  const add = (): void => {
    void createGame('Новая игра')
      .then(setEditing)
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Не удалось создать игру'),
      );
  };

  const open = (id: string): void => {
    void fetchGame(id)
      .then(setEditing)
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Не удалось открыть игру'),
      );
  };

  const destroy = (id: string): void => {
    void removeGame(id)
      .then(() => {
        setConfirmId(null);
        reload();
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Не удалось удалить игру'),
      );
  };

  return (
    <div className="app-shell on-scene relative isolate mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <DoodleField density="light" night />
      <header className="relative flex flex-wrap items-center justify-between gap-3">
        <div>
          {editing && (
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="btn btn-quiet font-body mb-2 text-sm"
            >
              ← Игры
            </button>
          )}
          <h1
            className="font-pop text-4xl font-black"
            style={{ WebkitTextStroke: '4px #1a1a1a', paintOrder: 'stroke fill', color: '#fff6e9' }}
          >
            Игры
          </h1>
          <p className="font-body font-bold opacity-80">
            Пак — это вопросы, игра — состав вечера, собранный из паков
          </p>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={add}
            className="btn font-pop bg-p5 rounded-2xl px-4 py-2 font-black"
          >
            + собрать игру
          </button>
        )}
      </header>

      {error && (
        <p role="alert" className="notice notice-error font-body">
          {error}
        </p>
      )}

      {editing ? (
        <GameBuilder
          game={editing}
          packs={packs}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
          onClose={() => setEditing(null)}
        />
      ) : games === null ? (
        <p className="text-soft font-body font-bold">Загружаем…</p>
      ) : games.length === 0 ? (
        <p className="text-soft font-body font-bold">
          Игр пока нет. Соберите первую из своих паков.
        </p>
      ) : (
        <ul className="grid gap-3">
          {games.map((game) => (
            <li
              key={game.id}
              className="on-paper ink-border bg-card text-ink relative flex flex-wrap items-center gap-3 rounded-3xl px-5 py-4"
              style={{ boxShadow: '5px 5px 0 #1a1a1a' }}
            >
              <div className="min-w-0 flex-1">
                <span className="font-pop block text-xl font-black">{game.title}</span>
                <span className="text-soft block text-sm">
                  {game.roundsCount} раунда · {game.themesCount} тем ·{' '}
                  {game.modifiersPerRound > 0
                    ? `модификаторов на раунд: ${game.modifiersPerRound}`
                    : 'без модификаторов'}
                </span>
                {!game.playable && (
                  <span className="text-no-ink block text-sm font-bold">
                    Потерялось тем: {game.missingRefs} — откройте и пересоберите состав
                  </span>
                )}
              </div>
              {confirmId === game.id ? (
                <>
                  <button
                    type="button"
                    onClick={() => destroy(game.id)}
                    className="btn btn-danger shrink-0 px-3 text-sm"
                  >
                    Удалить насовсем
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmId(null)}
                    className="btn shrink-0 px-3 text-sm"
                  >
                    Отмена
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => open(game.id)}
                    className="btn bg-p4 shrink-0 px-3 text-sm"
                  >
                    Открыть
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmId(game.id)}
                    className="btn shrink-0 px-3 text-sm hover:border-no hover:text-no-ink"
                  >
                    Удалить
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {!editing && (
        <Link
          to="/"
          className="text-soft font-body w-fit text-sm font-bold underline underline-offset-4"
        >
          На главную
        </Link>
      )}
    </div>
  );
}
