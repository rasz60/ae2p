// 공용 테스터 계정 · 에이전트 공유 (P-0004)
// 판정은 세션의 app_metadata 로 한다 (사용자가 스스로 못 바꾼다). 메뉴 숨김은 편의이고, 실제 막기는 각 앱 API 가 한다.
import type { User } from '@supabase/supabase-js';
import { APPS, canUseAgent as canUseAgentMeta, isTesterMeta } from '../../shared/apps';
import { supabase } from './supabase';

export const isTester = (user: User | null | undefined) => isTesterMeta(user?.app_metadata);
export const canUseAgent = (user: User | null | undefined) => canUseAgentMeta(user?.app_metadata);

/** 앱 하나당 정리 API 기다리는 시간. 넘으면 그냥 로그아웃한다 (남은 데이터는 매일 새벽 정리가 지운다) */
const RESET_TIMEOUT_MS = 5_000;

/** 세 앱에 테스터가 새로 만든 데이터를 지워 달라고 동시에 요청한다. 실패해도 멈추지 않는다 */
export async function resetTesterData(token: string): Promise<void> {
  await Promise.allSettled(
    APPS.filter((a) => a.testerReset).map((a) =>
      fetch(a.testerReset!, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(RESET_TIMEOUT_MS),
      }),
    ),
  );
}

/** 로그아웃. 테스터면 먼저 테스터 데이터를 지운다 (UserMenu · /login?logout=1 이 같이 쓴다) */
export async function logout(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (session && isTester(session.user)) {
    await resetTesterData(session.access_token);
    // 같은 테스터 계정을 쓰는 다른 사람의 세션은 끊지 않는다 (기본 scope 'global' 은 그 계정의 모든 세션을 끝낸다)
    await supabase.auth.signOut({ scope: 'local' });
    return;
  }
  await supabase.auth.signOut();
}
