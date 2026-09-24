import { describe, expect, it } from 'vitest';
import { matchAnswer, normalizeAnswer } from './answerMatch.js';

describe('normalizeAnswer', () => {
  it('убирает регистр, ё, кавычки и пунктуацию', () => {
    expect(normalizeAnswer('  «Ёжик-в  Тумане»! ')).toBe('ежик в тумане');
  });
});

describe('matchAnswer', () => {
  it('точное совпадение с точностью до регистра и ё', () => {
    expect(matchAnswer('ЁЛКА', ['Елка'])).toEqual({ kind: 'exact', matched: 'Елка' });
  });

  it('совпадение с другим принимаемым ответом', () => {
    expect(matchAnswer('коппола', ['Фрэнсис Форд Коппола', 'Коппола'])).toEqual({
      kind: 'exact',
      matched: 'Коппола',
    });
  });

  it('скобки в ответе пака необязательны', () => {
    expect(matchAnswer('Пушкин', ['Пушкин (Александр Сергеевич)']).kind).toBe('exact');
  });

  it('опечатка — «похоже», а не «верно»', () => {
    expect(matchAnswer('Капола', ['Коппола'])).toEqual({ kind: 'close', matched: 'Коппола' });
  });

  it('в коротком ответе опечатка не прощается', () => {
    expect(matchAnswer('кит', ['кот']).kind).toBe('none');
  });

  it('только фамилия из полного имени — «похоже»', () => {
    expect(matchAnswer('Коппола', ['Фрэнсис Форд Коппола']).kind).toBe('close');
  });

  it('правильный ответ внутри фразы — «похоже»', () => {
    expect(matchAnswer('наверное это Байкал', ['Байкал']).kind).toBe('close');
  });

  it('слитное и раздельное написание — «похоже»', () => {
    expect(matchAnswer('Санктпетербург', ['Санкт-Петербург']).kind).toBe('close');
  });

  it('пустой ответ ни с чем не совпадает', () => {
    expect(matchAnswer('  ', ['Байкал'])).toEqual({ kind: 'none', matched: null });
  });

  it('непохожий ответ', () => {
    expect(matchAnswer('Онега', ['Байкал', 'озеро Байкал']).kind).toBe('none');
  });
});
