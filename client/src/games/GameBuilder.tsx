import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Shuffle } from 'lucide-react';
import type { Game, GameRecipe, PackSummary, RecipeResolution } from '@svoyak/shared';
import { composeGame } from '../net/gameApi.js';
import { CompositionView, PackChecklist, SizeControls } from '../ui/host/GameSetup.js';
import { Notice } from '../workspace/ui.js';
import { fetchGameComposition, saveGame } from './api.js';
import { ModifierPicker } from './ModifierPicker.js';

interface GameBuilderProps {
  game: Game;
  packs: PackSummary[];
  onSaved: (game: Game) => void;
  onClose: () => void;
}

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
  const [themesPerRound, setThemesPerRound] = useState(Math.max(1, game.recipe.rounds[0]?.length ?? 4));
  const [finalThemes, setFinalThemes] = useState(Math.max(1, game.recipe.final.length || 3));
  const [modifiers, setModifiers] = useState(game.modifiers);
  const [recipe, setRecipe] = useState<GameRecipe>(game.recipe);
  const [preview, setPreview] = useState<RecipeResolution | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Паки или размер поменялись после сборки: состав на экране уже не им соответствует.
  const [stale, setStale] = useState(false);

  // У новой игры (`Собрать игру`) рецепт пуст — показывать нечего, и первый
  // состав нужен сразу. У уже сохранённой — рецепт не пуст, и это ровно то,
  // что должно остаться на экране до явной пересборки.
  const hasSavedComposition = game.recipe.rounds.length > 0;

  // `packs` приходит от родителя асинхронно. У сохранённой игры выбор паков
  // выводим из её состава; пустой рецепт — единственный случай, когда берём
  // первые три готовых пака. Раз выставленный выбор не трогаем.
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
        : packs
            .filter((pack) => pack.playable)
            .slice(0, 3)
            .map((pack) => pack.id),
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
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Не удалось открыть состав игры');
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
        setStale(false);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Не удалось собрать состав'))
      .finally(() => setBusy(false));
  }, [selected, rounds, themesPerRound, finalThemes]);

  // Только для только что созданной игры: показать состав сразу.
  const autoComposed = useRef(false);
  useEffect(() => {
    if (hasSavedComposition || autoComposed.current || selected.length === 0) return;
    autoComposed.current = true;
    compose();
  }, [hasSavedComposition, selected, compose]);

  const touch =
    <T,>(setter: (value: T) => void) =>
    (value: T): void => {
      setter(value);
      setStale(true);
    };

  const togglePack = (id: string): void => {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
    setStale(true);
  };

  const save = (): void => {
    if (recipe.rounds.length === 0) return;
    setBusy(true);
    void saveGame({ ...game, title: title.trim() || 'Новая игра', recipe, modifiers })
      .then(onSaved)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Не удалось сохранить игру'))
      .finally(() => setBusy(false));
  };

  return (
    <div className="grid gap-6">
      <label>
        <span className="sr-only">Название игры</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Название игры"
          className="ws-input-bare text-[1.625rem] leading-tight font-semibold tracking-tight"
        />
      </label>

      {error && <Notice>{error}</Notice>}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid min-w-0 gap-6">
          <section className="ws-card">
            <header className="ws-card-head">
              <h2 className="ws-card-title">Из каких паков</h2>
              <span className="text-ws-faint num ml-auto text-[0.8125rem]">
                выбрано {selected.length} из {packs.length}
              </span>
            </header>
            <div className="px-3 py-2">
              {packs.length === 0 ? (
                <p className="text-ws-soft px-3 py-2 text-sm">Паков пока нет — соберите первый в редакторе.</p>
              ) : (
                <PackChecklist packs={packs} selected={selected} onToggle={togglePack} />
              )}
            </div>
          </section>

          <section className="ws-card">
            <header className="ws-card-head">
              <h2 className="ws-card-title">Размер игры</h2>
            </header>
            <div className="p-4 sm:p-5">
              <SizeControls
                rounds={rounds}
                themesPerRound={themesPerRound}
                finalThemes={finalThemes}
                onRounds={touch(setRounds)}
                onThemesPerRound={touch(setThemesPerRound)}
                onFinalThemes={touch(setFinalThemes)}
              />
            </div>
          </section>

          <section className="ws-card">
            <header className="ws-card-head">
              <h2 className="ws-card-title">Модификаторы</h2>
              <span className="text-ws-faint ml-auto text-[0.8125rem]">сюрпризы вместо вопросов</span>
            </header>
            <div className="p-4 sm:p-5">
              <ModifierPicker plan={modifiers} onChange={setModifiers} />
            </div>
          </section>
        </div>

        <aside className="ws-card lg:sticky lg:top-20" aria-label="Состав игры">
          <header className="ws-card-head">
            <h2 className="ws-card-title">Состав</h2>
            <button
              type="button"
              onClick={compose}
              disabled={busy || selected.length === 0}
              title={selected.length === 0 ? 'Сначала выберите хотя бы один пак' : 'Собрать темы заново'}
              className="ws-btn ws-btn-sm ml-auto"
            >
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Shuffle aria-hidden />}
              Пересобрать
            </button>
          </header>
          <div className="grid max-h-[calc(100dvh-17rem)] gap-4 overflow-y-auto p-4 sm:p-5">
            {stale && preview && (
              <Notice tone="info">Паки или размер изменились — нажмите «Пересобрать», чтобы обновить состав.</Notice>
            )}
            {preview ? (
              <CompositionView rounds={preview.rounds} final={preview.final} busy={busy} />
            ) : (
              <p className="text-ws-soft text-sm">
                {busy ? 'Собираем состав…' : 'Состав ещё не собран — нажмите «Пересобрать».'}
              </p>
            )}
          </div>
          <footer className="border-ws-line grid gap-2 border-t p-4">
            <button
              type="button"
              onClick={save}
              disabled={busy || recipe.rounds.length === 0}
              className="ws-btn ws-btn-primary ws-btn-lg w-full"
            >
              Сохранить игру
            </button>
            <button type="button" onClick={onClose} className="ws-btn ws-btn-ghost w-full">
              Закрыть без сохранения
            </button>
          </footer>
        </aside>
      </div>
    </div>
  );
}
