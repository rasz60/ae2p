# ae:p 인증 메일 템플릿

`npm run mail`로 만든 파일이다. 직접 고치지 말고 `design/gen-mail.mjs`를 고친 뒤 다시 만든다.

Supabase 대시보드 **Authentication → Emails → Templates**에서 템플릿마다 Subject와 본문(Source)을 바꿔 넣는다.

| 템플릿 | Subject | 본문 파일 |
|---|---|---|
| Invite user | `ae:p에 초대됐어요` | [invite.html](invite.html) |
| Reset password | `ae:p 비밀번호 재설정` | [recovery.html](recovery.html) |
| Confirm signup | `ae:p 이메일 확인` | [confirmation.html](confirmation.html) |
| Magic link | `ae:p 로그인 링크` | [magic_link.html](magic_link.html) |

- 로고 이미지는 `{{ .SiteURL }}/pwa-192x192.png`를 쓴다. Site URL이 `https://ae2p.duckdns.org`여야 보인다.
- 메일 클라이언트 호환 때문에 table 레이아웃과 인라인 스타일만 쓴다.
