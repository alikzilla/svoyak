import path from 'node:path';
import type { Pack } from '@svoyak/shared';
import { PACKS_DIR } from '../config.js';
import { writeJsonAtomic } from '../storage/atomicWrite.js';
import { demoClassicPack } from './demo/classic.js';

const packs: Pack[] = [demoClassicPack];

for (const pack of packs) {
  const file = path.join(PACKS_DIR, `${pack.id}.json`);
  writeJsonAtomic(file, pack);
  const questions = pack.rounds.reduce(
    (sum, round) => sum + round.themes.reduce((s, theme) => s + theme.questions.length, 0),
    0,
  );
  console.log(`✓ ${pack.title}: ${questions} вопросов + финал ${pack.final.themes.length} тем → ${file}`);
}
