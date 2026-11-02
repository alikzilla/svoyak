import { lazy, StrictMode, Suspense, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import './design/fonts.js';
import './index.css';
import { RouteError } from './ui/RouteError.js';

// Каждый экран — свой чанк: телефон игрока не качает редактор, перетаскивание
// и стиль-гид, которые ему никогда не понадобятся.
const Landing = lazy(() => import('./routes/Landing.js'));
const Host = lazy(() => import('./routes/Host.js'));
const Join = lazy(() => import('./routes/Join.js'));
const Play = lazy(() => import('./routes/Play.js'));
const Board = lazy(() => import('./routes/Board.js'));
const Editor = lazy(() => import('./routes/Editor.js'));
const Games = lazy(() => import('./routes/Games.js'));
const Style = lazy(() => import('./routes/Style.js'));
const History = lazy(() => import('./routes/History.js'));

/** Пока чанк экрана грузится, виден фон страницы — без мигающих заглушек. */
const page = (screen: ReactNode): ReactNode => <Suspense fallback={null}>{screen}</Suspense>;

const router = createBrowserRouter([
  {
    // Общая граница ошибок: упавший экран и неизвестный адрес показывают
    // понятную страницу, а не белый лист.
    errorElement: <RouteError />,
    children: [
      { path: '/', element: page(<Landing />) },
      { path: '/host', element: page(<Host />) },
      { path: '/join', element: page(<Join />) },
      { path: '/play', element: page(<Play />) },
      { path: '/board', element: page(<Board />) },
      { path: '/editor', element: page(<Editor />) },
      { path: '/editor/:packId', element: page(<Editor />) },
      { path: '/games', element: page(<Games />) },
      { path: '/style', element: page(<Style />) },
      { path: '/history', element: page(<History />) },
    ],
  },
]);

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Не найден корневой элемент #root');

createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
