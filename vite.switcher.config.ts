import { defineConfig } from 'vite';

// 각 앱이 <script type="module" src="/shell/switcher.js"> 로 불러가는 앱 전환 버튼.
// 포털 빌드(dist) 안의 shell/ 에 따로 떨어뜨린다 (해시 없는 고정 이름)
export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'dist/shell',
    emptyOutDir: true,
    lib: { entry: 'switcher/index.ts', formats: ['es'], fileName: () => 'switcher.js' },
  },
});
