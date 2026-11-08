import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { SOCIAL, type SocialItem } from '../components/Social';
import { portalApi } from '../lib/api';
import { goTo, safeNext, useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { logout } from '../lib/tester';

/** 공용 테스터 계정으로 둘러보기 (P-0004). 빌드 때 켠다 */
const TESTER_ENABLED = import.meta.env.VITE_TESTER_ENABLED === 'true';

/** 소셜 로그인이 실패하고 돌아오면 주소(?error_description= 또는 #error_description=)에 이유가 붙어 온다 */
function oauthError(): string {
  const msg =
    new URLSearchParams(window.location.search).get('error_description') ??
    new URLSearchParams(window.location.hash.slice(1)).get('error_description');
  if (!msg) return '';
  // 공개 가입을 꺼 두었으므로, 초대받지 않은 계정의 소셜 로그인은 가입 거부로 돌아온다
  return /signup/i.test(msg) ? '초대받은 이메일로만 로그인할 수 있어요.' : msg;
}

/** 네이버 로그인(server/naver.ts)이 실패하고 돌아오면 주소 해시에 붙는 사유 */
const NAVER_ERRORS: Record<string, string> = {
  not_linked: '네이버 계정이 연결된 ae:p 계정이 없어요. 다른 방법으로 로그인한 뒤 계정 설정에서 네이버를 연결해 주세요.',
  cancelled: '네이버 로그인을 취소했어요.',
  expired: '로그인 시간이 지났어요. 다시 시도해 주세요.',
  failed: '네이버 로그인에 실패했어요. 잠시 뒤 다시 시도해 주세요.',
};

/**
 * 네이버 로그인이 성공하면 /login#naver_token=… (1회용 로그인 토큰), 실패하면 #naver_error=… 로 돌아온다.
 * 토큰이 주소창 · 방문 기록에 남지 않게 읽자마자 해시를 지운다
 */
function takeNaverHash(): { token: string; error: string } {
  const h = new URLSearchParams(window.location.hash.slice(1));
  const token = h.get('naver_token') ?? '';
  const error = h.get('naver_error') ?? '';
  if (token || error) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  return { token, error };
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
  const [naverBusy, setNaverBusy] = useState(false);
  const [testerBusy, setTesterBusy] = useState(false);
  const naverRead = useRef(false);

  // 네이버 로그인 결과 처리. 개발 모드(StrictMode)에서 effect 가 두 번 돌아도 토큰은 한 번만 쓴다
  useEffect(() => {
    if (naverRead.current) return;
    naverRead.current = true;
    const { token, error: code } = takeNaverHash();
    if (code) setError(NAVER_ERRORS[code] ?? NAVER_ERRORS.failed!);
    if (!token) return;
    setNaverBusy(true);
    // 세션이 생기면 onAuthStateChange → 아래 effect 가 next 로 보낸다
    supabase.auth.verifyOtp({ token_hash: token, type: 'magiclink' }).then(({ error }) => {
      if (error) setError(NAVER_ERRORS.expired!);
      setNaverBusy(false);
    });
  }, []);

  useEffect(() => {
    if (!loggingOut) return;
    // 테스터면 먼저 테스터 데이터를 지운다 (lib/tester.ts)
    logout().finally(() => {
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

  // 서버가 테스터 계정의 1회용 로그인 토큰을 주면 세션을 연다 (네이버 로그인과 같은 방식)
  async function enterAsTester() {
    setTesterBusy(true);
    setError('');
    try {
      const { token } = await portalApi<{ token: string }>('/tester/login', { method: 'POST', body: '{}' });
      const { error } = await supabase.auth.verifyOtp({ token_hash: token, type: 'magiclink' });
      if (error) throw new Error('테스터 입장에 실패했어요. 다시 시도해 주세요.');
    } catch (e) {
      setError((e as Error).message);
      setTesterBusy(false);
    }
  }

  async function social(item: SocialItem) {
    setError('');
    // 네이버: 포털 API 가 네이버 로그인으로 보낸다
    if ('href' in item) return window.location.assign(item.href(next));
    const { error } = await supabase.auth.signInWithOAuth({
      provider: item.provider,
      options: { redirectTo: `${window.location.origin}/login?next=${encodeURIComponent(next)}` },
    });
    if (error) setError(error.message);
  }

  if (!ready) return null;
  if (loggingOut) {
    return (
      <AuthLayout>
        <p className="auth-done muted">로그아웃하는 중…</p>
      </AuthLayout>
    );
  }
  if (naverBusy) {
    return (
      <AuthLayout>
        <p className="auth-done muted">네이버로 로그인하는 중…</p>
      </AuthLayout>
    );
  }

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
              <button key={s.key} type="button" className={`btn ${s.className}`} onClick={() => social(s)}>
                {s.icon}
                {s.label}
              </button>
            ))}
          </div>
          <p className="auth-note">초대받은 계정으로만 들어올 수 있어요.</p>
          {TESTER_ENABLED && (
            <div className="tester-entry">
              <button type="button" className="btn btn-ghost" disabled={testerBusy} onClick={enterAsTester}>
                {testerBusy ? '들어가는 중…' : '테스터로 입장하기'}
              </button>
              <p className="muted">공용 테스터 계정으로 둘러봐요. 새로 만든 데이터는 로그아웃하면 지워져요.</p>
            </div>
          )}
        </>
      )}
    </AuthLayout>
  );
}
