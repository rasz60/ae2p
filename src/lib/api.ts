import { supabase } from './supabase';

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${data.session?.access_token ?? ''}` };
}

async function request<T>(base: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      // FormData(파일 첨부)는 브라우저가 boundary 를 붙여 직접 정한다
      ...(typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      ...(await authHeader()),
      ...init.headers,
    },
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `요청 실패 (${res.status})`);
  return body;
}

/** 포털 API (Caddy: /api/portal/* → server/index.ts). 로그인 토큰을 붙여 보낸다 */
export const portalApi = <T>(path: string, init?: RequestInit) => request<T>('/api/portal', path, init);

/** Claude 작업실 API (Caddy: /api/builder/* → server/builder.ts). 테스트 서버에만 있다 */
export const builderApi = <T>(path: string, init?: RequestInit) => request<T>('/api/builder', path, init);

/** 작업실의 SSE 응답을 fetch 로 읽는다 (EventSource 는 Authorization 헤더를 못 붙인다). 연결이 끝나면 resolve */
export async function builderStream<E>(path: string, init: RequestInit, onEvent: (e: E) => void): Promise<void> {
  const res = await fetch(`/api/builder${path}`, { ...init, headers: { ...(await authHeader()), ...init.headers } });
  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `요청 실패 (${res.status})`);
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    let i: number;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const data = buf
        .slice(0, i)
        .split('\n')
        .filter((l) => l.startsWith('data: '))
        .map((l) => l.slice(6))
        .join('\n');
      buf = buf.slice(i + 2);
      if (data) onEvent(JSON.parse(data) as E);
    }
  }
}
