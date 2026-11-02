import type { RequestHandler } from 'express';

/** Имя хоста из заголовка Host: без порта и без скобок IPv6. */
function hostname(host: string): string {
  if (host.startsWith('[')) return host.slice(1, host.indexOf(']')).toLowerCase();
  return host.replace(/:\d+$/, '').toLowerCase();
}

function isPrivateIPv4(name: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(name);
  if (!match) return false;
  const [a, b] = [Number(match[1]), Number(match[2])];
  return (
    a === 127 ||
    a === 10 ||
    (a === 192 && b === 168) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 169 && b === 254)
  );
}

/**
 * Пришёл ли запрос по адресу домашней сети. Туннель (cloudflared, ngrok)
 * передаёт свой публичный Host как есть, и подделать его снаружи нельзя:
 * по нему провайдер туннеля и находит, куда вести запрос.
 */
export function isHomeHost(host: string | undefined): boolean {
  if (!host) return false;
  const name = hostname(host);
  if (name === 'localhost' || name.endsWith('.localhost') || name.endsWith('.local')) return true;
  if (name === '::1' || name.startsWith('fe80:') || /^f[cd][0-9a-f]{2}:/.test(name)) return true;
  return isPrivateIPv4(name);
}

/** Пак целиком — это ответы на все вопросы. */
const FULL_PACK = /^\/packs\/[^/]+\/?$/;

/**
 * Через туннель идёт только игра. Редактор и конструктор игр — дело ведущего
 * за ноутбуком: кто угодно со ссылкой не должен ни удалить пак, ни загрузить
 * в память полгигабайта .siq, ни прочитать ответы перед вопросом.
 */
export function tunnelGuard(): RequestHandler {
  return (req, res, next) => {
    if (isHomeHost(req.headers.host)) return next();
    const reading = req.method === 'GET' || req.method === 'HEAD';
    if (reading && !FULL_PACK.test(req.path)) return next();
    res.status(403).json({
      error: 'Паки и игры правятся только из домашней сети — через туннель доступна только сама игра',
    });
  };
}
