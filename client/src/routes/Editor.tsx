import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
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
import { DoodleField } from '../design/Doodles.js';
import { useAutosave } from '../editor/useAutosave.js';

const SAVE_LABEL = {
  idle: '',
  saving: 'сохраняем…',
  saved: 'сохранено',
  error: 'не сохранилось',
} as const;

export default function Editor() {
  const { packId } = useParams();
  return packId ? <PackScreen packId={packId} /> : <PackListScreen />;
}

function PackListScreen() {
  const navigate = useNavigate();
  const [packs, setPacks] = useState<PackSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [report, setReport] = useState<ImportEntry[] | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const siqInput = useRef<HTMLInputElement>(null);

  const reload = (): void => {
    void listPacks()
      .then(setPacks)
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Не удалось загрузить паки'),
      );
  };

  useEffect(reload, []);

  return (
    <div className="app-shell relative mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <DoodleField density="light" night />
      <header className="relative flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1
            className="font-pop text-4xl font-black"
            style={{ WebkitTextStroke: '4px #1a1a1a', paintOrder: 'stroke fill', color: '#fff6e9' }}
          >
            Редактор паков
          </h1>
          <p className="font-body font-bold opacity-80">Свои вопросы — без запущенной игры</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() =>
              void createPack('Новый пак')
                .then((pack) => navigate(`/editor/${pack.id}`))
                .catch((cause: unknown) =>
                  setError(cause instanceof Error ? cause.message : 'Не удалось создать пак'),
                )
            }
            className="ink-border font-pop bg-p5 text-ink rounded-2xl px-4 py-2 font-black"
            style={{ boxShadow: '5px 5px 0 #1a1a1a' }}
          >
            Создать пак
          </button>
          <button
            onClick={() => fileInput.current?.click()}
            className="ink-border font-pop bg-card text-ink rounded-2xl px-4 py-2 font-black" style={{ boxShadow: '5px 5px 0 #1a1a1a' }}
          >
            Импорт JSON
          </button>
          <button
            disabled={busy}
            onClick={() => siqInput.current?.click()}
            className="ink-border font-pop bg-card text-ink rounded-2xl px-4 py-2 font-black disabled:opacity-50" style={{ boxShadow: '5px 5px 0 #1a1a1a' }}
          >
            {busy ? 'Разбираем архив…' : 'Импорт .siq'}
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
              setBusy(true);
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
                .finally(() => setBusy(false));
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
              void importPackFile(file)
                .then((pack) => navigate(`/editor/${pack.id}`))
                .catch((cause: unknown) =>
                  setError(cause instanceof Error ? cause.message : 'Не удалось импортировать'),
                );
            }}
          />
        </div>
      </header>

      {error && <p className="rounded-xl border border-no/50 bg-no/10 p-3 text-no">{error}</p>}

      {report && (
        <section className="grid gap-2 rounded-2xl ink-border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">Отчёт импорта</h2>
            <button onClick={() => setReport(null)} className="text-sm text-ink/60 underline">
              скрыть
            </button>
          </div>
          <ul className="grid max-h-56 gap-1 overflow-y-auto text-sm">
            {report.map((entry, index) => (
              <li
                key={`${entry.message}-${index}`}
                className={entry.level === 'warning' ? 'text-p1' : 'text-ink/60'}
              >
                {entry.message}
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink/60">
            Всё, что не перенеслось, перечислено здесь — поправьте эти вопросы руками.
          </p>
        </section>
      )}

      {packs === null ? (
        <p className="text-ink/60">Загружаем…</p>
      ) : packs.length === 0 ? (
        <p className="text-ink/60">Паков пока нет. Создайте первый или импортируйте JSON.</p>
      ) : (
        <ul className="grid gap-3">
          {packs.map((pack) => (
            <li
              key={pack.id}
              className="ink-border bg-card text-ink flex flex-wrap items-center gap-3 rounded-3xl px-5 py-4"
              style={{ boxShadow: '5px 5px 0 #1a1a1a' }}
            >
              <Link to={`/editor/${pack.id}`} className="min-w-0 flex-1">
                <span className="font-pop block text-xl font-black">{pack.title}</span>
                <span className="block text-sm text-ink/60">
                  {pack.roundsCount} раунда · {pack.questionsCount} вопросов · финал из{' '}
                  {pack.finalThemesCount} тем
                </span>
              </Link>
              {confirmId === pack.id ? (
                <>
                  <button
                    onClick={() =>
                      void removePack(pack.id).then(() => {
                        setConfirmId(null);
                        reload();
                      })
                    }
                    className="rounded-lg bg-no px-3 py-1.5 text-sm text-bg"
                  >
                    Удалить насовсем
                  </button>
                  <button
                    onClick={() => setConfirmId(null)}
                    className="ink-border rounded-lg px-3 py-1.5 text-sm text-ink/60"
                  >
                    Отмена
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmId(pack.id)}
                  className="ink-border rounded-lg px-3 py-1.5 text-sm text-ink/60 hover:border-no hover:text-no"
                >
                  Удалить
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Link to="/" className="text-sm text-ink/60 underline underline-offset-4">
        на главную
      </Link>
    </div>
  );
}

function PackScreen({ packId }: { packId: string }) {
  const [pack, setPack] = useState<Pack | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { state, issues, error, saveNow } = useAutosave(pack);

  useEffect(() => {
    void fetchPack(packId)
      .then(setPack)
      .catch((cause: unknown) =>
        setLoadError(cause instanceof Error ? cause.message : 'Пак не найден'),
      );
  }, [packId]);

  if (loadError) {
    return (
      <div className="app-shell flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-no">{loadError}</p>
        <Link to="/editor" className="text-p1 underline underline-offset-4">
          к списку паков
        </Link>
      </div>
    );
  }

  if (!pack) {
    return <div className="app-shell flex items-center justify-center p-6 text-ink/60">Загружаем…</div>;
  }

  return (
    <div className="app-shell editor-shell relative mx-auto flex w-full max-w-5xl flex-col gap-5 p-6">
      <DoodleField density="light" night />
      <header className="relative flex flex-wrap items-center gap-3">
        <Link to="/editor" className="text-sm text-ink/60 underline underline-offset-4">
          ← паки
        </Link>
        <input
          className="font-pop min-w-0 flex-1 rounded-xl border-4 border-transparent bg-transparent px-2 py-1.5 text-2xl font-black hover:border-ink/30 focus:border-p1"
          style={{ WebkitTextStroke: '3px #1a1a1a', paintOrder: 'stroke fill', color: '#fff6e9' }}
          value={pack.title}
          placeholder="Название пака"
          onChange={(event) => setPack({ ...pack, title: event.target.value })}
        />
        <span
          className={`text-sm tabular-nums ${state === 'error' ? 'text-no' : 'text-ink/60'}`}
          title={error ?? undefined}
        >
          {SAVE_LABEL[state]}
        </span>
        {state === 'error' && (
          <button onClick={saveNow} className="rounded-lg border border-no px-3 py-1.5 text-sm text-no">
            Повторить
          </button>
        )}
        <button
          onClick={() => downloadPack(pack)}
          className="ink-border rounded-xl px-4 py-2 text-sm hover:border-p1"
        >
          Скачать JSON
        </button>
      </header>

      <PackEditor pack={pack} issues={issues} onChange={setPack} />
    </div>
  );
}
