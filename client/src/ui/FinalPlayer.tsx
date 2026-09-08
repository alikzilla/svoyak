import { useState } from 'react';
import type { PlayerPrompt, PlayerView } from '@svoyak/shared';

interface FinalPlayerProps {
  view: PlayerView;
  prompt: Extract<PlayerPrompt, { kind: 'final_remove_theme' | 'final_bet' | 'final_answer' }>;
  onRemoveTheme: (themeId: string) => void;
  onBet: (bet: number) => void;
  onAnswer: (answer: string) => void;
}

export function FinalPlayer({ view, prompt, onRemoveTheme, onBet, onAnswer }: FinalPlayerProps) {
  const [bet, setBet] = useState(prompt.kind === 'final_bet' ? prompt.min : 1);
  const [answer, setAnswer] = useState('');

  if (prompt.kind === 'final_remove_theme') {
    return (
      <div className="flex flex-1 flex-col justify-center gap-4">
        <p className="text-center text-lg text-gold text-pretty">Уберите одну тему</p>
        <ul className="grid gap-2">
          {prompt.themes.map((theme) => (
            <li key={theme.id}>
              <button
                onClick={() => onRemoveTheme(theme.id)}
                className="w-full rounded-2xl border border-line bg-surface px-4 py-4 text-lg font-semibold hover:border-bad hover:text-bad"
              >
                {theme.title}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (prompt.kind === 'final_bet') {
    if (prompt.placed) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <p className="text-muted">Ваша ставка</p>
          <p className="text-5xl font-black tabular-nums text-gold">{view.myFinalBet}</p>
          <p className="text-muted">Ждём остальных</p>
        </div>
      );
    }
    return (
      <div className="flex flex-1 flex-col justify-center gap-4">
        <div className="text-center">
          <p className="text-sm text-muted">Тема финала</p>
          <p className="text-2xl font-bold text-gold text-pretty">
            {view.final?.themeTitle ?? '—'}
          </p>
          <p className="mt-1 text-muted">
            Ставка от <span className="tabular-nums">{prompt.min}</span> до{' '}
            <span className="tabular-nums">{prompt.max}</span> — вопрос вы пока не видите
          </p>
        </div>
        <input
          className="w-full rounded-2xl border border-line bg-surface px-4 py-4 text-center text-3xl font-bold tabular-nums focus:border-gold"
          value={bet}
          inputMode="numeric"
          onChange={(event) => setBet(Number(event.target.value.replace(/\D/g, '')) || 0)}
        />
        <button
          disabled={bet < prompt.min || bet > prompt.max}
          onClick={() => onBet(bet)}
          className="rounded-2xl bg-gold px-4 py-4 text-xl font-bold text-bg disabled:opacity-40"
        >
          Поставить {bet}
        </button>
        <button
          onClick={() => onBet(prompt.max)}
          className="rounded-2xl border border-gold px-4 py-3 font-bold text-gold"
        >
          Ва-банк · {prompt.max}
        </button>
      </div>
    );
  }

  if (prompt.placed) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <p className="text-muted">Ваш ответ принят</p>
        <p className="text-2xl font-bold text-gold text-pretty">{view.myFinalAnswer}</p>
        <p className="text-muted">Ждём остальных</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col justify-center gap-4">
      <p className="text-center text-lg text-pretty">{view.final?.questionText}</p>
      <input
        className="w-full rounded-2xl border border-line bg-surface px-4 py-4 text-xl focus:border-gold"
        value={answer}
        placeholder="Ваш ответ"
        autoComplete="off"
        onChange={(event) => setAnswer(event.target.value)}
      />
      <button
        disabled={answer.trim() === ''}
        onClick={() => onAnswer(answer)}
        className="rounded-2xl bg-gold px-4 py-4 text-xl font-bold text-bg disabled:opacity-40"
      >
        Ответить
      </button>
    </div>
  );
}
