import fs from 'node:fs';
import path from 'node:path';
import type { GameResult } from '@svoyak/shared';
import { HISTORY_DIR } from '../config.js';
import { readJson, writeJsonAtomic } from './atomicWrite.js';

const resultFile = (id: string): string => path.join(HISTORY_DIR, `${id}.json`);

/**
 * Итог игры на диск. Комната может вернуться к итогам повторно (отмена,
 * переподключение ведущего) — запись та же, счёт свежий, а время окончания
 * остаётся первым: иначе игра «переезжала» бы на дату последнего касания.
 */
export function saveResult(result: GameResult): void {
  if (!/^[\w-]+$/.test(result.id)) return;
  const existing = readJson<GameResult>(resultFile(result.id));
  writeJsonAtomic(resultFile(result.id), {
    ...result,
    finishedAt: existing?.finishedAt ?? result.finishedAt,
  });
}

/** Все сыгранные игры, от новых к старым. Битые файлы пропускаются. */
export function listResults(): GameResult[] {
  if (!fs.existsSync(HISTORY_DIR)) return [];
  const results: GameResult[] = [];
  for (const file of fs.readdirSync(HISTORY_DIR)) {
    if (!file.endsWith('.json')) continue;
    const result = readJson<GameResult>(path.join(HISTORY_DIR, file));
    if (result && typeof result.id === 'string' && Array.isArray(result.players)) results.push(result);
  }
  return results.sort((left, right) => right.finishedAt - left.finishedAt);
}
