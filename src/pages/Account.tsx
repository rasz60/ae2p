import type { User } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { Backdrop, Brand } from '../components/Brand';
import { GOOGLE_ICON, KAKAO_ICON, NAVER_ENABLED, NAVER_ICON } from '../components/Social';
import { UserMenu } from '../components/UserMenu';
import { portalApi } from '../lib/api';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

/** server/naver.ts 가 app_metadata.naver 에 저장하는 값 */
interface NaverLink {
  id: string;
  email: string | null;
  linked_at: string;
}

/** 네이버 연결(server/naver.ts)을 마치고 돌아오면 주소 해시에 붙는 결과 */
const NAVER_RESULT: Record<string, { ok: boolean; text: string }> = {
  'naver=linked': { ok: true, text: '네이버를 연결했어요. 다음부터 네이버로 로그인할 수 있어요.' },
  'naver_error=taken': { ok: false, text: '이미 다른 ae:p 계정에 연결된 네이버 계정이에요.' },
  'naver_error=cancelled': { ok: false, text: '네이버 연결을 취소했어요.' },
  'naver_error=expired': { ok: false, text: '연결 시간이 지났어요. 다시 시도해 주세요.' },
  'naver_error=failed': { ok: false, text: '네이버 연결에 실패했어요. 잠시 뒤 다시 시도해 주세요.' },
};

function takeResult(): { ok: boolean; text: string } | null {
  const hash = window.location.hash.slice(1);
  if (!hash) return null;
  const r = NAVER_RESULT[hash] ?? (hash.startsWith('naver_error=') ? NAVER_RESULT['naver_error=failed']! : null);
  if (r) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  return r;
}

const date = (iso: string) => new Date(iso).toLocaleDateString('ko-KR');

/** 계정 설정: 내 계정 · 로그인 방법 (네이버 연결/해제) */
export function Account() {
  const { user: sessionUser, isTester } = useAuth();
  // 세션에 든 사용자 정보는 로그인 시점 것이라, 연결 직후의 app_metadata 를 보려면 서버에서 새로 받는다
  const [user, setUser] = useState<User | null>(sessionUser);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const resultRead = useRef(false);

  useEffect(() => {
    if (resultRead.current) return;
    resultRead.current = true;
    const r = takeResult();
    if (r) setResult(r);
  }, []);

  const reload = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) setUser(data.user);
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);

  const providers = new Set((user?.identities ?? []).map((i) => i.provider));
  const naver = (user?.app_metadata.naver as NaverLink | null | undefined) ?? null;

  async function linkNaver() {
    setBusy(true);
    setResult(null);
    try {
      const { url } = await portalApi<{ url: string }>('/naver/link', { method: 'POST' });
      window.location.assign(url);
    } catch (e) {
      setResult({ ok: false, text: (e as Error).message });
      setBusy(false);
    }
  }

  async function unlinkNaver() {
    if (!window.confirm('네이버 연결을 해제할까요? 해제하면 네이버로 로그인할 수 없어요.')) return;
    setBusy(true);
    setResult(null);
    try {
      await portalApi('/naver/link', { method: 'DELETE' });
      await reload();
      setResult({ ok: true, text: '네이버 연결을 해제했어요.' });
    } catch (e) {
      setResult({ ok: false, text: (e as Error).message });
    }
    setBusy(false);
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
        <h1 className="page-title">계정 설정</h1>

        {isTester ? (
          <section className="card">
            <p className="muted">테스터 계정은 계정 설정을 바꿀 수 없어요.</p>
          </section>
        ) : (
          <section className="card">
            <h2>로그인 방법</h2>
            <p className="muted account-lead">{user?.email}</p>
            <ul className="method-list">
              <Method icon={<span className="method-mark">@</span>} name="이메일 · 비밀번호" meta="초대받은 이메일로 로그인">
                <Link className="btn btn-ghost bd-small" to="/set-password">
                  비밀번호 변경
                </Link>
              </Method>
              <Method icon={GOOGLE_ICON} name="Google" meta="같은 이메일의 Google 계정으로 로그인하면 자동으로 연결돼요">
                <Status on={providers.has('google')} />
              </Method>
              <Method icon={KAKAO_ICON} tone="kakao" name="카카오" meta="같은 이메일의 카카오 계정으로 로그인하면 자동으로 연결돼요">
                <Status on={providers.has('kakao')} />
              </Method>
              {NAVER_ENABLED && (
                <Method
                  icon={NAVER_ICON}
                  tone="naver"
                  name="네이버"
                  meta={naver ? `${naver.email ?? '네이버 계정'} · ${date(naver.linked_at)} 연결` : '여기서 한 번 연결하면 다음부터 네이버로 로그인할 수 있어요'}
                >
                  {naver ? (
                    <>
                      <Status on />
                      <button className="btn btn-ghost bd-small" disabled={busy} onClick={unlinkNaver}>
                        연결 해제
                      </button>
                    </>
                  ) : (
                    <button className="btn btn-naver bd-small" disabled={busy} onClick={linkNaver}>
                      {busy ? '이동 중…' : '연결하기'}
                    </button>
                  )}
                </Method>
              )}
            </ul>
            {result && (
              <p className={result.ok ? 'notice' : 'error'} role="status">
                {result.text}
              </p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function Method({
  icon,
  tone,
  name,
  meta,
  children,
}: {
  icon: ReactElement;
  tone?: 'kakao' | 'naver';
  name: string;
  meta: string;
  children: ReactElement;
}) {
  return (
    <li>
      <span className={`method-icon ${tone ? `method-${tone}` : ''}`}>{icon}</span>
      <div className="user-main">
        <strong>{name}</strong>
        <span className="user-meta">{meta}</span>
      </div>
      {children}
    </li>
  );
}

const Status = ({ on }: { on: boolean }) => <span className={`chip ${on ? 'tone-health' : ''}`}>{on ? '연결됨' : '연결 안 됨'}</span>;
