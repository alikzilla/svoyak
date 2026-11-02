import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Shuffle } from 'lucide-react';
import type { ComposeResponse, GameRecipe, PackSummary, ThemeOption } from '@svoyak/shared';
import { GAME_LIMITS } from '@svoyak/shared';
import { composeGame } from '../../net/gameApi.js';
import { Stepper } from '../../workspace/ui.js';
import { pluralWord } from '../../history/plural.js';

export const themesWord = (count: number): string => pluralWord(count, ['тема', 'темы', 'тем']);
export const questionsWord = (count: number): string =>
  pluralWord(count, ['вопрос', 'вопроса', 'вопросов']);
export const roundsWord = (count: number): string => pluralWord(count, ['раунд', 'раунда', 'раундов']);
export const packsWord = (count: number): string => pluralWord(count, ['пак', 'пака', 'паков']);

/**
 * Черновик состава: какие паки берём, сколько раундов и тем, что в итоге
 * выпало. Состав считает сервер — только он знает содержимое паков.
 */
export function useComposer(packs: PackSummary[], onRecipeChange: (recipe: GameRecipe | null) => void) {
  const [selected, setSelected] = useState<string[]>(() =>
    packs
      .filter((pack) => pack.playable)
      .slice(0, 3)
      .map((pack) => pack.id),
  );
  const [rounds, setRounds] = useState(2);
  const [themesPerRound, setThemesPerRound] = useState(4);
  const [finalThemes, setFinalThemes] = useState(3);
  const [draft, setDraft] = useState<ComposeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const compose = useCallback(
    (seed?: number) => {
      if (selected.length === 0) {
        setDraft(null);
        setError(null);
        onRecipeChange(null);
        return;
      }
      setBusy(true);
      composeGame({
        packIds: selected,
        rounds,
        themesPerRound,
        finalThemes,
        ...(seed === undefined ? {} : { seed }),
      })
        .then((response) => {
          setDraft(response);
          setError(null);
          onRecipeChange(response.recipe);
        })
        .catch((cause: unknown) => {
          setDraft(null);
          setError(cause instanceof Error ? cause.message : 'Не удалось собрать игру');
          onRecipeChange(null);
        })
        .finally(() => setBusy(false));
    },
    [selected, rounds, themesPerRound, finalThemes, onRecipeChange],
  );

  useEffect(compose, [compose]);

  const togglePack = (id: string): void =>
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );

  /** Меняет одну тему на запасную, не трогая остальной состав. */
  const replaceTheme = (roundIndex: number, themeIndex: number): void => {
    if (!draft || draft.pool.length === 0) return;
    const [replacement, ...rest] = draft.pool;
    if (!replacement) return;
    const dropped = draft.rounds[roundIndex]?.[themeIndex];
    if (!dropped) return;

    const nextRounds = draft.rounds.map((round, index) =>
      index !== roundIndex
        ? round
        : round.map((theme, position) => (position === themeIndex ? replacement : theme)),
    );
    const next: ComposeResponse = {
      ...draft,
      rounds: nextRounds,
      // Заменённая тема уходит в конец запаса: к ней можно вернуться.
      pool: [...rest, dropped],
      recipe: {
        ...draft.recipe,
        rounds: nextRounds.map((round) =>
          round.map((theme) => ({ packId: theme.packId, themeId: theme.themeId })),
        ),
      },
    };
    setDraft(next);
    onRecipeChange(next.recipe);
  };

  return {
    selected,
    togglePack,
    rounds,
    setRounds,
    themesPerRound,
    setThemesPerRound,
    finalThemes,
    setFinalThemes,
    draft,
    error,
    busy,
    reshuffle: () => compose(Math.floor(Math.random() * 2 ** 31)),
    replaceTheme,
  };
}

/** Список паков с флажками. Недоделанный пак виден, но выбрать его нельзя. */
export function PackChecklist({
  packs,
  selected,
  onToggle,
}: {
  packs: PackSummary[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <ul className="-mx-1 grid gap-0.5">
      {packs.map((pack) => (
        <li key={pack.id}>
          <label className="ws-option">
            <input
              type="checkbox"
              className="ws-check"
              disabled={!pack.playable}
              checked={selected.includes(pack.id)}
              onChange={() => onToggle(pack.id)}
            />
            <span className="grid min-w-0 flex-1 gap-0.5">
              <span className={`text-[0.9375rem] font-medium ${pack.playable ? '' : 'text-ws-faint'}`}>
                {pack.title}
              </span>
              <span className="text-ws-faint num text-[0.8125rem]">
                {pack.questionsCount} {questionsWord(pack.questionsCount)} · финал из{' '}
                {pack.finalThemesCount}
              </span>
            </span>
            {!pack.playable && (
              <span className="flex shrink-0 items-center gap-2">
                <span className="ws-badge ws-badge-warn">не дозаполнен</span>
                <Link to={`/editor/${pack.id}`} className="text-ws-accent-ink text-[0.8125rem] font-medium">
                  Дописать
                </Link>
              </span>
            )}
          </label>
        </li>
      ))}
    </ul>
  );
}

export function SizeControls({
  rounds,
  themesPerRound,
  finalThemes,
  onRounds,
  onThemesPerRound,
  onFinalThemes,
}: {
  rounds: number;
  themesPerRound: number;
  finalThemes: number;
  onRounds: (value: number) => void;
  onThemesPerRound: (value: number) => void;
  onFinalThemes: (value: number) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Stepper
        label="Раундов"
        value={rounds}
        min={GAME_LIMITS.rounds[0]}
        max={GAME_LIMITS.rounds[1]}
        onChange={onRounds}
      />
      <Stepper
        label="Тем в раунде"
        value={themesPerRound}
        min={GAME_LIMITS.themesPerRound[0]}
        max={GAME_LIMITS.themesPerRound[1]}
        onChange={onThemesPerRound}
      />
      <Stepper
        label="Тем в финале"
        value={finalThemes}
        min={GAME_LIMITS.finalThemes[0]}
        max={GAME_LIMITS.finalThemes[1]}
        onChange={onFinalThemes}
        hint="игроки уберут лишние"
      />
    </div>
  );
}

/**
 * Что получилось: раунды со своими темами и финал. Пустое место (тема
 * потерялась вместе с паком) остаётся на виду, а не пропадает молча.
 */
export function CompositionView({
  rounds,
  final,
  onReplace,
  canReplace = false,
  onReshuffle,
  busy = false,
}: {
  rounds: Array<Array<ThemeOption | null>>;
  final: Array<ThemeOption | null>;
  onReplace?: (roundIndex: number, themeIndex: number) => void;
  canReplace?: boolean;
  onReshuffle?: () => void;
  busy?: boolean;
}) {
  return (
    <div className={`grid gap-5 transition-opacity ${busy ? 'opacity-60' : ''}`} aria-busy={busy}>
      {rounds.map((round, roundIndex) => (
        <section key={roundIndex} className="grid gap-1.5">
          <header className="flex items-baseline justify-between gap-3">
            <h3 className="text-[0.8125rem] font-semibold">Раунд {roundIndex + 1}</h3>
            <span className="text-ws-faint num text-xs">
              {100 * (roundIndex + 1)}–{500 * (roundIndex + 1)} · {round.length} {themesWord(round.length)}
            </span>
          </header>
          <ul className="grid">
            {round.map((theme, themeIndex) => (
              <ThemeRow
                key={theme ? `${theme.packId}-${theme.themeId}` : `missing-${themeIndex}`}
                theme={theme}
                {...(onReplace
                  ? { onReplace: () => onReplace(roundIndex, themeIndex), canReplace }
                  : {})}
              />
            ))}
          </ul>
        </section>
      ))}
      <section className="grid gap-1.5">
        <header className="flex items-baseline justify-between gap-3">
          <h3 className="text-[0.8125rem] font-semibold">Финал</h3>
          <span className="text-ws-faint num text-xs">
            {final.length} {themesWord(final.length)}
          </span>
        </header>
        <ul className="grid">
          {final.map((theme, index) => (
            <ThemeRow key={theme ? `${theme.packId}-${theme.themeId}` : `missing-${index}`} theme={theme} />
          ))}
        </ul>
      </section>
      {onReshuffle && (
        <button
          type="button"
          onClick={onReshuffle}
          disabled={busy}
          className="ws-btn ws-btn-sm justify-self-start"
        >
          <Shuffle aria-hidden />
          Перемешать темы
        </button>
      )}
    </div>
  );
}

function ThemeRow({
  theme,
  onReplace,
  canReplace = false,
}: {
  theme: ThemeOption | null;
  onReplace?: () => void;
  canReplace?: boolean;
}) {
  if (!theme) {
    return (
      <li className="text-ws-no-ink border-ws-line border-b py-2 text-sm last:border-b-0">
        тема недоступна — пак удалён или изменён
      </li>
    );
  }
  return (
    <li className="group border-ws-line flex items-center gap-2 border-b py-1.5 last:border-b-0">
      <span className="grid min-w-0 flex-1">
        <span className="truncate text-sm font-medium" title={theme.title}>
          {theme.title}
        </span>
        <span className="text-ws-faint truncate text-xs" title={theme.packTitle}>
          {theme.packTitle}
        </span>
      </span>
      {onReplace && (
        <button
          type="button"
          onClick={onReplace}
          disabled={!canReplace}
          title={canReplace ? 'Заменить на другую тему' : 'Запасных тем не осталось'}
          aria-label={`Заменить тему «${theme.title}»`}
          className="ws-btn ws-btn-ghost ws-btn-sm ws-btn-icon opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
        >
          <RefreshCw aria-hidden />
        </button>
      )}
    </li>
  );
}
