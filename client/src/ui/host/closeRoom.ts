import { ask } from '../../net/socket.js';
import { clearSession } from '../../net/session.js';

/**
 * Закрыть комнату насовсем и вернуться к сборке новой игры. Сервер удаляет
 * комнату с диска и шлёт `room:closed` всем, включая ведущего, — по нему
 * экран ведущего сам уходит к новой игре. Если сервер комнату уже не знает
 * (её нет или мы в ней не ведущий), забываем сессию сами: застрять в старой
 * игре ведущий не должен ни при каком ответе.
 */
export async function closeRoom(): Promise<void> {
  const result = await ask('host:closeRoom');
  if (result.ok) return;
  clearSession('host');
  location.reload();
}
