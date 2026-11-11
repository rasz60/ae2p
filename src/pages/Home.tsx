import { appLogo, TONE_LABEL, visibleApps, type PortalApp } from '../../shared/apps';
import { isPlainClick, showLoader } from '../../shared/loader';
import { Brand } from '../components/Brand';
import { UserMenu } from '../components/UserMenu';
import { useAuth } from '../lib/auth';

/** 10월 25일 일요일 */
const today = () => new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' });

/** 앱 런처 */
export function Home() {
  const { user, isTester } = useAuth();
  // 에이전트는 관리자와 공유받은 멤버에게만 보인다 (P-0004)
  const apps = visibleApps(user?.app_metadata);
  return (
    <div className="page">
      <header className="topbar">
        <Brand kind="mark" height={30} />
        <UserMenu />
      </header>
      <main className="home">
        <section className="hero">
          <p className="hero-date">{today()}</p>
          {/* 괄호 속 글자(a · e)만 포인트 색. 읽는 사람에게는 'take care.' */}
          <h1 aria-label="take care.">
            t<b>[A]</b>k<b>[E]</b> c<b>[A]</b>r<b>[E]</b>.
          </h1>
          <p>일도, 운동도, 관심사도. 모두 한곳에서.</p>
          {isTester && <p className="tester-note">테스터 모드예요. 새로 만든 데이터는 로그아웃하면 지워지고, 기본 데이터는 바꿀 수 없어요.</p>}
        </section>
        <ul className="app-grid">
          {apps.map((app) => (
            <li key={app.id}>
              <AppCard app={app} />
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}

function AppCard({ app }: { app: PortalApp }) {
  const logo = appLogo(app);
  const body = (
    <>
      <span
        className={`app-icon tone-${app.tone}`}
        style={{ ['--logo' as string]: logo.size }}
        dangerouslySetInnerHTML={{ __html: logo.html }}
      />
      <span className="app-text">
        <strong>{app.name}</strong>
        <span className="app-desc">{app.desc}</span>
      </span>
      <span className={`chip ${app.ready ? `tone-${app.tone}` : ''}`}>{app.ready ? TONE_LABEL[app.tone] : '준비 중'}</span>
    </>
  );
  // 다른 앱은 다른 빌드라 라우터 링크가 아니라 페이지 이동
  return app.ready ? (
    <a className={`app-card tone-${app.tone}`} href={app.path} onClick={(e) => isPlainClick(e.nativeEvent) && showLoader(app)}>
      {body}
    </a>
  ) : (
    <div className="app-card is-soon" aria-disabled>
      {body}
    </div>
  );
}
