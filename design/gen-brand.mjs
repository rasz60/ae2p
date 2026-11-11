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
// ae 는 포인트 초록 한 색, :p 와 takecare 는 잉크. 그라데이션 · 입체 효과는 쓰지 않는다 (src/styles.css 의 --accent 와 같은 값)
const C = {
  accent: '#0A7D5A', accentDark: '#3DBB92',
  ink: '#171B21', inkDark: '#F1F3F5',
  sub: '#4B525C', subDark: '#B4BAC3',
  bg: '#FFFFFF', bgDark: '#111418',
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

/** ae:p 마크 (단위 좌표, 대략 x 10~289 / y 10~142). a 의 기둥과 e 가 맞닿아 한 덩어리(æ)로 읽힌다 */
function mark(dark = false) {
  const ink = dark ? C.inkDark : C.ink;
  const dots = colon.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="8.5"/>`).join('');
  return `
<g fill="none" stroke="${dark ? C.accentDark : C.accent}" stroke-width="${W}" stroke-linecap="round" stroke-linejoin="round">
  <path d="${aPath}"/><path d="${ePath}"/>
</g>
<g fill="${ink}">${dots}</g>
<path d="${pPath}" fill="none" stroke="${ink}" stroke-width="${PW}" stroke-linecap="round"/>`;
}

const svg = (vb, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${body}</svg>\n`;

/** 꽉 찬 정사각형 앱 아이콘 (둥근 모서리는 OS 가 깎는다). scale 이 작을수록 여백이 넓다 */
function icon(dark, scale) {
  const tx = 512 - 149.5 * scale, ty = 512 - 72 * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
<rect width="1024" height="1024" fill="${dark ? C.bgDark : C.bg}"/>
<g transform="translate(${tx} ${ty}) scale(${scale})">${mark(dark)}</g></svg>\n`;
}

const files = {};
for (const dark of [false, true]) {
  const s = dark ? '-dark' : '';
  const tc = takecare(dark ? C.subDark : C.sub);
  files[`wordmark${s}.svg`] = svg('0 -6 300 210', `${mark(dark)}<g transform="translate(${149.5 - tc.width / 2} 172)">${tc.svg}</g>`);
  files[`mark${s}.svg`] = svg('0 -6 300 160', mark(dark));
  files[`icon${dark ? '-dark' : '-light'}.svg`] = icon(dark, 2.75);
}
files['icon-maskable.svg'] = icon(false, 2.2); // 안드로이드 마스크(원형 안전 영역 80%)에 들어가게
for (const [name, content] of Object.entries(files)) writeFileSync(join(brand, name), content);

// 파비콘: 작은 크기에선 ae 만 (탭 바탕이 밝든 어둡든 보이는 초록)
writeFileSync(
  join(pub, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220">
<g transform="translate(12 52)" fill="none" stroke="#0E9A70" stroke-width="${W + 4}" stroke-linecap="round" stroke-linejoin="round">
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
