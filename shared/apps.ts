// 포털에 뜨는 앱 목록. 홈 화면과 switcher.js 가 같이 쓴다
// 새 앱을 붙이면 여기에 추가하고 이 저장소를 배포한다 (각 앱은 다시 배포할 필요 없음)

export type AppTone = 'work' | 'project' | 'health' | 'interest';

export interface PortalApp {
  id: string;
  name: string;
  desc: string;
  /** 같은 도메인의 하위 경로. 끝에 / */
  path: string;
  tone: AppTone;
  /** false 면 '준비 중'으로 보이고 누를 수 없다 */
  ready: boolean;
}

export const APPS: PortalApp[] = [
  { id: 'diary', name: '업무일지++', desc: '업무 · 일지 · 캘린더', path: '/diary/', tone: 'work', ready: true },
  { id: 'agent', name: '에이전트', desc: '잡 모니터 · 잡 요청', path: '/agent/', tone: 'project', ready: false },
  { id: 'workout', name: '운동기록', desc: '체성분 · 운동 · AI 코치', path: '/workout/', tone: 'health', ready: false },
  { id: 'career', name: '커리어++', desc: '경력 · 목표 관리', path: '/career/', tone: 'interest', ready: false },
];

/** 축별 아이콘 (24×24, 선 2px). React 와 웹 컴포넌트 양쪽에서 innerHTML 로 쓴다 */
export const TONE_ICON: Record<AppTone, string> = {
  work: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  project: '<circle cx="6" cy="18" r="3"/><circle cx="18" cy="6" r="3"/><path d="M6 3v12"/><path d="M18 9a9 9 0 0 1-9 9"/>',
  health: '<circle cx="15" cy="4" r="2"/><path d="M7 21l3-6 3 2v4"/><path d="M5 12l3.5-4 4.5 1 2.5 3.5H19"/><path d="M10 15l2-6"/>',
  interest: '<path d="m12 2.5 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.3l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9z"/>',
};

export const TONE_LABEL: Record<AppTone, string> = { work: 'Work', project: 'Project', health: 'Health', interest: 'Interest' };

export const iconSvg = (tone: AppTone) =>
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TONE_ICON[tone]}</svg>`;

/** 지금 주소가 어느 앱인지 */
export const currentApp = (pathname: string) => APPS.find((a) => pathname.startsWith(a.path));
