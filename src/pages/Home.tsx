import { APPS, iconSvg, TONE_LABEL, type PortalApp } from '../../shared/apps';
import { Backdrop, Brand } from '../components/Brand';
import { UserMenu } from '../components/UserMenu';

/** 앱 런처 */
export function Home() {
  return (
    <div className="page">
      <Backdrop />
      <header className="topbar">
        <Brand kind="mark" height={30} />
        <UserMenu />
      </header>
      <main className="home">
        <section className="hero">
          <h1>
            All your life,
            <br />
            in one log.
          </h1>
          <p>일도, 운동도, 프로젝트도, 관심사도. 모두 한곳에서.</p>
        </section>
        <ul className="app-grid">
          {APPS.map((app) => (
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
  const body = (
    <>
      <span className={`app-icon tone-${app.tone}`} dangerouslySetInnerHTML={{ __html: iconSvg(app.tone) }} />
      <span className="app-text">
        <strong>{app.name}</strong>
        <span className="app-desc">{app.desc}</span>
      </span>
      <span className={`chip ${app.ready ? `tone-${app.tone}` : ''}`}>{app.ready ? TONE_LABEL[app.tone] : '준비 중'}</span>
    </>
  );
  // 다른 앱은 다른 빌드라 라우터 링크가 아니라 페이지 이동
  return app.ready ? (
    <a className="app-card" href={app.path}>
      {body}
    </a>
  ) : (
    <div className="app-card is-soon" aria-disabled>
      {body}
    </div>
  );
}
