import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Avatar, PLAYER_COLORS, colorForIndex } from '../design/Avatar.js';
import { DoodleButton } from '../design/DoodleButton.js';
import { Doodle, DoodleField } from '../design/Doodles.js';
import { DoodleTimer } from '../design/DoodleTimer.js';
import { PriceCell } from '../design/PriceCell.js';
import { RoughCircle, RoughFrame, RoughUnderline } from '../design/rough.js';
import { FloatingPoints, ScoreNumber } from '../design/ScoreNumber.js';
import { Stamp } from '../design/Stamp.js';

/** Три пары шрифтов на выбор: сравнивать их надо на одном экране и на кириллице. */
const FONT_PAIRS = {
  notebook: {
    title: 'Блокнот',
    hint: 'Caveat + Nunito — ближе всего к «нарисовано маркером в тетради»',
    display: "'Caveat Variable', cursive",
    digits: "'Nunito Variable', system-ui",
    body: "'Nunito Variable', system-ui",
  },
  poster: {
    title: 'Постер',
    hint: 'Unbounded + Rubik — жёстче и современнее, читается с телевизора',
    display: "'Unbounded Variable', system-ui",
    digits: "'Unbounded Variable', system-ui",
    body: "'Rubik Variable', system-ui",
  },
  mix: {
    title: 'Микс',
    hint: 'Caveat для заголовков, Unbounded для цифр — рукописный вид, но счёт весомый',
    display: "'Caveat Variable', cursive",
    digits: "'Unbounded Variable', system-ui",
    body: "'Nunito Variable', system-ui",
  },
} as const;

type FontKey = keyof typeof FONT_PAIRS;

const PLAYER_NAMES = ['Аня', 'Боря', 'Вера', 'Гоша', 'Даша', 'Егор'];

/** Плотность бумаги: сравнивать оттенки надо живьём, рядом с цветными элементами. */
const PAPER_TONES = {
  cream: { title: 'сливочная', value: '#fff6e9', card: '#ffffff' },
  kraft: { title: 'крафт', value: '#f0e2c8', card: '#fdf6e7' },
  sand: { title: 'песочная', value: '#e4d2b0', card: '#f7ecd6' },
  clay: { title: 'глина', value: '#d8c3a0', card: '#f2e6cd' },
} as const;

type PaperKey = keyof typeof PAPER_TONES;

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4">
      <header>
        <h2 className="font-display text-4xl font-bold">{title}</h2>
        <RoughUnderline className="w-40" seed={title.length} />
        {note && <p className="font-body text-ink-soft mt-1 max-w-prose">{note}</p>}
      </header>
      {children}
    </section>
  );
}

export default function Style() {
  const [fontKey, setFontKey] = useState<FontKey>('mix');
  const [calm, setCalm] = useState(false);
  const [density, setDensity] = useState<'full' | 'light' | 'off'>('full');
  const [paper, setPaper] = useState<PaperKey>('kraft');
  const [seedSalt, setSeedSalt] = useState(0);
  const [score, setScore] = useState(1200);
  const [points, setPoints] = useState<{ amount: number; key: number } | null>(null);
  const [verdict, setVerdict] = useState<'yes' | 'no' | null>(null);
  const [played, setPlayed] = useState<number[]>([300]);
  const [timerLeft, setTimerLeft] = useState(8);
  const [running, setRunning] = useState(false);
  const [answering, setAnswering] = useState<number | null>(null);
  const pair = FONT_PAIRS[fontKey];
  const stampTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setTimerLeft((left) => {
        if (left <= 0.1) {
          setRunning(false);
          return 0;
        }
        return Math.round((left - 0.1) * 10) / 10;
      });
    }, 100);
    return () => clearInterval(id);
  }, [running]);

  const celebrate = (color: string): void => {
    void confetti({
      particleCount: 90,
      spread: 75,
      origin: { y: 0.6 },
      colors: [color, '#1a1a1a', '#fff6e9'],
      scalar: 1.1,
    });
  };

  const judge = (result: 'yes' | 'no'): void => {
    setVerdict(result);
    setScore((current) => current + (result === 'yes' ? 500 : -500));
    setPoints({ amount: result === 'yes' ? 500 : -500, key: Date.now() });
    setAnswering(result === 'yes' ? 0 : null);
    if (result === 'yes') celebrate(colorForIndex(0));
    if (stampTimer.current) clearTimeout(stampTimer.current);
    stampTimer.current = window.setTimeout(() => setVerdict(null), 1400);
  };

  return (
    <div
      className={`paper-scene min-h-dvh ${calm ? 'calm' : ''}`}
      style={
        {
          '--paper-tone': PAPER_TONES[paper].value,
          '--card-tone': PAPER_TONES[paper].card,
          '--font-display': pair.display,
          '--font-digits': pair.digits,
          '--font-body-active': pair.body,
          fontFamily: pair.body,
        } as React.CSSProperties
      }
    >
      <style>{`
        .font-display { font-family: var(--font-display); }
        .font-digits { font-family: var(--font-digits); }
        .font-body { font-family: var(--font-body-active); }
        .font-pop { font-family: var(--font-digits); }
        .font-hand { font-family: var(--font-display); }
      `}</style>

      <DoodleField density={calm ? 'off' : density} />

      <div className="relative mx-auto grid max-w-5xl gap-14 px-5 py-10">
        {/* Герой: самая характерная вещь игры — кнопка, которую хочется нажать. */}
        <header className="grid gap-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <motion.h1
                initial={{ rotate: -4, scale: 0.9, opacity: 0 }}
                animate={{ rotate: -2, scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 14 }}
                className="font-display text-7xl leading-none font-bold"
              >
                Свояк
              </motion.h1>
              <p className="font-body text-ink-soft mt-2 text-lg">
                Стиль игры: что нарисовано и как оно себя ведёт. Всё здесь живое — трогайте.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <DoodleButton size="sm" tone={calm ? 'p3' : 'paper'} tilt={0.8} onClick={() => setCalm((v) => !v)}>
                {calm ? 'спокойный режим' : 'обычный режим'}
              </DoodleButton>
              <DoodleButton
                size="sm"
                tone="paper"
                tilt={-0.8}
                onClick={() =>
                  setDensity((current) =>
                    current === 'full' ? 'light' : current === 'light' ? 'off' : 'full',
                  )
                }
              >
                дудлы: {density === 'full' ? 'полный' : density === 'light' ? 'лёгкий' : 'выключены'}
              </DoodleButton>
            </div>
          </div>

          <RoughFrame seed={2} fill="var(--card-tone)" contentClassName="grid place-items-center py-10">
            <div className="grid justify-items-center gap-4">
              <DoodleButton size="xl" tone="p1" idle onClick={() => celebrate(colorForIndex(0))}>
                ЖМИ
              </DoodleButton>
              <p className="font-body text-ink-soft text-sm">
                Наведите — приподнимается. Нажмите — вдавливается в тень.
              </p>
            </div>
          </RoughFrame>
        </header>

        <Section
          title="Бумага"
          note="Фон задаёт настроение всей игры: чем темнее лист, тем сочнее на нём цветные кнопки. Выберите плотность — остальные экраны поедут на ней."
        >
          <div className="flex flex-wrap gap-3">
            {(Object.keys(PAPER_TONES) as PaperKey[]).map((key) => (
              <button key={key} onClick={() => setPaper(key)} className="relative">
                <RoughFrame
                  seed={key.length * 4}
                  fill={PAPER_TONES[key].value}
                  className="w-40"
                  contentClassName="grid justify-items-center gap-1 px-3 py-5"
                >
                  <span className="font-display text-2xl font-bold">{PAPER_TONES[key].title}</span>
                  <code className="font-body text-ink-soft text-xs">{PAPER_TONES[key].value}</code>
                </RoughFrame>
                {paper === key && (
                  <motion.span
                    initial={{ scale: 0, rotate: -30 }}
                    animate={{ scale: 1, rotate: -10 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 12 }}
                    className="border-ink bg-p5 absolute -top-4 -right-3 grid size-11 place-items-center rounded-full border-4"
                  >
                    <Doodle name="check" size={22} strokeWidth={6} />
                  </motion.span>
                )}
              </button>
            ))}
          </div>
        </Section>

        <Section
          title="Шрифты"
          note="Все три пары с кириллицей и подключены локально, без Google CDN — игра должна работать в сети без интернета. Выберите пару, дальше раскатаю её на все экраны."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            {(Object.keys(FONT_PAIRS) as FontKey[]).map((key) => (
              <button key={key} onClick={() => setFontKey(key)} className="relative text-left">
                <RoughFrame
                  seed={key.length * 5}
                  fill={fontKey === key ? '#ffe6ad' : 'var(--card-tone)'}
                  className="h-full"
                  contentClassName="p-4"
                >
                  <p style={{ fontFamily: FONT_PAIRS[key].display }} className="text-3xl font-bold">
                    Кот в мешке
                  </p>
                  <p style={{ fontFamily: FONT_PAIRS[key].digits }} className="text-4xl font-black">
                    1500
                  </p>
                  <p style={{ fontFamily: FONT_PAIRS[key].body }} className="mt-2 text-sm">
                    Съешь ещё этих мягких французских булок да выпей чаю
                  </p>
                  <p className="font-body text-ink-soft mt-2 text-xs">{FONT_PAIRS[key].hint}</p>
                </RoughFrame>
                {fontKey === key && (
                  <motion.span
                    initial={{ scale: 0, rotate: -30 }}
                    animate={{ scale: 1, rotate: -10 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 12 }}
                    className="absolute -top-4 -right-3 grid size-12 place-items-center rounded-full border-4 border-ink bg-p5"
                  >
                    <Doodle name="check" size={26} strokeWidth={6} />
                  </motion.span>
                )}
              </button>
            ))}
          </div>
        </Section>

        <Section
          title="Цвет"
          note="Шесть цветов игроков: цвет закрепляется при входе и дальше ходит за человеком — аватар, рамка, счёт, летящие очки. Три служебных цвета отвечают за вердикт и ставки."
        >
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {PLAYER_COLORS.map((color, index) => (
              <RoughFrame key={color} seed={index * 3 + 1} fill={color} contentClassName="grid gap-1 p-4">
                <span className="font-display text-2xl font-bold text-white drop-shadow-[2px_2px_0_#1a1a1a]">
                  {PLAYER_NAMES[index]}
                </span>
                <code className="font-body text-xs text-ink/70">{color}</code>
              </RoughFrame>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['верно', 'var(--color-yes)'],
              ['неверно', 'var(--color-no)'],
              ['ставка и аукцион', 'var(--color-gold)'],
            ].map(([label, color]) => (
              <RoughFrame key={label} seed={label!.length} fill={color} contentClassName="p-4">
                <span className="font-display text-2xl font-bold text-white drop-shadow-[2px_2px_0_#1a1a1a]">
                  {label}
                </span>
              </RoughFrame>
            ))}
          </div>
        </Section>

        <Section title="Кнопки" note="Одна форма на все случаи: цвет говорит, что произойдёт.">
          <div className="flex flex-wrap items-center gap-4">
            <DoodleButton tone="p1" size="lg">Начать игру</DoodleButton>
            <DoodleButton tone="yes" onClick={() => judge('yes')}>Верно</DoodleButton>
            <DoodleButton tone="no" onClick={() => judge('no')}>Неверно</DoodleButton>
            <DoodleButton tone="gold" tilt={1}>Ва-банк</DoodleButton>
            <DoodleButton tone="paper" tilt={0.6}>Ещё время</DoodleButton>
            <DoodleButton tone="p1" disabled>Недоступно</DoodleButton>
          </div>
        </Section>

        <Section
          title="Табло"
          note="Клетка подпрыгивает под курсором. Сыгранную перечёркивает нарисованный крест — сразу видно, что осталось."
        >
          <div className="grid grid-cols-5 gap-3">
            {[100, 200, 300, 400, 500].map((price, index) => (
              <PriceCell
                key={price}
                price={price}
                tilt={index % 2 === 0 ? -1.2 : 1.2}
                played={played.includes(price)}
                onOpen={() => setPlayed((current) => [...current, price])}
              />
            ))}
          </div>
          <DoodleButton size="sm" tone="paper" onClick={() => setPlayed([])}>
            вернуть клетки
          </DoodleButton>
        </Section>

        <Section
          title="Игроки"
          note="Персонаж собирается из головы, глаз, рта и причёски по имени игрока — у одного человека он всегда один и тот же. Моргает, покачивается, подпрыгивает когда отвечает и сдувается когда ошибся."
        >
          <div className="flex flex-wrap gap-4">
            {PLAYER_NAMES.map((name, index) => (
              <motion.div
                key={name}
                whileHover={{ scale: 1.08, rotate: index % 2 ? 3 : -3 }}
                className="relative"
                onClick={() => setAnswering(answering === index ? null : index)}
              >
                <RoughFrame
                  seed={index * 9 + 2}
                  fill="var(--card-tone)"
                  className="w-32 cursor-pointer"
                  contentClassName="grid justify-items-center gap-1 px-3 py-4"
                >
                  <Avatar
                    seed={`${name}-${seedSalt}`}
                    color={colorForIndex(index)}
                    size={78}
                    mood={answering === index ? 'answering' : verdict === 'no' && index === 1 ? 'wrong' : 'idle'}
                  />
                  <span className="font-display text-2xl font-bold">{name}</span>
                  <span className="font-digits text-xl font-black tabular-nums">
                    {(index + 1) * 300}
                  </span>
                </RoughFrame>
                {answering === index && <RoughCircle seed={index} color={colorForIndex(index)} />}
              </motion.div>
            ))}
          </div>
          <div className="flex gap-3">
            <DoodleButton size="sm" tone="paper" onClick={() => setSeedSalt((v) => v + 1)}>
              другие лица
            </DoodleButton>
            <DoodleButton size="sm" tone="p3" onClick={() => setAnswering(0)}>
              Аня отвечает
            </DoodleButton>
          </div>
        </Section>

        <Section title="Таймер" note="Считает окно на кнопку. Последние три секунды — краснеет, пульсирует и трясётся.">
          <div className="max-w-xl">
            <DoodleTimer progress={timerLeft / 8} seconds={Math.ceil(timerLeft)} label="до конца" />
          </div>
          <div className="flex gap-3">
            <DoodleButton size="sm" tone="p1" onClick={() => { setTimerLeft(8); setRunning(true); }}>
              запустить
            </DoodleButton>
            <DoodleButton size="sm" tone="paper" onClick={() => { setTimerLeft(2.9); setRunning(true); }}>
              последние секунды
            </DoodleButton>
          </div>
        </Section>

        <Section
          title="Вердикт"
          note="Счёт наматывается прокруткой, очки улетают вверх или падают вниз, поверх шлёпается штамп. Верный ответ добавляет конфетти цветом игрока."
        >
          <RoughFrame seed={31} fill="var(--card-tone)" contentClassName="grid place-items-center gap-4 py-10">
            <div className="relative grid place-items-center">
              <ScoreNumber value={score} size="xl" color={colorForIndex(0)} />
              <AnimatePresence>
                {points && <FloatingPoints key={points.key} amount={points.amount} shown />}
              </AnimatePresence>
            </div>
            <AnimatePresence>
              {verdict && (
                <Stamp
                  key={verdict}
                  shown
                  tone={verdict}
                  text={verdict === 'yes' ? 'ВЕРНО!' : 'МИМО!'}
                />
              )}
            </AnimatePresence>
            <div className="flex gap-3">
              <DoodleButton size="sm" tone="yes" onClick={() => judge('yes')}>+500</DoodleButton>
              <DoodleButton size="sm" tone="no" onClick={() => judge('no')}>−500</DoodleButton>
            </div>
          </RoughFrame>
        </Section>

        <Section
          title="Ночная сцена"
          note="Финал уходит в тёмно-синий: дудлы начинают светиться, цвета игроков остаются теми же."
        >
          <div className="night-scene relative overflow-hidden rounded-3xl border-4 border-ink p-8">
            <DoodleField density={calm ? 'off' : 'light'} night />
            <div className="relative grid gap-5">
              <h3 className="font-display text-5xl font-bold">Финал</h3>
              <p className="font-body max-w-prose text-lg text-white/80">
                Осталась одна тема. Ставки делают вслепую — вопрос ещё не показали.
              </p>
              <div className="flex flex-wrap items-center gap-6">
                {PLAYER_NAMES.slice(0, 3).map((name, index) => (
                  <div key={name} className="grid justify-items-center gap-1">
                    <Avatar seed={`${name}-${seedSalt}`} color={colorForIndex(index)} size={64} />
                    <span className="font-display text-xl">{name}</span>
                    <span className="font-body text-gold text-sm">ставка скрыта</span>
                  </div>
                ))}
                <Doodle name="star" size={54} color="#ffd76a" strokeWidth={3} />
              </div>
            </div>
          </div>
        </Section>

        <footer className="font-body text-ink-soft pb-16 text-sm">
          Дальше по плану: экран игрока на телефоне, табло ведущего, анимации игрового цикла,
          спецсцены и звук. Скажите, что поменять здесь, — и раскатаю.
        </footer>
      </div>
    </div>
  );
}
