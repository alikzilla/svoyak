import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import './design/fonts.js';
import './index.css';
import Landing from './routes/Landing.js';
import Host from './routes/Host.js';
import Join from './routes/Join.js';
import Play from './routes/Play.js';
import Board from './routes/Board.js';
import Editor from './routes/Editor.js';
import Style from './routes/Style.js';

const router = createBrowserRouter([
  { path: '/', element: <Landing /> },
  { path: '/host', element: <Host /> },
  { path: '/join', element: <Join /> },
  { path: '/play', element: <Play /> },
  { path: '/board', element: <Board /> },
  { path: '/editor', element: <Editor /> },
  { path: '/editor/:packId', element: <Editor /> },
  { path: '/style', element: <Style /> },
]);

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Не найден корневой элемент #root');

createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
