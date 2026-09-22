import { useCallback, useEffect, useRef, useState } from 'react';
import {
  GAME_LIMITS,
  type Game,
  type GameRecipe,
  type PackSummary,
  type RecipeResolution,
} from '@svoyak/shared';
import { composeGame } from '../net/gameApi.js';
import { fetchGameComposition, saveGame } from './api.js';
import { ModifierPicker } from './ModifierPicker.js';

interface GameBuilderProps {
  game: Game;
  packs: PackSummary[];
  onSaved: (game: Game) => void;
  onClose: () => void;
}

const [ROUNDS_MIN, ROUNDS_MAX] = GAME_LIMITS.rounds;
const [THEMES_MIN, THEMES_MAX] = GAME_LIMITS.themesPerRound;
const [FINAL_MIN, FINAL_MAX] = GAME_LIMITS.finalThemes;

/** Конструктор одной игры: паки → состав → модификаторы → сохранить.
 *
 *  Состав — не производная от полей формы, а собственное состояние
 *  (`recipe`/`preview`). У уже сохранённой игры открытие показывает именно
 *  тот состав, с которым она была сохранена: пересборка — только по кнопке
 *  «Пересобрать состав». Иначе переименование тихо перебрасывает темы (сервер
 *  без явного seed сам бросает кубик), а «Сохранить игру» затирает исходную
 *  сборку составом, который хост не просил. */
export function GameBuilder({ game, packs, onSaved, onClose }: GameBuilderProps) {
  const [title, setTitle] = useState(game.title);
  const [selected, setSelected] = useState<string[]>([]);
  const [rounds, setRounds] = useState(Math.max(1, game.recipe.rounds.length || 2));
  const [themesPerRound, setThemesPerRound] = useState(
    Math.max(1, game.recipe.rounds[0]?.length ?? 4),
  );
  const [finalThemes, setFinalThemes] = useState(Math.max(1, game.recipe.final.length || 3));
  const [modifiers, setModifiers] = useState(game.modifiers);
  const [recipe, setRecipe] = useState<GameRecipe>(game.recipe);
  const [preview, setPreview] = useState<RecipeResolution | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // У новой игры (`+ собрать игру`) рецепт пуст — показывать нечего, и первый
  // состав нужен сразу. У уже сохранённой — рецепт не пуст, и это ровно то,
  // что должно остаться на экране до явной пересборки.
  const hasSavedComposition = game.recipe.rounds.length > 0;

  // `packs` приходит от родителя асинхронно: на момент первого рендера конструктора
  // список может быть ещё пуст. У сохранённой игры уже есть состав — выбор паков
  // выводим из него (иначе повторное открытие подменяет паки на "первые три" и
  // «Пересобрать состав» соберёт не то). Пустой рецепт (только что созданная
  // игра) — единственный случай, когда берём дефолт. Раз выставленный выбор не
  // трогаем, даже когда `packs` потом обновится.
  const defaulted = useRef(false);
  useEffect(() => {
    if (defaulted.current || packs.length === 0) return;
    defaulted.current = true;
    const fromRecipe = Array.from(
      new Set(game.recipe.rounds.flat().concat(game.recipe.final).map((ref) => ref.packId)),
    );
    setSelected(
      fromRecipe.length > 0
        ? fromRecipe
        : packs.filter((pack) => pack.playable).slice(0, 3).map((pack) => pack.id),
    );
  }, [packs, game]);

  // Открытие уже собранной игры показывает её собственный состав — сервер
  // подписывает те же ссылки именами тем, ничего не бросая заново.
  useEffect(() => {
    if (!hasSavedComposition) return;
    let cancelled = false;
    setBusy(true);
    void fetchGameComposition(game.id)
      .then((resolution) => {
        if (!cancelled) setPreview(resolution);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Не удалось открыть состав игры');
        }
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [game.id, hasSavedComposition]);

  const compose = useCallback(() => {
    if (selected.length === 0) {
      setError('Выберите хотя бы один пак');
      return;
    }
    setBusy(true);
    void composeGame({ packIds: selected, rounds, themesPerRound, finalThemes })
      .then((response) => {
        setRecipe(response.recipe);
        setPreview({ rounds: response.rounds, final: response.final });
        setError(null);
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Не удалось собрать состав'),
      )
      .finally(() => setBusy(false));
  }, [selected, rounds, themesPerRound, finalThemes]);

  // Только для только что созданной игры: показать хоть какой-то состав сразу,
  // не дожидаясь ручной «Пересобрать состав». Дальше — только по кнопке или
  // изменению паков/чисел, которые «Пересобрать состав» использует при клике.
  const autoComposed = useRef(false);
  useEffect(() => {
    if (hasSavedComposition || autoComposed.current || selected.length === 0) return;
    autoComposed.current = true;
    compose();
  }, [hasSavedComposition, selected, compose]);

  const togglePack = (id: string): void =>
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );

  const save = (): void => {
    if (recipe.rounds.length === 0) return;
    setBusy(true);
    void saveGame({ ...game, title: title.trim() || 'Новая игра', recipe, modifiers })
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
            min={ROUNDS_MIN}
            max={ROUNDS_MAX}
            value={rounds}
            onChange={(event) =>
              setRounds(Math.min(ROUNDS_MAX, Math.max(ROUNDS_MIN, Number(event.target.value) || ROUNDS_MIN)))
            }
            className="ink-border bg-paper rounded-xl px-3 py-2 tabular-nums"
          />
        </label>
        <label className="font-body grid gap-1 text-sm font-bold">
          <span>Тем в раунде</span>
          <input
            type="number"
            min={THEMES_MIN}
            max={THEMES_MAX}
            value={themesPerRound}
            onChange={(event) =>
              setThemesPerRound(
                Math.min(THEMES_MAX, Math.max(THEMES_MIN, Number(event.target.value) || THEMES_MIN)),
              )
            }
            className="ink-border bg-paper rounded-xl px-3 py-2 tabular-nums"
          />
        </label>
        <label className="font-body grid gap-1 text-sm font-bold">
          <span>Тем в финале</span>
          <input
            type="number"
            min={FINAL_MIN}
            max={FINAL_MAX}
            value={finalThemes}
            onChange={(event) =>
              setFinalThemes(Math.min(FINAL_MAX, Math.max(FINAL_MIN, Number(event.target.value) || FINAL_MIN)))
            }
            className="ink-border bg-paper rounded-xl px-3 py-2 tabular-nums"
          />
        </label>
      </section>

      <ModifierPicker plan={modifiers} onChange={setModifiers} />

      {preview && (
        <section className="ink-border bg-card text-ink grid gap-2 rounded-2xl p-4">
          {preview.rounds.map((round, index) => (
            <p key={index} className="font-body text-sm font-bold">
              Раунд {index + 1}: {round.map((theme) => theme?.title ?? '— тема недоступна —').join(', ')}
            </p>
          ))}
          <p className="font-body text-sm font-bold opacity-70">
            Финал: {preview.final.map((theme) => theme?.title ?? '— тема недоступна —').join(', ')}
          </p>
        </section>
      )}

      {error && <p className="font-body text-no text-sm font-bold">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={compose}
          disabled={busy}
          className="ink-border bg-card text-ink font-body rounded-2xl px-4 py-2 text-sm font-bold"
        >
          Пересобрать состав
        </button>
        <button
          type="button"
          onClick={save}
          disabled={busy || recipe.rounds.length === 0}
          className="ink-border bg-gold text-ink font-body rounded-2xl px-4 py-2 text-sm font-bold"
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
