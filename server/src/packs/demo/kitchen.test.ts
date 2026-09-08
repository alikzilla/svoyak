import { describe, it, expect } from 'vitest';
import { validatePack } from '@svoyak/shared';
import { demoKitchenPack } from './kitchen.js';

describe('демо-пак «Вечеринка»', () => {
  it('проходит валидацию без ошибок', () => {
    expect(validatePack(demoKitchenPack).filter((issue) => issue.level === 'error')).toEqual([]);
  });

  it('это один раунд из четырёх тем по пять вопросов', () => {
    expect(demoKitchenPack.rounds).toHaveLength(1);
    expect(demoKitchenPack.rounds[0]?.themes).toHaveLength(4);
    for (const theme of demoKitchenPack.rounds[0]!.themes) {
      expect(theme.questions).toHaveLength(5);
    }
  });

  it('содержит кота в мешке и аукцион, чтобы показать спецвопросы', () => {
    const questions = demoKitchenPack.rounds.flatMap((round) =>
      round.themes.flatMap((theme) => theme.questions),
    );
    expect(questions.some((question) => question.type === 'cat')).toBe(true);
    expect(questions.some((question) => question.type === 'auction')).toBe(true);
  });

  it('идентификатор отличается от первого демо-пака', () => {
    expect(demoKitchenPack.id).not.toBe('demo-classic');
  });
});
