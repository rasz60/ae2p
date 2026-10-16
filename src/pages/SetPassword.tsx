import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { goTo, safeNext, useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

const MIN = 8;

/**
 * 비밀번호 정하기/바꾸기.
 * 초대 메일 링크, 비밀번호 재설정 링크, 소셜 첫 로그인 모두 여기로 온다 (링크의 토큰은 supabase-js 가 읽어 로그인시킨다)
 */
export function SetPassword() {
  const { ready, session, user, needsPassword } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get('next'));

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < MIN) return setError(`${MIN}자 이상으로 정해 주세요.`);
    if (password !== confirm) return setError('두 비밀번호가 달라요.');
    setBusy(true);
    setError('');
    const { error } = await supabase.auth.updateUser({ password, data: { password_set: true } });
    setBusy(false);
    if (error) return setError(/different/i.test(error.message) ? '지금 비밀번호와 다른 비밀번호로 정해 주세요.' : error.message);
    goTo(next, navigate);
  }

  if (!ready) return null;
  if (!session) {
    return (
      <AuthLayout>
        <div className="auth-done">
          <p>링크가 만료됐거나 이미 사용됐어요.</p>
          <Link className="btn btn-primary" to="/login">
            로그인하기
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <form className="form" onSubmit={submit}>
        <h1 className="auth-title">{needsPassword ? '비밀번호를 정해 주세요' : '비밀번호 변경'}</h1>
        {needsPassword && <p className="muted">다음부터는 이메일과 비밀번호로도 로그인할 수 있어요.</p>}
        <label className="field">
          <span>이메일</span>
          <input type="email" value={user?.email ?? ''} readOnly autoComplete="username" />
        </label>
        <label className="field">
          <span>새 비밀번호</span>
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={`${MIN}자 이상`}
          />
        </label>
        <label className="field">
          <span>비밀번호 확인</span>
          <input type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary" disabled={busy}>
          {busy ? '저장 중…' : '저장'}
        </button>
        {!needsPassword && (
          <Link className="link" to="/">
            취소
          </Link>
        )}
      </form>
    </AuthLayout>
  );
}
