import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronRight, Copy, Library, Play, Undo2 } from 'lucide-react';
import type {
  CreateRoomResult,
  GameRecipe,
  GameSummary,
  PackSummary,
  RecipeResolution,
  RoomSettings,
} from '@svoyak/shared';
import { DEFAULT_SETTINGS } from '@svoyak/shared';
import { ask } from '../net/socket.js';
import { fetchPacks } from '../net/gameApi.js';
import { fetchGameComposition, listGames } from '../games/api.js';
import {
  CompositionView,
  PackChecklist,
  SizeControls,
  packsWord,
  roundsWord,
  themesWord,
  useComposer,
} from '../ui/host/GameSetup.js';
import { SettingsPanel } from '../ui/host/SettingsPanel.js';
import { clearSession, saveSession } from '../net/session.js';
import { useHostRoom } from '../net/useRoom.js';
import { QrCode } from '../ui/QrCode.js';
import { PlayerLedger } from '../ui/PlayerLedger.js';
import { HostGame } from '../ui/host/HostGame.js';
import { PageHeader, Shell } from '../workspace/Shell.js';
import {
  ConfirmDelete,
  ConnectionStatus,
  EmptyState,
  Notice,
  Segmented,
  SoundButton,
} from '../workspace/ui.js';

export default function Host() {
  const { view, connected, closed } = useHostRoom();

  if (!view) return <SetupScreen connected={connected} closed={closed !== null} />;
  if (view.phase !== 'lobby') return <HostGame view={view} connected={connected} />;
  return <LobbyScreen view={view} connected={connected} />;
}

/* ── Новая игра ───────────────────────────────────────────────────────── */

function SetupScreen({ connected, closed }: { connected: boolean; closed: boolean }) {
  const [packs, setPacks] = useState<PackSummary[] | null>(null);
  const [games, setGames] = useState<GameSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchPacks()
      .then(setPacks)
      .catch(() => {
        setPacks([]);
        setError('Не удалось загрузить список паков. Проверьте, что сервер запущен, и обновите страницу.');
      });
  }, []);

  useEffect(() => {
    // Сохранённые игры не критичны: при сбое просто не показываем их,
    // но говорим об этом, а не молчим.
    void listGames()
      .then(setGames)
      .catch(() => {
        setGames([]);
        setError('Не удалось загрузить сохранённые игры — можно собрать игру из паков.');
      });
  }, []);

  return (
    <Shell aside={<ConnectionStatus connected={connected} />}>
      <PageHeader
        title="Новая игра"
        description="Выберите, что играть, проверьте состав и создайте комнату. Гости войдут по QR-коду со своих телефонов."
      />

      <div className="mb-6 grid gap-3 empty:hidden">
        {/* Прошлая комната закрылась — это не ошибка, поэтому без красного. */}
        {closed && (
          <Notice tone="info">Прошлая комната закрыта. Соберите новую игру — код будет другой.</Notice>
        )}
        {error && <Notice>{error}</Notice>}
      </div>

      {packs === null ? (
        <SetupSkeleton />
      ) : packs.length === 0 ? (
        <EmptyState
          icon={<Library aria-hidden />}
          title="Паков пока нет"
          action={
            <Link to="/editor" className="ws-btn ws-btn-primary no-underline">
              Открыть редактор паков
            </Link>
          }
        >
          Создайте пак в редакторе, импортируйте файл SIGame (.siq) или выполните{' '}
          <code className="bg-ws-sunken rounded px-1 py-0.5 text-[0.8125rem]">npm run build:packs</code>.
        </EmptyState>
      ) : (
        <SetupForm packs={packs} games={games} connected={connected} onError={setError} />
      )}
    </Shell>
  );
}

function SetupSkeleton() {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]" aria-busy>
      <div className="grid gap-6">
        {[12, 7, 10].map((height, index) => (
          <div key={index} className="ws-card animate-pulse" style={{ height: `${height}rem` }} />
        ))}
      </div>
      <div className="ws-card h-80 animate-pulse" />
    </div>
  );
}

type Source = 'packs' | 'saved';

function SetupForm({
  packs,
  games,
  connected,
  onError,
}: {
  packs: PackSummary[];
  games: GameSummary[];
  connected: boolean;
  onError: (message: string | null) => void;
}) {
  const [source, setSource] = useState<Source>('packs');
  const [recipe, setRecipe] = useState<GameRecipe | null>(null);
  const [settings, setSettings] = useState<RoomSettings>(DEFAULT_SETTINGS);
  const [gameId, setGameId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const composer = useComposer(packs, setRecipe);

  const playableGames = games.filter((game) => game.playable);
  const selectedGame = games.find((game) => game.id === gameId) ?? null;

  const createRoom = async (): Promise<void> => {
    const payload =
      source === 'saved'
        ? selectedGame
          ? { gameId: selectedGame.id }
          : null
        : recipe
          ? { recipe }
          : null;
    if (!payload) return;
    setCreating(true);
    onError(null);
    const result = await ask<CreateRoomResult>('room:create', { ...payload, settings });
    setCreating(false);
    if (!result.ok) {
      onError(result.error);
      return;
    }
    saveSession({ role: 'host', code: result.data.code, token: result.data.hostToken, playerId: null });
  };

  const blocker = !connected
    ? 'Нет связи с сервером'
    : source === 'saved'
      ? selectedGame
        ? null
        : 'Выберите игру'
      : composer.selected.length === 0
        ? 'Выберите хотя бы один пак'
        : composer.error
          ? 'Состав не собрался'
          : recipe === null
            ? 'Собираем состав…'
            : null;

  const createButton = (
    <button
      type="button"
      disabled={creating || blocker !== null}
      onClick={() => void createRoom()}
      className="ws-btn ws-btn-primary ws-btn-lg w-full"
    >
      {creating ? 'Создаём комнату…' : 'Создать комнату'}
    </button>
  );

  return (
    <>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid min-w-0 gap-6">
          {games.length > 0 && (
            <Segmented<Source>
              label="Что играем"
              value={source}
              onChange={setSource}
              options={[
                { value: 'packs', label: 'Собрать из паков' },
                {
                  value: 'saved',
                  label: (
                    <>
                      Сохранённая игра <span className="text-ws-faint num">{games.length}</span>
                    </>
                  ),
                },
              ]}
            />
          )}

          {source === 'packs' ? (
            <>
              <section className="ws-card">
                <header className="ws-card-head">
                  <h2 className="ws-card-title">Паки</h2>
                  <span className="text-ws-faint num ml-auto text-[0.8125rem]">
                    выбрано {composer.selected.length} из {packs.length}
                  </span>
                </header>
                <div className="px-3 py-2">
                  <PackChecklist packs={packs} selected={composer.selected} onToggle={composer.togglePack} />
                </div>
              </section>

              <section className="ws-card">
                <header className="ws-card-head">
                  <h2 className="ws-card-title">Размер игры</h2>
                </header>
                <div className="p-4 sm:p-5">
                  <SizeControls
                    rounds={composer.rounds}
                    themesPerRound={composer.themesPerRound}
                    finalThemes={composer.finalThemes}
                    onRounds={composer.setRounds}
                    onThemesPerRound={composer.setThemesPerRound}
                    onFinalThemes={composer.setFinalThemes}
                  />
                </div>
              </section>
            </>
          ) : (
            <section className="ws-card">
              <header className="ws-card-head">
                <h2 className="ws-card-title">Сохранённые игры</h2>
                <Link to="/games" className="text-ws-accent-ink ml-auto text-[0.8125rem] font-medium">
                  Управлять играми
                </Link>
              </header>
              <ul className="grid gap-0.5 px-3 py-2">
                {games.map((game) => (
                  <li key={game.id}>
                    <label className="ws-option">
                      <input
                        type="radio"
                        name="saved-game"
                        className="ws-check"
                        disabled={!game.playable}
                        checked={gameId === game.id}
                        onChange={() => setGameId(game.id)}
                      />
                      <span className="grid min-w-0 flex-1 gap-0.5">
                        <span className={`text-[0.9375rem] font-medium ${game.playable ? '' : 'text-ws-faint'}`}>
                          {game.title}
                        </span>
                        <span className="text-ws-faint num text-[0.8125rem]">
                          {game.roundsCount} {roundsWord(game.roundsCount)} · {game.themesCount}{' '}
                          {themesWord(game.themesCount)}
                          {game.modifiersPerRound > 0 && ` · модификаторов на раунд: ${game.modifiersPerRound}`}
                        </span>
                      </span>
                      {!game.playable && <span className="ws-badge ws-badge-warn">состав потерялся</span>}
                    </label>
                  </li>
                ))}
              </ul>
              {playableGames.length === 0 && (
                <p className="text-ws-soft border-ws-line border-t px-5 py-3 text-sm">
                  Ни одну игру сейчас не сыграть: темы пропали вместе с паками. Пересоберите их в
                  разделе «Игры».
                </p>
              )}
            </section>
          )}

          <section className="ws-card">
            <header className="ws-card-head">
              <h2 className="ws-card-title">Темп</h2>
              <span className="text-ws-faint ml-auto text-[0.8125rem]">можно поменять в лобби</span>
            </header>
            <div className="p-4 sm:p-5">
              <SettingsPanel
                settings={settings}
                onChange={(patch) => setSettings((current) => ({ ...current, ...patch }))}
              />
            </div>
          </section>
        </div>

        <aside className="ws-card lg:sticky lg:top-20" aria-label="Состав игры">
          <header className="ws-card-head">
            <h2 className="ws-card-title">Состав</h2>
            {source === 'packs' && composer.selected.length > 0 && (
              <span className="text-ws-faint num ml-auto text-[0.8125rem]">
                из {composer.selected.length} {packsWord(composer.selected.length)}
              </span>
            )}
          </header>
          <div className="max-h-[calc(100dvh-17rem)] overflow-y-auto p-4 sm:p-5">
            {source === 'packs' ? (
              composer.error ? (
                <Notice>{composer.error}</Notice>
              ) : composer.selected.length === 0 ? (
                <p className="text-ws-soft text-sm">Отметьте паки слева — состав появится здесь.</p>
              ) : composer.draft ? (
                <CompositionView
                  rounds={composer.draft.rounds}
                  final={composer.draft.final}
                  onReplace={composer.replaceTheme}
                  canReplace={composer.draft.pool.length > 0}
                  onReshuffle={composer.reshuffle}
                  busy={composer.busy}
                />
              ) : (
                <p className="text-ws-soft text-sm">Собираем состав…</p>
              )
            ) : selectedGame ? (
              <SavedComposition gameId={selectedGame.id} />
            ) : (
              <p className="text-ws-soft text-sm">Выберите игру слева — её состав появится здесь.</p>
            )}
          </div>
          <footer className="border-ws-line hidden gap-2 border-t p-4 lg:grid">
            {createButton}
            <p className="text-ws-faint text-center text-[0.8125rem]">
              {blocker ?? 'Код и QR для гостей появятся на следующем шаге'}
            </p>
          </footer>
        </aside>
      </div>

      {/* На узком экране главное действие прилипает к низу. */}
      <div className="bg-ws-surface/95 border-ws-line sticky bottom-0 z-20 -mx-4 mt-6 grid gap-1.5 border-t px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:hidden">
        {createButton}
        {blocker && <p className="text-ws-faint text-center text-[0.8125rem]">{blocker}</p>}
      </div>
    </>
  );
}

function SavedComposition({ gameId }: { gameId: string }) {
  const [resolution, setResolution] = useState<RecipeResolution | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setResolution(null);
    setError(null);
    void fetchGameComposition(gameId)
      .then((next) => {
        if (alive) setResolution(next);
      })
      .catch((cause: unknown) => {
        if (alive) setError(cause instanceof Error ? cause.message : 'Не удалось открыть состав');
      });
    return () => {
      alive = false;
    };
  }, [gameId]);

  if (error) return <Notice>{error}</Notice>;
  if (!resolution) return <p className="text-ws-soft text-sm">Загружаем состав…</p>;
  return <CompositionView rounds={resolution.rounds} final={resolution.final} />;
}

/* ── Лобби ────────────────────────────────────────────────────────────── */

function LobbyScreen({
  view,
  connected,
}: {
  view: NonNullable<ReturnType<typeof useHostRoom>['view']>;
  connected: boolean;
}) {
  const canStart = view.players.length > 0;

  return (
    <Shell
      aside={
        <>
          <ConnectionStatus connected={connected} />
          <SoundButton />
        </>
      }
    >
      <PageHeader
        title={view.packTitle}
        description="Комната открыта. Гости входят по QR-коду — когда все в списке, начинайте."
        actions={
          <>
            {view.canUndo && (
              <button type="button" onClick={() => void ask('host:undo')} className="ws-btn ws-btn-ghost">
                <Undo2 aria-hidden />
                Отменить
              </button>
            )}
            <ConfirmDelete
              size="md"
              label="Закрыть комнату"
              confirmLabel="Да, закрыть"
              onConfirm={() => {
                clearSession('host');
                location.reload();
              }}
            />
            <button
              type="button"
              disabled={!canStart}
              title={canStart ? undefined : 'Нужен хотя бы один игрок'}
              onClick={() => void ask('host:startGame')}
              className="ws-btn ws-btn-primary ws-btn-lg"
            >
              <Play aria-hidden />
              Начать игру
            </button>
          </>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <JoinCard code={view.code} joinUrl={view.joinUrl} />

        <section className="ws-card">
          <header className="ws-card-head">
            <h2 className="ws-card-title">Игроки</h2>
            <span className="text-ws-faint num text-[0.8125rem]">{view.players.length}</span>
          </header>
          <PlayerLedger
            players={view.players}
            highlightId={view.controlPlayerId}
            onScoreChange={(playerId, score) => void ask('host:adjustScore', { playerId, score })}
            onKick={(playerId) => void ask('host:kick', { playerId })}
            onSetControl={(playerId) => void ask('host:setControl', { playerId })}
          />
        </section>
      </div>

      <div className="mt-6 grid gap-3">
        <LobbyRecipe />
        <details className="ws-card ws-disclosure">
          <summary className="px-5 py-4">
            <ChevronRight size={18} className="ws-chevron text-ws-faint" aria-hidden />
            <span className="ws-card-title">Темп</span>
            <span className="text-ws-faint ml-auto text-[0.8125rem]">меняется сразу</span>
          </summary>
          <div className="border-ws-line border-t p-4 sm:p-5">
            <SettingsPanel settings={view.settings} onChange={(patch) => void ask('host:updateSettings', patch)} />
          </div>
        </details>
      </div>
    </Shell>
  );
}

function JoinCard({ code, joinUrl }: { code: string; joinUrl: string }) {
  const [copied, setCopied] = useState(false);
  const urlField = useRef<HTMLInputElement>(null);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Буфер обмена недоступен (не https) — выделяем ссылку, чтобы скопировать руками.
      urlField.current?.select();
    }
  };

  return (
    <section className="ws-card" aria-label="Вход для игроков">
      <header className="ws-card-head">
        <h2 className="ws-card-title">Вход для игроков</h2>
      </header>
      <div className="grid justify-items-center gap-4 p-5">
        <div className="rounded-xl bg-white p-3 shadow-[0_0_0_1px_var(--ws-line)]">
          <QrCode value={joinUrl} size={200} dark="#16141f" light="#ffffff" />
        </div>
        <div className="grid justify-items-center gap-0.5">
          <span className="ws-label">Код комнаты</span>
          <span className="num text-[2.5rem] leading-none font-semibold tracking-[0.12em]">{code}</span>
        </div>
        <div className="flex w-full items-center gap-1.5">
          <input
            ref={urlField}
            readOnly
            value={joinUrl}
            aria-label="Ссылка для входа"
            onFocus={(event) => event.currentTarget.select()}
            className="ws-input text-ws-soft min-w-0 flex-1 text-[0.8125rem]"
          />
          <button
            type="button"
            onClick={() => void copy()}
            className="ws-btn ws-btn-icon"
            title="Скопировать ссылку"
            aria-label="Скопировать ссылку"
          >
            {copied ? <Check aria-hidden className="text-ws-yes-ink" /> : <Copy aria-hidden />}
          </button>
        </div>
      </div>
    </section>
  );
}

/** Состав можно поменять, пока игроки сходятся: после старта поздно. */
function LobbyRecipe() {
  const [packs, setPacks] = useState<PackSummary[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || packs) return;
    void fetchPacks()
      .then(setPacks)
      .catch(() => setPacks([]));
  }, [open, packs]);

  return (
    <details
      className="ws-card ws-disclosure"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="px-5 py-4">
        <ChevronRight size={18} className="ws-chevron text-ws-faint" aria-hidden />
        <span className="ws-card-title">Изменить состав</span>
        <span className="text-ws-faint ml-auto text-[0.8125rem]">до начала игры</span>
      </summary>
      <div className="border-ws-line border-t p-4 sm:p-5">
        {packs === null ? (
          <p className="text-ws-soft text-sm">Загружаем паки…</p>
        ) : packs.length === 0 ? (
          <p className="text-ws-soft text-sm">Паков не нашлось.</p>
        ) : (
          <LobbyComposer packs={packs} onApplied={() => setOpen(false)} />
        )}
      </div>
    </details>
  );
}

function LobbyComposer({ packs, onApplied }: { packs: PackSummary[]; onApplied: () => void }) {
  const [draft, setDraft] = useState<GameRecipe | null>(null);
  const handleRecipe = useCallback((next: GameRecipe | null) => setDraft(next), []);
  const composer = useComposer(packs, handleRecipe);

  return (
    <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="grid gap-5">
        <PackChecklist packs={packs} selected={composer.selected} onToggle={composer.togglePack} />
        <SizeControls
          rounds={composer.rounds}
          themesPerRound={composer.themesPerRound}
          finalThemes={composer.finalThemes}
          onRounds={composer.setRounds}
          onThemesPerRound={composer.setThemesPerRound}
          onFinalThemes={composer.setFinalThemes}
        />
      </div>
      <div className="grid gap-4">
        {composer.error ? (
          <Notice>{composer.error}</Notice>
        ) : composer.draft ? (
          <CompositionView
            rounds={composer.draft.rounds}
            final={composer.draft.final}
            onReplace={composer.replaceTheme}
            canReplace={composer.draft.pool.length > 0}
            onReshuffle={composer.reshuffle}
            busy={composer.busy}
          />
        ) : (
          <p className="text-ws-soft text-sm">Отметьте паки — состав появится здесь.</p>
        )}
        <button
          type="button"
          disabled={draft === null}
          onClick={() => {
            if (draft) void ask('host:setRecipe', { recipe: draft });
            onApplied();
          }}
          className="ws-btn ws-btn-primary justify-self-start"
        >
          Применить состав
        </button>
      </div>
    </div>
  );
}
