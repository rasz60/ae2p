# ae:p 포털 기능 정의서

현재 버전: v2.0.1 (2026-11-11)

## 기능 목록
| 기능 ID | 기능 | 화면/경로 | API | 설명 | 도입 버전 |
|---|---|---|---|---|---|
| F-001 | 이메일 로그인 | /login | Supabase Auth `signInWithPassword` | 초대받은 이메일 · 비밀번호로 로그인 | v1.0.0 |
| F-002 | 비밀번호 재설정 메일 | /login (재설정 모드) | Supabase Auth `resetPasswordForEmail` | 재설정 링크를 메일로 보냄 | v1.0.0 |
| F-003 | 비밀번호 설정 · 변경 | /set-password | Supabase Auth `updateUser` | 초대 수락 · 재설정 링크 · 첫 소셜 로그인 뒤 비밀번호를 정함 | v1.0.0 |
| F-004 | Google · 카카오 로그인 | /login | Supabase Auth `signInWithOAuth` | 초대받은 이메일과 같은 계정이면 같은 계정으로 로그인 | v1.0.0 |
| F-005 | 앱 런처 (홈) | / | - | 포털에 붙은 앱 목록(`shared/apps.ts`)을 카드로 보여 주고 이동 | v1.0.0 |
| F-006 | 앱 전환 버튼 | 각 앱의 `/shell/switcher.js` | - | 모든 앱에 붙는 `<aep-switcher>` 웹 컴포넌트 (앱 이동 · 로그아웃) | v1.0.0 |
| F-007 | 계정 메뉴 | 모든 화면 오른쪽 위 | Supabase `push_subscriptions` | 푸시 알림 켜기/끄기 · 앱 설치(PWA) · 계정 설정 · 비밀번호 변경 · 로그아웃 | v1.0.0 |
| F-008 | 초대 | /admin | POST /api/portal/invite | 관리자가 이메일로 초대 메일 발송 | v1.0.0 |
| F-009 | 계정 목록 · 삭제 | /admin | GET /api/portal/users · DELETE /api/portal/users/:id | 관리자가 계정 · 로그인 방법 · 상태를 보고 삭제 | v1.0.0 |
| F-010 | Claude 작업실 | /admin/builder (테스트 서버 전용) | /api/builder/* | 관리자 채팅으로 테스트 서버의 코드를 고치고 빌드 · 재기동 | v1.0.0 |
| F-011 | iPhone 앱 ae:p | `mobile/` | - | 포털과 모든 앱을 WebView 하나로 열고 Apple 건강을 읽어 전달 | v1.0.0 |
| F-012 | 인증 메일 템플릿 | Supabase 대시보드 | - | 초대 · 비밀번호 재설정 · 이메일 확인 · 로그인 링크 메일 (`npm run mail`) | v1.0.0 |
| F-013 | 네이버 로그인 | /login | GET /api/portal/naver/start · GET /api/portal/naver/callback | 계정 설정에서 연결한 네이버 계정으로 로그인 | v1.1.0 |
| F-014 | 계정 설정 (로그인 방법 · 네이버 연결) | /account | POST · DELETE /api/portal/naver/link | 내 로그인 방법 확인, 네이버 연결 · 해제 | v1.1.0 |
| F-015 | 테스터로 입장하기 | /login | POST /api/portal/tester/login | 공용 테스터 계정으로 비밀번호 없이 들어와 둘러보기. 로그아웃하면 새로 만든 데이터가 지워진다 | v2.0.0 |
| F-016 | 테스터 계정 관리 | /admin | GET · POST /api/portal/tester/state | 테스터 지정 · 기본 데이터 편집 시작 · 잠그기, 상태 · 기준 시각 | v2.0.0 |
| F-017 | 에이전트 공유 | /admin | PUT /api/portal/users/:id/agent | 멤버별 스위치. 켜면 에이전트 메뉴가 보이고 픽셀 오피스를 같이 본다 | v2.0.0 |

## 기능 상세

### F-001 이메일 로그인
- 동작: 이메일 · 비밀번호로 Supabase 로그인. 세션은 같은 도메인의 모든 앱이 공유한다(localStorage).
- 입력: 이메일, 비밀번호 / `?next=` 로그인 뒤 돌아갈 주소(`/`로 시작하는 주소만)
- 출력: `next`로 이동. 비밀번호를 정하지 않은 계정(`user_metadata.password_set !== true`)은 `/set-password`로
- 권한: 누구나 (공개 가입은 꺼져 있어 초대받은 계정만 로그인됨)
- 예외: 이메일 · 비밀번호가 틀리면 "이메일 또는 비밀번호가 맞지 않아요." / `?logout=1`로 오면 로그아웃 후 로그인 화면

### F-002 비밀번호 재설정 메일
- 동작: 입력한 이메일로 재설정 링크를 보냄. 링크는 `/set-password`로 돌아온다.
- 입력: 이메일
- 출력: 발송 완료 안내
- 권한: 누구나
- 예외: Supabase 오류 메시지 표시

### F-003 비밀번호 설정 · 변경
- 동작: 새 비밀번호를 저장하고 `user_metadata.password_set = true`로 표시
- 입력: 새 비밀번호(8자 이상), 확인
- 출력: `next`로 이동
- 권한: 로그인한 사용자 (링크의 토큰으로 로그인된 경우 포함)
- 예외: 8자 미만 · 두 값 불일치 · 지금과 같은 비밀번호 / 세션이 없으면 "링크가 만료됐거나 이미 사용됐어요."

### F-004 Google · 카카오 로그인
- 동작: Supabase OAuth. 초대받은 이메일과 같은 계정이면 Supabase가 자동으로 같은 계정에 연결
- 입력: 각 사 로그인
- 출력: `/login?next=…`로 돌아와 `next`로 이동
- 권한: 초대받은 이메일의 계정
- 예외: 초대받지 않은 계정은 "초대받은 이메일로만 로그인할 수 있어요."
- 모바일 앱: Google이 WebView 로그인을 막아 시스템 로그인 창에서 하고 `aep://auth`로 돌아온다

### F-005 앱 런처 (홈)
- 동작: `shared/apps.ts`의 앱을 카드로 보여 줌. 준비 중인 앱은 누를 수 없음
- 권한: 로그인한 사용자

### F-006 앱 전환 버튼
- 동작: 각 앱이 `<script src="/shell/switcher.js">`를 넣으면 앱 이동 메뉴 버튼이 붙음 (떠 있는 버튼 / 툴바 안 버튼)
- 권한: 각 앱의 화면

### F-007 계정 메뉴
- 동작: 이메일 표시, 웹 푸시 구독 켜기/끄기(`push_subscriptions` 테이블), PWA 설치, 계정 설정 · 비밀번호 변경 · 계정 관리(관리자) · 로그아웃 링크
- 예외: 알림이 차단되면 안내 문구, iOS는 홈 화면에 추가한 앱에서만 푸시

### F-008 초대
- 동작: 이메일로 Supabase 초대 메일 발송. 링크는 `<PUBLIC_URL>/set-password`로 돌아온다
- 입력: 이메일
- 권한: 관리자(`app_metadata.role = 'admin'`)
- 예외: 형식 오류, 이미 가입 · 초대한 이메일

### F-009 계정 목록 · 삭제
- 동작: 계정 목록(이메일 · 역할 · 로그인 방법 · 초대됨/활성 · 가입일 · 최근 로그인), 계정 삭제
- 출력: 로그인 방법에는 Supabase 공급자(google, kakao)와 네이버(`app_metadata.naver`)가 함께 표시된다
- 권한: 관리자
- 예외: 자기 계정은 삭제할 수 없음

### F-010 Claude 작업실
- 동작: 관리자 채팅 · 첨부로 요청하면 테스트 서버의 Claude가 코드 수정 · 빌드 · 재기동. 세션 목록, 실행 스트림, 중지, 작업실 재시작
- 권한: 관리자, `BUILDER_ENABLED=true`인 서버(테스트 서버)에서만
- 자세한 내용: `deploy/TEST_SERVER.md`

### F-011 iPhone 앱 ae:p
- 동작: 포털과 모든 앱을 WebView로 열고, 다른 사이트 링크는 사파리로. `window.aepNative`로 Apple 건강 운동 기록을 운동기록 웹에 전달
- 앱 안에서 여는 주소: 포털 도메인, `*.supabase.co`, `nid.naver.com`(네이버 로그인)
- 배포: TestFlight 내부 테스트 (`mobile/README.md`)

### F-012 인증 메일 템플릿
- 동작: `design/gen-mail.mjs`가 `supabase/email-templates/*.html` 4종을 만들고, Supabase 대시보드 템플릿에 붙여 넣는다

### F-013 네이버 로그인
- 동작:
  1. `/login`의 "네이버로 계속하기" → `GET /api/portal/naver/start?next=` → state를 만들어 쿠키와 서버 메모리에 두고 네이버 로그인으로 보냄
  2. 네이버 → `GET /api/portal/naver/callback` → state 확인 → 토큰 교환 → 프로필(`/v1/nid/me`)의 고유 id 조회
  3. `app_metadata.naver.id`가 같은 계정을 찾아 Supabase 관리자 API(`generateLink` magiclink)로 1회용 로그인 토큰 발급
  4. `/login?next=…#naver_token=…`으로 보내고, 웹이 `verifyOtp`로 세션을 만든 뒤 해시를 지우고 `next`로 이동
- 입력: 네이버 로그인
- 출력: 연결된 ae:p 계정으로 로그인
- 권한: 계정 설정에서 네이버를 연결한 사용자. 네이버 이메일로는 계정을 찾지 않는다 (네이버는 이메일 인증 여부를 주지 않음)
- 예외 (`/login#naver_error=…`):
  - `not_linked`: 연결된 계정 없음
  - `cancelled`: 네이버에서 취소
  - `expired`: state가 없거나 다르거나 10분이 지남
  - `failed`: 네이버 · Supabase 오류
- 설정: `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `PUBLIC_URL`(Callback 주소의 기준), `VITE_NAVER_ENABLED=true`(버튼 표시). 셋 중 하나라도 없으면 꺼진다

### F-014 계정 설정 (로그인 방법 · 네이버 연결)
- 동작: 로그인 방법(이메일 · 비밀번호, Google, 카카오, 네이버)의 연결 상태를 보여 줌
  - Google · 카카오: Supabase `identities` 기준. 읽기만 한다
  - 네이버 연결: `POST /api/portal/naver/link`(Bearer) → 로그인 사용자를 state에 묶어 네이버 로그인 주소를 받음 → 네이버 로그인 → callback이 `app_metadata.naver = { id, email, linked_at }` 저장 → `/account#naver=linked`
  - 네이버 해제: `DELETE /api/portal/naver/link`(Bearer) → `app_metadata.naver = null`
- 입력: 연결하기 / 연결 해제 버튼
- 출력: 연결 상태, 연결된 네이버 이메일 · 연결일
- 권한: 로그인한 사용자 본인
- 예외 (`/account#naver_error=…`):
  - `taken`: 이미 다른 계정에 연결된 네이버 계정
  - `cancelled`, `expired`, `failed`: F-013과 같음

### F-015 테스터로 입장하기
- 동작: 로그인 화면 아래 '테스터로 입장하기' → 포털 API 가 `TESTER_EMAIL` 계정의 1회용 로그인 토큰(magiclink)을 만들고, 브라우저가 `verifyOtp`로 세션을 연다. 비밀번호 정하기 화면은 거치지 않는다.
- 로그아웃(계정 메뉴 · 앱 전환 메뉴의 `/login?logout=1`): 테스터면 업무일지 · 운동기록 · 커리어++의 정리 API(`shared/apps.ts`의 `testerReset`)를 동시에 부른 뒤(앱마다 5초 제한) 로그아웃한다. 실패해도 로그아웃하고, 남은 데이터는 각 앱 DB 의 매일 04:00 정리가 지운다.
- 테스터 표시: 홈에 안내 문구, 각 앱 위에 switcher.js 가 '테스터 모드' 띠를 붙인다.
- 막는 것: 비밀번호 변경 · 계정 설정(메뉴 숨김, 주소로 들어가면 안내), 네이버 연결 · 해제(API 403), 에이전트 메뉴.
- 권한: 누구나. `VITE_TESTER_ENABLED=true`로 빌드했을 때만 버튼이 보인다.
- 예외: `TESTER_EMAIL`이 없으면 503, 그 계정의 `app_metadata.role`이 `tester`가 아니면 403(다른 계정의 토큰을 만들지 않는다), IP 당 시간당 `TESTER_LOGIN_PER_HOUR`(기본 20)회를 넘으면 429.
- 같은 계정을 여러 명이 동시에 쓰면 한 사람의 로그아웃이 다른 사람이 만든 데이터도 지운다. 테스터 로그아웃은 그 기기 세션만 끝낸다(`scope: 'local'`, 다른 사람의 세션은 유지).

### F-016 테스터 계정 관리
- 동작: 계정 관리 아래 '테스터 계정' 카드. 상태(테스터 아님 · 편집 중 · 잠김)와 기본 데이터 기준 시각을 보여 준다.
  - 테스터로 지정: `app_metadata.role = 'tester'`, `tester_editing = true`
  - 기본 데이터 편집 시작: `tester_editing = true`, `tester_edit_started_at = 지금` (각 앱의 잠금 · 막은 쓰기가 꺼지고, 정리는 편집 시작 전에 남은 방문자 데이터만 지운다)
  - 잠그기: `tester_editing` · `tester_edit_started_at` 제거, `tester_baseline_at = 지금`. 이 시각까지 만든 행이 기본 데이터가 된다
  - 순서: 편집 시작 → 테스터로 입장해 기본 데이터 입력 → 테스터 로그아웃(남은 방문자 데이터 정리) → 관리자로 '잠그기'
- 권한: 관리자. 관리자 계정은 테스터로 지정할 수 없다.
- 예외: `TESTER_EMAIL` 계정이 없으면 404 "먼저 초대해 주세요".

### F-017 에이전트 공유
- 동작: 계정 목록의 줄마다 '에이전트 공유' 스위치 → `app_metadata.agent_share`. 관리자 줄은 '에이전트 항상', 테스터 줄은 꺼진 채 비활성.
- 에이전트 메뉴(홈 · 앱 전환 메뉴)는 관리자 · 공유받은 멤버에게만 보인다. 실제 막기는 업무일지 모니터 API 가 한다(403).
- 공유 범위는 픽셀 오피스뿐이다. 로그 · 알림은 각자 자기 잡 것만 본다.
- 메뉴는 세션의 app_metadata 로 판단하므로 공유를 바꾸면 다음 토큰 갱신(최대 1시간) 뒤 메뉴에 반영된다. 모니터 화면은 15분 안에 막힌다.
- 권한: 관리자. 예외: 관리자 · 테스터 계정에는 400.

## 변경 이력

### v2.0.1 — 2026-11-11 — 계획 없음(직접 요청)
- 수정: F-005 · F-006 · F-007 화면 디자인 — 보라/파랑 그라데이션 · 블러 배경 · 파스텔 원형 장식 제거. 잉크 + 종이 바탕에 포인트 색 초록 하나로 통일하고 라이트 · 다크 대비를 맞춤
- 수정: F-006 앱 전환 버튼 — 새 팔레트 적용, 패널이 버튼 모서리에서 펼쳐지는 반응, 키보드 포커스 표시 보강
- 수정: F-011 · F-012 로고 · PWA 아이콘 · 모바일 앱 아이콘 · 스플래시 · 인증 메일 4종 — 그라데이션 · 입체 효과를 없애고 단색 로고로 교체
- 기타: 앱 전환 때 보이는 로딩 화면을 같은 디자인으로 바꾸고 각 앱 index.html 에도 반영

### v2.0.0 — 2026-11-06 — 계획 P-0004
- 추가: F-015 테스터로 입장하기 — 공용 테스터 계정 1회용 로그인, 로그아웃 때 세 앱의 테스터 데이터 정리, 테스터 띠
- 추가: F-016 테스터 계정 관리 — 테스터 지정 · 기본 데이터 편집 시작 · 잠그기
- 추가: F-017 에이전트 공유 — 멤버별 공유 스위치
- 수정: F-005 앱 런처 · F-006 앱 전환 버튼 — 에이전트 항목은 관리자 · 공유받은 멤버에게만 (기존 멤버는 공유를 켜야 보이므로 MAJOR)
- 수정: F-007 계정 메뉴 — 테스터에게 계정 설정 · 비밀번호 변경 숨김, 로그아웃 전 테스터 정리
- 수정: F-009 계정 목록 — 역할에 테스터, 에이전트 공유 상태
- 수정: F-003 비밀번호 변경 · F-014 계정 설정 — 테스터는 막음 (F-001 로그인: 테스터는 비밀번호 정하기를 건너뜀)

### v1.1.0 — 2026-11-06 — 계획 P-0001
- 추가: F-013 네이버 로그인 — 계정 설정에서 연결한 네이버 고유 id로 로그인 (포털 API가 OAuth 처리, Supabase 관리자 API로 세션 발급)
- 추가: F-014 계정 설정 — `/account`에서 로그인 방법 확인, 네이버 연결 · 해제
- 수정: F-007 계정 메뉴 — "계정 설정" 항목 추가
- 수정: F-009 계정 목록 — 로그인 방법에 `naver` 표시
- 수정: F-011 iPhone 앱 — 네이버 로그인 화면(`nid.naver.com`)을 앱 안에서 연다 (앱 재빌드 필요)

### v1.0.0 — 2026-11-06
- 기준선: 기능 정의서를 처음 작성. F-001 ~ F-012는 이 시점 코드에 이미 있던 기능이다.
