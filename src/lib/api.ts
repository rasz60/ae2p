import { supabase } from './supabase';

/** 포털 API (Caddy: /api/portal/* → server/). 로그인 토큰을 붙여 보낸다 */
export async function portalApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(`/api/portal${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${data.session?.access_token ?? ''}`,
      ...init.headers,
    },
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `요청 실패 (${res.status})`);
  return body;
}
