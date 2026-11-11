// ae:p 인증 메일 템플릿 생성: supabase/email-templates/*.html
// 사용: npm run mail → 만들어진 HTML 을 Supabase 대시보드 Authentication → Emails → Templates 에 붙여 넣는다
// 레이아웃은 layout() 하나, 메일별 문구는 MAILS 에만 둔다 (4종이 늘 같은 모양이 되게)
// 메일 클라이언트용이라 table 레이아웃 + 인라인 스타일만 쓴다 (Gmail 은 <style> · SVG · 웹폰트를 대부분 무시)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'supabase', 'email-templates');
mkdirSync(out, { recursive: true });

// ── 색 (src/styles.css 의 라이트 테마와 같은 값) ──
const C = {
  bg: '#d5e0dc',
  card: '#e7efed',
  line: '#1f2d3a', // 외곽선 · 점선 (앱의 --edge 와 같은 값)
  text: '#1c2631',
  muted: '#44525f',
  link: '#1f4f8a',
  btn: '#f4e7b4', // 크림 버튼 + 잉크 글자
  btnText: '#1f2d3a',
  // 앱 축 색 (업무 · 프로젝트 · 건강 · 관심) — 한 계정으로 여러 앱을 쓴다는 표시
  axes: ['#3d63b8', '#2f6f8f', '#c2564b', '#c2762b'],
};
const FONT = "-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Pretendard', 'Noto Sans KR', 'Malgun Gothic', sans-serif";

// ── 메일별 문구 ──
// file: Supabase 템플릿 이름과 맞춘 파일명 / subject: 대시보드 Subject 칸에 넣는 값
const MAILS = [
  {
    file: 'invite',
    template: 'Invite user',
    subject: 'ae:p에 초대됐어요',
    preheader: '버튼을 눌러 비밀번호를 정하면 가입이 끝나요.',
    title: 'ae:p에 초대됐어요',
    body: [
      '업무일지, 운동기록 같은 여러 앱을 계정 하나로 쓰는 ae:p에 초대됐어요.',
      '아래 버튼을 눌러 비밀번호를 정하면 가입이 끝나요.',
    ],
    button: '비밀번호 정하고 시작하기',
    note: '가입한 뒤에는 이 이메일을 쓰는 구글 · 카카오 계정으로도 로그인할 수 있어요. 초대받은 적이 없다면 이 메일은 무시하세요.',
  },
  {
    file: 'recovery',
    template: 'Reset password',
    subject: 'ae:p 비밀번호 재설정',
    preheader: '버튼을 눌러 새 비밀번호를 정해 주세요.',
    title: '새 비밀번호를 정해 주세요',
    body: ['비밀번호 재설정을 요청하셨어요.', '아래 버튼을 눌러 새 비밀번호를 정해 주세요.'],
    button: '새 비밀번호 정하기',
    note: '요청한 적이 없다면 이 메일은 무시하세요. 버튼을 누르지 않으면 비밀번호는 바뀌지 않아요.',
  },
  {
    file: 'confirmation',
    template: 'Confirm signup',
    subject: 'ae:p 이메일 확인',
    preheader: '버튼을 누르면 이메일 확인이 끝나요.',
    title: '이메일 주소를 확인해 주세요',
    body: ['ae:p 계정에 쓸 이메일 주소가 맞는지 확인하는 메일이에요.', '아래 버튼을 누르면 확인이 끝나고 바로 로그인돼요.'],
    button: '이메일 확인하기',
    note: '요청한 적이 없다면 이 메일은 무시하세요.',
  },
  {
    file: 'magic_link',
    template: 'Magic link',
    subject: 'ae:p 로그인 링크',
    preheader: '버튼을 누르면 비밀번호 없이 로그인돼요.',
    title: '로그인 링크가 도착했어요',
    body: ['아래 버튼을 누르면 비밀번호 없이 ae:p에 로그인돼요.'],
    button: 'ae:p 로그인',
    note: '요청한 적이 없다면 이 메일은 무시하세요. 이 링크는 다른 사람에게 전달하지 마세요.',
  },
];

// ── 레이아웃 ──
// Supabase 변수: {{ .ConfirmationURL }} 링크 · {{ .Email }} 받는 주소 · {{ .SiteURL }} https://ae2p.duckdns.org
function layout(m) {
  const axisBar = C.axes
    .map((c, i) => `<td width="18" height="6" style="background:${c};border:2px solid ${C.line};font-size:0;line-height:0;">&nbsp;</td>${i < C.axes.length - 1 ? '<td width="4" style="font-size:0;line-height:0;">&nbsp;</td>' : ''}`)
    .join('');
  const body = m.body
    .map((p, i) => `<p style="margin:${i ? '6px' : '12px'} 0 0;font-size:15px;line-height:1.7;color:${C.muted};">${p}</p>`)
    .join('\n                ');

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${m.subject}</title>
</head>
<body style="margin:0;padding:0;background:${C.bg};word-break:keep-all;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${m.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};">
  <tr>
    <td align="center" style="padding:40px 16px 48px;font-family:${FONT};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:440px;">
        <tr>
          <td align="center" style="padding-bottom:20px;">
            <a href="{{ .SiteURL }}" style="text-decoration:none;"><img src="{{ .SiteURL }}/pwa-192x192.png" width="56" height="56" alt="ae:p" style="display:block;border:0;image-rendering:pixelated;"></a>
          </td>
        </tr>
        <tr>
          <td style="background:${C.card};border:3px solid ${C.line};border-bottom-width:7px;padding:36px 32px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding-bottom:18px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${axisBar}</tr></table>
                </td>
              </tr>
              <tr>
                <td>
                <h1 style="margin:0;font-size:22px;line-height:1.4;font-weight:700;color:${C.text};">${m.title}</h1>
                ${body}
                </td>
              </tr>
              <tr>
                <td style="padding-top:28px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="center" bgcolor="${C.btn}" style="background-color:${C.btn};border:3px solid ${C.line};border-bottom-width:6px;">
                        <a href="{{ .ConfirmationURL }}" target="_blank" style="display:block;padding:15px 18px;font-size:16px;line-height:18px;font-weight:700;color:${C.btnText};text-decoration:none;">${m.button}</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding-top:20px;font-size:13px;line-height:1.6;color:${C.muted};">
                  버튼이 눌리지 않으면 아래 주소를 브라우저에 붙여 넣으세요.<br>
                  <a href="{{ .ConfirmationURL }}" target="_blank" style="color:${C.link};word-break:break-all;">{{ .ConfirmationURL }}</a>
                </td>
              </tr>
              <tr>
                <td style="padding-top:24px;">
                  <div style="border-top:3px dotted ${C.line};font-size:0;line-height:0;">&nbsp;</div>
                </td>
              </tr>
              <tr>
                <td style="padding-top:8px;font-size:13px;line-height:1.6;color:${C.muted};">
                  ${m.note}<br>링크는 한 번만 쓸 수 있고, 시간이 지나면 만료돼요.
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding-top:20px;font-size:12px;line-height:1.6;color:${C.muted};">
            {{ .Email }} 주소로 보낸 메일이에요.<br>
            <a href="{{ .SiteURL }}" style="color:${C.muted};text-decoration:underline;">ae:p takecare</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>
`;
}

for (const m of MAILS) {
  writeFileSync(join(out, `${m.file}.html`), layout(m));
}

// 대시보드에 옮길 때 보는 표 (템플릿 이름 · 제목 · 파일)
const readme = `# ae:p 인증 메일 템플릿

\`npm run mail\`로 만든 파일이다. 직접 고치지 말고 \`design/gen-mail.mjs\`를 고친 뒤 다시 만든다.

Supabase 대시보드 **Authentication → Emails → Templates**에서 템플릿마다 Subject와 본문(Source)을 바꿔 넣는다.

| 템플릿 | Subject | 본문 파일 |
|---|---|---|
${MAILS.map((m) => `| ${m.template} | \`${m.subject}\` | [${m.file}.html](${m.file}.html) |`).join('\n')}

- 로고 이미지는 \`{{ .SiteURL }}/pwa-192x192.png\`를 쓴다. Site URL이 \`https://ae2p.duckdns.org\`여야 보인다.
- 메일 클라이언트 호환 때문에 table 레이아웃과 인라인 스타일만 쓴다.
`;
writeFileSync(join(out, 'README.md'), readme);

console.log(`메일 템플릿 ${MAILS.length}종 → ${out}`);
