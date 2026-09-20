import fs from 'node:fs';
import path from 'node:path';
import type { Game, GameSummary, Pack, ThemeRef } from '@svoyak/shared';
import { GAMES_DIR } from '../config.js';
import { readJson, writeJsonAtomic } from './atomicWrite.js';

/** Где искать пак по идентификатору. Параметром, чтобы карточку игры можно
 *  было посчитать в тесте без файлов на диске. */
export type PackLookup = (packId: string) => Pack | null;

const gameFile = (id: string): string => path.join(GAMES_DIR, `${id}.json`);

export function getGame(id: string): Game | null {
  // Идентификатор приходит от клиента: не даём выйти за пределы папки игр.
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) return null;
  return readJson<Game>(gameFile(id));
}

export function saveGame(game: Game): void {
  fs.mkdirSync(GAMES_DIR, { recursive: true });
  writeJsonAtomic(gameFile(game.id), game);
}

export function deleteGame(id: string): void {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) return;
  fs.rmSync(gameFile(id), { force: true });
}

/** Резолвится ли ссылка: тема раунда ищется среди тем всех раундов пака,
 *  финальная — среди финальных. */
function resolves(ref: ThemeRef, lookup: PackLookup, final: boolean): boolean {
  const pack = lookup(ref.packId);
  if (!pack) return false;
  if (final) return pack.final.themes.some((theme) => theme.id === ref.themeId);
  return pack.rounds.some((round) => round.themes.some((theme) => theme.id === ref.themeId));
}

export function summarizeGame(game: Game, lookup: PackLookup): GameSummary {
  const roundRefs = game.recipe.rounds.flat();
  let missingRefs = 0;
  for (const ref of roundRefs) if (!resolves(ref, lookup, false)) missingRefs += 1;
  for (const ref of game.recipe.final) if (!resolves(ref, lookup, true)) missingRefs += 1;

  return {
    id: game.id,
    title: game.title,
    createdAt: game.createdAt,
    updatedAt: game.updatedAt,
    roundsCount: game.recipe.rounds.length,
    themesCount: roundRefs.length,
    finalThemesCount: game.recipe.final.length,
    modifiersPerRound: game.modifiers.perRound,
    missingRefs,
    // Играть можно только целой игрой: потерянную тему ведущий должен увидеть
    // до гостей, а не обнаружить пустую клетку на доске.
    playable: missingRefs === 0 && roundRefs.length > 0 && game.recipe.final.length > 0,
  };
}

export function listGames(lookup: PackLookup): GameSummary[] {
  if (!fs.existsSync(GAMES_DIR)) return [];
  const games: GameSummary[] = [];
  for (const file of fs.readdirSync(GAMES_DIR)) {
    if (!file.endsWith('.json')) continue;
    const game = readJson<Game>(path.join(GAMES_DIR, file));
    if (game?.id) games.push(summarizeGame(game, lookup));
  }
  return games.sort((a, b) => b.updatedAt - a.updatedAt);
}
