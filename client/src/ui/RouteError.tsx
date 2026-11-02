import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { DoodleButton } from '../design/DoodleButton.js';
import { DoodleField } from '../design/Doodles.js';

/**
 * Экран вместо белого листа, если что-то упало при отрисовке. Перезагрузка
 * безопасна: сессия ведущего, игрока и табло лежит в localStorage, и после неё
 * участник возвращается в ту же комнату с тем же счётом.
 */
export function RouteError() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  // Подробности — в консоль: гостю на телевизоре стек вызовов ни к чему.
  if (!notFound) console.error(error);

  return (
    <div className="app-shell on-scene relative isolate flex flex-col items-center justify-center gap-6 p-6 text-center">
      <DoodleField density="light" night />
      <h1
        className="font-pop relative text-[clamp(2rem,1rem+5vw,3.5rem)] leading-tight font-black"
        style={{ WebkitTextStroke: '4px #1a1a1a', paintOrder: 'stroke fill', color: '#fff6e9' }}
      >
        {notFound ? 'Такой страницы нет' : 'Что-то сломалось'}
      </h1>
      <p className="font-body relative max-w-prose text-lg font-bold text-pretty">
        {notFound
          ? 'Проверьте адрес или вернитесь на главную.'
          : 'Перезагрузите страницу — игра продолжится с того же места, счёт не потеряется.'}
      </p>
      {!notFound && (
        <DoodleButton tone="p5" size="lg" onClick={() => window.location.reload()}>
          Перезагрузить
        </DoodleButton>
      )}
      <Link to="/" className="font-body relative text-sm font-bold underline underline-offset-4 opacity-80">
        на главную
      </Link>
    </div>
  );
}
