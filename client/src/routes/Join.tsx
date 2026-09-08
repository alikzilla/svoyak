import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { JoinRoomResult } from '@svoyak/shared';
import { ask } from '../net/socket.js';
import { saveSession } from '../net/session.js';

export default function Join() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [code, setCode] = useState(params.get('code') ?? '');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    <div className="app-shell flex flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-4xl font-black tracking-tight text-gold">Вход в игру</h1>

      <form className="grid w-full max-w-sm gap-4" onSubmit={(event) => void submit(event)}>
        <label className="grid gap-1 text-sm text-muted">
          Код комнаты
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="off"
            placeholder="1234"
            className="rounded-xl border border-line bg-surface px-4 py-3 text-center text-3xl tabular-nums tracking-[0.3em] text-ink placeholder:text-line focus:border-gold"
          />
        </label>

        <label className="grid gap-1 text-sm text-muted">
          Ваше имя
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={20}
            autoComplete="nickname"
            placeholder="Вася"
            className="rounded-xl border border-line bg-surface px-4 py-3 text-lg text-ink placeholder:text-line focus:border-gold"
          />
        </label>

        {error && <p className="rounded-xl border border-bad/50 bg-bad/10 p-3 text-bad">{error}</p>}

        <button
          type="submit"
          disabled={!ready || busy}
          className="rounded-xl bg-gold px-4 py-4 text-lg font-bold text-bg disabled:opacity-40"
        >
          {busy ? 'Заходим…' : 'Войти'}
        </button>
      </form>
    </div>
  );
}
