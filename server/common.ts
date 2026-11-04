// 포털 API(index.ts)와 Claude 작업실(builder.ts)이 같이 쓰는 것: .env 읽기 · service_role 클라이언트 · 관리자 확인
import { createClient, type User } from '@supabase/supabase-js';
import type { FastifyReply, FastifyRequest } from 'fastify';

export function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} 가 필요합니다 (.env)`);
  return v;
}

export const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

declare module 'fastify' {
  interface FastifyRequest {
    user: User;
  }
}

/** Authorization: Bearer <access token> 를 검증하고, app_metadata.role 이 admin 인지 본다 */
export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return reply.code(401).send({ error: '로그인이 필요해요.' });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return reply.code(401).send({ error: '로그인이 필요해요.' });
  if (data.user.app_metadata.role !== 'admin') return reply.code(403).send({ error: '관리자만 할 수 있어요.' });
  req.user = data.user;
}
