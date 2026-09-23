import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { Pack, Question } from '@svoyak/shared';
import { hasErrors, validatePack } from '@svoyak/shared';
import { PACKS_DIR } from '../config.js';

/** Проверка паков, которые лежат на диске и попадают в игру. Она появилась
 *  после разбора паков, распарсенных с ютуба: там 262 вопроса из 389 повторяли
 *  текст соседа («Назовите знак зодиака по его символу» пять раз подряд),
 *  потому что настоящий вопрос был на экране, а не в тексте. 73 из них вдобавок
 *  остались вообще без картинки — ведущему нечего было показать.
 *  Поэтому главное правило здесь одно: вопрос обязан работать, если его просто
 *  прочитать вслух. */

interface Loaded {
  file: string;
  pack: Pack;
}

const load = (): Loaded[] => {
  if (!fs.existsSync(PACKS_DIR)) return [];
  return fs
    .readdirSync(PACKS_DIR)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => ({
      file,
      pack: JSON.parse(fs.readFileSync(path.join(PACKS_DIR, file), 'utf8')) as Pack,
    }));
};

const allQuestions = (pack: Pack): Question[] =>
  pack.rounds.flatMap((round) => round.themes.flatMap((theme) => theme.questions));

/** Обороты, которые обещают то, чего в тексте нет. Без прикреплённого медиа
 *  такой вопрос невозможно задать вслух. */
const POINTS_AT_SOMETHING = [
  'на экране',
  'на картинке',
  'на фото',
  'на изображении',
  'по символу',
  'на видео',
  'послушайте',
  'изображён',
  'изображена',
  'изображено',
];

const packs = load();
/** Паки-заготовки для тестов собираются из кода (`npm run build:packs`) и живут
 *  по своим правилам: у них другая сетка и другое число финальных тем. */
const content = packs.filter((entry) => entry.file.startsWith('pack-'));

describe('паки на диске', () => {
  it('вообще есть', () => {
    expect(packs.length).toBeGreaterThan(0);
  });

  it.each(packs)('$file: проходит проверку перед игрой', ({ pack }) => {
    expect(hasErrors(validatePack(pack))).toBe(false);
  });

  it.each(packs)('$file: ни один вопрос не повторяет текст соседа', ({ pack }) => {
    const seen = new Map<string, number>();
    for (const question of allQuestions(pack)) {
      const key = question.text.trim().toLowerCase();
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    const repeated = [...seen.entries()].filter(([, count]) => count > 1).map(([text]) => text);
    expect(repeated).toEqual([]);
  });

  it.each(packs)('$file: вопрос не ссылается на то, чего нет', ({ pack }) => {
    const broken = allQuestions(pack)
      .filter((question) => {
        if (question.media) return false;
        const text = question.text.toLowerCase();
        return POINTS_AT_SOMETHING.some((phrase) => text.includes(phrase));
      })
      .map((question) => question.text);
    expect(broken).toEqual([]);
  });

  it.each(packs)('$file: у каждого вопроса есть текст и ответ', ({ pack }) => {
    const empty = allQuestions(pack)
      .filter((question) => question.text.trim().length < 15 || question.answer.trim() === '')
      .map((question) => question.text);
    expect(empty).toEqual([]);
  });

  it.each(packs)('$file: медиа лежит на диске, а не только в ссылке', ({ pack }) => {
    const missing: string[] = [];
    for (const question of allQuestions(pack)) {
      for (const media of [question.media, question.answerMedia]) {
        if (!media || !media.src.startsWith('/uploads/')) continue;
        const onDisk = path.join(process.cwd(), media.src.replace(/^\//, ''));
        if (!fs.existsSync(onDisk)) missing.push(media.src);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe('игровые паки', () => {
  it('их не меньше десяти — иначе вечер упирается в повторы', () => {
    expect(content.length).toBeGreaterThanOrEqual(10);
  });

  it.each(content)('$file: два раунда по четыре темы, в теме пять вопросов', ({ pack }) => {
    expect(pack.rounds).toHaveLength(2);
    for (const round of pack.rounds) {
      expect(round.themes).toHaveLength(4);
      for (const theme of round.themes) expect(theme.questions).toHaveLength(5);
    }
  });

  it.each(content)('$file: сетка цен та же, что у доски', ({ pack }) => {
    pack.rounds.forEach((round, roundIndex) => {
      for (const theme of round.themes) {
        const prices = theme.questions.map((question) => question.price);
        const expected = [1, 2, 3, 4, 5].map((step) => step * 100 * (roundIndex + 1));
        expect(prices).toEqual(expected);
      }
    });
  });

  it.each(content)('$file: ровно один кот и ровно один аукцион', ({ pack }) => {
    const questions = allQuestions(pack);
    expect(questions.filter((question) => question.type === 'cat')).toHaveLength(1);
    expect(questions.filter((question) => question.type === 'auction')).toHaveLength(1);
  });

  it.each(content)('$file: три темы в финале', ({ pack }) => {
    expect(pack.final.themes).toHaveLength(3);
  });
});
