# ae:p takecare — 포털

> All your life, in one log. — 일도, 운동도, 프로젝트도, 관심사도. 모두 한곳에서.

개인 앱들을 한 도메인(`https://ae2p.duckdns.org`)에 모으는 **포털(wrapper)** 저장소입니다.
여기서 한 번 로그인하면 각 앱으로 이동할 때 다시 로그인하지 않습니다. 각 앱은 **자기 저장소에서 따로 개발·배포**합니다.

| 경로 | 앱 | 저장소 |
|---|---|---|
| `/` | 포털: 로그인 · 초대 · 앱 런처 · 앱 전환 버튼 · PWA | `rasz60/ae2p` (여기) |
| `/diary/` | 업무일지++ | `kingtepad` |
| `/agent/` | 에이전트 (잡 모니터 · 잡 요청) | 분리 예정 |
| `/workout/` | 운동기록 | `rasz60/work-doubt` (Go API :8091) |
| `/career/` | 커리어++ (공개 이력서 · 프로젝트 · 채용공고 · 연락) | `careerpad` (Go API :8092) |
| iPhone 앱 | **ae:p** — 위 전부를 앱 하나로 (TestFlight). 설치 · 빌드는 [mobile/README.md](mobile/README.md) | 여기 `mobile/` |

## 구조

```
ae2p/
├─ src/              포털 웹 (React + Vite): 로그인 · 비밀번호 설정 · 홈 · 계정 설정 · 계정 관리
├─ switcher/         <aep-switcher> 웹 컴포넌트 → dist/shell/switcher.js (각 앱이 불러간다)
├─ shared/apps.ts    앱 목록 (홈과 switcher 가 같이 씀) ← 앱을 추가하면 여기만 고친다
├─ server/           포털 API (Fastify): 초대 · 계정 목록 · 삭제 · 네이버 로그인 — service_role 키는 여기서만
│  └─ builder.ts     Claude 작업실 (테스트 서버 전용): 관리자 채팅 → Claude 가 코드 수정 · 빌드 · 재기동
├─ design/           로고 생성 스크립트 (npm run brand → public/brand/*.svg, PWA 아이콘)
├─ deploy/Caddyfile  도메인 전체 라우팅 (포털 + 모든 앱)
├─ deploy/TEST_SERVER.md  테스트 서버 구축 · Claude 작업실 안내 (A1 재시도 스크립트, Caddyfile.test)
├─ mobile/           iPhone 앱 ae:p (Expo): 포털을 WebView 로 + Apple 건강 읽기. 웹 빌드 · 배포와는 따로 (npm 패키지도 따로)
└─ supabase/setup.sql 관리자 지정 등 1회 설정
```

### 왜 이렇게 나눴나

- **같은 도메인 + 경로 분리**: 같은 출처라 Supabase 세션(localStorage)이 공유되어 한 번 로그인으로 모든 앱이 열린다.
  iframe 은 모바일 스크롤·뒤로가기·푸시 문제로 쓰지 않는다.
- **Supabase 프로젝트 1개 + 앱별 스키마**: 무료 프로젝트 2개 한도, 7일 비활성 일시정지, 로그인 분리 문제를 피한다.
- **PWA · 푸시는 포털만**: 서비스워커는 도메인에 하나(`scope: /`)여야 앱 전체가 한 앱으로 설치된다.
  포털 서비스워커는 다른 앱 경로를 가로채지 않는다 (`vite.config.ts` 의 `navigateFallbackDenylist`).
- **앱 전환 버튼은 런타임 스크립트**: 각 앱은 `/shell/switcher.js` 한 줄만 넣는다. 앱 목록이 바뀌어도 앱을 다시 배포할 필요가 없다.

## 로그인 · 가입 (초대제)

- 공개 가입은 끈다. **관리자가 계정 관리 화면에서 이메일로 초대** → 메일 링크 → 비밀번호 설정 → 가입 완료.
- 받는 정보는 이메일과 비밀번호뿐.
- 구글·카카오 로그인: 초대받은 이메일과 같은 계정이면 같은 계정으로 연결된다 (가입은 안 됨).
  비밀번호를 아직 안 정한 계정은 처음에 비밀번호 설정 화면을 거친다 (`user_metadata.password_set`).
- 네이버 로그인: 로그인한 뒤 **계정 설정(`/account`)에서 "네이버 연결"** 을 한 번 하면, 다음부터 네이버로 로그인할 수 있다.
  네이버는 이메일 인증 여부를 주지 않아 이메일로 자동 연결하지 않는다. 연결 정보는 네이버 고유 id 로 `app_metadata.naver` 에 저장된다.
  Supabase 가 네이버를 지원하지 않아 포털 API([server/naver.ts](server/naver.ts))가 직접 처리한다.
- 계정 설정(`/account`): 내 로그인 방법(이메일 · Google · 카카오 · 네이버) 확인, 네이버 연결 · 해제.
- 관리자 = `app_metadata.role = 'admin'` (사용자가 스스로 못 바꾸는 값). [supabase/setup.sql](supabase/setup.sql) 로 지정.
- **테스터로 입장하기**: 로그인 화면 아래 버튼으로 공용 테스터 계정(`TESTER_EMAIL`)에 비밀번호 없이 들어와 둘러본다.
  관리자가 잠가 둔 기본 데이터는 바꿀 수 없고, 새로 만든 데이터는 로그아웃할 때와 매일 새벽 4시에 지워진다.
  비밀번호 변경 · 계정 설정 · 에이전트 · 운동기록 AI 코치 · 커리어++ 채용공고 · 메시지는 쓸 수 없다.
  준비: 계정 관리에서 테스터 계정을 초대 → '테스터로 지정' → 테스터로 입장해 기본 데이터 입력 → '잠그기' → `VITE_TESTER_ENABLED=true`로 빌드.
  각 앱의 테스터 마이그레이션(업무일지 `20261107000000_tester.sql`, 운동기록 `0005_tester.sql`, 커리어++ `0003_tester.sql`)과 Supabase `pg_cron` 확장이 필요하다.
  누구나 들어오는 계정이므로 기본 데이터에 실제 개인정보를 넣지 않는다. Supabase Auth 의 'Secure email change'를 켜 둔다.
- **에이전트 공유**: 에이전트 메뉴는 관리자와, 계정 관리에서 '에이전트 공유'를 켠 멤버에게만 보인다. 픽셀 오피스만 같이 보고, 로그 · 알림은 각자 자기 잡 것만 본다.

## 개발

```bash
cp .env.example .env     # Supabase URL·키 (업무일지와 같은 프로젝트)
npm install
npm run dev              # 포털 웹 http://localhost:5173
npm run dev:server       # 포털 API http://127.0.0.1:8090 (vite 가 /api/portal 을 넘겨줌)
npm run brand            # 로고·아이콘 다시 생성 (design/gen-brand.mjs 의 색·두께 수정 후)
```

## Supabase 설정 (대시보드, 1회)

1. **Authentication → Sign In / Providers**
   - *Allow new users to sign up* **끄기** (초대제)
   - Google, Kakao 켜기 (각 개발자 콘솔에서 만든 Client ID/Secret). 콘솔의 리디렉트 URI 에는 Supabase 가 보여 주는 Callback URL 을 넣는다
   - 카카오는 동의 항목에서 이메일(`account_email`)을 받을 수 있어야 한다 (비즈 앱 전환이 필요할 수 있음)
2. **Authentication → URL Configuration**
   - Site URL: `https://ae2p.duckdns.org`
   - Redirect URLs: `https://ae2p.duckdns.org/**`, 개발용 `http://localhost:5173/**`
3. **Authentication → Emails → SMTP Settings**: 외부 SMTP 연결 (Gmail 앱 비밀번호, Resend 등).
   기본 메일 서버는 발송 한도가 매우 작고 팀원 주소로만 보낼 수 있어 초대 메일이 안 갈 수 있다
4. **Emails → Templates**: 초대 · 비밀번호 재설정 · 이메일 확인 · 로그인 링크 메일을 ae:p 템플릿으로 바꾼다.
   제목과 본문은 [supabase/email-templates](supabase/email-templates/README.md)에 있다 (`npm run mail`로 생성, 원본은 `design/gen-mail.mjs`)
5. **SQL Editor**: [supabase/setup.sql](supabase/setup.sql) 실행 (관리자 이메일 바꿔서)

## 네이버 로그인 설정 (1회)

1. **네이버 개발자센터** (https://developers.naver.com) → Application → 애플리케이션 등록
   - 사용 API: 네이버 로그인 / 제공 정보: 이메일 주소(선택 — 계정 설정에 연결된 계정을 보여 주는 용도)
   - 환경: PC 웹, 서비스 URL `https://ae2p.duckdns.org`
   - Callback URL: `https://ae2p.duckdns.org/api/portal/naver/callback` (개발용 `http://localhost:5173/api/portal/naver/callback`)
   - '개발 중' 상태에서는 **멤버관리**에 등록한 네이버 아이디만 로그인할 수 있다. 모두에게 열려면 검수를 신청한다
2. **서버 `.env`**: `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `VITE_NAVER_ENABLED=true`.
   `VITE_NAVER_ENABLED` 는 빌드 때 읽으므로 넣은 뒤 다시 빌드 · 배포해야 버튼이 보인다
3. 다른 환경(테스트 서버, Codespaces 등)은 그 환경의 `PUBLIC_URL` 기준 Callback URL 을 네이버에 추가한다

## 배포 (Oracle 서버)

kingtepad 와 같은 서버·같은 방식(Caddy + pm2 + GitHub Actions)입니다.

1. **DuckDNS**: `ae2p` 서브도메인을 만들고 kingtepad 와 같은 서버 IP 를 넣는다
2. **서버에 받기**: `git clone git@github-ae2p:rasz60/ae2p.git ~/ae2p` (읽기 전용 Deploy key, ssh 별칭은 kingtepad 와 같은 방식)
3. **`.env`**: `.env.example` 참고. `SUPABASE_SERVICE_ROLE_KEY` 는 서버 `.env` 에만
4. **빌드 · 실행**: `npm ci && npm run build && pm2 start ecosystem.config.cjs && pm2 save`
5. **Caddy**: [deploy/Caddyfile](deploy/Caddyfile) 의 `ae2p.duckdns.org` 블록을 `/etc/caddy/Caddyfile` 에 추가 → `sudo systemctl reload caddy`
6. **자동 배포 (GitHub Actions)**: `main` 에 push → 타입체크 → 서버에 SSH 로 접속해 [scripts/deploy.sh](scripts/deploy.sh) 실행.
   kingtepad 와 같은 방식이고, 키는 kingtepad 것과 따로 만든다. 최초 1회:
   ```bash
   # (서버) Actions 전용 키를 만들고, 이 키로는 ae2p 의 deploy.sh 만 실행되게 묶는다
   ssh-keygen -t ed25519 -C "github-actions-ae2p" -f ~/.ssh/gha_ae2p -N ""
   echo "command=\"bash $HOME/ae2p/scripts/deploy.sh\",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty $(cat ~/.ssh/gha_ae2p.pub)" >> ~/.ssh/authorized_keys
   cat ~/.ssh/gha_ae2p              # → Secret DEPLOY_SSH_KEY 에 붙여 넣고, 서버의 이 파일은 지운다
   ssh-keyscan -t ed25519 localhost | sed 's/^localhost/ae2p.duckdns.org/'   # → Secret DEPLOY_KNOWN_HOSTS
   ```
   GitHub 저장소 → Settings → Secrets and variables → Actions 에 `DEPLOY_HOST`(ae2p.duckdns.org), `DEPLOY_USER`(ubuntu),
   `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS` 를 넣는다. 진행 상황은 저장소 **Actions** 탭, 수동 실행은 Actions → deploy → Run workflow

## 앱을 포털에 붙이는 법

각 앱 저장소에서 할 일입니다.

1. **경로**: 빌드 base 를 `/<앱>/` 로 (Vite `base: '/diary/'`, React Router `basename="/diary"`, Expo `experiments.baseUrl`)
2. **같은 Supabase 프로젝트**: 포털과 같은 `SUPABASE_URL`·`ANON_KEY` 로 클라이언트를 만들면 세션이 자동 공유된다.
   데이터는 앱 스키마에 (`createClient(url, key, { db: { schema: 'workout' } })`, Supabase API 설정의 Exposed schemas 에 추가)
3. **로그인 화면 없애기**: 세션이 없으면 포털로 보낸다
   ```ts
   const { data } = await supabase.auth.getSession();
   if (!data.session) location.replace(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
   ```
4. **앱 전환 버튼**: `index.html` 에 한 줄
   ```html
   <script type="module" src="/shell/switcher.js"></script>
   ```
   기본은 오른쪽 아래 떠 있는 버튼. 하단 탭이 있는 앱은 `<aep-switcher position="top-left">` 처럼 위치를 정하거나,
   툴바 안에 `<aep-switcher mode="inline">` 로 넣는다 (React 로 그릴 땐 `<meta name="aep-switcher" content="manual">` 로 자동 삽입을 끈다).
   inline 버튼 크기는 CSS 변수로: `aep-switcher { --aep-switcher-size: 28px; }`
5. **PWA · 푸시 끄기**: 서비스워커는 포털 것 하나만. 앱의 manifest·서비스워커·푸시 구독은 지운다
6. **포털 목록 갱신**: 이 저장소 `shared/apps.ts` 에서 그 앱을 `ready: true` 로 → 배포

## 진행 순서

1. ~~포털 뼈대~~ (이 저장소)
2. ~~도메인 이전: DuckDNS `ae2p` + Caddy + Supabase URL 설정~~ (구글·카카오 OAuth 는 ID 발급 후)
3. ~~kingtepad → `/diary/`~~ (자체 로그인·PWA·푸시를 포털로). 에이전트 모니터는 분리 전까지 `/diary/monitor`
4. 에이전트 저장소 분리 + 잡 요청 게시판
5. ~~work-doubt → Supabase Auth 검증 + `workout` 스키마 + `/workout/`~~
6. ~~careerpad → `/career/`~~ (공개 페이지는 로그인 없이 `/career/<slug>`)
