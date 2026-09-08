import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { JoinRoomResult } from '@svoyak/shared';
import { ask } from '../net/socket.js';
import { saveSession } from '../net/session.js';

export default function Join() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const codeFromLink = (params.get('code') ?? '').replace(/\D/g, '').slice(0, 6);

  const [code, setCode] = useState(codeFromLink);
  const [name, setName] = useState('');
  const [editingCode, setEditingCode] = useState(codeFromLink.length < 4);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nameField = useRef<HTMLInputElement>(null);

  // Код пришёл из QR — гостю остаётся только имя, открываем клавиатуру сразу.
  useEffect(() => {
    if (!editingCode) nameField.current?.focus();
  }, [editingCode]);

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await ask<JoinRoomResult>('room:join', { code: code.trim(), name: name.trim() });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    saveSession({
      role: 'player',
      code: code.trim(),
      token: result.data.sessionToken,
      playerId: result.data.playerId,
      name: name.trim(),
    });
    void navigate('/play');
  };

  const ready = code.trim().length >= 4 && name.trim().length > 0;

  return (
    <div className="app-shell flex flex-col overflow-y-auto p-5">
      {/* my-auto центрирует, когда есть место, и не срезает верх, когда открыта клавиатура */}
      <form
        className="my-auto grid w-full max-w-sm gap-4 self-center"
        onSubmit={(event) => void submit(event)}
      >
        <h1 className="text-center text-3xl font-black tracking-tight text-gold">Вход в игру</h1>

        {editingCode ? (
          <label className="grid gap-1.5 text-sm text-muted">
            Код комнаты
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              enterKeyHint="next"
              autoComplete="off"
              autoFocus={code.length === 0}
              placeholder="1234"
              className="rounded-2xl border border-line bg-surface px-4 py-4 text-center text-3xl tabular-nums tracking-[0.3em] text-ink [text-indent:0.3em] placeholder:text-line focus:border-gold"
            />
          </label>
        ) : (
          <p className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
            <span className="text-muted">Комната</span>
            <span className="text-2xl font-bold tabular-nums tracking-[0.15em] text-gold">
              {code}
            </span>
            <button
              type="button"
              onClick={() => setEditingCode(true)}
              className="text-sm text-muted underline underline-offset-4"
            >
              изменить
            </button>
          </p>
        )}

        <label className="grid gap-1.5 text-sm text-muted">
          Ваше имя
          <input
            ref={nameField}
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={20}
            autoComplete="nickname"
            autoCapitalize="words"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            placeholder="Вася"
            className="rounded-2xl border border-line bg-surface px-4 py-4 text-xl text-ink placeholder:text-line focus:border-gold"
          />
        </label>

        {error && (
          <p role="alert" className="rounded-2xl border border-bad/50 bg-bad/10 p-3 text-bad">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!ready || busy}
          className="rounded-2xl bg-gold px-4 py-5 text-xl font-bold text-bg transition disabled:opacity-40"
        >
          {busy ? 'Заходим…' : 'Войти в игру'}
        </button>
      </form>
    </div>
  );
}
