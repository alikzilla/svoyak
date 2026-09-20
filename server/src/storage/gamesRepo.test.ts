import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Game, Pack } from '@svoyak/shared';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'svoyak-games-'));
process.env['DATA_DIR'] = tempDir;
const { deleteGame, getGame, listGames, saveGame, summarizeGame } = await import('./gamesRepo.js');

beforeAll(() => {
  fs.mkdirSync(path.join(tempDir, 'games'), { recursive: true });
});

afterAll(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

/** Пак с одной темой: для проверки ссылок содержимое вопросов не важно. */
const pack = (id: string, themeIds: string[]): Pack => ({
  id,
  title: `Пак ${id}`,
  createdAt: 1,
  updatedAt: 1,
  rounds: [
    {
      id: `${id}-r1`,
      title: 'Первый раунд',
      themes: themeIds.map((themeId) => ({ id: themeId, title: themeId, questions: [] })),
    },
  ],
  final: { themes: [{ id: `${id}-f1`, title: 'Финал', question: { id: `${id}-fq`, text: 'т', answer: 'о', altAnswers: [] } }] },
});

const library: Record<string, Pack> = { alpha: pack('alpha', ['t1', 't2']) };
const lookup = (id: string): Pack | null => library[id] ?? null;

const game = (over: Partial<Game> = {}): Game => ({
  id: 'g1',
  title: 'Вечеринка',
  createdAt: 10,
  updatedAt: 10,
  recipe: {
    rounds: [[{ packId: 'alpha', themeId: 't1' }, { packId: 'alpha', themeId: 't2' }]],
    final: [{ packId: 'alpha', themeId: 'alpha-f1' }],
  },
  modifiers: { perRound: 2, kinds: ['flip', 'jackpot'] },
  ...over,
});

describe('хранилище игр', () => {
  it('сохранённая игра читается обратно', () => {
    saveGame(game());
    expect(getGame('g1')?.title).toBe('Вечеринка');
  });

  it('не выпускает идентификатор за пределы папки', () => {
    expect(getGame('../packs/demo-classic')).toBeNull();
  });

  it('удалённая игра больше не читается', () => {
    saveGame(game({ id: 'g2' }));
    deleteGame('g2');
    expect(getGame('g2')).toBeNull();
  });

  it('считает состав для карточки', () => {
    const summary = summarizeGame(game(), lookup);
    expect(summary.roundsCount).toBe(1);
    expect(summary.themesCount).toBe(2);
    expect(summary.finalThemesCount).toBe(1);
    expect(summary.modifiersPerRound).toBe(2);
    expect(summary.missingRefs).toBe(0);
    expect(summary.playable).toBe(true);
  });

  it('замечает ссылку на удалённый пак', () => {
    const broken = game({
      recipe: {
        rounds: [[{ packId: 'omega', themeId: 't1' }]],
        final: [{ packId: 'alpha', themeId: 'alpha-f1' }],
      },
    });
    const summary = summarizeGame(broken, lookup);
    expect(summary.missingRefs).toBe(1);
    expect(summary.playable).toBe(false);
  });

  it('замечает ссылку на вырезанную тему', () => {
    const broken = game({
      recipe: {
        rounds: [[{ packId: 'alpha', themeId: 'no-such-theme' }]],
        final: [{ packId: 'alpha', themeId: 'alpha-f1' }],
      },
    });
    expect(summarizeGame(broken, lookup).missingRefs).toBe(1);
  });

  it('список отдаёт карточки всех сохранённых игр', () => {
    saveGame(game({ id: 'g3', title: 'Корпоратив' }));
    const titles = listGames(lookup).map((item) => item.title);
    expect(titles).toContain('Корпоратив');
  });
});
