import { configDefaults, defineConfig } from 'vitest/config';
import path from 'node:path';

/** Проверка паков на диске смотрит на живые данные, а не на код: правка пака в
 *  редакторе не должна краснить `npm test`. Она запускается отдельно —
 *  `npm run lint:packs` (vitest.packs.config.ts). */
export const PACKS_LINT = 'server/src/packs/packs.lint.test.ts';

export default defineConfig({
  resolve: {
    alias: { '@svoyak/shared': path.resolve(import.meta.dirname, 'shared/src/index.ts') },
  },
  test: {
    include: ['server/src/**/*.test.ts', 'shared/src/**/*.test.ts', 'client/src/**/*.test.ts'],
    exclude: [...configDefaults.exclude, PACKS_LINT],
    environment: 'node',
  },
});
