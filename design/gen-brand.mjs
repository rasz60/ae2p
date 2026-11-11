// ae:p 브랜드 자산 생성: 로고 SVG(public/brand) + 파비콘 + PWA 아이콘 PNG(public) + 모바일 앱 아이콘(mobile/assets)
// 사용: npm run brand   — 색을 바꾸려면 아래 상수만 고치고 다시 실행
// 로고는 5×5 도트 글자(a · e · : · p)를 칸 하나씩 사각형으로 그린다. 확대해도 칸 경계가 또렷하다 (shape-rendering: crispEdges)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');
const brand = join(pub, 'brand');
const mobileAssets = join(root, 'mobile', 'assets');
mkdirSync(brand, { recursive: true });

// ── 색 (src/styles.css 의 토큰과 같은 값) ──
const C = {
  ink: '#1F2D3A', inkDark: '#F1F5F8', // 글자
  led: '#E0533D',                      // 콜론
  steel: '#587A9A', steelDark: '#34495E', // 앱 아이콘 바탕 (자판기 몸체)
  cream: '#F4E7B4',                    // 아이콘 글자
  edge: '#1F2D3A', edgeDark: '#05090D',
};

// ── 도트 글자 (x-height 5줄, p 의 꼬리 2줄 아래로). [위에서 몇 줄 내려 시작, 칸 모양] ──
const G = {
  a: [2, ['.###.', '....#', '.####', '#...#', '.####']],
  e: [2, ['.###.', '#...#', '#####', '#....', '.###.']],
  ':': [2, ['.', '.', '#', '.', '.', '#', '.']], // 3·5번째 줄에 점
  p: [2, ['####.', '#...#', '#...#', '#...#', '####.', '#....', '#....']],
};
/** 글자 → 칸 목록 {x, y, ch} 과 전체 크기 */
function layout(text) {
  const cells = [];
  let x = 0;
  for (const [i, ch] of [...text].entries()) {
    const [top, rows] = G[ch];
    rows.forEach((row, ry) => [...row].forEach((c, rx) => c === '#' && cells.push({ x: x + rx, y: top + ry, ch })));
    x += rows[0].length + (i < text.length - 1 ? 1 : 0);
  }
  return { cells, w: x, h: 9 };
}
const L = layout('ae:p');

/** 칸들을 줄마다 이어서 rect 로. 같은 줄에서 이어진 칸은 하나로 합친다 */
function rects(cells, fill) {
  const rows = new Map();
  for (const { x, y } of cells) rows.set(y, [...(rows.get(y) ?? []), x].sort((a, b) => a - b));
  let out = '';
  for (const [y, xs] of rows) {
    let s = xs[0], p = xs[0];
    for (const x of [...xs.slice(1), Infinity]) {
      if (x !== p + 1) { out += `<rect x="${s}" y="${y}" width="${p - s + 1}" height="1" fill="${fill}"/>`; s = x; }
      p = x;
    }
  }
  return out;
}
const word = (cells, ink, dot) => rects(cells.filter((c) => c.ch !== ':'), ink) + rects(cells.filter((c) => c.ch === ':'), dot);
const svg = (vb, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" shape-rendering="crispEdges">${body}</svg>\n`;

const files = {};
for (const dark of [false, true]) {
  const s = dark ? '-dark' : '';
  const body = word(L.cells, dark ? C.inkDark : C.ink, C.led);
  files[`mark${s}.svg`] = svg(`0 0 ${L.w} ${L.h}`, body);
  files[`wordmark${s}.svg`] = svg(`0 0 ${L.w} ${L.h}`, body); // 로고는 하나다 (예전 wordmark 이름을 쓰는 곳 호환)
}

/** 꽉 찬 정사각형 앱 아이콘 (둥근 모서리는 OS 가 깎는다) */
function icon(dark, scale) {
  const tx = (1024 - L.w * scale) / 2, ty = (1024 - L.h * scale) / 2;
  const drop = L.cells.map((c) => ({ ...c, x: c.x + 0.45, y: c.y + 0.6 }));
  const edge = dark ? C.edgeDark : C.edge;
  return svg(
    '0 0 1024 1024',
    `<rect width="1024" height="1024" fill="${dark ? C.steelDark : C.steel}"/>
<rect x="40" y="40" width="944" height="944" fill="none" stroke="${edge}" stroke-width="40"/>
<g transform="translate(${tx} ${ty}) scale(${scale})">${rects(drop, edge)}${word(L.cells, C.cream, C.led)}</g>`,
  );
}
files['icon-light.svg'] = icon(false, 38);
files['icon-dark.svg'] = icon(true, 38);
files['icon-maskable.svg'] = icon(false, 30); // 안드로이드 마스크(원형 안전 영역 80%)에 들어가게
for (const [name, content] of Object.entries(files)) writeFileSync(join(brand, name), content);

// 파비콘: 작은 크기에선 ae 만, 잉크 테두리를 둘러 탭이 밝든 어둡든 보이게
const ae = layout('ae').cells.map((c) => ({ ...c, x: c.x + 1, y: c.y - 1 }));
const ring = [];
for (const c of ae) for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) ring.push({ ...c, x: c.x + dx, y: c.y + dy });
writeFileSync(join(pub, 'favicon.svg'), svg('0 0 13 7', rects(ring, C.edge) + rects(ae, C.cream)));

// ── PNG ──
const png = (src, size, out) => sharp(join(brand, src), { density: 300 }).resize(size, size).png().toFile(out);
await Promise.all([
  png('icon-light.svg', 64, join(pub, 'pwa-64x64.png')),
  png('icon-light.svg', 192, join(pub, 'pwa-192x192.png')),
  png('icon-light.svg', 512, join(pub, 'pwa-512x512.png')),
  png('icon-maskable.svg', 512, join(pub, 'maskable-icon-512x512.png')),
  png('icon-light.svg', 180, join(pub, 'apple-touch-icon-180x180.png')),
  png('icon-light.svg', 1024, join(mobileAssets, 'icon.png')),
  // 모바일 스플래시: 로고만 투명 배경에 (배경색은 app.json 에서 정한다)
  sharp(join(brand, 'mark.svg'), { density: 1200 })
    .resize(600, 320, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(join(mobileAssets, 'splash.png')),
]);
console.log('brand:', [...Object.keys(files), 'favicon.svg', 'PWA png 5개', 'mobile icon · splash'].join(', '));
