// <aep-switcher> — 각 앱에 붙는 ae:p 앱 전환 버튼 (프레임워크 무관 웹 컴포넌트)
//
// 앱에서 쓰는 법 (index.html 한 줄):
//   <script type="module" src="/shell/switcher.js"></script>
// 태그가 없으면 오른쪽 아래에 떠 있는 버튼을 자동으로 붙인다 (끄기: <meta name="aep-switcher" content="manual">).
// 위치를 정하려면 직접 넣는다:
//   <aep-switcher position="top-left" offset="12"></aep-switcher>   떠 있는 버튼 (모서리 + 간격 px)
//   <aep-switcher mode="inline"></aep-switcher>                      앱 툴바 안에 그냥 놓이는 버튼 (크기: CSS --aep-switcher-size)
//
// Shadow DOM 이라 앱 CSS 와 섞이지 않는다. 앱 목록은 포털 저장소의 shared/apps.ts 를 빌드할 때 넣는다
//
// P-0004: 같은 출처 localStorage 의 Supabase 세션(app_metadata)을 읽어
//   - 에이전트 항목은 관리자 · 공유받은 멤버에게만 보인다 (실제 막기는 업무일지 API)
//   - 공용 테스터 계정이면 화면 위에 '테스터 모드' 띠를 붙인다
import { APPS, appLogo, currentApp, isTesterMeta, visibleApps, type AppMetadata } from '../shared/apps';
import { isPlainClick, showLoader } from '../shared/loader';

const CSS = `
:host { all: initial; font-family: 'Galmuri11', 'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; }
:host(:not([mode='inline'])) { position: fixed; z-index: 2147483000; }
* { box-sizing: border-box; }
/* 동전 모양 앱 전환 버튼: 아래 두께가 있고 누르면 내려간다 */
.btn {
  width: 44px; height: 44px; padding: 7px; border: 3px solid #1f2d3a; border-radius: 0;
  background: #f4e7b4; box-shadow: 0 4px 0 #1f2d3a; cursor: pointer;
  display: grid; place-items: center; transition: transform .08s steps(2), box-shadow .08s steps(2);
}
/* 툴바 안 버튼 크기는 앱이 정한다: aep-switcher { --aep-switcher-size: 28px } (사용자 정의 속성은 all: initial 에도 상속된다) */
:host([mode='inline']) .btn {
  width: var(--aep-switcher-size, 36px); height: var(--aep-switcher-size, 36px);
  padding: calc(var(--aep-switcher-size, 36px) * .14); border-width: 2px; box-shadow: 0 2px 0 #1f2d3a;
}
.btn:active { transform: translateY(3px); box-shadow: 0 0 0 #1f2d3a; }
:host([mode='inline']) .btn:active { transform: translateY(2px); }
.btn[aria-expanded='true'] { transform: translateY(3px); box-shadow: 0 0 0 #1f2d3a; }
.btn:focus-visible { outline: 3px solid #fff; outline-offset: 2px; box-shadow: 0 0 0 6px #1f2d3a; }
.btn svg { width: 100%; height: 100%; image-rendering: pixelated; }
/* inline 모드는 호스트에 z-index 가 없어서, 패널에 직접 주지 않으면 뒤에 오는 앱 요소(position: relative 인 탭 등)가 패널 위에 그려진다 */
.panel {
  position: fixed; z-index: 2147483000; width: 272px; padding: 6px;
  background: #e7efed; color: #1c2631; border: 3px solid #1f2d3a; border-radius: 0;
  box-shadow: 4px 4px 0 #1f2d3a;
  font-size: 14px; line-height: 1.4;
  transform-origin: var(--origin, top left); animation: pop .14s steps(3);
}
.panel[hidden] { display: none; }
@keyframes pop { from { opacity: 0; transform: translateY(-4px); } }
.head { display: flex; align-items: center; gap: 8px; padding: 6px 8px 8px; color: #44525f; font-size: 12px; border-bottom: 3px dotted #1f2d3a; margin-bottom: 4px; }
.head svg { width: 20px; height: 20px; }
a { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 6px 8px; color: inherit; text-decoration: none; font-weight: 700; }
a:hover { background: #fff6cf; }
a:focus-visible { background: #fff6cf; outline: 3px solid #1f2d3a; outline-offset: -3px; }
a.current { background: #f4e7b4; }
a.soon { opacity: .5; pointer-events: none; }
.ic { width: 30px; height: 30px; flex: none; display: grid; place-items: center; --px-ink: #1f2d3a; }
.ic svg { width: 100%; height: auto; display: block; }
.tag { margin-left: auto; font-size: 12px; color: #44525f; font-weight: 400; }
.foot { border-top: 3px dotted #1f2d3a; margin-top: 4px; padding-top: 4px; }
.foot a { color: #a63a29; font-size: 13px; }
@media (prefers-color-scheme: dark) {
  .btn { border-color: #05090d; box-shadow: 0 4px 0 #05090d; }
  :host([mode='inline']) .btn { box-shadow: 0 2px 0 #05090d; }
  .btn:active, .btn[aria-expanded='true'] { box-shadow: 0 0 0 #05090d; }
  .panel { background: #2d4156; color: #f1f5f8; border-color: #05090d; box-shadow: 4px 4px 0 #05090d; }
  .head, .foot { border-color: #05090d; color: #a9bbc9; }
  .tag { color: #a9bbc9; }
  a:hover, a:focus-visible { background: #3e5368; }
  a:focus-visible { outline-color: #f4e7b4; }
  a.current { background: #4b5a42; }
  .ic { --px-ink: #05090d; }
  .foot a { color: #ff9a86; }
}
@media (prefers-reduced-motion: reduce) { .panel { animation: none; } .btn { transition: none; } }
`;

/** 포털이 만든 Supabase 세션(localStorage 'sb-<프로젝트>-auth-token')의 app_metadata. 없으면 undefined */
function sessionMeta(): AppMetadata {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !/^sb-.+-auth-token$/.test(key)) continue;
      const session = JSON.parse(localStorage.getItem(key) ?? 'null') as { user?: { app_metadata?: AppMetadata } } | null;
      if (session?.user) return session.user.app_metadata ?? {};
    }
  } catch {
    // 저장소를 못 읽으면 기본 목록(에이전트 숨김)
  }
  return undefined;
}

// 8×8 도트 동전 (앱 전환 버튼 · 머리말 · 홈 항목)
const COIN_ROWS = ['..kkkk..', '.kyyyyk.', 'kyywwyyk', 'kywyyyyk', 'kywyyyyk', 'kyyyyyyk', '.kyyyyk.', '..kkkk..'];
const COIN_FILL: Record<string, string> = { k: '#1f2d3a', y: '#f0c94a', w: '#fff6cf' };
const COIN = `<svg viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true">${COIN_ROWS.flatMap((row, y) =>
  [...row].map((c, x) => (c === '.' ? '' : `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${COIN_FILL[c]}"/>`)),
).join('')}</svg>`;

const TESTER_BAND_ID = 'aep-tester-band';
/** 테스터 모드 띠. 화면 위 가운데에 떠 있고 누를 수 없다 (앱 조작을 막지 않게) */
function mountTesterBand() {
  if (document.getElementById(TESTER_BAND_ID)) return;
  const band = document.createElement('div');
  band.id = TESTER_BAND_ID;
  band.setAttribute('role', 'status');
  band.textContent = '테스터 모드 · 새로 만든 데이터는 로그아웃하면 지워져요 · 기본 데이터는 바꿀 수 없어요';
  Object.assign(band.style, {
    position: 'fixed', top: 'calc(6px + env(safe-area-inset-top))', left: '50%', transform: 'translateX(-50%)',
    zIndex: '2147483001', maxWidth: 'calc(100vw - 24px)', padding: '4px 10px', borderRadius: '0',
    background: '#f4e7b4', color: '#1f2d3a', border: '3px solid #1f2d3a', boxShadow: '0 3px 0 #1f2d3a',
    font: "700 12px/1.4 'Galmuri11', 'Pretendard Variable', Pretendard, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif",
    textAlign: 'center', pointerEvents: 'none',
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.append(band);
}

class AepSwitcher extends HTMLElement {
  private panel!: HTMLElement;
  private button!: HTMLButtonElement;

  connectedCallback() {
    if (this.shadowRoot) return;
    const root = this.attachShadow({ mode: 'open' });
    const here = currentApp(location.pathname);
    const meta = sessionMeta();
    if (isTesterMeta(meta)) mountTesterBand();

    const items = visibleApps(meta).map((a) => {
      const logo = appLogo(a);
      return `<a href="${a.path}" data-app="${a.id}" class="${a === here ? 'current' : ''} ${a.ready ? '' : 'soon'}" ${a.ready ? '' : 'aria-disabled="true" tabindex="-1"'}>
          <span class="ic ${a.tone}" style="--logo:${logo.size}">${logo.html}</span>${a.name}${a.ready ? '' : '<span class="tag">준비 중</span>'}
        </a>`;
    }).join('');

    root.innerHTML = `<style>${CSS}</style>
      <button class="btn" part="button" aria-haspopup="true" aria-expanded="false" aria-label="앱 전환">${COIN}</button>
      <nav class="panel" hidden aria-label="ae:p 앱">
        <div class="head">${COIN}<span>ae:p 자판기</span></div>
        <a href="/" class="home"><span class="ic">${COIN}</span>홈 (자판기)</a>
        ${items}
        <div class="foot"><a href="/login?logout=1">로그아웃</a></div>
      </nav>`;

    this.button = root.querySelector('.btn')!;
    this.panel = root.querySelector('.panel')!;
    this.button.addEventListener('click', () => this.toggle());
    // 다른 화면으로 넘어갈 때 로딩 화면으로 덮는다 (홈·로그아웃은 ae 만)
    this.panel.addEventListener('click', (e) => {
      const link = (e.target as Element).closest('a');
      if (!link || !isPlainClick(e)) return;
      this.toggle(false);
      // 지금 보고 있는 바로 그 주소면 다시 불러오지 않는다
      if (link.href === location.href) return e.preventDefault();
      showLoader(APPS.find((a) => a.id === link.dataset.app));
    });
    this.place();
  }

  /** 떠 있는 버튼의 모서리 위치 */
  private place() {
    if (this.getAttribute('mode') === 'inline') return;
    const [v, h] = (this.getAttribute('position') ?? 'bottom-right').split('-');
    const gap = Number(this.getAttribute('offset') ?? 16);
    const safe = v === 'bottom' ? 'env(safe-area-inset-bottom)' : 'env(safe-area-inset-top)';
    this.style.setProperty(v === 'top' ? 'top' : 'bottom', `calc(${gap}px + ${safe})`);
    this.style.setProperty(h === 'left' ? 'left' : 'right', `${gap}px`);
  }

  private onOutside = (e: Event) => {
    if (!e.composedPath().includes(this)) this.toggle(false);
  };
  private onKey = (e: KeyboardEvent) => e.key === 'Escape' && this.toggle(false);

  private toggle(open = this.panel.hidden) {
    this.panel.hidden = !open;
    this.button.setAttribute('aria-expanded', String(open));
    if (open) {
      // 버튼이 화면 어느 쪽에 있든 안쪽으로 펼친다
      const r = this.button.getBoundingClientRect();
      const below = r.top < window.innerHeight / 2;
      const right = r.left > window.innerWidth / 2;
      Object.assign(this.panel.style, {
        top: below ? `${r.bottom + 8}px` : '',
        bottom: below ? '' : `${window.innerHeight - r.top + 8}px`,
        left: right ? '' : `${Math.max(8, r.left)}px`,
        right: right ? `${Math.max(8, window.innerWidth - r.right)}px` : '',
      });
      document.addEventListener('pointerdown', this.onOutside);
      document.addEventListener('keydown', this.onKey);
    } else {
      document.removeEventListener('pointerdown', this.onOutside);
      document.removeEventListener('keydown', this.onKey);
    }
  }

  disconnectedCallback() {
    this.toggle(false);
  }
}

if (!customElements.get('aep-switcher')) customElements.define('aep-switcher', AepSwitcher);

// 앱이 태그를 직접 넣지 않았으면 기본 위치(오른쪽 아래)에 붙인다.
// React 처럼 나중에 태그를 그리는 앱은 <meta name="aep-switcher" content="manual"> 로 끈다
function autoMount() {
  if (document.querySelector('aep-switcher, meta[name="aep-switcher"][content="manual"]')) return;
  document.body.append(document.createElement('aep-switcher'));
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoMount);
else autoMount();
