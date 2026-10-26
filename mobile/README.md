# ae:p iPhone 앱

포털(`https://ae2p.duckdns.org`)과 그 아래 모든 앱(업무일지++ · 에이전트 · 운동기록 · 커리어++)을 **앱 하나**로 연다.
나 혼자 쓰는 앱이라 **TestFlight 내부 테스트**로 설치한다 (내부 테스터는 심사 없이 바로 설치된다).

```
ae:p 앱 (Expo · React Native)
├─ WebView ── https://ae2p.duckdns.org/*   포털 로그인 · 앱 런처 · 각 앱 (웹 그대로, 세션은 앱 안에 남는다)
├─ Google · 카카오 로그인 → 시스템 로그인 창(ASWebAuthenticationSession) → aep://auth 로 돌아와 WebView 에 세션
├─ 다른 사이트 링크 → 사파리
└─ window.aepNative ── Apple 건강(HealthKit) 읽기 → 운동기록 웹이 자기 로그인으로 서버에 보낸다
```

- **웹을 고치면 앱은 다시 만들 필요가 없다.** 앱은 웹을 여는 틀이라 각 저장소에서 배포하면 다음에 앱을 열 때 바로 바뀐다.
  앱을 다시 빌드하는 건 이 폴더(`mobile/`)를 고쳤을 때 · TestFlight 빌드가 90일이 지나 만료될 때뿐이다.
- **Apple 건강**: 운동기록 › 내 정보 › 연결된 기기 › Apple 건강 연결. 그 뒤로는 운동기록 홈을 열 때 10분에 한 번 새 운동을 보낸다.
  운동기록 웹([work-doubt app/src/features/health/appleHealth.ts](https://github.com/rasz60/work-doubt))이 `window.aepNative` 를 보고 켠다.

## 파일

| 파일 | 내용 |
|---|---|
| [src/App.tsx](src/App.tsx) | WebView 화면 · 오프라인 화면 · 뒤로 가기 |
| [src/navigation.ts](src/navigation.ts) | 앱 안에서 열 주소 / 사파리로 보낼 주소, Google · 카카오 로그인 |
| [src/bridge.ts](src/bridge.ts) | 웹 ↔ 앱 다리 (`window.aepNative.call('health.workouts', { since })` 등) |
| [src/health.ts](src/health.ts) | HealthKit 운동 읽기 (운동기록 ingest 형식) |
| [app.json](app.json) · [eas.json](eas.json) | 앱 이름 · 번들 ID(`com.devsixt.aep`) · 권한 문구 · 빌드 설정 |
| `assets/` | 아이콘 · 스플래시 (포털 `public/brand` 로 만든 것) |

## 처음 한 번: 해야 할 일 (순서대로)

**1. Supabase — 앱 로그인 주소 허용** (Google · 카카오 로그인에 필요. 이메일 로그인만 쓰면 건너뛰어도 된다)
Authentication → URL Configuration → Redirect URLs 에 **`aep://**`** 추가

**2. 운동기록 마이그레이션** (아직 안 했다면) — Supabase SQL Editor 에서
[work-doubt `backend/migrations/0003_apple_health.sql`](https://github.com/rasz60/work-doubt/blob/main/backend/migrations/0003_apple_health.sql) 실행.
안 하면 Apple 건강 연결이 DB 제약 오류를 낸다

**3. Expo 계정 · 프로젝트** (무료 플랜으로 충분 — iOS 빌드 한 달 15회)

```powershell
cd mobile
npm install
npm i -g eas-cli
eas login                  # https://expo.dev 계정
eas init                   # Expo 프로젝트를 만들고 app.json 에 extra.eas.projectId 를 넣는다 → 커밋한다
```

**4. 빌드 + TestFlight 올리기** (Mac 없이 Expo 클라우드가 빌드한다, 20분쯤)

```powershell
npm run build:testflight   # = eas build -p ios --profile production --auto-submit
```

- 처음에 **Apple 개발자 계정으로 로그인**하라고 묻는다 → 로그인하면 EAS 가 번들 ID 등록 · 인증서 · 프로비저닝 프로필 ·
  **HealthKit capability** · App Store Connect 의 앱을 알아서 만든다 (질문은 모두 기본값 Yes)
- 앱 이름 **"ae:p" 가 App Store 에 이미 있으면** 앱 만들기가 실패한다. 그때는 `app.json` 의 `name` 을 `ae:p takecare` 처럼 바꾸고 다시 실행
- 수출 규정(암호화) 질문은 `ITSAppUsesNonExemptEncryption: false` 로 이미 답해 두었다

**5. 내 아이폰에 설치**

1. App Store Connect → 앱 → **TestFlight** → 빌드 처리가 끝나면(10~30분) **내부 테스팅** 그룹을 만들고 내 Apple ID 를 넣는다
2. 아이폰에 **TestFlight** 앱 설치 → 초대 메일/앱에서 ae:p **설치**
3. ae:p 열기 → 포털 로그인 → 운동기록 › 내 정보 › 연결된 기기 › **Apple 건강 연결** → 권한 허용

## 그 다음

| 언제 | 할 일 |
|---|---|
| 웹(포털 · 각 앱)을 고쳤을 때 | 각 저장소에 push 만. 앱은 그대로 |
| `mobile/` 을 고쳤을 때 · 빌드가 90일 지나 만료되기 전 | `npm run build:testflight` → TestFlight 에서 업데이트 |
| 버전 표시를 올리고 싶을 때 | `app.json` 의 `version` (빌드 번호는 EAS 가 알아서 올린다) |
| 개발 중 폰에서 바로 고쳐 보기 | `npm run build:dev` 로 개발용 앱을 한 번 설치(`eas device:create` 로 폰 등록) → `npm start` |

## 알아 둘 것 (한계)

- **커리어++ 의 'PDF로 저장'** (`window.print()`)은 앱 안 WebView 에서 동작하지 않는다. PDF 가 필요하면 사파리에서 연다
- **푸시 알림**은 아직 없다. 포털의 웹 푸시는 앱 안 WebView 에서 오지 않는다 (iOS 제약).
  앱 푸시를 하려면 앱에서 Expo 푸시 토큰을 받아 포털 서버가 APNs 로 보내도록 바꿔야 한다
- **초대 · 비밀번호 재설정 메일 링크**는 사파리로 열린다. 거기서 비밀번호를 정한 뒤 앱에서 로그인한다
- 운동기록 저장소의 **운동기록 단독 iPhone 앱**(`com.devsixt.workout`, work-doubt `docs/APP.md`)은 이제 필요 없다.
  ae:p 앱 안의 운동기록이 같은 Apple 건강 연동을 한다. 둘 다 설치해도 같은 운동은 서버가 한 번만 저장한다
- 공개 App Store 심사로 가려면: 개인정보 처리방침 URL, 심사용 계정, 스크린샷이 필요하고, 웹을 감싼 앱은 가이드라인 4.2(최소 기능)로
  거절될 수 있다. 지금 구성(TestFlight 내부 테스트)은 심사가 없다

## 검사

```powershell
npm run typecheck
npm run doctor             # expo-doctor: 패키지 버전 · 설정 점검
npx expo export -p ios     # 앱 코드가 묶이는지 (빌드 전에 빠르게)
```
