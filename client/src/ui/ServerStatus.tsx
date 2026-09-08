import { useEffect, useState } from 'react';

type Status = 'checking' | 'online' | 'offline';

/** Индикатор связи с сервером: главная проверка на этапе подключения телефона. */
export function ServerStatus() {
  const [status, setStatus] = useState<Status>('checking');

  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const res = await fetch('/api/health');
        const body: unknown = await res.json();
        const ok = typeof body === 'object' && body !== null && 'ok' in body && body.ok === true;
        if (alive) setStatus(ok ? 'online' : 'offline');
      } catch {
        if (alive) setStatus('offline');
      }
    };
    void check();
    const timer = setInterval(() => void check(), 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const label = { checking: 'проверяем связь…', online: 'сервер на связи', offline: 'нет связи с сервером' }[status];
  const dot = { checking: 'bg-p4', online: 'bg-yes', offline: 'bg-no' }[status];

  return (
    <p className="font-body flex items-center gap-2 text-sm font-bold opacity-80">
      <span className={`ink-border inline-block size-3 rounded-full border-2 ${dot}`} />
      {label}
    </p>
  );
}
