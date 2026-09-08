import { Link } from 'react-router-dom';
import { ServerStatus } from '../ui/ServerStatus.js';

const roles = [
  { to: '/host', title: 'Я ведущий', hint: 'Создать комнату и вести игру' },
  { to: '/join', title: 'Я игрок', hint: 'Войти по коду комнаты' },
  { to: '/board', title: 'Общий экран', hint: 'Табло для телевизора' },
  { to: '/editor', title: 'Редактор паков', hint: 'Собрать свои вопросы' },
];

export default function Landing() {
  return (
    <div className="app-shell flex flex-col items-center justify-center gap-8 p-6">
      <header className="text-center">
        <h1 className="text-[clamp(2.5rem,1rem+8vw,5rem)] leading-none font-black tracking-tight text-gold">
          СВОЯК
        </h1>
        <p className="mt-2 text-muted">Своя игра для своей компании</p>
      </header>

      <nav className="grid w-full max-w-md gap-3">
        {roles.map((role) => (
          <Link
            key={role.to}
            to={role.to}
            className="rounded-2xl border border-line bg-surface px-5 py-4 transition hover:border-gold hover:bg-surface-2"
          >
            <span className="block text-lg font-semibold">{role.title}</span>
            <span className="block text-sm text-muted">{role.hint}</span>
          </Link>
        ))}
      </nav>

      <ServerStatus />
    </div>
  );
}
