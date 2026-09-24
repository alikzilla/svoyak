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
    <div className="app-shell on-scene relative isolate mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
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
            type="button"
            onClick={() =>
              void createPack('Новый пак')
                .then((pack) => navigate(`/editor/${pack.id}`))
                .catch((cause: unknown) =>
                  setError(cause instanceof Error ? cause.message : 'Не удалось создать пак'),
                )
            }
            className="btn font-pop bg-p5 rounded-2xl px-4 py-2 font-black"
          >
            Создать пак
          </button>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="btn font-pop bg-card rounded-2xl px-4 py-2 font-black"
          >
            Импорт JSON
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => siqInput.current?.click()}
            className="btn font-pop bg-card rounded-2xl px-4 py-2 font-black"
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

      {error && (
        <p role="alert" className="notice notice-error font-body">
          {error}
        </p>
      )}

      {report && (
        <section className="on-paper ink-border bg-card text-ink grid gap-2 rounded-2xl p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-body font-bold">Отчёт импорта</h2>
            <button
              type="button"
              onClick={() => setReport(null)}
              className="btn btn-dashed px-3 text-sm"
            >
              Скрыть
            </button>
          </div>
          <ul className="grid max-h-56 gap-1 overflow-y-auto text-sm">
            {report.map((entry, index) => (
              <li
                key={`${entry.message}-${index}`}
                className={entry.level === 'warning' ? 'font-bold text-p1-ink' : 'text-soft'}
              >
                {entry.message}
              </li>
            ))}
          </ul>
          <p className="text-soft text-xs">
            Всё, что не перенеслось, перечислено здесь — поправьте эти вопросы руками.
          </p>
        </section>
      )}

      {packs === null ? (
        <p className="text-soft font-body font-bold">Загружаем…</p>
      ) : packs.length === 0 ? (
        <p className="text-soft font-body font-bold">
          Паков пока нет. Создайте первый или импортируйте JSON.
        </p>
      ) : (
        <ul className="grid gap-3">
          {packs.map((pack) => (
            <li
              key={pack.id}
              className="on-paper ink-border bg-card text-ink relative flex flex-wrap items-center gap-3 rounded-3xl px-5 py-4"
              style={{ boxShadow: '5px 5px 0 #1a1a1a' }}
            >
              <Link to={`/editor/${pack.id}`} className="min-w-0 flex-1">
                <span className="font-pop block text-xl font-black">{pack.title}</span>
                <span className="text-soft block text-sm">
                  {pack.roundsCount} раунда · {pack.questionsCount} вопросов · финал из{' '}
                  {pack.finalThemesCount} тем
                </span>
              </Link>
              {confirmId === pack.id ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      void removePack(pack.id).then(() => {
                        setConfirmId(null);
                        reload();
                      })
                    }
                    className="btn btn-danger px-3 text-sm"
                  >
                    Удалить насовсем
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmId(null)}
                    className="btn px-3 text-sm"
                  >
                    Отмена
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmId(pack.id)}
                  className="btn px-3 text-sm hover:border-no hover:text-no-ink"
                >
                  Удалить
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Link
        to="/"
        className="text-soft font-body w-fit text-sm font-bold underline underline-offset-4"
      >
        На главную
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
      <div className="app-shell on-scene flex flex-col items-center justify-center gap-4 p-6">
        <p role="alert" className="notice notice-error font-body">
          {loadError}
        </p>
        <Link to="/editor" className="btn font-body bg-card no-underline">
          К списку паков
        </Link>
      </div>
    );
  }

  if (!pack) {
    return (
      <div className="app-shell on-scene text-soft font-body flex items-center justify-center p-6 font-bold">
        Загружаем…
      </div>
    );
  }

  return (
    <div className="app-shell editor-shell on-scene relative isolate mx-auto flex w-full max-w-5xl flex-col gap-5 p-6">
      <DoodleField density="light" night />
      <header className="relative flex flex-wrap items-center gap-3">
        <Link to="/editor" className="btn btn-quiet font-body px-3 text-sm no-underline">
          ← Паки
        </Link>
        <input
          className="field-bare font-pop min-w-0 flex-1 text-2xl font-black"
          style={{ WebkitTextStroke: '3px #1a1a1a', paintOrder: 'stroke fill', color: '#fff6e9' }}
          value={pack.title}
          placeholder="Название пака"
          onChange={(event) => setPack({ ...pack, title: event.target.value })}
        />
        <span
          role="status"
          aria-live="polite"
          className={`font-body text-sm font-bold tabular-nums ${
            state === 'error' ? 'text-no-ink bg-card ink-border rounded-lg px-2 py-0.5' : 'text-soft'
          }`}
          title={error ?? undefined}
        >
          {SAVE_LABEL[state]}
        </span>
        {state === 'error' && (
          <button type="button" onClick={saveNow} className="btn btn-danger px-3 text-sm">
            Повторить
          </button>
        )}
        <button
          type="button"
          onClick={() => downloadPack(pack)}
          className="btn btn-quiet font-body text-sm"
        >
          Скачать JSON
        </button>
      </header>

      <PackEditor pack={pack} issues={issues} onChange={setPack} />
    </div>
  );
}
