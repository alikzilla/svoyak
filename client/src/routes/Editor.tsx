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
    <div className="app-shell mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-gold">Редактор паков</h1>
          <p className="text-muted">Свои вопросы — можно собрать без запущенной игры.</p>
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
            className="rounded-xl bg-gold px-4 py-2 font-bold text-bg"
          >
            Создать пак
          </button>
          <button
            onClick={() => fileInput.current?.click()}
            className="rounded-xl border border-line px-4 py-2 hover:border-gold"
          >
            Импорт JSON
          </button>
          <button
            disabled={busy}
            onClick={() => siqInput.current?.click()}
            className="rounded-xl border border-line px-4 py-2 hover:border-gold disabled:opacity-50"
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

      {error && <p className="rounded-xl border border-bad/50 bg-bad/10 p-3 text-bad">{error}</p>}

      {report && (
        <section className="grid gap-2 rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">Отчёт импорта</h2>
            <button onClick={() => setReport(null)} className="text-sm text-muted underline">
              скрыть
            </button>
          </div>
          <ul className="grid max-h-56 gap-1 overflow-y-auto text-sm">
            {report.map((entry, index) => (
              <li
                key={`${entry.message}-${index}`}
                className={entry.level === 'warning' ? 'text-gold' : 'text-muted'}
              >
                {entry.message}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">
            Всё, что не перенеслось, перечислено здесь — поправьте эти вопросы руками.
          </p>
        </section>
      )}

      {packs === null ? (
        <p className="text-muted">Загружаем…</p>
      ) : packs.length === 0 ? (
        <p className="text-muted">Паков пока нет. Создайте первый или импортируйте JSON.</p>
      ) : (
        <ul className="grid gap-3">
          {packs.map((pack) => (
            <li
              key={pack.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface px-5 py-4"
            >
              <Link to={`/editor/${pack.id}`} className="min-w-0 flex-1">
                <span className="block text-lg font-semibold">{pack.title}</span>
                <span className="block text-sm text-muted">
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
                    className="rounded-lg bg-bad px-3 py-1.5 text-sm text-bg"
                  >
                    Удалить насовсем
                  </button>
                  <button
                    onClick={() => setConfirmId(null)}
                    className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted"
                  >
                    Отмена
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmId(pack.id)}
                  className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:border-bad hover:text-bad"
                >
                  Удалить
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Link to="/" className="text-sm text-muted underline underline-offset-4">
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
        <p className="text-bad">{loadError}</p>
        <Link to="/editor" className="text-gold underline underline-offset-4">
          к списку паков
        </Link>
      </div>
    );
  }

  if (!pack) {
    return <div className="app-shell flex items-center justify-center p-6 text-muted">Загружаем…</div>;
  }

  return (
    <div className="app-shell mx-auto flex w-full max-w-5xl flex-col gap-5 p-6">
      <header className="flex flex-wrap items-center gap-3">
        <Link to="/editor" className="text-sm text-muted underline underline-offset-4">
          ← паки
        </Link>
        <input
          className="min-w-0 flex-1 rounded-xl border border-transparent bg-transparent px-2 py-1.5 text-2xl font-black text-gold hover:border-line focus:border-gold"
          value={pack.title}
          placeholder="Название пака"
          onChange={(event) => setPack({ ...pack, title: event.target.value })}
        />
        <span
          className={`text-sm tabular-nums ${state === 'error' ? 'text-bad' : 'text-muted'}`}
          title={error ?? undefined}
        >
          {SAVE_LABEL[state]}
        </span>
        {state === 'error' && (
          <button onClick={saveNow} className="rounded-lg border border-bad px-3 py-1.5 text-sm text-bad">
            Повторить
          </button>
        )}
        <button
          onClick={() => downloadPack(pack)}
          className="rounded-xl border border-line px-4 py-2 text-sm hover:border-gold"
        >
          Скачать JSON
        </button>
      </header>

      <PackEditor pack={pack} issues={issues} onChange={setPack} />
    </div>
  );
}
