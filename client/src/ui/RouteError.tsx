import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { DoodleButton } from '../design/DoodleButton.js';
import { Screen } from './Screen.js';

/**
 * Экран вместо белого листа, если что-то упало при отрисовке. Перезагрузка
 * безопасна: сессия ведущего, игрока и табло лежит в localStorage, и после неё
 * участник возвращается в ту же комнату с тем же счётом.
 */
export function RouteError() {
  const error = useRouteError();

  if (isRouteErrorResponse(error) && error.status === 404) {
    return <Screen title="Такой страницы нет" subtitle="Проверьте адрес или вернитесь на главную." />;
  }

  // Подробности — в консоль: гостю на телевизоре стек вызовов ни к чему.
  console.error(error);
  return (
    <Screen
      title="Что-то сломалось"
      subtitle="Перезагрузите страницу — игра продолжится с того же места, счёт не потеряется."
    >
      <DoodleButton tone="gold" size="lg" onClick={() => window.location.reload()}>
        Перезагрузить
      </DoodleButton>
    </Screen>
  );
}
