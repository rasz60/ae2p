import { defineConfig } from 'tsup';

// 포털 API (초대·계정 관리) → server-dist/index.js
// Claude 작업실 (테스트 서버 전용) → server-dist/builder.js
// 의존성(@anthropic-ai/claude-agent-sdk 등)은 묶지 않고 node_modules 에서 불러온다 (tsup 기본값)
export default defineConfig({
  entry: ['server/index.ts', 'server/builder.ts'],
  outDir: 'server-dist',
  format: 'esm',
  target: 'node22',
  clean: true,
});
