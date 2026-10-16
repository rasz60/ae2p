import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { APPS } from './shared/apps.ts';

// 같은 도메인의 다른 앱 경로. 포털 서비스워커가 이 주소들을 가로채 포털 index.html 을 띄우면 안 된다
const appPaths = APPS.map((a) => a.path.replace(/\//g, '\/'));
const notPortal = [new RegExp(`^(${appPaths.join('|')}|\/api\/|\/shell\/)`)];

export default defineConfig({
  server: {
    // 개발 중 포털 API
    proxy: { '/api/portal': { target: 'http://127.0.0.1:8090', rewrite: (p) => p.replace(/^\/api\/portal/, '') } },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png', 'brand/*.svg'],
      manifest: {
        name: 'ae:p takecare',
        short_name: 'ae:p',
        description: '일상의 모든 것을 연결하는 나만의 로그',
        lang: 'ko',
        // 포털이 도메인 전체를 하나의 앱으로 설치한다 (각 앱 경로도 같은 창에서 열린다)
        scope: '/',
        start_url: '/',
        display: 'standalone',
        background_color: '#F6F5FB',
        theme_color: '#F6F5FB',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: notPortal,
        // shell/switcher.js 는 고정 이름이라 프리캐시하면 앱들이 옛 버전을 받는다
        globIgnores: ['shell/**'],
      },
    }),
  ],
});
