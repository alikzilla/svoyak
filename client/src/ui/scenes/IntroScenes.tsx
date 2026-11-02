import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { introElapsedMs, roundIntroStage, type TimerView } from '@svoyak/shared';
import type { ClockReading } from '../../net/useClock.js';
import { JumpingLetters, TITLE_INK } from './RoundIntro.js';

type ReadClock = () => ClockReading;

interface IntroSceneProps {
  timer: TimerView | null;
  /** Часы сервера: окончание заставки приходит в его времени, а часы телевизора могут врать. */
  readClock: ReadClock;
}

const serverNow = (readClock: ReadClock): number => Date.now() + readClock().offset;

/** Плашка темы — как заголовок строки на табло: «это тема» читается сразу. */
const PLATE =
  'ink-border bg-p1 font-pop rounded-3xl px-8 py-3 text-center leading-tight font-black text-balance text-white hyphens-auto';
const PLATE_SHADOW: CSSProperties = { boxShadow: '6px 6px 0 #1a1a1a', overflowWrap: 'break-word' };
const tilt = (index: number): number => (index % 2 === 0 ? -1.2 : 1.2);

/** Края окна с титрами растворяются, а не режут плашку пополам. */
const FADE_EDGES = 'linear-gradient(transparent, #000 12%, #000 88%, transparent)';

/**
 * «Темы игры»: все темы пака плывут снизу вверх, как титры. Скорость
 * постоянная, длительность задаёт сервер. Положение списка — это CSS-анимация
 * с отрицательной задержкой: экран, открытый посреди заставки, сразу ставит
 * список туда, где он должен быть, а пауза ведущего его замораживает.
 */
export function GameThemesScene({ themes, timer, readClock }: IntroSceneProps & { themes: string[] }) {
  const calm = useReducedMotion() ?? false;
  const endsAt = timer?.endsAt;
  const remainingMs = timer?.remainingMs ?? null;
  // Задержку считаем один раз на состояние таймера: пересчёт на каждом
  // рендере (реакции, счёт) дёргал бы плывущий список.
  // oxlint-disable-next-line react/exhaustive-deps -- таймер меняется только через endsAt и remainingMs
  const elapsed = useMemo(() => introElapsedMs(timer, serverNow(readClock)), [endsAt, remainingMs, readClock]);
  const crawl = timer !== null && Number.isFinite(elapsed) && !calm;

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-6">
      <h2
        className="font-pop flex flex-wrap justify-center text-center text-[clamp(2.5rem,min(7vw,11dvh),5.5rem)] leading-none font-black"
        style={TITLE_INK}
      >
        <JumpingLetters text="Темы игры" />
      </h2>

      <div
        className="relative min-h-0 w-full flex-1 overflow-hidden"
        style={{ maskImage: FADE_EDGES, WebkitMaskImage: FADE_EDGES }}
      >
        {crawl ? (
          <ul
            className="intro-crawl absolute inset-x-0 grid justify-items-center gap-4 px-6"
            style={{
              animationDuration: `${timer.totalMs}ms`,
              animationDelay: `-${elapsed}ms`,
              animationPlayState: remainingMs !== null ? 'paused' : 'running',
            }}
          >
            {themes.map((title, index) => (
              <li
                key={index}
                lang="ru"
                className={`${PLATE} max-w-4xl text-[clamp(1.75rem,min(3.6vw,6dvh),3.25rem)]`}
                style={{ ...PLATE_SHADOW, rotate: `${tilt(index)}deg` }}
              >
                {title}
              </li>
            ))}
          </ul>
        ) : (
          // Без движения (так просит система или заставку не с чего считать) —
          // все темы разом, плотной россыпью.
          <ul className="flex h-full flex-wrap content-center justify-center gap-3 px-6">
            {themes.map((title, index) => (
              <li
                key={index}
                lang="ru"
                className={`${PLATE} text-[clamp(1.1rem,min(2vw,3.5dvh),1.75rem)]`}
                style={{ ...PLATE_SHADOW, rotate: `${tilt(index)}deg` }}
              >
                {title}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Сколько заставки прошло — с тиком, пока она идёт. На паузе остаток
 *  приходит готовым, и тикать нечему. */
function useIntroElapsed(timer: TimerView | null, readClock: ReadClock): number {
  const [now, setNow] = useState(() => serverNow(readClock));
  const running = timer !== null && timer.remainingMs === null;
  const endsAt = timer?.endsAt;

  useEffect(() => {
    setNow(serverNow(readClock));
    if (!running) return;
    const id = window.setInterval(() => setNow(serverNow(readClock)), 100);
    return () => window.clearInterval(id);
  }, [running, endsAt, readClock]);

  return introElapsedMs(timer, now);
}

/**
 * Заставка раунда: название прыгает по буквам, потом темы раунда выскакивают
 * по одной, и название уезжает вверх, освобождая им место.
 */
export function RoundThemesScene({
  title,
  themes,
  timer,
  readClock,
}: IntroSceneProps & { title: string; themes: string[] }) {
  const elapsed = useIntroElapsed(timer, readClock);
  const stage = roundIntroStage(elapsed, themes.length);
  // Что уже было на экране в момент открытия, не анимируем заново: телевизор
  // перезагрузили посреди заставки, а не начали её сначала.
  const [opened] = useState(stage);
  const twoColumns = themes.length > 6;

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[clamp(1rem,4dvh,2.5rem)]">
      <motion.h2
        layout
        className="font-pop flex flex-wrap justify-center px-6 text-center text-[clamp(2.5rem,min(8vw,12dvh),6rem)] leading-none font-black"
        style={TITLE_INK}
      >
        <JumpingLetters text={title} animate={!opened.titleDone} />
      </motion.h2>

      {stage.shown > 0 && (
        <ul
          className={`grid w-full max-w-5xl gap-[clamp(0.5rem,1.8dvh,1rem)] px-6 ${
            twoColumns ? 'grid-cols-2' : 'justify-items-center'
          }`}
        >
          {themes.slice(0, stage.shown).map((theme, index) => (
            <motion.li
              key={index}
              layout
              lang="ru"
              initial={index < opened.shown ? false : { scale: 0.2, opacity: 0, rotate: -10 }}
              animate={{ scale: 1, opacity: 1, rotate: tilt(index) }}
              transition={{ type: 'spring', stiffness: 420, damping: 13 }}
              className={`${PLATE} text-[clamp(1.5rem,min(3.2vw,5dvh),3rem)]`}
              style={PLATE_SHADOW}
            >
              {theme}
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}
