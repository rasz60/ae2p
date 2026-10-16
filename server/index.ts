// 포털 API: 초대 · 계정 목록 · 계정 삭제 (관리자만)
// service_role 키가 필요한 일만 여기서 한다. 나머지(로그인·비밀번호)는 웹이 Supabase 에 직접.
// Caddy: /api/portal/* → 127.0.0.1:PORT (접두어를 떼고 넘긴다)
import { createClient, type User } from '@supabase/supabase-js';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} 가 필요합니다 (.env)`);
  return v;
}

const PUBLIC_URL = env('PUBLIC_URL').replace(/\/$/, '');
const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

declare module 'fastify' {
  interface FastifyRequest {
    user: User;
  }
}

/** Authorization: Bearer <access token> 를 검증하고, app_metadata.role 이 admin 인지 본다 */
async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return reply.code(401).send({ error: '로그인이 필요해요.' });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return reply.code(401).send({ error: '로그인이 필요해요.' });
  if (data.user.app_metadata.role !== 'admin') return reply.code(403).send({ error: '관리자만 할 수 있어요.' });
  req.user = data.user;
}

const app = Fastify({ logger: { level: 'info' }, trustProxy: true });

app.get('/health', async () => ({ ok: true }));

app.get('/users', { preHandler: requireAdmin }, async (_req, reply) => {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) return reply.code(500).send({ error: error.message });
  const users = data.users
    .map((u) => ({
      id: u.id,
      email: u.email ?? '',
      role: u.app_metadata.role === 'admin' ? 'admin' : 'user',
      providers: ((u.app_metadata.providers as string[] | undefined) ?? []).filter((p) => p !== 'email'),
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

const port = Number(process.env.PORT ?? 8090);
const host = process.env.HOST ?? '127.0.0.1';
app.listen({ port, host }).catch((e) => {
  app.log.error(e);
  process.exit(1);
});
