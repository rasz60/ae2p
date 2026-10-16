import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Backdrop, Brand } from '../components/Brand';
import { UserMenu } from '../components/UserMenu';
import { portalApi } from '../lib/api';
import { useAuth } from '../lib/auth';

interface PortalUser {
  id: string;
  email: string;
  role: 'admin' | 'user';
  providers: string[];
  status: 'active' | 'invited';
  created_at: string;
  last_sign_in_at: string | null;
}

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('ko-KR') : '-');

/** 계정 관리 (관리자): 초대 · 목록 · 삭제 */
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

  return (
    <div className="page">
      <Backdrop />
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
                {u.id !== user?.id && (
                  <button className="link danger" onClick={() => remove(u)}>
                    삭제
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
