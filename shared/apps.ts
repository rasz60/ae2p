// 포털에 뜨는 앱 목록. 홈 화면 · switcher.js · 로딩 화면이 같이 쓴다
// 새 앱을 붙이면 여기에 추가하고 이 저장소를 배포한다 (각 앱은 다시 배포할 필요 없음)

export type AppTone = 'work' | 'project' | 'health' | 'interest';

export interface PortalApp {
  id: string;
  name: string;
  desc: string;
  /** 같은 도메인의 하위 경로 (앱 루트면 끝에 /) */
  path: string;
  tone: AppTone;
  /** false 면 '준비 중'으로 보이고 누를 수 없다 */
  ready: boolean;
  /** 앱의 대표 로고 (SVG). 없으면 축 아이콘. size = 아이콘 칸 안에서 차지하는 폭(%) */
  logo?: { svg: string; size: number };
  /** 'agent' 면 관리자와 에이전트를 공유받은 멤버에게만 보인다 (P-0004. 실제 막기는 업무일지 API 가 한다) */
  access?: 'agent';
  /** 테스터 로그아웃 직전에 포털이 POST 로 부르는 정리 API (P-0004). 테스터가 새로 만든 데이터를 지운다 */
  testerReset?: string;
}

// ── 앱별 대표 로고 ─────────────────────────
// 12×12 도트 아이콘. 자판기 칸 · 앱 전환 목록 · 로딩 화면이 같이 쓴다 (운동기록 · 커리어++ 앱 안의 아이콘과도 같은 그림)

/** 픽셀 아트(문자 격자) → SVG. k(외곽선)는 테마에 따라 --px-ink 로 바뀐다. a 는 앱마다 다른 포인트색 */
function pixelSvg(rows: string[], accent: string): string {
  const PX: Record<string, string> = {
    k: 'var(--px-ink, #1f2d3a)', w: '#ffffff', a: accent, b: '#2f6f8f', g: '#9be37a', d: '#d9dee8',
  };
  let rects = '';
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = row[x]!;
      if (c !== '.') rects += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${PX[c]}"/>`;
    }
  });
  return `<svg viewBox="0 0 ${rows[0]!.length} ${rows.length}" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}

// 업무일지: 메모장
const NOTEPAD = pixelSvg([
  'kkkkkkkkkkkk',
  'kaaaaaaaaaak',
  'kwwwwwwwwwwk',
  'kwkkkkkkkkwk',
  'kwwwwwwwwwwk',
  'kwkkkkkkwwwk',
  'kwwwwwwwwwwk',
  'kwkkkkkkkkwk',
  'kwwwwwwwwwwk',
  'kwkkkkwwwwwk',
  'kwwwwwwwwwwk',
  'kkkkkkkkkkkk',
], '#3d63b8');
// 에이전트: 모니터
const MONITOR = pixelSvg([
  'kkkkkkkkkkkk',
  'kbbbbbbbbbbk',
  'kbgbbbbbbbbk',
  'kbbgbbbbbbbk',
  'kbgbbbbbbbbk',
  'kbbbbggbbbbk',
  'kbbbbbbbbbbk',
  'kkkkkkkkkkkk',
  '....kkkk....',
  '.kkkkkkkkkk.',
  '.kddddddddk.',
  '.kkkkkkkkkk.',
], '#2f6f8f');
// 운동기록: 덤벨
const DUMBBELL = pixelSvg([
  '............',
  '............',
  '..kk....kk..',
  '.kaak..kaak.',
  'kkaakkkkaakk',
  'kaaawwwwaaak',
  'kaaawwwwaaak',
  'kkaakkkkaakk',
  '.kaak..kaak.',
  '..kk....kk..',
  '............',
  '............',
], '#c2564b');
// 커리어++: 이력서 카드
const IDCARD = pixelSvg([
  'kkkkkkkkkkkk',
  'kaaaaaaaaaak',
  'kwwwwwwwwwwk',
  'kwkkwwkkkkwk',
  'kwkkwwwwwwwk',
  'kwwwwwkkkkwk',
  'kwwwwwwwwwwk',
  'kwkkkkkkwwwk',
  'kwwwwwwwwwwk',
  'kwkkkkwwwwwk',
  'kwwwwwwwwwwk',
  'kkkkkkkkkkkk',
], '#c2762b');

export const APPS: PortalApp[] = [
  {
    id: 'diary', name: '업무일지++', desc: '업무 · 일지 · 캘린더', path: '/diary/', tone: 'work', ready: true,
    logo: { svg: NOTEPAD, size: 100 }, testerReset: '/api/diary/tester/reset',
  },
  // 별도 저장소로 떼어 내기 전까지는 업무일지 안의 모니터 화면 (떼어 내면 /agent/)
  {
    id: 'agent', name: '에이전트', desc: '잡 모니터 · 잡 요청', path: '/diary/monitor', tone: 'project', ready: true,
    logo: { svg: MONITOR, size: 100 }, access: 'agent',
  },
  {
    id: 'workout', name: '운동기록', desc: '체성분 · 운동 · AI 코치', path: '/workout/', tone: 'health', ready: true,
    logo: { svg: DUMBBELL, size: 100 }, testerReset: '/api/workout/api/v1/tester/reset',
  },
  {
    id: 'career', name: '커리어++', desc: '이력 · 프로젝트 · 채용공고', path: '/career/', tone: 'interest', ready: true,
    logo: { svg: IDCARD, size: 100 }, testerReset: '/api/career/api/v1/me/tester/reset',
  },
];

/** Supabase Auth 의 app_metadata (role · agent_share). 사용자가 스스로 못 바꾼다 */
export type AppMetadata = Record<string, unknown> | null | undefined;

export const isTesterMeta = (meta: AppMetadata) => meta?.role === 'tester';

/** 에이전트를 볼 수 있는 계정: 관리자, 또는 관리자가 공유한 멤버. 테스터는 못 본다 (업무일지 API 와 같은 규칙) */
export const canUseAgent = (meta: AppMetadata) =>
  meta?.role === 'admin' || (meta?.role !== 'tester' && meta?.agent_share === true);

/** 이 계정에게 보여 줄 앱 (홈 · switcher.js) */
export const visibleApps = (meta: AppMetadata) => APPS.filter((a) => a.access !== 'agent' || canUseAgent(meta));

/** 축별 아이콘 (24×24, 선 2px). 로고가 없는 앱에 쓴다 */
export const TONE_ICON: Record<AppTone, string> = {
  work: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  project: '<circle cx="6" cy="18" r="3"/><circle cx="18" cy="6" r="3"/><path d="M6 3v12"/><path d="M18 9a9 9 0 0 1-9 9"/>',
  health: '<circle cx="15" cy="4" r="2"/><path d="M7 21l3-6 3 2v4"/><path d="M5 12l3.5-4 4.5 1 2.5 3.5H19"/><path d="M10 15l2-6"/>',
  interest: '<path d="m12 2.5 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.3l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9z"/>',
};

export const TONE_LABEL: Record<AppTone, string> = { work: 'Work', project: 'Project', health: 'Health', interest: 'Interest' };

export const iconSvg = (tone: AppTone) =>
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TONE_ICON[tone]}</svg>`;

/** 아이콘 칸 안에 넣을 앱 로고. 크기는 style 의 --logo 로 넘긴다 (CSS: .xxx svg { width: var(--logo) }) */
export const appLogo = (app: PortalApp) => ({
  html: app.logo?.svg ?? iconSvg(app.tone),
  size: `${app.logo?.size ?? 46}%`,
});

/** 앱 경로에 들어가는 주소인지. 끝 / 가 없는 앱 루트(/workout, /workout?x=1)도 그 앱이다 */
const isUnder = (pathname: string, appPath: string) => {
  const root = appPath.replace(/\/$/, '');
  return pathname === root || pathname.startsWith(`${root}/`) || pathname.startsWith(`${root}?`);
};

/** 지금 주소가 어느 앱인지 (/diary/monitor 처럼 겹치면 더 긴 경로가 이긴다) */
export const currentApp = (pathname: string) =>
  APPS.filter((a) => isUnder(pathname, a.path)).sort((a, b) => b.path.length - a.path.length)[0];
