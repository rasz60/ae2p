// ae:p 브랜드 자산 생성: 로고 SVG(public/brand) + PWA 아이콘 PNG(public)
// 사용: npm run brand   — 색·두께를 바꾸려면 아래 상수만 고치고 다시 실행
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');
const brand = join(pub, 'brand');
mkdirSync(brand, { recursive: true });

// ── 색 ─────────────────────────────
const C = {
  g0: '#4E8BFF', g1: '#7A82FF', g2: '#B06EF8', g3: '#D47CF2',
  ink: '#434859', inkDark: '#F3F1FF',
  sub: '#4A4F62', subDark: '#C9C6E6',
};

// ── 글자 (단위: ae 의 x-height = 100) ──
const R = 36, W = 28; // a·e 링 반지름, 획 두께 → 바깥 50 / 안쪽 22
const A = { cx: 60, cy: 60 };
const E = { cx: 147, cy: 60 };
const rad = (d) => (d * Math.PI) / 180;
const pt = (c, r, deg) => [c.cx + r * Math.cos(rad(deg)), c.cy + r * Math.sin(rad(deg))].map((v) => +v.toFixed(2));

const aPath = `M${A.cx - R} ${A.cy}a${R} ${R} 0 1 0 ${2 * R} 0a${R} ${R} 0 1 0 ${-2 * R} 0M${A.cx + R} ${A.cy - 18}V${A.cy + 36}`;
const [ex, ey] = pt(E, R, 62); // e 의 끝 (터진 부분이 획 두께에 묻히지 않을 만큼)
const ePath = `M${E.cx - R} ${E.cy}H${E.cx + R}A${R} ${R} 0 1 0 ${ex} ${ey}`;

// 콜론과 p
const colon = [[212, 46], [212, 82]];
const PW = 16, PR = 22, P = { cx: 259, cy: 66 };
const pPath = `M${P.cx - PR} ${P.cy}a${PR} ${PR} 0 1 0 ${2 * PR} 0a${PR} ${PR} 0 1 0 ${-2 * PR} 0M${P.cx - PR} ${P.cy - 22}V${P.cy + 62}`;

// takecare (모노라인, x-height 22)
const T = {
  t: { w: 13, d: 'M5 -9V16Q5 22 11 22H13M0 2H12' },
  a: { w: 22, d: 'M0 11a11 11 0 1 0 22 0a11 11 0 1 0 -22 0M22 0V22' },
  k: { w: 15, d: 'M0 -10V22M14 0L1.5 12.5M6.5 8L15 22' },
  e: { w: 22, d: 'M0 11H22A11 11 0 1 0 19.43 18.07' },
  c: { w: 21, d: 'M19.43 3.93A11 11 0 1 0 19.43 18.07' },
  r: { w: 12, d: 'M0 0V22M0 11Q0 0 12 0' },
};
const TRACK = 15;
function takecare(color) {
  let x = 0;
  const parts = [];
  for (const ch of 'takecare') {
    parts.push(`<path transform="translate(${x} 0)" d="${T[ch].d}"/>`);
    x += T[ch].w + TRACK;
  }
  return {
    svg: `<g fill="none" stroke="${color}" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round">${parts.join('')}</g>`,
    width: x - TRACK,
  };
}

// ── 공통 defs (말랑한 입체감: 안쪽 하이라이트 + 안쪽 그림자 + 바닥 그림자) ──
// 필터 영역은 userSpaceOnUse 로 넉넉히. 기본값(bbox 기준)은 획 두께를 빼고 계산해 윗부분이 잘린다
const region = 'filterUnits="userSpaceOnUse" x="-40" y="-40" width="400" height="240" color-interpolation-filters="sRGB"';
const defs = (dark) => `
<defs>
  <linearGradient id="grad" gradientUnits="userSpaceOnUse" x1="10" y1="20" x2="197" y2="100">
    <stop offset="0" stop-color="${C.g0}"/>
    <stop offset=".45" stop-color="${C.g1}"/>
    <stop offset=".78" stop-color="${C.g2}"/>
    <stop offset="1" stop-color="${C.g3}"/>
  </linearGradient>
  <filter id="puff" ${region}>
    <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="b"/>
    <feOffset in="b" dx="-3" dy="-6" result="o1"/>
    <feComposite in="SourceAlpha" in2="o1" operator="out" result="rimBR"/>
    <feFlood flood-color="#4B2FC9" flood-opacity="${dark ? 0.5 : 0.4}"/>
    <feComposite in2="rimBR" operator="in" result="shade"/>
    <feOffset in="b" dx="3" dy="6" result="o2"/>
    <feComposite in="SourceAlpha" in2="o2" operator="out" result="rimTL"/>
    <feFlood flood-color="#FFFFFF" flood-opacity="${dark ? 0.45 : 0.6}"/>
    <feComposite in2="rimTL" operator="in" result="hi"/>
    <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="shade"/><feMergeNode in="hi"/></feMerge>
  </filter>
  <filter id="overlap" ${region}>
    <feGaussianBlur in="SourceAlpha" stdDeviation="4"/>
    <feOffset dx="-4" dy="3" result="s"/>
    <feFlood flood-color="#2E2394" flood-opacity=".35"/>
    <feComposite in2="s" operator="in"/>
    <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="drop" ${region}>
    <feDropShadow dx="0" dy="7" stdDeviation="6" flood-color="#6A5CFF" flood-opacity="${dark ? 0.45 : 0.28}"/>
  </filter>
</defs>`;

/** ae:p 마크 (단위 좌표, 대략 x 10~289 / y 10~142) */
function mark(dark = false) {
  const ink = dark ? C.inkDark : C.ink;
  const dots = colon.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="8.5"/>`).join('');
  return `
<g filter="url(#drop)">
  <g fill="none" stroke="url(#grad)" stroke-width="${W}" stroke-linecap="round" stroke-linejoin="round">
    <path d="${aPath}" filter="url(#puff)"/>
    <g filter="url(#overlap)"><path d="${ePath}" filter="url(#puff)"/></g>
  </g>
  <g fill="${ink}">${dots}</g>
  <path d="${pPath}" fill="none" stroke="${ink}" stroke-width="${PW}" stroke-linecap="round"/>
</g>`;
}

const svg = (vb, body, dark = false) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${defs(dark)}${body}</svg>\n`;

/** 꽉 찬 정사각형 앱 아이콘 (둥근 모서리는 OS 가 깎는다). scale 이 작을수록 여백이 넓다 */
function icon(dark, scale) {
  const bg = dark
    ? '<stop offset="0" stop-color="#2A2B48"/><stop offset="1" stop-color="#15162A"/>'
    : '<stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#EFEDF8"/>';
  const tx = 512 - 149.5 * scale, ty = 512 - 72 * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${defs(dark)}
<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">${bg}</linearGradient></defs>
<rect width="1024" height="1024" fill="url(#bg)"/>
<g transform="translate(${tx} ${ty}) scale(${scale})">${mark(dark)}</g></svg>\n`;
}

const files = {};
for (const dark of [false, true]) {
  const s = dark ? '-dark' : '';
  const tc = takecare(dark ? C.subDark : C.sub);
  files[`wordmark${s}.svg`] = svg('0 -6 300 210', `${mark(dark)}<g transform="translate(${149.5 - tc.width / 2} 172)">${tc.svg}</g>`, dark);
  files[`mark${s}.svg`] = svg('0 -6 300 160', mark(dark), dark);
  files[`icon${dark ? '-dark' : '-light'}.svg`] = icon(dark, 2.75);
}
files['icon-maskable.svg'] = icon(false, 2.2); // 안드로이드 마스크(원형 안전 영역 80%)에 들어가게
for (const [name, content] of Object.entries(files)) writeFileSync(join(brand, name), content);

// 파비콘: 작은 크기에선 ae 만, 입체 효과 없이 또렷하게
writeFileSync(
  join(pub, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220">
<defs><linearGradient id="grad" gradientUnits="userSpaceOnUse" x1="12" y1="60" x2="208" y2="160">
<stop offset="0" stop-color="${C.g0}"/><stop offset=".5" stop-color="${C.g1}"/><stop offset="1" stop-color="${C.g3}"/></linearGradient></defs>
<g transform="translate(12 52)" fill="none" stroke="url(#grad)" stroke-width="${W + 4}" stroke-linecap="round" stroke-linejoin="round">
<path d="${aPath}"/><path d="${ePath}"/></g></svg>\n`,
);

// ── PWA 아이콘 PNG ──
const png = (src, size, name) =>
  sharp(join(brand, src), { density: 300 }).resize(size, size).png().toFile(join(pub, name));
await Promise.all([
  png('icon-light.svg', 64, 'pwa-64x64.png'),
  png('icon-light.svg', 192, 'pwa-192x192.png'),
  png('icon-light.svg', 512, 'pwa-512x512.png'),
  png('icon-maskable.svg', 512, 'maskable-icon-512x512.png'),
  png('icon-light.svg', 180, 'apple-touch-icon-180x180.png'),
]);
console.log('brand:', [...Object.keys(files), 'favicon.svg', 'PWA png 5개'].join(', '));
