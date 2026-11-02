import fs from 'node:fs';
import path from 'node:path';
import type { Pack, PackSummary } from '@svoyak/shared';
import { hasErrors, validatePack } from '@svoyak/shared';
import { PACKS_DIR, ROOMS_DIR, UPLOADS_DIR } from '../config.js';
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

/** Все ссылки `src` внутри значения — пака или комнаты с паком внутри. */
function collectMediaRefs(value: unknown, into: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectMediaRefs(item, into);
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  for (const [key, item] of Object.entries(value)) {
    if (key === 'src' && typeof item === 'string') into.add(item);
    else collectMediaRefs(item, into);
  }
}

/** Медиа, на которое ещё ссылаются оставшиеся паки и сохранённые комнаты. */
function mediaInUse(): Set<string> {
  const refs = new Set<string>();
  for (const dir of [PACKS_DIR, ROOMS_DIR]) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (file.endsWith('.json')) collectMediaRefs(readJson(path.join(dir, file)), refs);
    }
  }
  return refs;
}

/**
 * Пак удаляется вместе со своим медиа, иначе файлы без хозяина копятся в
 * uploads/. Но не со всем: импорт JSON создаёт копию, ссылки которой ведут в
 * папку оригинала, а идущая комната держит пак у себя. Такие файлы остаются.
 */
export function deletePack(id: string): void {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) return;
  fs.rmSync(packFile(id), { force: true });

  const mediaDir = path.join(UPLOADS_DIR, id);
  if (!fs.existsSync(mediaDir)) return;
  const inUse = mediaInUse();
  for (const file of fs.readdirSync(mediaDir)) {
    if (!inUse.has(`/uploads/${id}/${file}`)) {
      fs.rmSync(path.join(mediaDir, file), { recursive: true, force: true });
    }
  }
  if (fs.readdirSync(mediaDir).length === 0) fs.rmdirSync(mediaDir);
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
    playable: !hasErrors(validatePack(pack)),
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
