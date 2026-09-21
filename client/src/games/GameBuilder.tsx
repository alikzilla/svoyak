import { useCallback, useEffect, useRef, useState } from 'react';
import type { ComposeResponse, Game, PackSummary } from '@svoyak/shared';
import { composeGame } from '../net/gameApi.js';
import { saveGame } from './api.js';
import { ModifierPicker } from './ModifierPicker.js';

interface GameBuilderProps {
  game: Game;
  packs: PackSummary[];
  onSaved: (game: Game) => void;
  onClose: () => void;
}

/** Конструктор одной игры: паки → состав → модификаторы → сохранить. */
export function GameBuilder({ game, packs, onSaved, onClose }: GameBuilderProps) {
  const [title, setTitle] = useState(game.title);
  const [selected, setSelected] = useState<string[]>([]);
  const [rounds, setRounds] = useState(Math.max(1, game.recipe.rounds.length || 2));
  const [themesPerRound, setThemesPerRound] = useState(
    Math.max(1, game.recipe.rounds[0]?.length ?? 4),
  );
  const [finalThemes, setFinalThemes] = useState(Math.max(1, game.recipe.final.length || 3));
  const [modifiers, setModifiers] = useState(game.modifiers);
  const [draft, setDraft] = useState<ComposeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // `packs` приходит от родителя асинхронно: на момент первого рендера конструктора
  // список может быть ещё пуст. Раз выставленный выбор не трогаем, даже когда
  // `packs` потом обновится (перезагрузится, изменится порядок и т. п.).
  const defaulted = useRef(false);
  useEffect(() => {
    if (defaulted.current || packs.length === 0) return;
    defaulted.current = true;
    setSelected(packs.filter((pack) => pack.playable).slice(0, 3).map((pack) => pack.id));
  }, [packs]);

  const compose = useCallback(() => {
    if (selected.length === 0) {
      setDraft(null);
      setError('Выберите хотя бы один пак');
      return;
    }
    setBusy(true);
    void composeGame({ packIds: selected, rounds, themesPerRound, finalThemes })
      .then((response) => {
        setDraft(response);
        setError(null);
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Не удалось собрать состав'),
      )
      .finally(() => setBusy(false));
  }, [selected, rounds, themesPerRound, finalThemes]);

  useEffect(compose, [compose]);

  const togglePack = (id: string): void =>
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );

  const save = (): void => {
    if (!draft) return;
    setBusy(true);
    void saveGame({ ...game, title: title.trim() || 'Новая игра', recipe: draft.recipe, modifiers })
      .then(onSaved)
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Не удалось сохранить игру'),
      )
      .finally(() => setBusy(false));
  };

  return (
    <div className="grid gap-4">
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Название игры"
        className="ink-border bg-card text-ink font-pop rounded-2xl px-4 py-3 text-xl font-black"
      />

      <section className="ink-border bg-card text-ink grid gap-2 rounded-2xl p-4">
        <span className="font-body text-sm font-bold">Из каких паков</span>
        <div className="grid gap-1 sm:grid-cols-2">
          {packs.map((pack) => (
            <label key={pack.id} className="font-body flex items-center gap-2 text-sm font-bold">
              <input
                type="checkbox"
                className="size-4"
                disabled={!pack.playable}
                checked={selected.includes(pack.id)}
                onChange={() => togglePack(pack.id)}
              />
              <span className={pack.playable ? '' : 'opacity-40'}>{pack.title}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="ink-border bg-card text-ink grid gap-3 rounded-2xl p-4 sm:grid-cols-3">
        <label className="font-body grid gap-1 text-sm font-bold">
          <span>Раундов</span>
          <input
            type="number"
            min={1}
            max={5}
            value={rounds}
            onChange={(event) => setRounds(Number(event.target.value) || 1)}
            className="ink-border bg-paper rounded-xl px-3 py-2 tabular-nums"
          />
        </label>
        <label className="font-body grid gap-1 text-sm font-bold">
          <span>Тем в раунде</span>
          <input
            type="number"
            min={1}
            max={8}
            value={themesPerRound}
            onChange={(event) => setThemesPerRound(Number(event.target.value) || 1)}
            className="ink-border bg-paper rounded-xl px-3 py-2 tabular-nums"
          />
        </label>
        <label className="font-body grid gap-1 text-sm font-bold">
          <span>Тем в финале</span>
          <input
            type="number"
            min={1}
            max={8}
            value={finalThemes}
            onChange={(event) => setFinalThemes(Number(event.target.value) || 1)}
            className="ink-border bg-paper rounded-xl px-3 py-2 tabular-nums"
          />
        </label>
      </section>

      <ModifierPicker plan={modifiers} onChange={setModifiers} />

      {draft && (
        <section className="ink-border bg-card text-ink grid gap-2 rounded-2xl p-4">
          {draft.rounds.map((round, index) => (
            <p key={index} className="font-body text-sm font-bold">
              Раунд {index + 1}: {round.map((theme) => theme.title).join(', ')}
            </p>
          ))}
          <p className="font-body text-sm font-bold opacity-70">
            Финал: {draft.final.map((theme) => theme.title).join(', ')}
          </p>
        </section>
      )}

      {error && <p className="font-body text-bad text-sm font-bold">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={compose}
          disabled={busy}
          className="ink-border bg-card font-body rounded-2xl px-4 py-2 text-sm font-bold"
        >
          Пересобрать состав
        </button>
        <button
          type="button"
          onClick={save}
          disabled={busy || !draft}
          className="ink-border bg-gold font-body rounded-2xl px-4 py-2 text-sm font-bold"
        >
          Сохранить игру
        </button>
        <button
          type="button"
          onClick={onClose}
          className="font-body text-sm font-bold underline underline-offset-4 opacity-70"
        >
          закрыть
        </button>
      </div>
    </div>
  );
}
