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
import favicon from '../public/favicon.svg?raw';
import { APPS, appLogo, currentApp } from '../shared/apps';
import { isPlainClick, showLoader } from '../shared/loader';

const CSS = `
:host { all: initial; font-family: 'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; }
:host(:not([mode='inline'])) { position: fixed; z-index: 2147483000; }
* { box-sizing: border-box; }
.btn {
  width: 44px; height: 44px; padding: 7px; border: 1px solid #ebe9f4; border-radius: 50%;
  background: #fff; box-shadow: 0 8px 22px -10px rgb(90 80 200 / .55); cursor: pointer;
  display: grid; place-items: center; transition: transform .12s;
}
/* 툴바 안 버튼 크기는 앱이 정한다: aep-switcher { --aep-switcher-size: 28px } (사용자 정의 속성은 all: initial 에도 상속된다) */
:host([mode='inline']) .btn {
  width: var(--aep-switcher-size, 36px); height: var(--aep-switcher-size, 36px);
  padding: calc(var(--aep-switcher-size, 36px) * .14); box-shadow: none;
}
.btn:active { transform: scale(.94); }
.btn:focus-visible { outline: 2px solid #6a5ff0; outline-offset: 2px; }
.btn svg { width: 100%; height: 100%; }
/* inline 모드는 호스트에 z-index 가 없어서, 패널에 직접 주지 않으면 뒤에 오는 앱 요소(position: relative 인 탭 등)가 패널 위에 그려진다 */
.panel {
  position: fixed; z-index: 2147483000; width: 264px; padding: 8px;
  background: #fff; color: #2e3142; border: 1px solid #ebe9f4; border-radius: 18px;
  box-shadow: 0 18px 40px -14px rgb(60 50 160 / .45);
  font-size: 14px; line-height: 1.4;
}
.panel[hidden] { display: none; }
.head { display: flex; align-items: center; gap: 8px; padding: 8px 10px 10px; color: #5d6177; font-size: 12px; border-bottom: 1px solid #ebe9f4; margin-bottom: 4px; }
.head svg { width: 26px; height: 26px; }
a { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 12px; color: inherit; text-decoration: none; }
a:hover, a:focus-visible { background: #f6f5fb; outline: none; }
a.current { background: #f1efff; font-weight: 700; }
a.soon { opacity: .45; pointer-events: none; }
.ic { width: 32px; height: 32px; flex: none; border-radius: 50%; display: grid; place-items: center; overflow: hidden; --px-ink: #1e1e1e; }
.ic svg { width: var(--logo, 56%); height: auto; display: block; }
.home .ic { background: #f6f5fb; color: #5d6177; }
.tag { margin-left: auto; font-size: 12px; color: #5d6177; }
.work { background: #efe9ff; color: #8b6cf6; }
.project { background: #e3eeff; color: #4e8bff; }
.health { background: #e0f5ea; color: #2faf6b; }
.interest { background: #fdeae2; color: #f07a4e; }
.foot { border-top: 1px solid #ebe9f4; margin-top: 4px; padding-top: 4px; }
.foot a { color: #c8344d; font-size: 13px; }
@media (prefers-color-scheme: dark) {
  .btn { background: #1f2038; border-color: #2e3050; }
  .panel { background: #1f2038; color: #ecebfa; border-color: #2e3050; }
  .head, .foot { border-color: #2e3050; }
  .head, .tag, .home .ic { color: #a3a5c2; }
  a:hover, a:focus-visible, .home .ic { background: #17182e; }
  a.current { background: #2a2650; }
  .work { background: #2d2652; color: #b39dff; }
  .project { background: #1d2f55; color: #8fb6ff; }
  .health { background: #183a2b; color: #6fd6a2; }
  .interest { background: #43281f; color: #ffa684; }
  .ic { --px-ink: #a7b6bd; }
  .foot a { color: #ff7d90; }
}
`;

const HOME_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>';

class AepSwitcher extends HTMLElement {
  private panel!: HTMLElement;
  private button!: HTMLButtonElement;

  connectedCallback() {
    if (this.shadowRoot) return;
    const root = this.attachShadow({ mode: 'open' });
    const here = currentApp(location.pathname);

    const items = APPS.map((a) => {
      const logo = appLogo(a);
      return `<a href="${a.path}" data-app="${a.id}" class="${a === here ? 'current' : ''} ${a.ready ? '' : 'soon'}" ${a.ready ? '' : 'aria-disabled="true" tabindex="-1"'}>
          <span class="ic ${a.tone}" style="--logo:${logo.size}">${logo.html}</span>${a.name}${a.ready ? '' : '<span class="tag">준비 중</span>'}
        </a>`;
    }).join('');

    root.innerHTML = `<style>${CSS}</style>
      <button class="btn" part="button" aria-haspopup="true" aria-expanded="false" aria-label="앱 전환">${favicon}</button>
      <nav class="panel" hidden aria-label="ae:p 앱">
        <div class="head">${favicon}<span>ae:p takecare</span></div>
        <a href="/" class="home"><span class="ic">${HOME_ICON}</span>홈</a>
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
