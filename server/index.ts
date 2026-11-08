// 포털 API: 초대 · 계정 목록 · 계정 삭제 · 에이전트 공유 (관리자만) + 네이버 로그인 (server/naver.ts) + 테스터 (server/tester.ts)
// service_role 키가 필요한 일만 여기서 한다. 나머지(로그인·비밀번호)는 웹이 Supabase 에 직접.
// Caddy: /api/portal/* → 127.0.0.1:PORT (접두어를 떼고 넘긴다)
import Fastify from 'fastify';
import { admin, env, requireAdmin } from './common';
import { naverLinkOf, naverRoutes } from './naver';
import { testerRoutes } from './tester';

const PUBLIC_URL = env('PUBLIC_URL').replace(/\/$/, '');

const app = Fastify({ logger: { level: 'info' }, trustProxy: true });

app.get('/health', async () => ({ ok: true }));

app.get('/users', { preHandler: requireAdmin }, async (_req, reply) => {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) return reply.code(500).send({ error: error.message });
  const users = data.users
    .map((u) => ({
      id: u.id,
      email: u.email ?? '',
      role: u.app_metadata.role === 'admin' ? 'admin' : u.app_metadata.role === 'tester' ? 'tester' : 'user',
      // 관리자가 에이전트를 공유한 멤버 (관리자는 항상 본다)
      agent_share: u.app_metadata.agent_share === true,
      providers: [
        ...((u.app_metadata.providers as string[] | undefined) ?? []).filter((p) => p !== 'email'),
        // 네이버는 Supabase 공급자가 아니라 포털이 app_metadata.naver 에 따로 저장한다 (server/naver.ts)
        ...(naverLinkOf(u) ? ['naver'] : []),
      ],
      // 초대만 받고 아직 한 번도 로그인하지 않은 계정
      status: u.last_sign_in_at ? 'active' : 'invited',
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
    }))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  return { users };
});

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post<{ Body: { email?: string } }>('/invite', { preHandler: requireAdmin }, async (req, reply) => {
  const email = req.body?.email?.trim().toLowerCase() ?? '';
  if (!EMAIL.test(email)) return reply.code(400).send({ error: '이메일 형식을 확인해 주세요.' });
  const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: `${PUBLIC_URL}/set-password` });
  if (error) {
    const msg = /already/i.test(error.message) ? '이미 가입했거나 초대한 이메일이에요.' : error.message;
    return reply.code(400).send({ error: msg });
  }
  req.log.info({ by: req.user.email, email }, 'invited');
  return { ok: true };
});

app.delete<{ Params: { id: string } }>('/users/:id', { preHandler: requireAdmin }, async (req, reply) => {
  if (req.params.id === req.user.id) return reply.code(400).send({ error: '자기 계정은 삭제할 수 없어요.' });
  const { error } = await admin.auth.admin.deleteUser(req.params.id);
  if (error) return reply.code(400).send({ error: error.message });
  req.log.info({ by: req.user.email, id: req.params.id }, 'user deleted');
  return { ok: true };
});

// 에이전트 공유 (P-0004): 켜면 그 멤버에게 에이전트 메뉴가 보이고 픽셀 오피스를 같이 본다. 로그 · 알림은 각자 자기 잡 것만
app.put<{ Params: { id: string }; Body: { enabled?: boolean } }>('/users/:id/agent', { preHandler: requireAdmin }, async (req, reply) => {
  const { data, error } = await admin.auth.admin.getUserById(req.params.id);
  if (error || !data.user) return reply.code(404).send({ error: '계정을 찾을 수 없어요.' });
  const role = data.user.app_metadata.role;
  if (role === 'admin') return reply.code(400).send({ error: '관리자는 항상 에이전트를 볼 수 있어요.' });
  if (role === 'tester') return reply.code(400).send({ error: '테스터 계정에는 에이전트를 공유할 수 없어요.' });
  const enabled = req.body?.enabled === true;
  const res = await admin.auth.admin.updateUserById(req.params.id, { app_metadata: { agent_share: enabled ? true : null } });
  if (res.error) return reply.code(500).send({ error: res.error.message });
  req.log.info({ by: req.user.email, id: req.params.id, enabled }, 'agent share');
  return { ok: true, agent_share: enabled };
});

naverRoutes(app);
testerRoutes(app);

const port = Number(process.env.PORT ?? 8090);
const host = process.env.HOST ?? '127.0.0.1';
app.listen({ port, host }).catch((e) => {
  app.log.error(e);
  process.exit(1);
});
