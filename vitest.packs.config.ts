import { defineConfig } from 'vitest/config';
import base, { PACKS_LINT } from './vitest.config.js';

/** Проверка паков в data/packs и их медиа в uploads/. Собирается вручную, а не
 *  через mergeConfig: тот склеивает массивы, и исключение из основного конфига
 *  выключило бы единственный файл этого. */
export default defineConfig({
  ...base,
  test: { ...base.test, include: [PACKS_LINT], exclude: [] },
});
