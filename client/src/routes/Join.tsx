import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ServerStatus } from '../ui/ServerStatus.js';

export default function Join() {
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get('code') ?? '');
  const [name, setName] = useState('');

  return (
    <div className="app-shell flex flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-4xl font-black tracking-tight text-gold">Вход в игру</h1>

      <form className="grid w-full max-w-sm gap-3" onSubmit={(e) => e.preventDefault()}>
        <label className="grid gap-1 text-sm text-muted">
          Код комнаты
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            placeholder="123456"
            className="rounded-xl border border-line bg-surface px-4 py-3 text-center text-2xl tracking-[0.3em] text-ink placeholder:text-line"
          />
        </label>

        <label className="grid gap-1 text-sm text-muted">
          Ваше имя
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            placeholder="Вася"
            className="rounded-xl border border-line bg-surface px-4 py-3 text-lg text-ink placeholder:text-line"
          />
        </label>

        <button
          type="submit"
          disabled
          className="rounded-xl bg-gold px-4 py-4 text-lg font-bold text-bg disabled:opacity-40"
        >
          Подключение появится на следующем этапе
        </button>
      </form>

      <ServerStatus />
    </div>
  );
}
