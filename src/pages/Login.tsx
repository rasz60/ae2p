import type { Provider } from '@supabase/supabase-js';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { SOCIAL } from '../components/Social';
import { goTo, safeNext, useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

/** 소셜 로그인이 실패하고 돌아오면 주소(?error_description= 또는 #error_description=)에 이유가 붙어 온다 */
function oauthError(): string {
  const msg =
    new URLSearchParams(window.location.search).get('error_description') ??
    new URLSearchParams(window.location.hash.slice(1)).get('error_description');
  if (!msg) return '';
  // 공개 가입을 꺼 두었으므로, 초대받지 않은 계정의 소셜 로그인은 가입 거부로 돌아온다
  return /signup/i.test(msg) ? '초대받은 이메일로만 로그인할 수 있어요.' : msg;
}

export function Login() {
  const { ready, session, needsPassword } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get('next'));

  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(oauthError);
  const [sent, setSent] = useState(false);
  // 각 앱의 앱 전환 메뉴에서 '로그아웃'을 누르면 /login?logout=1 로 온다
  const [loggingOut, setLoggingOut] = useState(params.get('logout') === '1');

  useEffect(() => {
    if (!loggingOut) return;
    supabase.auth.signOut().finally(() => {
      setLoggingOut(false);
      navigate('/login', { replace: true });
    });
  }, [loggingOut, navigate]);

  // 이미 로그인돼 있으면(소셜 로그인에서 돌아온 경우 포함) 바로 보낸다
  useEffect(() => {
    if (!ready || !session || loggingOut) return;
    if (needsPassword) navigate(`/set-password?next=${encodeURIComponent(next)}`, { replace: true });
    else goTo(next, navigate);
  }, [ready, session, needsPassword, loggingOut, next, navigate]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(/invalid/i.test(error.message) ? '이메일 또는 비밀번호가 맞지 않아요.' : error.message);
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/set-password`,
      });
      if (error) setError(error.message);
      else setSent(true);
    }
    setBusy(false);
  }

  async function social(provider: Provider) {
    setError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/login?next=${encodeURIComponent(next)}` },
    });
    if (error) setError(error.message);
  }

  if (!ready || loggingOut) return null;

  return (
    <AuthLayout>
      {mode === 'reset' && sent ? (
        <div className="auth-done">
          <p>
            <strong>{email}</strong> 로 비밀번호 재설정 메일을 보냈어요.
          </p>
          <button className="btn btn-ghost" onClick={() => (setMode('login'), setSent(false))}>
            로그인으로 돌아가기
          </button>
        </div>
      ) : (
        <form className="form" onSubmit={submit}>
          <h1 className="auth-title">{mode === 'login' ? '로그인' : '비밀번호 재설정'}</h1>
          {mode === 'reset' && <p className="muted">가입한 이메일로 재설정 링크를 보내 드려요.</p>}
          <label className="field">
            <span>이메일</span>
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {mode === 'login' && (
            <label className="field">
              <span>비밀번호</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary" disabled={busy}>
            {busy ? '잠시만요…' : mode === 'login' ? '로그인' : '재설정 메일 보내기'}
          </button>
          <button type="button" className="link" onClick={() => (setMode(mode === 'login' ? 'reset' : 'login'), setError(''))}>
            {mode === 'login' ? '비밀번호를 잊으셨나요?' : '로그인으로 돌아가기'}
          </button>
        </form>
      )}

      {mode === 'login' && (
        <>
          <div className="divider">
            <span>또는</span>
          </div>
          <div className="social">
            {SOCIAL.map((s) => (
              <button key={s.provider} type="button" className={`btn ${s.className}`} onClick={() => social(s.provider)}>
                {s.icon}
                {s.label}
              </button>
            ))}
          </div>
          <p className="auth-note">초대받은 계정으로만 들어올 수 있어요.</p>
        </>
      )}
    </AuthLayout>
  );
}
