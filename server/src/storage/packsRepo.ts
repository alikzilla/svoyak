import fs from 'node:fs';
import path from 'node:path';
import type { Pack, PackSummary } from '@svoyak/shared';
import { PACKS_DIR } from '../config.js';
import { readJson, writeJsonAtomic } from './atomicWrite.js';

const packFile = (id: string): string => path.join(PACKS_DIR, `${id}.json`);

export function getPack(id: string): Pack | null {
  // Идентификатор приходит от клиента: не даём выйти за пределы папки паков.
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) return null;
  return readJson<Pack>(packFile(id));
}

export function savePack(pack: Pack): void {
  writeJsonAtomic(packFile(pack.id), pack);
}

export function deletePack(id: string): void {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) return;
  fs.rmSync(packFile(id), { force: true });
}

export function summarize(pack: Pack): PackSummary {
  const questionsCount = pack.rounds.reduce(
    (sum, round) => sum + round.themes.reduce((inner, theme) => inner + theme.questions.length, 0),
    0,
  );
  return {
    id: pack.id,
    title: pack.title,
    createdAt: pack.createdAt,
    updatedAt: pack.updatedAt,
    ...(pack.author !== undefined ? { author: pack.author } : {}),
    ...(pack.description !== undefined ? { description: pack.description } : {}),
    roundsCount: pack.rounds.length,
    questionsCount,
    finalThemesCount: pack.final.themes.length,
  };
}

export function listPacks(): PackSummary[] {
  if (!fs.existsSync(PACKS_DIR)) return [];
  const packs: PackSummary[] = [];
  for (const file of fs.readdirSync(PACKS_DIR)) {
    if (!file.endsWith('.json')) continue;
    const pack = readJson<Pack>(path.join(PACKS_DIR, file));
    if (pack?.id) packs.push(summarize(pack));
  }
  return packs.sort((a, b) => b.updatedAt - a.updatedAt);
}
