import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { UserMenu } from '../components/UserMenu';
import { portalApi } from '../lib/api';
import { useAuth } from '../lib/auth';

interface PortalUser {
  id: string;
  email: string;
  role: 'admin' | 'tester' | 'user';
  /** 관리자가 에이전트를 공유한 멤버 */
  agent_share: boolean;
  providers: string[];
  status: 'active' | 'invited';
  created_at: string;
  last_sign_in_at: string | null;
}

/** server/tester.ts 의 테스터 계정 상태 */
interface TesterState {
  email: string;
  found: boolean;
  isTester: boolean;
  editing: boolean;
  baselineAt: string | null;
}

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('ko-KR') : '-');
const dateTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString('ko-KR') : '-');

/** 계정 관리 (관리자): 초대 · 목록 · 삭제 · 에이전트 공유 · 테스터 계정 */
export function Admin() {
  const { user } = useAuth();
  const [users, setUsers] = useState<PortalUser[] | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(() => {
    portalApi<{ users: PortalUser[] }>('/users')
      .then((r) => setUsers(r.users))
      .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  async function invite(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await portalApi('/invite', { method: 'POST', body: JSON.stringify({ email }) });
      setNotice(`${email} 로 초대 메일을 보냈어요.`);
      setEmail('');
      load();
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  }

  async function remove(u: PortalUser) {
    if (!window.confirm(`${u.email} 계정을 삭제할까요? 이 계정의 모든 앱 데이터도 함께 지워질 수 있어요.`)) return;
    try {
      await portalApi(`/users/${u.id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  // 에이전트 공유: 켜면 그 멤버에게 에이전트 메뉴가 보이고 픽셀 오피스를 같이 본다 (로그 · 알림은 각자)
  async function toggleAgent(u: PortalUser) {
    setError('');
    const enabled = !u.agent_share;
    setUsers((list) => list?.map((x) => (x.id === u.id ? { ...x, agent_share: enabled } : x)) ?? null);
    try {
      await portalApi(`/users/${u.id}/agent`, { method: 'PUT', body: JSON.stringify({ enabled }) });
    } catch (err) {
      setError((err as Error).message);
      load();
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <Link to="/" aria-label="홈">
          <Brand kind="mark" height={30} />
        </Link>
        <UserMenu />
      </header>
      <main className="admin">
        <h1 className="page-title">계정 관리</h1>

        <form className="card invite" onSubmit={invite}>
          <h2>초대하기</h2>
          <p className="muted">초대 메일의 링크로 들어와 비밀번호를 정하면 가입이 끝나요. 같은 이메일의 구글·카카오 계정으로도 로그인할 수 있어요.</p>
          <div className="invite-row">
            <input type="email" required placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="btn btn-primary" disabled={busy}>
              {busy ? '보내는 중…' : '초대'}
            </button>
          </div>
          {notice && <p className="notice">{notice}</p>}
          {error && <p className="error">{error}</p>}
        </form>

        <section className="card">
          <h2>
            계정 <span className="muted">{users ? users.length : ''}</span>
          </h2>
          <p className="muted">에이전트 공유를 켠 멤버는 에이전트 메뉴가 보이고 픽셀 오피스를 같이 봐요. 로그 · 알림은 각자 자기 잡 것만 보여요.</p>
          {!users && !error && <p className="muted">불러오는 중…</p>}
          <ul className="user-list">
            {users?.map((u) => (
              <li key={u.id}>
                <div className="user-main">
                  <strong>{u.email}</strong>
                  <span className="user-meta">
                    가입 {date(u.created_at)} · 최근 로그인 {date(u.last_sign_in_at)}
                    {u.providers.length > 0 && ` · ${u.providers.join(', ')}`}
                  </span>
                </div>
                <span className={`chip ${u.status === 'invited' ? 'chip-wait' : ''}`}>{u.status === 'invited' ? '초대됨' : '활성'}</span>
                {u.role === 'admin' && <span className="chip tone-work">관리자</span>}
                {u.role === 'tester' && <span className="chip tone-interest">테스터</span>}
                <AgentSwitch user={u} onToggle={() => toggleAgent(u)} />
                {u.id !== user?.id && (
                  <button className="link danger" onClick={() => remove(u)}>
                    삭제
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>

        <TesterCard onChange={load} />
      </main>
    </div>
  );
}

/** 멤버별 에이전트 공유 스위치. 관리자는 항상, 테스터는 공유할 수 없다 */
function AgentSwitch({ user, onToggle }: { user: PortalUser; onToggle: () => void }) {
  if (user.role === 'admin') return <span className="agent-share muted">에이전트 항상</span>;
  const disabled = user.role === 'tester';
  return (
    <label className={`agent-share ${disabled ? 'is-off' : ''}`} title={disabled ? '테스터 계정에는 공유할 수 없어요' : undefined}>
      <input type="checkbox" role="switch" checked={!disabled && user.agent_share} disabled={disabled} onChange={onToggle} />
      <span>에이전트 공유</span>
    </label>
  );
}

/** 공용 테스터 계정: 상태 · 기본 데이터 편집 시작 · 잠그기 */
function TesterCard({ onChange }: { onChange: () => void }) {
  const [state, setState] = useState<TesterState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    portalApi<TesterState>('/tester/state')
      .then(setState)
      .catch((e: Error) => setError(e.message));
  }, []);

  async function act(action: 'assign' | 'edit' | 'lock') {
    setBusy(true);
    setError('');
    try {
      setState(await portalApi<TesterState>('/tester/state', { method: 'POST', body: JSON.stringify({ action }) }));
      onChange();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <section className="card tester-card">
      <h2>테스터 계정</h2>
      <p className="muted">
        로그인 화면의 '테스터로 입장하기'로 누구나 이 계정에 들어와요. 잠그기 전에 넣은 데이터는 기본 데이터로 남고 테스터가 바꿀 수 없어요.
        잠근 뒤에 만든 데이터는 로그아웃할 때와 매일 새벽 4시에 지워져요. 실제 개인정보는 넣지 마세요.
      </p>
      {!state && !error && <p className="muted">불러오는 중…</p>}
      {state && !state.email && <p className="muted">포털 서버 .env 에 TESTER_EMAIL 을 넣으면 쓸 수 있어요.</p>}
      {state?.email && !state.found && <p className="muted">{state.email} 계정이 없어요. 위에서 먼저 초대해 주세요.</p>}
      {state?.found && (
        <>
          <dl className="tester-state">
            <dt>계정</dt>
            <dd>{state.email}</dd>
            <dt>상태</dt>
            <dd>
              {!state.isTester ? (
                <span className="chip">테스터 아님</span>
              ) : state.editing ? (
                <span className="chip chip-wait">기본 데이터 편집 중 · 잠금 · 정리 꺼짐</span>
              ) : (
                <span className="chip tone-health">잠김</span>
              )}
            </dd>
            <dt>기본 데이터 기준</dt>
            <dd>{dateTime(state.baselineAt)}</dd>
          </dl>
          {state.editing && (
            <p className="muted">
              테스터로 입장해서 업무일지 · 운동기록 · 커리어++에 기본 데이터를 넣은 뒤 '잠그기'를 누르세요. 편집 중에는 누구나 들어와 바꿀 수
              있으니 테스터 입장 버튼은 잠근 뒤에 켜는 것이 좋아요.
            </p>
          )}
          <div className="tester-actions">
            {!state.isTester && (
              <button className="btn btn-primary" disabled={busy} onClick={() => act('assign')}>
                테스터로 지정
              </button>
            )}
            {state.isTester && !state.editing && (
              <button className="btn btn-ghost" disabled={busy} onClick={() => act('edit')}>
                기본 데이터 편집 시작
              </button>
            )}
            {state.isTester && state.editing && (
              <button className="btn btn-primary" disabled={busy} onClick={() => act('lock')}>
                잠그기
              </button>
            )}
          </div>
        </>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
