// 앱 사이를 오갈 때 보이는 로딩 화면: 자판기 꺼내는 곳에 가려는 앱의 아이콘이 툭 떨어지고 "○○ 여는 중…"
// 포털 홈(카드)·switcher.js(앱 안의 전환 메뉴)·포털 index.html(첫 화면)이 같이 쓴다.
// 각 앱의 index.html 에도 같은 모양을 넣어 두면(첫 페인트 전) 화면이 끊기지 않고 이어진다
import { appLogo, type PortalApp } from './apps.ts';

export const LOADER_CSS = `
.aep-ld {
  position: fixed; inset: 0; z-index: 2147483646;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px;
  background: #d5e0dc; color: #1c2631;
  font: 700 14px/1.4 'Galmuri11', 'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
  letter-spacing: .02em;
  animation: aep-ld-in .2s steps(3) both;
  --px-ink: #1f2d3a;
}
.aep-ld p { margin: 0; }
/* 자판기 꺼내는 곳: 앱 아이콘이 툭 떨어져 들어간다 */
.aep-ld-drop { position: relative; width: 120px; height: 112px; }
.aep-ld-logo { position: absolute; left: 36px; top: 0; width: 48px; height: 48px; animation: aep-ld-fall 1.4s steps(7) infinite; }
.aep-ld-logo svg { width: 100%; height: 100%; display: block; }
.aep-ld-tray { position: absolute; left: 0; right: 0; bottom: 0; height: 44px; background: #26384a; border: 3px solid #1f2d3a; border-top-color: #9fb4c4; }
.aep-ld-tray::before { content: ''; position: absolute; left: 14px; right: 14px; top: 10px; height: 4px; background: #0e1620; }
.aep-ld-ae { width: 96px; height: auto; overflow: visible; display: block; animation: aep-ld-hop .9s steps(2) infinite; }
@keyframes aep-ld-in { from { opacity: 0; } }
@keyframes aep-ld-fall { 0% { transform: translateY(0); } 65% { transform: translateY(44px); } 78% { transform: translateY(36px); } 90%, 100% { transform: translateY(44px); } }
@keyframes aep-ld-hop { 50% { transform: translateY(-8px); } }
@media (prefers-color-scheme: dark) {
  .aep-ld { background: #131c25; color: #f1f5f8; --px-ink: #05090d; }
  .aep-ld-tray { border-color: #05090d; border-top-color: #34495e; }
}
@media (prefers-reduced-motion: reduce) {
  .aep-ld, .aep-ld-logo, .aep-ld-ae { animation: none; }
  .aep-ld-logo { transform: translateY(44px); }
}
`;

// 도트 ae:p (브랜드 로고와 같은 그림)
const AE =
  '<svg class="aep-ld-ae" viewBox="0 0 19 9" shape-rendering="crispEdges" aria-hidden="true">' +
  '<path fill="currentColor" d="M1 2h3v1h-3zM4 3h1v1h-1zM1 4h4v1h-4zM0 5h1v1h-1zM4 5h1v1h-1zM1 6h4v1h-4zM7 2h3v1h-3zM6 3h1v1h-1zM10 3h1v1h-1zM6 4h5v1h-5zM6 5h1v1h-1zM7 6h3v1h-3zM14 2h4v1h-4zM14 3h1v1h-1zM18 3h1v1h-1zM14 4h1v1h-1zM18 4h1v1h-1zM14 5h1v1h-1zM18 5h1v1h-1zM14 6h4v1h-4zM14 7h1v1h-1zM14 8h1v1h-1z"/>' +
  '<path fill="#e0533d" d="M12 4h1v1h-1zM12 7h1v1h-1z"/></svg>';

/** 로딩 화면 마크업. app 이 없으면 ae:p 만 (포털로 갈 때) */
export function loaderHtml(app?: PortalApp): string {
  if (!app) return `<div class="aep-ld" role="status" aria-label="불러오는 중">${AE}<p>ae:p</p></div>`;
  const logo = appLogo(app);
  return (
    `<div class="aep-ld" role="status" aria-label="${app.name} 여는 중">` +
    `<div class="aep-ld-drop"><div class="aep-ld-logo">${logo.html}</div><div class="aep-ld-tray"></div></div>` +
    `<p>${app.name} 여는 중…</p></div>`
  );
}

let host: HTMLElement | null = null;

/** 화면 전체를 로딩 화면으로 덮는다. 페이지가 넘어가면 같이 사라진다 (Shadow DOM 이라 앱 CSS 와 안 섞인다) */
export function showLoader(app?: PortalApp) {
  host?.remove();
  host = document.createElement('div');
  host.setAttribute('data-aep-loader', '');
  host.attachShadow({ mode: 'open' }).innerHTML = `<style>${LOADER_CSS}</style>${loaderHtml(app)}`;
  document.body.append(host);
}

/** 새 탭으로 여는 클릭(가운데 버튼, Ctrl/⌘ 클릭)은 지금 화면이 안 바뀌므로 로딩 화면을 띄우지 않는다 */
export const isPlainClick = (e: MouseEvent) =>
  e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.defaultPrevented;

// 뒤로 가기로 이 페이지가 캐시(bfcache)에서 되살아나면 덮개를 걷는다
if (typeof window !== 'undefined') {
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) {
      host?.remove();
      host = null;
    }
  });
}
