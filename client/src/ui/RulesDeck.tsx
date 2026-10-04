import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { MODIFIER_HINTS, MODIFIER_TITLES, type ModifierKind } from '@svoyak/shared';
import { Avatar, colorForIndex } from '../design/Avatar.js';
import { Doodle } from '../design/Doodles.js';
import { DoodleButton } from '../design/DoodleButton.js';
import { RoughCross, RoughFrame } from '../design/rough.js';

/**
 * Правила на общем экране, пока гости заходят. Ведущий листает их с ноутбука
 * и рассказывает вслух: на слайде одна мысль крупно, остальное — словами.
 *
 * Слайды свёрстаны на сцене 1920×1080 и масштабируются целиком: телевизор,
 * ноутбук и проектор показывают одну и ту же раскладку, ничего не переносится.
 */

const STAGE_W = 1920;
const STAGE_H = 1080;

const INK = '#1a1a1a';
const STROKE = { WebkitTextStroke: '6px #1a1a1a', paintOrder: 'stroke fill', color: '#fff6e9' } as const;

interface RulesDeckProps {
  onClose: () => void;
}

export function RulesDeck({ onClose }: RulesDeckProps) {
  const [index, setIndex] = useState(0);
  const [scale, setScale] = useState({ factor: 1, x: 0, y: 0 });
  const viewport = useRef<HTMLDivElement>(null);
  const wheelLock = useRef(0);
  const swipeStart = useRef<number | null>(null);

  const last = SLIDES.length - 1;
  const go = useCallback((next: number) => setIndex(Math.max(0, Math.min(last, next))), [last]);

  // Сцена вписывается в окно целиком: поля по краям лучше, чем перенос строк.
  useLayoutEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const fit = (): void => {
      const { width, height } = node.getBoundingClientRect();
      const factor = Math.min(width / STAGE_W, height / STAGE_H);
      setScale({ factor, x: (width - STAGE_W * factor) / 2, y: (height - STAGE_H * factor) / 2 });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(event.key)) {
        event.preventDefault();
        go(index + 1);
      } else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(event.key)) {
        event.preventDefault();
        go(index - 1);
      } else if (event.key === 'Home') {
        go(0);
      } else if (event.key === 'End') {
        go(last);
      } else if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, index, last, onClose]);

  const Slide = SLIDES[index]!;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Как играть"
      className="bg-scene fixed inset-0 z-50 flex flex-col select-none"
    >
      <div
        ref={viewport}
        className="relative min-h-0 flex-1 overflow-hidden"
        // Колесо мыши листает, но не чаще раза в полсекунды: тачпад шлёт десятки событий.
        onWheel={(event) => {
          const now = Date.now();
          if (now - wheelLock.current < 500 || Math.abs(event.deltaY) < 20) return;
          wheelLock.current = now;
          go(index + (event.deltaY > 0 ? 1 : -1));
        }}
        onPointerDown={(event) => {
          swipeStart.current = event.clientX;
        }}
        onPointerUp={(event) => {
          const start = swipeStart.current;
          swipeStart.current = null;
          if (start === null) return;
          const dx = event.clientX - start;
          if (Math.abs(dx) > 60) go(index + (dx < 0 ? 1 : -1));
          else go(index + 1);
        }}
      >
        <div
          className="absolute top-0 left-0 origin-top-left overflow-hidden"
          style={{
            width: STAGE_W,
            height: STAGE_H,
            transform: `translate(${scale.x}px, ${scale.y}px) scale(${scale.factor})`,
          }}
        >
          {/* Слайд виден сразу: движение только сдвигом. Если браузер телевизора
              притормозит анимации, на экране всё равно будет текст, а не пустота. */}
          <motion.section
            key={index}
            aria-roledescription="слайд"
            aria-label={`${index + 1} из ${SLIDES.length}`}
            className="text-scene-ink absolute inset-0 px-[120px] py-[96px]"
            initial={{ x: 48 }}
            animate={{ x: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <Slide />
          </motion.section>
        </div>
      </div>

      {/* Управление живёт вне сцены: оно для ведущего, а не часть слайда. */}
      <nav className="on-scene flex shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-3 px-3 pt-2 pb-5">
        <button type="button" onClick={onClose} className="btn btn-quiet font-body text-sm">
          Закрыть
        </button>
        <DoodleButton tone="paper" size="sm" tilt={0} disabled={index === 0} onClick={() => go(index - 1)}>
          ← назад
        </DoodleButton>
        <span className="font-pop min-w-16 text-center text-lg font-black tabular-nums" aria-live="polite">
          {index + 1} / {SLIDES.length}
        </span>
        <DoodleButton tone="p5" size="sm" tilt={0} disabled={index === last} onClick={() => go(index + 1)}>
          дальше →
        </DoodleButton>
      </nav>
    </div>
  );
}

/* ── Общие куски слайдов ─────────────────────────────────────────────── */

function Title({ children, tilt = -1.5 }: { children: ReactNode; tilt?: number }) {
  return (
    <h2
      className="font-pop text-[112px] leading-none font-black"
      style={{ ...STROKE, transform: `rotate(${tilt}deg)`, transformOrigin: 'left center' }}
    >
      {children}
    </h2>
  );
}

function Lead({ children }: { children: ReactNode }) {
  return <p className="font-body mt-8 max-w-[1300px] text-[48px] leading-tight font-bold text-pretty">{children}</p>;
}

/** Появление по очереди сдвигом снизу. Прозрачность не трогаем: текст виден с первого кадра. */
function Rise({ children, order = 0, className = '' }: { children: ReactNode; order?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { y: 36 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.12 + order * 0.12 }}
    >
      {children}
    </motion.div>
  );
}

function Paper({ children, seed, className = '' }: { children: ReactNode; seed: number; className?: string }) {
  return (
    <RoughFrame fill="var(--color-card)" seed={seed} className={className} contentClassName="text-ink h-full px-12 py-10">
      {children}
    </RoughFrame>
  );
}

/** Плашка-кнопка в том же виде, что на телефоне игрока. */
function BuzzerChip({ fill, label, caption }: { fill: string; label: string; caption: string }) {
  return (
    <div className="grid justify-items-center gap-5">
      <div
        className="grid h-[260px] w-[420px] place-items-center rounded-[40px] border-[6px]"
        style={{ backgroundColor: fill, borderColor: INK, boxShadow: `10px 10px 0 ${INK}` }}
      >
        <span className="font-pop text-[76px] font-black" style={{ ...STROKE, WebkitTextStroke: '5px #1a1a1a' }}>
          {label}
        </span>
      </div>
      <p className="font-body text-[36px] font-bold">{caption}</p>
    </div>
  );
}

function Arrow() {
  return <Doodle name="arrow" size={110} color="#ffc53d" strokeWidth={5} className="shrink-0 rotate-[18deg]" />;
}

/* ── Слайды ──────────────────────────────────────────────────────────── */

function Cover() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <Rise className="flex gap-6">
        {['Аня', 'Боря', 'Вера', 'Гоша'].map((name, i) => (
          <motion.div
            key={name}
            animate={{ y: [0, -14, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.25, ease: 'easeInOut' }}
          >
            <Avatar seed={name} color={colorForIndex(i)} size={150} />
          </motion.div>
        ))}
      </Rise>
      <Rise order={1}>
        <h2 className="font-pop mt-12 text-[200px] leading-none font-black" style={{ ...STROKE, WebkitTextStroke: '9px #1a1a1a', transform: 'rotate(-2deg)' }}>
          Как играть
        </h2>
      </Rise>
      <Rise order={2}>
        <p className="font-body mt-10 text-[52px] font-bold">Вопросы, кнопка и немного везения</p>
      </Rise>
    </div>
  );
}

function BuzzerSlide() {
  return (
    <div className="flex h-full flex-col">
      <Title>Кнопка</Title>
      <Lead>Ведущий читает вопрос и сам открывает кнопку. Жмите, когда она станет зелёной.</Lead>
      <Rise order={1} className="my-auto flex items-end justify-center gap-16">
        <BuzzerChip fill="#6a5fb8" label="ждите" caption="ведущий читает" />
        <BuzzerChip fill="var(--color-yes)" label="ЖМИ" caption="кнопка открыта" />
        <BuzzerChip fill="var(--color-no)" label="рано!" caption="фальстарт: пара секунд блокировки" />
      </Rise>
      <Rise order={2}>
        <p className="font-body mt-14 text-center text-[36px] font-bold opacity-85">
          Побеждает самое раннее нажатие, а не самый быстрый интернет.
        </p>
      </Rise>
    </div>
  );
}

function AnswerSlide() {
  return (
    <div className="flex h-full flex-col">
      <Title tilt={1.2}>Ответ вслух</Title>
      <Lead>Кто нажал первым, тот и отвечает. Решает ведущий.</Lead>
      <div className="my-auto grid grid-cols-2 gap-14">
        <Rise order={1}>
          <Paper seed={31} className="h-[360px]">
            <p className="font-hand text-yes-ink text-[110px] leading-none font-bold" style={{ transform: 'rotate(-6deg)' }}>
              ВЕРНО!
            </p>
            <p className="font-body mt-8 text-[44px] leading-tight font-bold">+ цена вопроса и право хода</p>
          </Paper>
        </Rise>
        <Rise order={2}>
          <Paper seed={37} className="h-[360px]">
            <p className="font-hand text-no-ink text-[110px] leading-none font-bold" style={{ transform: 'rotate(-6deg)' }}>
              МИМО!
            </p>
            <p className="font-body mt-8 text-[44px] leading-tight font-bold">
              − цена, и кнопка снова открыта для остальных
            </p>
          </Paper>
        </Rise>
      </div>
      <Rise order={3}>
        <p className="font-body mt-10 text-[34px] font-bold opacity-85">В спокойном режиме за ошибку не штрафуют.</p>
      </Rise>
    </div>
  );
}

function TurnSlide() {
  return (
    <div className="flex h-full flex-col">
      <Title>Ваш ход</Title>
      <Lead>Назовите тему и цену вслух. Вопрос открывает ведущий.</Lead>
      <Rise order={1} className="my-auto">
        <div className="grid grid-cols-[1.6fr_repeat(5,1fr)] items-stretch gap-4">
          <div
            className="font-pop bg-p1 flex items-center rounded-3xl border-[5px] px-8 text-[44px] font-black text-white"
            style={{ borderColor: INK, boxShadow: `6px 6px 0 ${INK}` }}
          >
            Птицы
          </div>
          {[100, 200, 300, 400, 500].map((price, i) => (
            <div key={price} className="relative" style={{ transform: `rotate(${i % 2 ? 1.1 : -1.1}deg)` }}>
              {/* Та же клетка, что на табло, но в размере сцены 1920×1080. */}
              <RoughFrame
                seed={price}
                fill={i === 0 ? '#d8cdb8' : 'var(--color-card)'}
                className="h-[170px] w-full"
                contentClassName="grid place-items-center"
              >
                <span className={`font-pop text-[64px] font-black tabular-nums ${i === 0 ? 'text-ink/20' : 'text-p1'}`}>
                  {price}
                </span>
              </RoughFrame>
              {i === 0 && <RoughCross seed={price} color="#c2493c" />}
              {i === 2 && (
                <motion.div
                  className="pointer-events-none absolute -top-[130px] left-1/2 -translate-x-1/2"
                  animate={{ y: [0, -12, 0] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Doodle name="arrow" size={110} color="#ffc53d" strokeWidth={6} className="rotate-[100deg]" />
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </Rise>
      <Rise order={2}>
        <p className="font-pop mt-14 text-center text-[64px] font-black" style={{ color: '#ffc53d' }}>
          «Птицы за триста!»
        </p>
      </Rise>
    </div>
  );
}

function CatSlide() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-10">
        <Title>Кот в мешке</Title>
        <Doodle name="cat" size={150} color="#fff6e9" strokeWidth={4} />
      </div>
      <Lead>Этот вопрос нужно отдать другому игроку. Видны только тема и цена кота.</Lead>
      <div className="my-auto grid grid-cols-[1fr_auto_1fr] items-center gap-10">
        <Rise order={1}>
          <Paper seed={41} className="h-[300px]">
            <p className="font-pop text-[48px] font-black">Отвечает только он</p>
            <p className="font-body mt-5 text-[38px] leading-tight font-bold">Кнопка не работает, думать можно спокойно.</p>
          </Paper>
        </Rise>
        <Rise order={2}>
          <Arrow />
        </Rise>
        <Rise order={3}>
          <Paper seed={43} className="h-[300px]">
            <p className="font-body text-[40px] leading-tight font-bold">
              <span className="text-yes-ink font-black">Верно:</span> деньги и ход ему.
            </p>
            <p className="font-body mt-5 text-[40px] leading-tight font-bold">
              <span className="text-no-ink font-black">Неверно:</span> минус ему, ход остаётся у вас.
            </p>
          </Paper>
        </Rise>
      </div>
    </div>
  );
}

function AuctionSlide() {
  const moves = [
    { label: 'поднять', note: 'минимум на шаг', fill: 'var(--color-p4)' },
    { label: 'ва-банк', note: 'весь свой счёт', fill: 'var(--color-p2)' },
    { label: 'пас', note: 'насовсем', fill: 'var(--color-card)' },
  ];
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-10">
        <Title tilt={1.2}>Аукцион</Title>
        <Doodle name="hammer" size={140} color="#fff6e9" strokeWidth={4} />
      </div>
      <Lead>Тему и цену видно, вопрос нет. Торгуются по кругу.</Lead>
      <div className="my-auto flex items-stretch justify-center gap-12">
        {moves.map((move, i) => (
          <Rise key={move.label} order={i + 1}>
            <div
              className="text-ink grid h-[260px] w-[420px] content-center justify-items-center gap-4 rounded-[36px] border-[6px] text-center"
              style={{ backgroundColor: move.fill, borderColor: INK, boxShadow: `8px 8px 0 ${INK}`, transform: `rotate(${(i - 1) * 1.5}deg)` }}
            >
              <span className="font-pop text-[64px] font-black">{move.label}</span>
              <span className="font-body text-[36px] font-bold">{move.note}</span>
            </div>
          </Rise>
        ))}
      </div>
      <Rise order={4}>
        <p className="font-body mt-14 text-center text-[44px] font-bold">
          Победитель отвечает один. На кону его ставка, а не цена клетки.
        </p>
      </Rise>
    </div>
  );
}

const MODIFIER_ORDER: ModifierKind[] = ['jackpot', 'double', 'robbery', 'swap', 'hint', 'nothing', 'generosity', 'flip'];

function ModifierSlide() {
  return (
    <div className="flex h-full flex-col">
      <Title>Клетки с сюрпризом</Title>
      <Lead>Под некоторыми ценами нет вопроса. Где они, не знает даже ведущий.</Lead>
      <div className="my-auto grid grid-cols-4 gap-8">
        {MODIFIER_ORDER.map((kind, i) => (
          <Rise key={kind} order={1 + i * 0.4} className="h-full">
            <div
              className="bg-card text-ink h-full min-h-[190px] rounded-[28px] border-[5px] px-7 py-6"
              style={{ borderColor: INK, boxShadow: `6px 6px 0 ${INK}`, transform: `rotate(${i % 2 ? 1 : -1}deg)` }}
            >
              <p className="font-pop text-[40px] leading-none font-black">{MODIFIER_TITLES[kind]}</p>
              <p className="font-body mt-4 text-[30px] leading-tight font-bold">{MODIFIER_HINTS[kind]}</p>
            </div>
          </Rise>
        ))}
      </div>
    </div>
  );
}

function FinalSlide() {
  const steps = [
    { title: 'Убираем темы', note: 'по очереди, пока не останется одна' },
    { title: 'Ставим', note: 'тайно, от 1 до своего счёта' },
    { title: 'Пишем ответ', note: 'на телефоне, никто не подсмотрит' },
    { title: 'Вскрываем', note: 'по одному, от меньшего счёта' },
  ];
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-10">
        <Title tilt={1.2}>Финал</Title>
        <Doodle name="crown" size={140} color="#ffc53d" strokeWidth={5} />
      </div>
      <Lead>Играют те, у кого счёт больше нуля.</Lead>
      <div className="my-auto grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] items-stretch gap-4">
        {steps.map((step, i) => (
          <div key={step.title} className="contents">
            <Rise order={i + 1} className="h-full">
              <Paper seed={51 + i} className="h-full min-h-[300px]">
                <p className="font-pop text-[40px] leading-[1.05] font-black">{step.title}</p>
                <p className="font-body mt-6 text-[34px] leading-tight font-bold">{step.note}</p>
              </Paper>
            </Rise>
            {i < steps.length - 1 && (
              <Rise order={i + 1.5} className="self-center">
                <Doodle name="arrow" size={70} color="#ffc53d" strokeWidth={6} className="shrink-0" />
              </Rise>
            )}
          </div>
        ))}
      </div>
      <Rise order={5}>
        <p className="font-pop mt-14 text-center text-[60px] font-black" style={{ color: '#ffc53d' }}>
          Удачи!
        </p>
      </Rise>
    </div>
  );
}

const SLIDES = [Cover, BuzzerSlide, AnswerSlide, TurnSlide, CatSlide, AuctionSlide, ModifierSlide, FinalSlide];
