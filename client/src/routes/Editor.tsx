import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Check, Download, FileJson, Library, Loader2, PackageOpen, Plus, Trash2, X } from 'lucide-react';
import type { Pack, PackSummary } from '@svoyak/shared';
import {
  createPack,
  downloadPack,
  fetchPack,
  importPackFile,
  importSiqFile,
  listPacks,
  removePack,
  type ImportEntry,
} from '../editor/api.js';
import { PackEditor } from '../editor/PackEditor.js';
import { useAutosave, type SaveState } from '../editor/useAutosave.js';
import { questionsWord, roundsWord, themesWord } from '../ui/host/GameSetup.js';
import { PageHeader, Shell } from '../workspace/Shell.js';
import { ConfirmDelete, EmptyState, Notice } from '../workspace/ui.js';

export default function Editor() {
  const { packId } = useParams();
  return packId ? <PackScreen packId={packId} /> : <PackListScreen />;
}

const DATE = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' });

/* ── Список паков ─────────────────────────────────────────────────────── */

function PackListScreen() {
  const navigate = useNavigate();
  const [packs, setPacks] = useState<PackSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ImportEntry[] | null>(null);
  const [busy, setBusy] = useState<'create' | 'json' | 'siq' | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const siqInput = useRef<HTMLInputElement>(null);

  const reload = (): void => {
    void listPacks()
      .then(setPacks)
      .catch((cause: unknown) => {
        setPacks([]);
        setError(cause instanceof Error ? cause.message : 'Не удалось загрузить паки');
      });
  };

  useEffect(reload, []);

  const create = (): void => {
    setBusy('create');
    void createPack('Новый пак')
      .then((pack) => navigate(`/editor/${pack.id}`))
      .catch((cause: unknown) => {
        setBusy(null);
        setError(cause instanceof Error ? cause.message : 'Не удалось создать пак');
      });
  };

  const actions = (
    <>
      <button type="button" disabled={busy !== null} onClick={() => fileInput.current?.click()} className="ws-btn">
        <FileJson aria-hidden />
        Импорт JSON
      </button>
      <button type="button" disabled={busy !== null} onClick={() => siqInput.current?.click()} className="ws-btn">
        {busy === 'siq' ? <Loader2 className="animate-spin" aria-hidden /> : <PackageOpen aria-hidden />}
        {busy === 'siq' ? 'Разбираем архив…' : 'Импорт из SIGame'}
      </button>
      <button type="button" disabled={busy !== null} onClick={create} className="ws-btn ws-btn-primary">
        <Plus aria-hidden />
        Новый пак
      </button>
      <input
        ref={siqInput}
        type="file"
        accept=".siq,application/zip"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          setBusy('siq');
          setError(null);
          setReport(null);
          void importSiqFile(file)
            .then((result) => {
              setReport(result.report);
              reload();
            })
            .catch((cause: unknown) =>
              setError(cause instanceof Error ? cause.message : 'Не удалось импортировать'),
            )
            .finally(() => setBusy(null));
        }}
      />
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          setBusy('json');
          void importPackFile(file)
            .then((pack) => navigate(`/editor/${pack.id}`))
            .catch((cause: unknown) => {
              setBusy(null);
              setError(cause instanceof Error ? cause.message : 'Не удалось импортировать');
            });
        }}
      />
    </>
  );

  return (
    <Shell>
      <PageHeader
        title="Паки"
        description="Вопросы для игр: раунды с темами и финал. Правки сохраняются сами."
        actions={actions}
      />

      <div className="mb-6 grid gap-3 empty:hidden">
        {error && (
          <Notice
            action={
              <button type="button" onClick={() => setError(null)} className="ws-btn ws-btn-ghost ws-btn-sm ws-btn-icon" aria-label="Скрыть">
                <X aria-hidden />
              </button>
            }
          >
            {error}
          </Notice>
        )}
        {report && <ImportReport report={report} onClose={() => setReport(null)} />}
      </div>

      {packs === null ? (
        <div className="ws-card divide-ws-line divide-y" aria-busy>
          {[0, 1, 2].map((row) => (
            <div key={row} className="grid gap-2 px-5 py-4">
              <div className="bg-ws-sunken h-4 w-48 animate-pulse rounded" />
              <div className="bg-ws-sunken h-3 w-72 animate-pulse rounded" />
            </div>
          ))}
        </div>
      ) : packs.length === 0 ? (
        <EmptyState
          icon={<Library aria-hidden />}
          title="Паков пока нет"
          action={
            <button type="button" onClick={create} className="ws-btn ws-btn-primary">
              <Plus aria-hidden />
              Создать первый пак
            </button>
          }
        >
          Создайте пак с нуля или импортируйте готовый: файл SIGame (.siq) или JSON, скачанный из
          этого редактора.
        </EmptyState>
      ) : (
        <ul className="ws-card divide-ws-line divide-y overflow-hidden">
          {packs.map((pack) => (
            <li key={pack.id} className="group hover:bg-ws-hover relative flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 transition-colors">
              <div className="grid min-w-0 flex-1 basis-64 gap-1">
                <Link
                  to={`/editor/${pack.id}`}
                  className="truncate text-[1rem] font-semibold no-underline after:absolute after:inset-0 hover:underline"
                >
                  {pack.title}
                </Link>
                <span className="text-ws-faint num text-[0.8125rem]">
                  {pack.roundsCount} {roundsWord(pack.roundsCount)} · {pack.questionsCount}{' '}
                  {questionsWord(pack.questionsCount)} · финал из {pack.finalThemesCount}{' '}
                  {themesWord(pack.finalThemesCount)} · изменён {DATE.format(pack.updatedAt)}
                </span>
              </div>
              <span className="flex items-center gap-2">
                {pack.source === 'siq' && <span className="ws-badge">из SIGame</span>}
                {pack.playable ? (
                  <span className="ws-badge ws-badge-yes">
                    <Check aria-hidden />
                    готов к игре
                  </span>
                ) : (
                  <span className="ws-badge ws-badge-warn">
                    <AlertCircle aria-hidden />
                    есть ошибки
                  </span>
                )}
              </span>
              {/* Над ссылкой-подложкой, чтобы кнопка ловила клик сама. */}
              <span className="relative z-10">
                <ConfirmDelete
                  icon={<Trash2 aria-hidden />}
                  title={`Удалить пак «${pack.title}»`}
                  onConfirm={() =>
                    void removePack(pack.id)
                      .then(reload)
                      .catch((cause: unknown) =>
                        setError(cause instanceof Error ? cause.message : 'Не удалось удалить пак'),
                      )
                  }
                />
              </span>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}

function ImportReport({ report, onClose }: { report: ImportEntry[]; onClose: () => void }) {
  const warnings = report.filter((entry) => entry.level === 'warning').length;
  return (
    <section className="ws-card">
      <header className="ws-card-head">
        <h2 className="ws-card-title">Отчёт импорта</h2>
        {warnings > 0 && <span className="ws-badge ws-badge-warn num">предупреждений: {warnings}</span>}
        <button type="button" onClick={onClose} className="ws-btn ws-btn-ghost ws-btn-sm ml-auto">
          Скрыть
        </button>
      </header>
      <ul className="grid max-h-56 gap-1 overflow-y-auto px-5 py-3 text-sm">
        {report.map((entry, index) => (
          <li
            key={`${entry.message}-${index}`}
            className={entry.level === 'warning' ? 'text-ws-warn-ink font-medium' : 'text-ws-soft'}
          >
            {entry.message}
          </li>
        ))}
      </ul>
      <p className="text-ws-faint border-ws-line border-t px-5 py-3 text-[0.8125rem]">
        Всё, что не перенеслось, перечислено здесь — поправьте эти вопросы руками.
      </p>
    </section>
  );
}

/* ── Один пак ─────────────────────────────────────────────────────────── */

function PackScreen({ packId }: { packId: string }) {
  const [pack, setPack] = useState<Pack | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { state, issues, error, saveNow } = useAutosave(pack);

  useEffect(() => {
    void fetchPack(packId)
      .then(setPack)
      .catch((cause: unknown) => setLoadError(cause instanceof Error ? cause.message : 'Пак не найден'));
  }, [packId]);

  const back = (
    <Link
      to="/editor"
      className="text-ws-soft hover:text-ws-fg inline-flex w-fit items-center gap-1.5 text-sm font-medium no-underline"
    >
      <ArrowLeft size={16} aria-hidden />
      Все паки
    </Link>
  );

  if (loadError) {
    return (
      <Shell>
        <div className="grid gap-4">
          {back}
          <Notice>{loadError}</Notice>
        </div>
      </Shell>
    );
  }

  if (!pack) {
    return (
      <Shell>
        <div className="grid gap-4" aria-busy>
          {back}
          <div className="bg-ws-sunken h-9 w-80 animate-pulse rounded-lg" />
          <div className="ws-card h-64 animate-pulse" />
        </div>
      </Shell>
    );
  }

  return (
    <Shell aside={<SaveStatus state={state} error={error} onRetry={saveNow} />}>
      <div className="mb-6 grid gap-3">
        {back}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="min-w-56 flex-1">
            <span className="sr-only">Название пака</span>
            <input
              className="ws-input-bare text-[1.625rem] leading-tight font-semibold tracking-tight"
              value={pack.title}
              placeholder="Название пака"
              onChange={(event) => setPack({ ...pack, title: event.target.value })}
            />
          </label>
          <button type="button" onClick={() => downloadPack(pack)} className="ws-btn">
            <Download aria-hidden />
            Скачать JSON
          </button>
        </div>
      </div>

      <PackEditor pack={pack} issues={issues} onChange={setPack} />
    </Shell>
  );
}

function SaveStatus({ state, error, onRetry }: { state: SaveState; error: string | null; onRetry: () => void }) {
  if (state === 'error') {
    return (
      <span className="flex items-center gap-2">
        <span role="status" className="text-ws-no-ink text-[0.8125rem] font-medium" title={error ?? undefined}>
          Не сохранилось
        </span>
        <button type="button" onClick={onRetry} className="ws-btn ws-btn-sm">
          Повторить
        </button>
      </span>
    );
  }
  return (
    <span role="status" aria-live="polite" className="text-ws-faint flex items-center gap-1.5 text-[0.8125rem]">
      {state === 'saving' && (
        <>
          <Loader2 size={14} className="animate-spin" aria-hidden />
          Сохраняем…
        </>
      )}
      {state === 'saved' && (
        <>
          <Check size={14} className="text-ws-yes-ink" aria-hidden />
          Сохранено
        </>
      )}
      {state === 'idle' && <span className="hidden sm:inline">Правки сохраняются сами</span>}
    </span>
  );
}
