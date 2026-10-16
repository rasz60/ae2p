/**
 * pm2 프로세스 정의 (Oracle Cloud 서버). 최초 1회:
 *   npm ci && npm run build && pm2 start ecosystem.config.cjs && pm2 save
 */
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
  ],
};
