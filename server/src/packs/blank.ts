import { randomUUID } from 'node:crypto';
import type { Pack } from '@svoyak/shared';

/** Идентификатор из названия: читаемый в имени файла, но безопасный для пути. */
export function makePackId(title: string): string {
  const translit = title
    .toLowerCase()
    .replace(/[а-яё]/g, (char) => {
      const map: Record<string, string> = {
        а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
        й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
        у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
        э: 'e', ю: 'yu', я: 'ya',
      };
      return map[char] ?? '';
    })
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  const suffix = randomUUID().slice(0, 6);
  return translit === '' ? `pack-${suffix}` : `${translit}-${suffix}`;
}

const PRICES = [100, 200, 300, 400, 500];

/** Заготовка: раунд с одной темой и финал с одной темой — сразу есть что править. */
export function makeBlankPack(title: string, now = Date.now()): Pack {
  const id = makePackId(title);
  return {
    id,
    title,
    createdAt: now,
    updatedAt: now,
    rounds: [
      {
        id: `${id}-r1`,
        title: 'Первый раунд',
        themes: [
          {
            id: `${id}-r1-t1`,
            title: 'Новая тема',
            questions: PRICES.map((price, index) => ({
              id: `${id}-r1-t1-q${index + 1}`,
              price,
              type: 'normal' as const,
              text: '',
              answer: '',
              altAnswers: [],
            })),
          },
        ],
      },
    ],
    final: {
      themes: [
        {
          id: `${id}-f1`,
          title: 'Финальная тема',
          question: { id: `${id}-f1-q`, text: '', answer: '', altAnswers: [] },
        },
      ],
    },
  };
}
