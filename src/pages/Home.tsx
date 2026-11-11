import { useEffect, useState } from 'react';
import { appLogo, visibleApps, type PortalApp } from '../../shared/apps';
import { isPlainClick, showLoader } from '../../shared/loader';
import { Brand } from '../components/Brand';
import { UserMenu } from '../components/UserMenu';
import { useAuth } from '../lib/auth';

/** 11/11 수 */
const today = () => new Date().toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short' });

const TAG: Record<PortalApp['tone'], string> = { work: 'WORK', project: 'PROJ', health: 'HEALTH', interest: 'CAREER' };

/** 앱 런처: 자판기. 칸을 누르면 그 앱이 나오고, 아래 번호 버튼은 1~4 키로도 눌린다 */
export function Home() {
  const { user, isTester } = useAuth();
  // 에이전트는 관리자와 공유받은 멤버에게만 보인다 (P-0004)
  const apps = visibleApps(user?.app_metadata);
  // 마우스를 올리거나 포커스한 칸. 번호 버튼의 불이 켜지고 꺼내는 곳에 설명이 뜬다
  const [lit, setLit] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      const app = apps[Number(e.key) - 1];
      if (!app?.ready) return;
      showLoader(app);
      window.location.assign(app.path);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [apps]);

  const cur = apps[lit] ?? apps[0];
  return (
    <div className="page">
      <header className="topbar">
        <Brand kind="mark" height={26} />
        <UserMenu />
      </header>
      <main className="shop">
        <div className="vend">
          <div className="sign">
            <strong aria-label="ae:p 자판기">
              AE<i>:</i>P
            </strong>
            <small>{today()}</small>
          </div>
          <h1 className="sr-only">앱 고르기</h1>
          <div className="glass">
            <ul className="slots">
              {apps.map((app, i) => (
                <li key={app.id} onMouseEnter={() => setLit(i)} onFocus={() => setLit(i)}>
                  <AppSlot app={app} no={i + 1} on={i === lit} />
                </li>
              ))}
            </ul>
          </div>
          <ol className="btns" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <li key={i}>
                <span className={i === lit && apps[i] ? 'lit' : ''}>{i + 1}</span>
              </li>
            ))}
          </ol>
          <div className="out">
            <div className="coin" aria-hidden="true">
              <i />
            </div>
            <div className="tray" role="status">
              <span>
                {cur ? (
                  <>
                    <b>{cur.name}</b> · {cur.desc}
                  </>
                ) : (
                  '오늘은 어떤 걸 뽑을까요?'
                )}
                {isTester && <span className="tester-note">테스터 모드예요. 새로 만든 데이터는 로그아웃하면 지워지고, 기본 데이터는 바꿀 수 없어요.</span>}
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function AppSlot({ app, no, on }: { app: PortalApp; no: number; on: boolean }) {
  const logo = appLogo(app);
  const body = (
    <>
      <span className="no" aria-hidden="true">
        {no}
      </span>
      <span className="slot-ic" dangerouslySetInnerHTML={{ __html: logo.html }} />
      <strong>{app.name}</strong>
      <small>{app.ready ? `${app.desc}` : '준비 중'}</small>
      <span className="price" aria-hidden="true">
        {TAG[app.tone]}
      </span>
    </>
  );
  // 다른 앱은 다른 빌드라 라우터 링크가 아니라 페이지 이동
  return app.ready ? (
    <a className={`slot${on ? ' on' : ''}`} href={app.path} onClick={(e) => isPlainClick(e.nativeEvent) && showLoader(app)}>
      {body}
    </a>
  ) : (
    <div className="slot is-soon" aria-disabled>
      {body}
    </div>
  );
}
