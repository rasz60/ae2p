// 공용 테스터 계정 (P-0004)
//   POST /tester/login   로그인 화면의 '테스터로 입장하기'. TESTER_EMAIL 계정의 1회용 로그인 토큰을 준다 (네이버 로그인과 같은 방식)
//   GET  /tester/state   (관리자) 테스터 계정 상태: 잠김 · 편집 중 · 기본 데이터 기준 시각
//   POST /tester/state   (관리자) { action: 'assign' | 'edit' | 'lock' } 테스터 지정 · 기본 데이터 편집 시작 · 잠그기
//
// 계정 표시는 app_metadata 에 둔다 (사용자가 스스로 못 바꾼다). 각 앱 DB 트리거가 이 값을 읽는다.
//   role = 'tester', tester_editing = true(편집 중), tester_baseline_at = 마지막 잠그기 시각
// 잠그기 전에 만든 데이터 = 기본 데이터(테스터가 못 바꿈), 뒤에 만든 데이터 = 로그아웃 · 매일 새벽에 지워짐.
import type { User } from '@supabase/supabase-js';
import type { FastifyInstance } from 'fastify';
import { admin, requireAdmin } from './common';

const TESTER_EMAIL = (process.env.TESTER_EMAIL ?? '').trim().toLowerCase();
const PER_HOUR = Number(process.env.TESTER_LOGIN_PER_HOUR ?? 20) || 20;
const HOUR_MS = 60 * 60 * 1000;

export const isTesterUser = (u: User) => u.app_metadata.role === 'tester';

/** IP 당 시간당 입장 횟수 (서버 메모리, 재시작하면 비워진다) */
const hits = new Map<string, number[]>();
function allow(ip: string): boolean {
  const now = Date.now();
  if (hits.size > 5000) hits.clear();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < HOUR_MS);
  const ok = recent.length < PER_HOUR;
  if (ok) recent.push(now);
  hits.set(ip, recent);
  return ok;
}

/** TESTER_EMAIL 계정 찾기 (초대제라 사용자가 적어 전체를 훑는다) */
async function findTesterAccount(): Promise<User | null> {
  if (!TESTER_EMAIL) return null;
  const perPage = 1000;
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === TESTER_EMAIL);
    if (hit) return hit;
    if (data.users.length < perPage) return null;
  }
}

const stateOf = (u: User | null) => ({
  email: TESTER_EMAIL,
  found: !!u,
  isTester: !!u && isTesterUser(u),
  editing: u?.app_metadata.tester_editing === true,
  baselineAt: (u?.app_metadata.tester_baseline_at as string | undefined) ?? null,
});

export function testerRoutes(app: FastifyInstance) {
  if (!TESTER_EMAIL) app.log.warn('TESTER_EMAIL 이 없어 테스터 입장을 끕니다');

  app.post('/tester/login', async (req, reply) => {
    if (!TESTER_EMAIL) return reply.code(503).send({ error: '테스터 입장이 준비되지 않았어요.' });
    if (!allow(req.ip)) return reply.code(429).send({ error: '잠시 뒤에 다시 시도해 주세요.' });
    try {
      const tester = await findTesterAccount();
      // 다른 계정의 로그인 토큰을 만들지 않도록, 테스터로 지정된 계정만 연다
      if (!tester?.email || !isTesterUser(tester)) return reply.code(403).send({ error: '테스터 계정이 준비되지 않았어요.' });
      const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: tester.email });
      if (error) throw error;
      req.log.info({ ip: req.ip }, 'tester login');
      return { token: data.properties.hashed_token };
    } catch (e) {
      req.log.error(e, 'tester login failed');
      return reply.code(500).send({ error: '테스터 입장에 실패했어요. 잠시 뒤 다시 시도해 주세요.' });
    }
  });

  app.get('/tester/state', { preHandler: requireAdmin }, async () => stateOf(await findTesterAccount()));

  app.post<{ Body: { action?: string } }>('/tester/state', { preHandler: requireAdmin }, async (req, reply) => {
    const action = req.body?.action;
    const tester = await findTesterAccount();
    if (!tester) return reply.code(404).send({ error: `${TESTER_EMAIL || 'TESTER_EMAIL'} 계정이 없어요. 먼저 초대해 주세요.` });
    if (tester.app_metadata.role === 'admin') return reply.code(400).send({ error: '관리자 계정은 테스터로 지정할 수 없어요.' });

    let meta: Record<string, unknown>;
    // tester_edit_started_at: 편집 중 정리는 이 시각 전에 남은 방문자 데이터만 지운다 (관리자가 넣는 기본 데이터는 남긴다)
    const now = new Date().toISOString();
    if (action === 'assign') meta = { role: 'tester', tester_editing: true, tester_edit_started_at: now, agent_share: null };
    else if (action === 'edit' && isTesterUser(tester)) meta = { tester_editing: true, tester_edit_started_at: now };
    else if (action === 'lock' && isTesterUser(tester)) meta = { tester_editing: null, tester_edit_started_at: null, tester_baseline_at: now };
    else return reply.code(400).send({ error: '먼저 테스터로 지정해 주세요.' });

    const { data, error } = await admin.auth.admin.updateUserById(tester.id, { app_metadata: meta });
    if (error) return reply.code(500).send({ error: error.message });
    req.log.info({ by: req.user.email, action }, 'tester state');
    return stateOf(data.user);
  });
}
