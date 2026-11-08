// 네이버 로그인 (P-0001). Supabase 가 네이버를 지원하지 않아 포털 API 가 직접 OAuth 를 처리한다.
//
// 계정 연결 방식: 로그인한 사용자가 /account 에서 "네이버 연결"을 누르면 네이버 고유 id 를
// app_metadata.naver 에 저장하고, 다음부터는 그 id 로 계정을 찾는다.
// 네이버 이메일로는 계정을 찾지 않는다 (네이버는 이메일 인증 여부를 주지 않는다).
//
// 로그인 세션은 Supabase 관리자 API 로 1회용 로그인 토큰(magiclink hashed_token)을 만들어
// /login#naver_token=… 으로 넘기고, 웹이 supabase.auth.verifyOtp 로 연다.
//
// Caddy 가 /api/portal 접두어를 떼고 넘기므로 여기 경로는 /naver/… 이고, 브라우저 주소는 /api/portal/naver/… 이다.
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { User } from '@supabase/supabase-js';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { admin } from './common';

const CLIENT_ID = process.env.NAVER_CLIENT_ID ?? '';
const CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET ?? '';
const PUBLIC_URL = (process.env.PUBLIC_URL ?? '').replace(/\/$/, '');
const REDIRECT_URI = `${PUBLIC_URL}/api/portal/naver/callback`;

const AUTHORIZE_URL = 'https://nid.naver.com/oauth2.0/authorize';
const TOKEN_URL = 'https://nid.naver.com/oauth2.0/token';
const PROFILE_URL = 'https://openapi.naver.com/v1/nid/me';

/** app_metadata.naver 에 저장하는 값 */
export interface NaverLink {
  id: string;
  /** 연결된 네이버 계정을 보여 주는 용도. 계정을 찾는 데 쓰지 않는다 */
  email: string | null;
  linked_at: string;
}

export const naverLinkOf = (u: User): NaverLink | null => {
  const v = u.app_metadata.naver as NaverLink | null | undefined;
  return v && typeof v.id === 'string' ? v : null;
};

// ── state: 쿼리 · 쿠키 · 서버 메모리 셋이 모두 맞아야 통과. 한 번 쓰면 지운다 ──
type Mode = 'login' | 'link';
interface Pending {
  mode: Mode;
  /** link 모드: Bearer 토큰으로 확인한 사용자 */
  userId?: string;
  next: string;
  exp: number;
}
const TTL_MS = 10 * 60 * 1000;
const pending = new Map<string, Pending>();

function newState(p: Omit<Pending, 'exp'>): string {
  const now = Date.now();
  for (const [k, v] of pending) if (v.exp < now) pending.delete(k);
  const state = randomBytes(32).toString('base64url');
  pending.set(state, { ...p, exp: now + TTL_MS });
  return state;
}

const COOKIE = 'aep_naver_state';
// 브라우저 기준 경로 (Caddy 가 접두어를 떼기 전)
const COOKIE_PATH = '/api/portal/naver';
const secure = PUBLIC_URL.startsWith('https://') ? '; Secure' : '';

/** 쿠키 값은 '<mode>:<state>'. mode 는 실패했을 때 돌아갈 화면을 고르는 데만 쓴다 */
const setStateCookie = (reply: FastifyReply, mode: Mode, state: string) =>
  reply.header('set-cookie', `${COOKIE}=${mode}:${state}; Path=${COOKIE_PATH}; Max-Age=${TTL_MS / 1000}; HttpOnly; SameSite=Lax${secure}`);
const clearStateCookie = (reply: FastifyReply) =>
  reply.header('set-cookie', `${COOKIE}=; Path=${COOKIE_PATH}; Max-Age=0; HttpOnly; SameSite=Lax${secure}`);

function readCookie(req: FastifyRequest): { mode: Mode; state: string } | null {
  const raw = req.headers.cookie
    ?.split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  const m = raw && /^(login|link):([A-Za-z0-9_-]+)$/.exec(raw);
  return m ? { mode: m[1] as Mode, state: m[2]! } : null;
}

const sameString = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** 로그인 뒤 돌아갈 주소. 웹의 safeNext 와 같은 규칙 (다른 사이트로 튀는 //evil.com 차단) */
const safeNext = (raw: unknown): string =>
  typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\') ? raw : '/';

// ── 결과 화면으로 보내기. 값은 해시(#)로만 넘겨 서버 로그 · Referer 에 남지 않게 한다 ──
type LoginError = 'not_linked' | 'cancelled' | 'expired' | 'failed';
type LinkError = 'taken' | 'cancelled' | 'expired' | 'failed';

const loginUrl = (next: string, hash: string) => `/login?next=${encodeURIComponent(next)}#${hash}`;
const toLogin = (reply: FastifyReply, next: string, error: LoginError) =>
  reply.redirect(loginUrl(next, `naver_error=${error}`));
const toAccount = (reply: FastifyReply, hash: `naver=linked` | `naver_error=${LinkError}`) => reply.redirect(`/account#${hash}`);

// ── 네이버 API ──
async function fetchNaverProfile(code: string, state: string): Promise<{ id: string; email: string | null }> {
  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      state,
    }),
  });
  const token = (await tokenRes.json().catch(() => ({}))) as { access_token?: string; error?: string; error_description?: string };
  if (!tokenRes.ok || !token.access_token) throw new Error(`naver token: ${token.error ?? tokenRes.status} ${token.error_description ?? ''}`);

  const profileRes = await fetch(PROFILE_URL, { headers: { Authorization: `Bearer ${token.access_token}` } });
  const profile = (await profileRes.json().catch(() => ({}))) as {
    resultcode?: string;
    message?: string;
    response?: { id?: string; email?: string };
  };
  const id = profile.response?.id;
  if (!profileRes.ok || profile.resultcode !== '00' || !id) throw new Error(`naver profile: ${profile.resultcode ?? profileRes.status} ${profile.message ?? ''}`);
  return { id, email: profile.response?.email ?? null };
}

// ── 계정 찾기: 초대제라 사용자가 적어 전체를 훑는다 ──
async function findByNaverId(naverId: string): Promise<User | null> {
  const perPage = 1000;
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const hit = data.users.find((u) => naverLinkOf(u)?.id === naverId);
    if (hit) return hit;
    if (data.users.length < perPage) return null;
  }
}

/** Authorization: Bearer <access token> 로 로그인한 사용자 확인 */
async function bearerUser(req: FastifyRequest): Promise<User | null> {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  return error ? null : data.user;
}

const authorizeUrl = (state: string) =>
  `${AUTHORIZE_URL}?${new URLSearchParams({ response_type: 'code', client_id: CLIENT_ID, redirect_uri: REDIRECT_URI, state })}`;

export function naverRoutes(app: FastifyInstance) {
  const enabled = !!(CLIENT_ID && CLIENT_SECRET && PUBLIC_URL);
  if (!enabled) app.log.warn('NAVER_CLIENT_ID / NAVER_CLIENT_SECRET / PUBLIC_URL 이 없어 네이버 로그인을 끕니다');

  // 로그인 시작: /login 의 "네이버로 계속하기"가 이 주소로 페이지 이동한다
  app.get<{ Querystring: { next?: string } }>('/naver/start', async (req, reply) => {
    const next = safeNext(req.query.next);
    if (!enabled) return toLogin(reply, next, 'failed');
    const state = newState({ mode: 'login', next });
    setStateCookie(reply, 'login', state);
    return reply.redirect(authorizeUrl(state));
  });

  // 연결 시작: /account 가 로그인 토큰을 붙여 부르고, 받은 url 로 페이지 이동한다
  app.post('/naver/link', async (req, reply) => {
    const user = await bearerUser(req);
    if (!user) return reply.code(401).send({ error: '로그인이 필요해요.' });
    // 공용 테스터 계정은 로그인 방법을 바꿀 수 없다 (P-0004)
    if (user.app_metadata.role === 'tester') return reply.code(403).send({ error: '테스터 계정은 계정 설정을 바꿀 수 없어요.' });
    if (!enabled) return reply.code(503).send({ error: '네이버 로그인이 아직 준비되지 않았어요.' });
    const state = newState({ mode: 'link', userId: user.id, next: '/account' });
    setStateCookie(reply, 'link', state);
    return { url: authorizeUrl(state) };
  });

  // 연결 해제
  app.delete('/naver/link', async (req, reply) => {
    const user = await bearerUser(req);
    if (!user) return reply.code(401).send({ error: '로그인이 필요해요.' });
    if (user.app_metadata.role === 'tester') return reply.code(403).send({ error: '테스터 계정은 계정 설정을 바꿀 수 없어요.' });
    const { error } = await admin.auth.admin.updateUserById(user.id, { app_metadata: { naver: null } });
    if (error) return reply.code(500).send({ error: error.message });
    req.log.info({ user: user.id }, 'naver unlinked');
    return { ok: true };
  });

  // 네이버가 돌려보내는 주소 (네이버 개발자센터의 Callback URL)
  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>('/naver/callback', async (req, reply) => {
    const cookie = readCookie(req);
    clearStateCookie(reply);
    const fail = (error: 'cancelled' | 'expired' | 'failed', next = '/') =>
      cookie?.mode === 'link' ? toAccount(reply, `naver_error=${error}`) : toLogin(reply, next, error);

    const state = req.query.state ?? '';
    const p = state ? pending.get(state) : undefined;
    if (state) pending.delete(state);
    if (!cookie || !p || !sameString(cookie.state, state) || cookie.mode !== p.mode || p.exp < Date.now()) return fail('expired');

    // 사용자가 네이버 동의 화면에서 취소
    if (req.query.error || !req.query.code) return fail('cancelled', p.next);

    let naver: { id: string; email: string | null };
    try {
      naver = await fetchNaverProfile(req.query.code, state);
    } catch (e) {
      req.log.error(e, 'naver oauth failed');
      return fail('failed', p.next);
    }

    try {
      const owner = await findByNaverId(naver.id);

      if (p.mode === 'link') {
        if (owner && owner.id !== p.userId) return toAccount(reply, 'naver_error=taken');
        const link: NaverLink = { id: naver.id, email: naver.email, linked_at: new Date().toISOString() };
        const { error } = await admin.auth.admin.updateUserById(p.userId!, { app_metadata: { naver: link } });
        if (error) throw error;
        req.log.info({ user: p.userId }, 'naver linked');
        return toAccount(reply, 'naver=linked');
      }

      if (!owner?.email) return toLogin(reply, p.next, 'not_linked');
      const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: owner.email });
      if (error) throw error;
      req.log.info({ user: owner.id }, 'naver login');
      return reply.redirect(loginUrl(p.next, `naver_token=${encodeURIComponent(data.properties.hashed_token)}`));
    } catch (e) {
      req.log.error(e, 'naver link/login failed');
      return fail('failed', p.next);
    }
  });
}
