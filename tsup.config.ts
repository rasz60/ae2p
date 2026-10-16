import { defineConfig } from 'tsup';

// 포털 API (초대·계정 관리) → server-dist/index.js
export default defineConfig({
  entry: ['server/index.ts'],
  outDir: 'server-dist',
  format: 'esm',
  target: 'node22',
  clean: true,
});
