import { describe, it, expect } from 'vitest';
import { parseThemeText } from './parseTheme.js';

describe('parseThemeText', () => {
  it('читает название темы и строки вопросов', () => {
    const result = parseThemeText(`Тема: Кино
100 | Кто снял «Крёстного отца»? | Коппола
200 | Кто сыграл Нео? | Киану Ривз`);

    expect(result.title).toBe('Кино');
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      { price: 100, text: 'Кто снял «Крёстного отца»?', answer: 'Коппола', altAnswers: [] },
      { price: 200, text: 'Кто сыграл Нео?', answer: 'Киану Ривз', altAnswers: [] },
    ]);
  });

  it('работает без строки «Тема:» — название пустое', () => {
    const result = parseThemeText('100 | Вопрос | Ответ');
    expect(result.title).toBeNull();
    expect(result.rows).toHaveLength(1);
  });

  it('принимает альтернативные ответы в четвёртой колонке через точку с запятой', () => {
    const result = parseThemeText('300 | Вопрос | Ответ | Вариант; Ещё вариант');
    expect(result.rows[0]?.altAnswers).toEqual(['Вариант', 'Ещё вариант']);
  });

  it('срезает лишние пробелы вокруг разделителей', () => {
    const result = parseThemeText('  400   |   Вопрос   |   Ответ   ');
    expect(result.rows[0]).toEqual({ price: 400, text: 'Вопрос', answer: 'Ответ', altAnswers: [] });
  });

  it('пропускает пустые строки', () => {
    const result = parseThemeText('Тема: Т\n\n100 | В | О\n\n\n200 | В2 | О2\n');
    expect(result.rows).toHaveLength(2);
    expect(result.errors).toEqual([]);
  });

  it('сообщает о строке без разделителей с её номером', () => {
    const result = parseThemeText('Тема: Т\n100 | В | О\nпросто текст');
    expect(result.rows).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('3');
  });

  it('нечисловая цена — ошибка с номером строки', () => {
    const result = parseThemeText('сто | Вопрос | Ответ');
    expect(result.rows).toHaveLength(0);
    expect(result.errors[0]).toContain('1');
    expect(result.errors[0]).toContain('цена');
  });

  it('пустой ответ — ошибка', () => {
    const result = parseThemeText('100 | Вопрос |   ');
    expect(result.rows).toHaveLength(0);
    expect(result.errors[0]).toContain('ответ');
  });

  it('понимает табуляцию как разделитель', () => {
    const result = parseThemeText('100\tВопрос\tОтвет');
    expect(result.rows[0]).toEqual({ price: 100, text: 'Вопрос', answer: 'Ответ', altAnswers: [] });
  });

  it('пустой ввод даёт пустой результат без ошибок', () => {
    expect(parseThemeText('   ')).toEqual({ title: null, rows: [], errors: [] });
  });
});
