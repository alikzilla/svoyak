import { useEffect, useRef, useState } from 'react';
import type { Pack, PackIssue } from '@svoyak/shared';
import { savePack } from './api.js';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const DEBOUNCE_MS = 800;

/** Автосохранение пака: правки летят на сервер сами, состояние всегда видно на экране. */
export function useAutosave(pack: Pack | null): {
  state: SaveState;
  issues: PackIssue[];
  error: string | null;
  saveNow: () => void;
} {
  const [state, setState] = useState<SaveState>('idle');
  const [issues, setIssues] = useState<PackIssue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const latest = useRef<Pack | null>(pack);
  const firstRun = useRef(true);

  latest.current = pack;

  const flush = (): void => {
    const current = latest.current;
    if (!current) return;
    setState('saving');
    void savePack(current)
      .then((result) => {
        setIssues(result.issues);
        setError(null);
        setState('saved');
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : 'Не удалось сохранить');
        setState('error');
      });
  };

  useEffect(() => {
    if (!pack) return;
    // Первую загрузку не сохраняем: иначе каждое открытие пака переписывало бы файл.
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, DEBOUNCE_MS);
    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, [pack]);

  return { state, issues, error, saveNow: flush };
}
