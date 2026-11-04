/**
 * pm2 프로세스 정의 (Oracle Cloud 서버). 최초 1회:
 *   npm ci && npm run build && pm2 start ecosystem.config.cjs && pm2 save
 */
const fs = require('node:fs');
const path = require('node:path');

// Claude 작업실은 .env 에 BUILDER_ENABLED=true 가 있는 서버(테스트 서버)에서만 띄운다
let builderEnabled = false;
try {
  builderEnabled = /^BUILDER_ENABLED=true\s*$/m.test(fs.readFileSync(path.join(__dirname, '.env'), 'utf8'));
} catch {}

module.exports = {
  apps: [
    {
      // 포털 API: 초대·계정 관리 (Caddy /api/portal/* → 127.0.0.1:8090)
      name: 'ae2p-portal-api',
      script: 'server-dist/index.js',
      cwd: __dirname,
      node_args: '--env-file=.env',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '200M',
      restart_delay: 3000,
    },
    ...(builderEnabled
      ? [
          {
            // Claude 작업실: 관리자 채팅 → 코드 수정 · 빌드 · 재기동 (Caddy /api/builder/* → 127.0.0.1:8095)
            // 다른 앱을 재기동하므로 따로 띄우고, 자기 자신은 재기동 대상에서 뺀다 (server/builder.ts)
            name: 'ae2p-builder',
            script: 'server-dist/builder.js',
            cwd: __dirname,
            node_args: '--env-file=.env',
            env: { NODE_ENV: 'production' },
            // 작업 중인 Claude 프로세스는 자식 프로세스라 여기 메모리에 안 잡힌다
            max_memory_restart: '400M',
            restart_delay: 3000,
            // 빌드가 server-dist 를 다시 쓸 때 저절로 재시작하지 않게 (재시작은 화면 버튼으로)
            watch: false,
            autorestart: true,
          },
        ]
      : []),
  ],
};
