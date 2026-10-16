// 앱 사이를 오갈 때 보이는 로딩 화면: 가려는 앱의 로고 + 통통 튀는 ae + "○○ 여는 중…"
// 포털 홈(카드)·switcher.js(앱 안의 전환 메뉴)·포털 index.html(첫 화면)이 같이 쓴다.
// 각 앱의 index.html 에도 같은 모양을 넣어 두면(첫 페인트 전) 화면이 끊기지 않고 이어진다
import { appLogo, type PortalApp } from './apps.ts';

export const LOADER_CSS = `
.aep-ld {
  position: fixed; inset: 0; z-index: 2147483646;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px;
  background: #f6f5fb; color: #7b7f95;
  font: 14px/1.4 'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
  letter-spacing: .02em;
  animation: aep-ld-in .2s ease-out both;
  --px-ink: #1e1e1e;
}
.aep-ld p { margin: 0; }
.aep-ld-logo {
  width: 92px; height: 92px; border-radius: 50%;
  display: grid; place-items: center;
  box-shadow: 0 14px 34px -14px rgb(90 80 200 / .45);
  animation: aep-ld-pop .45s cubic-bezier(.2, 1.4, .4, 1) both;
}
.aep-ld-logo svg { width: var(--logo); height: auto; display: block; }
.aep-ld-work { background: #efe9ff; } .aep-ld-project { background: #e3eeff; }
.aep-ld-health { background: #e0f5ea; } .aep-ld-interest { background: #fdeae2; }
.aep-ld-ae { width: 58px; height: auto; overflow: visible; }
.aep-ld-ae path { transform-box: fill-box; transform-origin: center bottom; animation: aep-ld-hop .9s ease-in-out infinite; }
.aep-ld-ae .e { animation-delay: .18s; }
.aep-ld-solo .aep-ld-ae { width: 96px; }
@keyframes aep-ld-in { from { opacity: 0; } }
@keyframes aep-ld-pop { from { transform: scale(.6); opacity: 0; } }
@keyframes aep-ld-hop {
  0%, 60%, 100% { transform: translateY(0) scale(1, 1); }
  20% { transform: translateY(-16px) scale(.96, 1.04); }
  45% { transform: translateY(0) scale(1.06, .92); }
}
@media (prefers-color-scheme: dark) {
  .aep-ld { background: #14152a; color: #9a9cb8; --px-ink: #a7b6bd; }
  .aep-ld-work { background: #2d2652; } .aep-ld-project { background: #1d2f55; }
  .aep-ld-health { background: #183a2b; } .aep-ld-interest { background: #43281f; }
}
@media (prefers-reduced-motion: reduce) {
  .aep-ld, .aep-ld-logo, .aep-ld-ae path { animation: none; }
}
`;

// 파비콘과 같은 ae (a 와 e 를 따로 튀게 하려고 path 를 나눠 둔다)
const AE =
  '<svg class="aep-ld-ae" viewBox="4 4 200 112" aria-hidden="true">' +
  '<defs><linearGradient id="aep-ld-grad" gradientUnits="userSpaceOnUse" x1="8" y1="40" x2="200" y2="90">' +
  '<stop offset="0" stop-color="#4E8BFF"/><stop offset=".5" stop-color="#7A82FF"/><stop offset="1" stop-color="#D47CF2"/></linearGradient></defs>' +
  '<g fill="none" stroke="url(#aep-ld-grad)" stroke-width="32" stroke-linecap="round" stroke-linejoin="round">' +
  '<path class="a" d="M24 60a36 36 0 1 0 72 0a36 36 0 1 0 -72 0M96 42V96"/>' +
  '<path class="e" d="M111 60H183A36 36 0 1 0 163.9 91.79"/></g></svg>';

/** 로딩 화면 마크업. app 이 없으면 ae 만 크게 (포털로 갈 때) */
export function loaderHtml(app?: PortalApp): string {
  if (!app) return `<div class="aep-ld aep-ld-solo" role="status" aria-label="불러오는 중">${AE}<p>ae:p</p></div>`;
  const logo = appLogo(app);
  return (
    `<div class="aep-ld" role="status" aria-label="${app.name} 여는 중">` +
    `<div class="aep-ld-logo aep-ld-${app.tone}" style="--logo:${logo.size}">${logo.html}</div>` +
    `${AE}<p>${app.name} 여는 중…</p></div>`
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
