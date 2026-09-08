import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ServerStatus } from '../ui/ServerStatus.js';
import { DoodleField } from '../design/Doodles.js';
import { Avatar, colorForIndex } from '../design/Avatar.js';

const ROLES = [
  { to: '/host', title: 'Я ведущий', hint: 'создать комнату и вести игру', tone: 'var(--color-p1)' },
  { to: '/join', title: 'Я играю', hint: 'войти по коду комнаты', tone: 'var(--color-p5)' },
  { to: '/board', title: 'Общий экран', hint: 'табло для телевизора', tone: 'var(--color-p3)' },
  { to: '/editor', title: 'Свои вопросы', hint: 'собрать пак в редакторе', tone: 'var(--color-p4)' },
];

export default function Landing() {
  return (
    <div className="app-shell relative flex flex-col items-center justify-center gap-8 overflow-y-auto p-6 select-none">
      <DoodleField density="full" night />

      <header className="relative grid justify-items-center gap-3">
        <div className="flex gap-1">
          {['Аня', 'Боря', 'Вера'].map((name, index) => (
            <motion.div
              key={name}
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 2.2, repeat: Infinity, delay: index * 0.3, ease: 'easeInOut' }}
            >
              <Avatar seed={name} color={colorForIndex(index)} size={64} />
            </motion.div>
          ))}
        </div>
        <motion.h1
          initial={{ scale: 0.8, rotate: -6, opacity: 0 }}
          animate={{ scale: 1, rotate: -2, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 13 }}
          className="font-pop text-[clamp(3rem,12vw,5.5rem)] leading-none font-black"
          style={{ WebkitTextStroke: '5px #1a1a1a', paintOrder: 'stroke fill', color: '#fff6e9' }}
        >
          Свояк
        </motion.h1>
        <p className="font-body text-lg font-bold">Своя игра для своей компании</p>
      </header>

      <nav className="relative grid w-full max-w-md gap-3">
        {ROLES.map((role, index) => (
          <motion.div
            key={role.to}
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 18, delay: 0.08 * index }}
          >
            <Link to={role.to} className="block">
              <motion.div
                whileHover={{ scale: 1.03, y: -4, rotate: index % 2 ? 1 : -1 }}
                whileTap={{ scale: 0.97, x: 4, y: 5, boxShadow: '0px 0px 0 #1a1a1a' }}
                style={{ backgroundColor: role.tone, boxShadow: '6px 6px 0 #1a1a1a' }}
                className="ink-border text-ink rounded-3xl px-5 py-4"
              >
                <span className="font-pop block text-2xl font-black">{role.title}</span>
                <span className="font-body block text-sm font-bold opacity-80">{role.hint}</span>
              </motion.div>
            </Link>
          </motion.div>
        ))}
      </nav>

      <div className="relative">
        <ServerStatus />
      </div>
    </div>
  );
}
