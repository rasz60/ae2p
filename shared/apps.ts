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
  /** 앱의 대표 로고 (SVG). 없으면 축 아이콘. size = 동그라미 안에서 차지하는 폭(%) */
  logo?: { svg: string; size: number };
}

// ── 앱별 대표 로고 ─────────────────────────
// 각 앱의 UI 콘셉트를 그대로 가져온다: 업무일지·에이전트 = kingtepad 픽셀 아이콘, 운동기록 = 흑백 모노크롬

/** 픽셀 아트(문자 격자) → SVG. k(외곽선)는 테마에 따라 --px-ink 로 바뀐다 */
const PX: Record<string, string> = {
  k: 'var(--px-ink, #1e1e1e)', g: '#3ec46d', d: '#1f8a4c', e: '#a8e07a', m: '#f6dfb8', b: '#4d8dff',
};
function pixelSvg(rows: string[]): string {
  let rects = '';
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = row[x]!;
      if (c !== '.') rects += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${PX[c]}"/>`;
    }
  });
  return `<svg viewBox="0 0 ${rows[0]!.length} ${rows.length}" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}

const TURTLE = pixelSvg([
  '..kkkkkkk......',
  '.kgdgggdgk.kkk.',
  'kgdgdgdgdgkekek',
  'kggdgggdggkeeek',
  'kkkkkkkkkkkkkk.',
  '.kmmmmmmmmmk...',
  '.kek.....kek...',
  '.kkk.....kkk...',
]);
const MONITOR = pixelSvg([
  'kkkkkkkkkkk',
  'kbbbbbbbbbk',
  'kbgbbbbbbbk',
  'kbbgbbbbbbk',
  'kbgbbgggbbk',
  'kbbbbbbbbbk',
  'kbbbbbbbbbk',
  'kkkkkkkkkkk',
  '....kkk....',
  '..kkkkkkk..',
]);
// 운동기록(work-doubt): 검은 원 + 흰 추세선 (앱의 TREND 차트)
const TREND =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#0b0b0b"/>' +
  '<polyline points="5.5,15.5 9.5,11.5 12.5,14 17,8.5 18.8,10" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export const APPS: PortalApp[] = [
  {
    id: 'diary', name: '업무일지++', desc: '업무 · 일지 · 캘린더', path: '/diary/', tone: 'work', ready: true,
    logo: { svg: TURTLE, size: 72 },
  },
  // 별도 저장소로 떼어 내기 전까지는 업무일지 안의 모니터 화면 (떼어 내면 /agent/)
  {
    id: 'agent', name: '에이전트', desc: '잡 모니터 · 잡 요청', path: '/diary/monitor', tone: 'project', ready: true,
    logo: { svg: MONITOR, size: 56 },
  },
  {
    id: 'workout', name: '운동기록', desc: '체성분 · 운동 · AI 코치', path: '/workout/', tone: 'health', ready: true,
    logo: { svg: TREND, size: 100 },
  },
  { id: 'career', name: '커리어++', desc: '경력 · 목표 관리', path: '/career/', tone: 'interest', ready: false },
];

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

/** 동그라미 안에 넣을 앱 로고. 크기는 style 의 --logo 로 넘긴다 (CSS: .xxx svg { width: var(--logo) }) */
export const appLogo = (app: PortalApp) => ({
  html: app.logo?.svg ?? iconSvg(app.tone),
  size: `${app.logo?.size ?? 46}%`,
});

/** 지금 주소가 어느 앱인지 (/diary/monitor 처럼 겹치면 더 긴 경로가 이긴다) */
export const currentApp = (pathname: string) =>
  APPS.filter((a) => pathname.startsWith(a.path)).sort((a, b) => b.path.length - a.path.length)[0];
