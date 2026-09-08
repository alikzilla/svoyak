import { describe, it, expect } from 'vitest';
import { validatePack } from '@svoyak/shared';
import { demoClassicPack } from './classic.js';

describe('демо-пак «Классика»', () => {
  it('содержит два раунда и финал минимум из пяти тем', () => {
    expect(demoClassicPack.rounds).toHaveLength(2);
    expect(demoClassicPack.final.themes.length).toBeGreaterThanOrEqual(5);
  });

  it('в каждом раунде по четыре темы, в теме по пять вопросов', () => {
    for (const round of demoClassicPack.rounds) {
      expect(round.themes).toHaveLength(4);
      for (const theme of round.themes) expect(theme.questions).toHaveLength(5);
    }
  });

  it('во втором раунде цены удвоены относительно первого', () => {
    const prices = (roundIndex: number): number[] =>
      demoClassicPack.rounds[roundIndex]!.themes[0]!.questions.map((q) => q.price);
    expect(prices(1)).toEqual(prices(0).map((price) => price * 2));
  });

  it('у каждого вопроса непустой текст и непустой ответ', () => {
    for (const round of demoClassicPack.rounds)
      for (const theme of round.themes)
        for (const question of theme.questions) {
          expect(question.text.trim()).not.toBe('');
          expect(question.answer.trim()).not.toBe('');
        }
    for (const theme of demoClassicPack.final.themes) {
      expect(theme.question.text.trim()).not.toBe('');
      expect(theme.question.answer.trim()).not.toBe('');
    }
  });

  it('все идентификаторы вопросов уникальны', () => {
    const ids = demoClassicPack.rounds.flatMap((r) =>
      r.themes.flatMap((t) => t.questions.map((q) => q.id)),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('проходит валидацию без ошибок', () => {
    const issues = validatePack(demoClassicPack).filter((issue) => issue.level === 'error');
    expect(issues).toEqual([]);
  });

  it('содержит кота в мешке и аукцион, и у кота задана спецификация', () => {
    const questions = demoClassicPack.rounds.flatMap((r) =>
      r.themes.flatMap((t) => t.questions),
    );
    const cats = questions.filter((q) => q.type === 'cat');
    expect(cats.length).toBeGreaterThanOrEqual(1);
    expect(questions.some((q) => q.type === 'auction')).toBe(true);
    for (const cat of cats) expect(cat.cat).toBeDefined();
  });
});
