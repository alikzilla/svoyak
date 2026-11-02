import { useEffect, useState } from 'react';

/** Что выбрал ведущий. «system» — как в настройках ноутбука. */
export type ThemePref = 'light' | 'dark' | 'system';

/** Тот же ключ читает скрипт в index.html до первой отрисовки. */
const KEY = 'svoyak:theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

export function readThemePref(): ThemePref {
  try {
    const stored = localStorage.getItem(KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

function saveThemePref(pref: ThemePref): void {
  try {
    if (pref === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    // Без хранилища выбор проживёт до перезагрузки — дальше снова «как в системе».
  }
}

const systemIsDark = (): boolean => window.matchMedia(DARK_QUERY).matches;

/** Ставит на <html> итоговую тему: светлую или тёмную. */
function applyTheme(pref: ThemePref): void {
  const dark = pref === 'dark' || (pref === 'system' && systemIsDark());
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

/**
 * Выбор темы рабочего места. При «как в системе» тема меняется вслед за
 * системой — например, когда ноутбук сам переходит в тёмный режим вечером.
 */
export function useThemePref(): [ThemePref, (pref: ThemePref) => void] {
  const [pref, setPref] = useState<ThemePref>(readThemePref);

  useEffect(() => {
    applyTheme(pref);
    if (pref !== 'system') return;
    const query = window.matchMedia(DARK_QUERY);
    const onChange = (): void => applyTheme('system');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [pref]);

  // Другая вкладка поменяла тему — подхватываем, чтобы окна не спорили.
  useEffect(() => {
    const onStorage = (event: StorageEvent): void => {
      if (event.key === KEY || event.key === null) setPref(readThemePref());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const choose = (next: ThemePref): void => {
    saveThemePref(next);
    setPref(next);
  };

  return [pref, choose];
}
