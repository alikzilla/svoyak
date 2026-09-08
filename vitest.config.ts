import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: { '@svoyak/shared': path.resolve(import.meta.dirname, 'shared/src/index.ts') },
  },
  test: {
    include: ['server/src/**/*.test.ts', 'shared/src/**/*.test.ts'],
    environment: 'node',
  },
});
