import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Layers, Plus, Trash2, AlertCircle } from 'lucide-react';
import type { Game, GameSummary, PackSummary } from '@svoyak/shared';
import { listPacks } from '../editor/api.js';
import { createGame, fetchGame, listGames, removeGame } from '../games/api.js';
import { GameBuilder } from '../games/GameBuilder.js';
import { roundsWord, themesWord } from '../ui/host/GameSetup.js';
import { PageHeader, Shell } from '../workspace/Shell.js';
import { ConfirmDelete, EmptyState, Notice } from '../workspace/ui.js';

/** Игры: пак — это содержимое, игра — состав вечера, собранный из паков. */
export default function Games() {
  const [games, setGames] = useState<GameSummary[] | null>(null);
  const [packs, setPacks] = useState<PackSummary[]>([]);
  const [editing, setEditing] = useState<Game | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = (): void => {
    void listGames()
      .then(setGames)
      .catch((cause: unknown) => {
        setGames([]);
        setError(cause instanceof Error ? cause.message : 'Не удалось загрузить игры');
      });
  };

  useEffect(() => {
    reload();
    void listPacks()
      .then(setPacks)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Не удалось загрузить паки'));
  }, []);

  const add = (): void => {
    void createGame('Новая игра')
      .then(setEditing)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Не удалось создать игру'));
  };

  const open = (id: string): void => {
    void fetchGame(id)
      .then(setEditing)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Не удалось открыть игру'));
  };

  const destroy = (id: string): void => {
    void removeGame(id)
      .then(reload)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Не удалось удалить игру'));
  };

  if (editing) {
    return (
      <Shell>
        <button
          type="button"
          onClick={() => setEditing(null)}
          className="text-ws-soft hover:text-ws-fg mb-3 inline-flex w-fit items-center gap-1.5 text-sm font-medium"
        >
          <ArrowLeft size={16} aria-hidden />
          Все игры
        </button>
        <GameBuilder
          game={editing}
          packs={packs}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
          onClose={() => setEditing(null)}
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <PageHeader
        title="Игры"
        description="Игра — это состав вечера: темы из нескольких паков, финал и модификаторы. Сохранённую игру можно выбрать, когда создаёте комнату."
        actions={
          <button type="button" onClick={add} className="ws-btn ws-btn-primary">
            <Plus aria-hidden />
            Собрать игру
          </button>
        }
      />

      {error && (
        <div className="mb-6">
          <Notice>{error}</Notice>
        </div>
      )}

      {games === null ? (
        <div className="ws-card divide-ws-line divide-y" aria-busy>
          {[0, 1].map((row) => (
            <div key={row} className="grid gap-2 px-5 py-4">
              <div className="bg-ws-sunken h-4 w-48 animate-pulse rounded" />
              <div className="bg-ws-sunken h-3 w-64 animate-pulse rounded" />
            </div>
          ))}
        </div>
      ) : games.length === 0 ? (
        <EmptyState
          icon={<Layers aria-hidden />}
          title="Игр пока нет"
          action={
            <button type="button" onClick={add} className="ws-btn ws-btn-primary">
              <Plus aria-hidden />
              Собрать первую игру
            </button>
          }
        >
          Отметьте паки, задайте число раундов и тем — состав соберётся сам. Сохранённую игру не
          придётся собирать заново перед каждым вечером.
        </EmptyState>
      ) : (
        <ul className="ws-card divide-ws-line divide-y overflow-hidden">
          {games.map((game) => (
            <li
              key={game.id}
              className="hover:bg-ws-hover relative flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 transition-colors"
            >
              <div className="grid min-w-0 flex-1 basis-64 gap-1">
                <button
                  type="button"
                  onClick={() => open(game.id)}
                  className="truncate text-left text-[1rem] font-semibold after:absolute after:inset-0 hover:underline"
                >
                  {game.title}
                </button>
                <span className="text-ws-faint num text-[0.8125rem]">
                  {game.roundsCount} {roundsWord(game.roundsCount)} · {game.themesCount} {themesWord(game.themesCount)} ·{' '}
                  {game.modifiersPerRound > 0
                    ? `модификаторов на раунд: ${game.modifiersPerRound}`
                    : 'без модификаторов'}
                </span>
              </div>
              {game.playable ? (
                <span className="ws-badge ws-badge-yes">
                  <Check aria-hidden />
                  готова
                </span>
              ) : (
                <span className="ws-badge ws-badge-warn" title="Откройте игру и пересоберите состав">
                  <AlertCircle aria-hidden />
                  потерялось тем: {game.missingRefs}
                </span>
              )}
              <span className="relative z-10">
                <ConfirmDelete
                  icon={<Trash2 aria-hidden />}
                  title={`Удалить игру «${game.title}»`}
                  onConfirm={() => destroy(game.id)}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}
