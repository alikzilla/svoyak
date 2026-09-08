import { useState } from 'react';
import { motion } from 'framer-motion';
import type { PlayerPrompt, PlayerView } from '@svoyak/shared';
import { DoodleButton } from '../design/DoodleButton.js';

interface FinalPlayerProps {
  view: PlayerView;
  prompt: Extract<PlayerPrompt, { kind: 'final_remove_theme' | 'final_bet' | 'final_answer' }>;
  onRemoveTheme: (themeId: string) => void;
  onBet: (bet: number) => void;
  onAnswer: (answer: string) => void;
}

const bigNumber = 'font-pop text-6xl font-black tabular-nums';
const stroke = { WebkitTextStroke: '3px #1a1a1a', paintOrder: 'stroke fill' } as const;

export function FinalPlayer({ view, prompt, onRemoveTheme, onBet, onAnswer }: FinalPlayerProps) {
  const [bet, setBet] = useState(prompt.kind === 'final_bet' ? prompt.min : 1);
  const [answer, setAnswer] = useState('');

  if (prompt.kind === 'final_remove_theme') {
    return (
      <div className="flex flex-1 flex-col justify-center gap-3 overflow-y-auto">
        <p className="font-pop text-center text-2xl font-black">Уберите одну тему</p>
        <ul className="grid gap-2">
          {prompt.themes.map((theme) => (
            <li key={theme.id}>
              <motion.button
                onClick={() => onRemoveTheme(theme.id)}
                whileTap={{ scale: 0.96, x: 4, y: 5, boxShadow: '0px 0px 0 #1a1a1a' }}
                style={{ boxShadow: '6px 6px 0 #1a1a1a' }}
                className="ink-border bg-paper-2 text-ink font-pop w-full rounded-3xl px-4 py-4 text-2xl font-black"
              >
                {theme.title}
              </motion.button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (prompt.kind === 'final_bet') {
    if (prompt.placed) {
      return (
        <div className="grid flex-1 place-items-center gap-2 text-center">
          <p className="font-body font-bold opacity-75">ваша ставка</p>
          <p className={`${bigNumber} text-gold`} style={stroke}>
            {view.myFinalBet}
          </p>
          <p className="font-body font-bold">ждём остальных</p>
        </div>
      );
    }

    return (
      <div className="flex flex-1 flex-col justify-center gap-4 overflow-y-auto">
        <div className="grid justify-items-center gap-1 text-center">
          <p className="font-body text-sm font-bold opacity-75">тема финала</p>
          <p className="font-pop text-3xl font-black text-pretty">{view.final?.themeTitle ?? '—'}</p>
          <p className="font-body font-bold text-pretty">
            от <span className="tabular-nums">{prompt.min}</span> до{' '}
            <span className="tabular-nums">{prompt.max}</span> — вопрос пока не показывают
          </p>
        </div>

        <input
          className="ink-border font-pop bg-paper-2 text-ink w-full rounded-2xl px-3 py-4 text-center text-4xl font-black tabular-nums"
          style={{ boxShadow: '5px 5px 0 #1a1a1a' }}
          value={bet}
          inputMode="numeric"
          onChange={(event) => setBet(Number(event.target.value.replace(/\D/g, '')) || 0)}
        />

        <DoodleButton
          size="lg"
          tone="gold"
          tilt={-0.8}
          className="w-full"
          disabled={bet < prompt.min || bet > prompt.max}
          onClick={() => onBet(bet)}
        >
          Ставлю {bet}
        </DoodleButton>
        <DoodleButton size="md" tone="p2" tilt={0.8} className="w-full" onClick={() => onBet(prompt.max)}>
          Ва-банк · {prompt.max}
        </DoodleButton>
      </div>
    );
  }

  if (prompt.placed) {
    return (
      <div className="grid flex-1 place-items-center gap-2 text-center">
        <p className="font-body font-bold opacity-75">ответ принят</p>
        <p className="font-pop text-3xl font-black text-pretty">{view.myFinalAnswer}</p>
        <p className="font-body font-bold">ждём остальных</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col justify-center gap-4 overflow-y-auto">
      <p className="font-body text-center text-lg font-bold text-pretty">
        {view.final?.questionText}
      </p>
      <input
        className="ink-border font-body bg-paper-2 text-ink w-full rounded-2xl px-4 py-4 text-xl font-bold"
        style={{ boxShadow: '5px 5px 0 #1a1a1a' }}
        value={answer}
        placeholder="ваш ответ"
        autoComplete="off"
        enterKeyHint="go"
        onChange={(event) => setAnswer(event.target.value)}
      />
      <DoodleButton
        size="lg"
        tone="p1"
        tilt={-0.8}
        className="w-full"
        disabled={answer.trim() === ''}
        onClick={() => onAnswer(answer)}
      >
        Ответить
      </DoodleButton>
    </div>
  );
}
