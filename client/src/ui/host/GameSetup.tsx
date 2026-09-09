import { useCallback, useEffect, useState } from 'react';
import type { ComposeResponse, GameRecipe, PackSummary, ThemeOption } from '@svoyak/shared';
import { composeGame } from '../../net/gameApi.js';

interface GameSetupProps {
  packs: PackSummary[];
  /** Отдаёт наверх готовый состав: кнопка «создать» или «применить» живёт снаружи. */
  onRecipeChange: (recipe: GameRecipe | null) => void;
}

const LIMITS = { rounds: [1, 5], themesPerRound: [1, 8], finalThemes: [1, 8] } as const;

const clamp = (value: number, [min, max]: readonly [number, number]): number =>
  Math.min(max, Math.max(min, value));

function Stepper({
  label,
  value,
  bounds,
  onChange,
}: {
  label: string;
  value: number;
  bounds: readonly [number, number];
  onChange: (value: number) => void;
}) {
  return (
    <div className="ink-border bg-card text-ink flex items-center justify-between gap-3 rounded-2xl px-4 py-2">
      <span className="font-body text-sm font-bold">{label}</span>
      <span className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`${label}: меньше`}
          onClick={() => onChange(clamp(value - 1, bounds))}
          className="ink-border size-8 rounded-lg font-black"
        >
          −
        </button>
        <span className="font-pop w-6 text-center text-xl font-black tabular-nums">{value}</span>
        <button
          type="button"
          aria-label={`${label}: больше`}
          onClick={() => onChange(clamp(value + 1, bounds))}
          className="ink-border size-8 rounded-lg font-black"
        >
          +
        </button>
      </span>
    </div>
  );
}

/** Мастер состава: какие паки берём, сколько раундов и тем, что в итоге вышло. */
export function GameSetup({ packs, onRecipeChange }: GameSetupProps) {
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
        setError('Выберите хотя бы один пак');
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

  const themesAvailable = packs
    .filter((pack) => selected.includes(pack.id))
    .reduce((sum, pack) => sum + pack.questionsCount / 5, 0);

  return (
    <div className="grid gap-4">
      <section className="grid gap-2">
        <h3 className="font-pop text-lg font-black">Паки</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {packs.map((pack) => {
            const active = selected.includes(pack.id);
            return (
              <button
                key={pack.id}
                type="button"
                disabled={!pack.playable}
                title={pack.playable ? pack.title : 'Пак не дозаполнен — его нельзя взять в игру'}
                onClick={() => togglePack(pack.id)}
                style={{ boxShadow: active ? '5px 5px 0 #1a1a1a' : '3px 3px 0 #1a1a1a' }}
                className={`ink-border text-ink rounded-2xl px-3 py-2 text-left ${
                  active ? 'bg-p3' : 'bg-card'
                } ${pack.playable ? '' : 'cursor-not-allowed opacity-40'}`}
              >
                <span className="font-pop block truncate text-base font-black">{pack.title}</span>
                <span className="font-body block text-xs font-bold opacity-70">
                  {pack.playable
                    ? `${pack.questionsCount} вопросов · финал из ${pack.finalThemesCount}`
                    : 'не дозаполнен'}
                </span>
              </button>
            );
          })}
        </div>
        <p className="font-body text-xs font-bold opacity-60">
          Выбрано паков: {selected.length}, тем в них примерно {Math.round(themesAvailable)}
        </p>
      </section>

      <section className="grid gap-2 sm:grid-cols-3">
        <Stepper label="Раундов" value={rounds} bounds={LIMITS.rounds} onChange={setRounds} />
        <Stepper
          label="Тем в раунде"
          value={themesPerRound}
          bounds={LIMITS.themesPerRound}
          onChange={setThemesPerRound}
        />
        <Stepper
          label="Тем в финале"
          value={finalThemes}
          bounds={LIMITS.finalThemes}
          onChange={setFinalThemes}
        />
      </section>

      {error && (
        <p className="ink-border bg-no font-body rounded-2xl px-4 py-3 font-bold text-white">
          {error}
        </p>
      )}

      {draft && (
        <section className="grid gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-pop text-lg font-black">Что получилось</h3>
            <button
              type="button"
              disabled={busy}
              onClick={() => compose(Math.floor(Math.random() * 2 ** 31))}
              className="font-body text-sm font-bold underline underline-offset-4 opacity-70 disabled:opacity-40"
            >
              пересобрать всё
            </button>
          </div>

          {draft.rounds.map((round, roundIndex) => (
            <div key={roundIndex} className="grid gap-2">
              <p className="font-body text-sm font-bold opacity-70">
                Раунд {roundIndex + 1} · цены {100 * (roundIndex + 1)}–{500 * (roundIndex + 1)}
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {round.map((theme, themeIndex) => (
                  <ThemeChip
                    key={`${theme.packId}-${theme.themeId}`}
                    theme={theme}
                    canReplace={draft.pool.length > 0}
                    onReplace={() => replaceTheme(roundIndex, themeIndex)}
                  />
                ))}
              </div>
            </div>
          ))}

          <div className="grid gap-2">
            <p className="font-body text-sm font-bold opacity-70">
              Финал · игроки уберут лишние темы
            </p>
            <div className="flex flex-wrap gap-2">
              {draft.final.map((theme) => (
                <span
                  key={`${theme.packId}-${theme.themeId}`}
                  className="ink-border bg-card text-ink font-body rounded-xl px-3 py-1.5 text-sm font-bold"
                >
                  {theme.title}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function ThemeChip({
  theme,
  canReplace,
  onReplace,
}: {
  theme: ThemeOption;
  canReplace: boolean;
  onReplace: () => void;
}) {
  return (
    <div className="ink-border bg-card text-ink grid gap-1 rounded-2xl px-3 py-2">
      <span className="font-pop truncate text-base font-black" title={theme.title}>
        {theme.title}
      </span>
      <span className="font-body truncate text-xs font-bold opacity-60" title={theme.packTitle}>
        {theme.packTitle} · {theme.questionsCount} вопросов
      </span>
      <button
        type="button"
        disabled={!canReplace}
        onClick={onReplace}
        className="font-body justify-self-start text-xs font-bold underline underline-offset-4 opacity-70 disabled:opacity-30"
      >
        заменить
      </button>
    </div>
  );
}
