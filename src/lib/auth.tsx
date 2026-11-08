import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { currentApp } from '../../shared/apps';
import { supabase } from './supabase';
import { canUseAgent, isTester } from './tester';

interface Auth {
  ready: boolean;
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  /** 공용 테스터 계정 (P-0004). 비밀번호 · 계정 설정 · 에이전트를 쓸 수 없다 */
  isTester: boolean;
  /** 에이전트를 볼 수 있는 계정: 관리자 · 공유받은 멤버 */
  canUseAgent: boolean;
  /** 초대 수락 직후·소셜 첫 로그인처럼 아직 비밀번호를 정하지 않은 계정 */
  needsPassword: boolean;
}

const AuthContext = createContext<Auth>({
  ready: false,
  session: null,
  user: null,
  isAdmin: false,
  isTester: false,
  canUseAgent: false,
  needsPassword: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const user = session?.user ?? null;
  const value: Auth = {
    ready,
    session,
    user,
    // app_metadata 는 서버(service_role)만 바꿀 수 있어 권한 판단에 쓴다. user_metadata 는 본인이 바꿀 수 있다
    isAdmin: user?.app_metadata.role === 'admin',
    isTester: isTester(user),
    canUseAgent: canUseAgent(user),
    // 테스터는 비밀번호 없이 '테스터로 입장하기'로만 들어온다
    needsPassword: !!user && !isTester(user) && user.user_metadata.password_set !== true,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

/** 로그인 뒤 돌아갈 주소. 다른 사이트로 튀는 주소(//evil.com)는 막는다 */
export function safeNext(raw: string | null): string {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
}

/** 포털 안 주소면 라우터로, 다른 앱 주소면 페이지째 이동 */
export function goTo(path: string, navigate: NavigateFunction) {
  if (currentApp(path)) window.location.assign(path);
  else navigate(path, { replace: true });
}
