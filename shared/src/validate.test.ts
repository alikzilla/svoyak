import { describe, it, expect } from 'vitest';
import type { Pack, Question, Theme } from './pack.js';
import { validatePack } from './validate.js';

const question = (over: Partial<Question> = {}): Question => ({
  id: 'q1',
  price: 100,
  type: 'normal',
  text: 'Вопрос?',
  answer: 'Ответ',
  altAnswers: [],
  ...over,
});

const theme = (over: Partial<Theme> = {}): Theme => ({
  id: 't1',
  title: 'Тема',
  questions: [question()],
  ...over,
});

const pack = (over: Partial<Pack> = {}): Pack => ({
  id: 'p1',
  title: 'Пак',
  createdAt: 0,
  updatedAt: 0,
  rounds: [{ id: 'r1', title: 'Раунд', themes: [theme()] }],
  final: {
    themes: [
      { id: 'f1', title: 'Финал', question: { id: 'fq1', text: 'Вопрос?', answer: 'Ответ', altAnswers: [] } },
    ],
  },
  ...over,
});

const errors = (input: Pack): string[] =>
  validatePack(input)
    .filter((issue) => issue.level === 'error')
    .map((issue) => issue.message);

const warnings = (input: Pack): string[] =>
  validatePack(input)
    .filter((issue) => issue.level === 'warning')
    .map((issue) => issue.message);

describe('validatePack', () => {
  it('корректный пак не даёт ни одной ошибки', () => {
    expect(errors(pack())).toEqual([]);
  });

  it('пустой ответ — ошибка', () => {
    const broken = pack({
      rounds: [{ id: 'r1', title: 'Раунд', themes: [theme({ questions: [question({ answer: '  ' })] })] }],
    });
    expect(errors(broken).join(' ')).toContain('ответ');
  });

  it('пустой текст вопроса — ошибка', () => {
    const broken = pack({
      rounds: [{ id: 'r1', title: 'Раунд', themes: [theme({ questions: [question({ text: '' })] })] }],
    });
    expect(errors(broken).join(' ')).toContain('текст');
  });

  it('ошибка указывает, где искать', () => {
    const broken = pack({
      rounds: [
        { id: 'r7', title: 'Раунд', themes: [theme({ id: 't7', questions: [question({ id: 'q7', answer: '' })] })] },
      ],
    });
    const issue = validatePack(broken).find((candidate) => candidate.level === 'error');
    expect(issue?.path).toEqual({ roundId: 'r7', themeId: 't7', questionId: 'q7' });
  });

  it('тема без вопросов — предупреждение', () => {
    const broken = pack({
      rounds: [{ id: 'r1', title: 'Раунд', themes: [theme({ questions: [] })] }],
    });
    expect(warnings(broken).join(' ')).toContain('без вопросов');
  });

  it('разное число вопросов в темах раунда — предупреждение', () => {
    const broken = pack({
      rounds: [
        {
          id: 'r1',
          title: 'Раунд',
          themes: [
            theme({ id: 't1', questions: [question({ id: 'a' })] }),
            theme({ id: 't2', questions: [question({ id: 'b' }), question({ id: 'c', price: 200 })] }),
          ],
        },
      ],
    });
    expect(warnings(broken).join(' ')).toContain('неодинаково');
  });

  it('повторяющиеся цены внутри темы — предупреждение', () => {
    const broken = pack({
      rounds: [
        {
          id: 'r1',
          title: 'Раунд',
          themes: [theme({ questions: [question({ id: 'a' }), question({ id: 'b' })] })],
        },
      ],
    });
    expect(warnings(broken).join(' ')).toContain('цен');
  });

  it('кот в мешке без спецификации — ошибка', () => {
    const broken = pack({
      rounds: [
        { id: 'r1', title: 'Раунд', themes: [theme({ questions: [question({ type: 'cat' })] })] },
      ],
    });
    expect(errors(broken).join(' ')).toContain('Кот в мешке');
  });

  it('финал без тем — ошибка', () => {
    expect(errors(pack({ final: { themes: [] } })).join(' ')).toContain('Финал');
  });

  it('пак без раундов — ошибка', () => {
    expect(errors(pack({ rounds: [] })).join(' ')).toContain('раунд');
  });

  it('пустое название пака — ошибка', () => {
    expect(errors(pack({ title: '   ' })).join(' ')).toContain('Название');
  });
});
