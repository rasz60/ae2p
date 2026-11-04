// Claude 작업실 API: 관리자가 채팅(글 · 이미지 · 파일)으로 요청하면 Claude Agent SDK 가 작업 폴더의 코드를 고치고
// 타입체크 · 빌드 · pm2 재기동까지 한다. 테스트 서버에서만 켠다 (.env BUILDER_ENABLED=true).
// Caddy: /api/builder/* → 127.0.0.1:BUILDER_PORT (접두어를 떼고 넘긴다, 응답은 SSE 라 버퍼링 없이)
//
// 안전장치: 관리자만 · 한 번에 하나의 작업 · 작업 폴더 밖/.env/SSH 키 접근 차단 · 위험한 셸 명령 차단(PreToolUse 훅)
//           · Claude 프로세스에는 비밀 환경변수를 넘기지 않음 · 요청당 비용/턴 상한.
// 훅의 명령 차단은 실수를 막는 장치이지 완전한 격리는 아니다 — 그래서 운영 서버가 아니라 테스트 서버에서만 돌린다.
import {
  getSessionMessages,
  listSessions,
  query,
  type EffortLevel,
  type HookCallback,
  type Query,
  type SDKMessage,
  type SDKUserMessage,
} from '@anthropic-ai/claude-agent-sdk';
import multipart from '@fastify/multipart';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { requireAdmin } from './common';

if (process.env.BUILDER_ENABLED !== 'true') {
  console.error('Claude 작업실은 BUILDER_ENABLED=true 일 때만 켜집니다 (테스트 서버 전용).');
  process.exit(1);
}

const SELF = 'ae2p-builder'; // pm2 앱 이름 (ecosystem.config.cjs)
const WORK_DIR = path.resolve(process.env.BUILDER_WORK_DIR || process.cwd());
const UPLOAD_DIR = path.resolve(process.env.BUILDER_UPLOAD_DIR || path.join(WORK_DIR, '..', 'builder-uploads'));
// 작업 폴더 말고 더 열어 줄 폴더 (예: 다른 앱 저장소). 쉼표로 구분한 절대 경로
const EXTRA_DIRS = (process.env.BUILDER_EXTRA_DIRS ?? '').split(',').map((d) => d.trim()).filter(Boolean).map((d) => path.resolve(d));
const ROOTS = [WORK_DIR, UPLOAD_DIR, ...EXTRA_DIRS];
const MODEL = process.env.BUILDER_MODEL || 'claude-opus-5-5';
const EFFORT = (process.env.BUILDER_EFFORT || 'high') as EffortLevel;
const MAX_BUDGET_USD = Number(process.env.BUILDER_MAX_BUDGET_USD || 5);
const MAX_TURNS = Number(process.env.BUILDER_MAX_TURNS || 100);

// Claude 프로세스(그리고 그 안의 Bash)에 넘기지 않을 환경변수. ANTHROPIC_API_KEY 는 Claude 가 써야 하므로 남긴다.
// 빈 ANTHROPIC_* 값(.env 의 `ANTHROPIC_API_KEY=`)은 빼야 구독 로그인으로 넘어간다
const SECRET_ENV = /SERVICE_ROLE|SECRET|PASSWORD|PRIVATE|DATABASE_URL/i;
const claudeEnv: Record<string, string> = {};
for (const [k, v] of Object.entries(process.env)) {
  if (v === undefined || SECRET_ENV.test(k) || (v === '' && k.startsWith('ANTHROPIC_'))) continue;
  claudeEnv[k] = v;
}

const SYSTEM_APPEND = `
## 작업실 환경 (ae2p 테스트 서버)
- 관리자가 웹 화면(포털 > Claude 작업실)에서 채팅으로 요청한다. 물어볼 것이 있으면 답변 글로 묻는다 — 관리자는 다음 메시지로 답한다.
- 작업 폴더: ${WORK_DIR}${EXTRA_DIRS.length ? ` (추가로 열린 폴더: ${EXTRA_DIRS.join(', ')})` : ''}. 이 밖의 파일과 .env · SSH 키 같은 비밀 값은 다룰 수 없다 (훅이 막는다).
- 첨부 파일은 ${UPLOAD_DIR} 에 저장되고 메시지 끝에 경로가 적힌다. 이미지는 메시지에 함께 들어 있다.
- 바꾼 뒤에는 확인까지 한다: npm run typecheck → npm run build → 필요하면 재기동. 웹(dist)만 바뀌었으면 빌드로 충분하다.
- 재기동은 앱 하나씩: \`pm2 restart <앱 이름>\` (예: ae2p-portal-api), .env 를 다시 읽혀야 하면 \`pm2 startOrReload ecosystem.config.cjs --only <앱 이름> --update-env\`. ecosystem 전체 · all 재시작과 scripts/deploy.sh 는 작업실까지 끊기므로 막혀 있다. 로그는 \`pm2 logs <앱 이름> --lines 50 --nostream\`.
- \`${SELF}\`(이 작업실 자신)는 재시작하지 않는다. server/builder.ts · server/common.ts 처럼 작업실이 쓰는 코드를 바꿨다면, 빌드 후 관리자에게 화면의 "작업실 재시작" 버튼을 눌러 달라고 알린다.
- sudo, git push, 다른 서버 접속은 막혀 있다. 커밋은 해도 되지만 push 는 관리자가 한다.
- 끝나면 무엇을 바꿨는지, 어떻게 확인했는지, 관리자가 브라우저에서 볼 것을 한국어로 짧게 정리한다.
${process.env.BUILDER_NOTES ? `\n${process.env.BUILDER_NOTES}\n` : ''}`;

// ── 도구 사용 검사 (PreToolUse 훅) ──

const BASH_DENY: [RegExp, string][] = [
  [/\bsudo\b|(^|[;&|]\s*)su\s/, '관리자 권한(sudo) 명령은 쓸 수 없어요.'],
  [/(?<![\w$])\.env(?![\w-]|\.example)/, '.env(비밀 값) 파일은 다룰 수 없어요.'],
  [/(^|[;&|]\s*)(printenv|env)\s*($|[|;&>])|\/proc\/\S*environ/, '환경변수 전체를 출력할 수 없어요.'],
  [/\brm\s+(-\w+\s+)*(\/|~|\$HOME)\/?(\*)?(\s|$)/, '루트 · 홈 폴더 삭제는 막혀 있어요.'],
  [/\b(shutdown|reboot|halt|poweroff|mkfs|fdisk|iptables)\b|\bdd\s+if=/, '시스템 명령은 쓸 수 없어요.'],
  [/\bpm2\s+(delete|kill|unstartup|update|deploy)\b/, 'pm2 프로세스 삭제 · 종료는 막혀 있어요. restart / reload 를 쓰세요.'],
  [new RegExp(`\\b${SELF}\\b`), `작업실(${SELF}) 자신은 건드릴 수 없어요. 관리자에게 화면의 "작업실 재시작" 버튼을 눌러 달라고 하세요.`],
  // ecosystem 전체 · all 재시작과 deploy.sh 는 작업실까지 재시작해 지금 작업이 끊긴다
  [
    /\bpm2\s+(start|startOrReload|startOrRestart|reload|restart)\b(?![^;&|]*--only)[^;&|]*(\becosystem\S*|\ball\b)|\bdeploy\.sh\b/,
    `작업실까지 재시작되는 명령이에요. \`pm2 restart <앱 이름>\` 이나 \`pm2 startOrReload ecosystem.config.cjs --only <앱 이름> --update-env\` 를 쓰세요.`,
  ],
  [/\bgit\s+push\b/, 'git push 는 관리자가 직접 해요.'],
  [/\b(curl|wget)\b[^|]*\|\s*(ba|z)?sh\b/, '내려받은 스크립트를 바로 실행할 수 없어요.'],
  [/\b(ssh|scp|sftp|rsync)\b/, '다른 서버 접속은 막혀 있어요.'],
  [/\.ssh\b|id_(rsa|ed25519)/, 'SSH 키는 다룰 수 없어요.'],
];
const SECRET_PATH = /(^|[\\/])\.env($|\.(?!example$))|[\\/]\.ssh([\\/]|$)|\.pem$/;

function inRoots(abs: string) {
  return ROOTS.some((r) => abs === r || abs.startsWith(r + path.sep));
}

/** 막을 이유가 있으면 그 이유를, 아니면 null */
function check(tool: string, input: Record<string, unknown>): string | null {
  if (tool === 'Bash') {
    const cmd = String(input.command ?? '');
    for (const [re, msg] of BASH_DENY) if (re.test(cmd)) return msg;
    return null;
  }
  for (const key of ['file_path', 'notebook_path', 'path']) {
    const v = input[key];
    if (typeof v !== 'string' || !v) continue;
    const abs = path.resolve(WORK_DIR, v);
    if (SECRET_PATH.test(abs)) return '비밀 값 파일(.env · SSH 키)은 열 수 없어요.';
    if (!inRoots(abs)) return `작업 폴더(${WORK_DIR}) 밖은 다룰 수 없어요.`;
  }
  return null;
}

const guard: HookCallback = async (input) => {
  if (input.hook_event_name !== 'PreToolUse') return {};
  const reason = check(input.tool_name, (input.tool_input ?? {}) as Record<string, unknown>);
  if (!reason) return {};
  app.log.warn({ tool: input.tool_name, input: input.tool_input, reason }, 'tool denied');
  return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } };
};

// ── 화면으로 보내는 이벤트 ──

type BuilderEvent =
  | { type: 'session'; sessionId: string }
  | { type: 'user'; text: string; files: string[] }
  | { type: 'text'; text: string }
  | { type: 'tool'; id: string; name: string; summary: string }
  | { type: 'tool_result'; id: string; ok: boolean; output: string }
  | { type: 'result'; ok: boolean; costUsd: number; turns: number; ms: number; error?: string }
  | { type: 'error'; message: string }
  | { type: 'done' };

const rel = (p: string) => (p.startsWith(WORK_DIR + path.sep) ? p.slice(WORK_DIR.length + 1) : p);
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}\n… (${s.length - n}자 생략)` : s);

function summarize(name: string, input: unknown): string {
  const i = (input ?? {}) as Record<string, unknown>;
  if (name === 'Bash') return String(i.command ?? '');
  for (const k of ['file_path', 'notebook_path', 'pattern', 'path', 'url', 'query', 'description', 'prompt']) {
    if (typeof i[k] === 'string') return rel(i[k] as string);
  }
  return clip(JSON.stringify(i), 200);
}

function resultText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((b: { type?: string; text?: string }) => (b.type === 'text' ? b.text : b.type === 'image' ? '[이미지]' : '')).join('\n');
  }
  return '';
}

/** SDK 메시지(실시간) 또는 저장된 세션 메시지(기록) → 화면 이벤트. withUserText: 기록에서는 사용자 글도 보여 준다 */
function toEvents(type: string, message: unknown, withUserText: boolean): BuilderEvent[] {
  const content = (message as { content?: unknown })?.content;
  const out: BuilderEvent[] = [];
  if (type === 'assistant' && Array.isArray(content)) {
    for (const b of content) {
      if (b.type === 'text' && b.text?.trim()) out.push({ type: 'text', text: b.text });
      else if (b.type === 'tool_use') out.push({ type: 'tool', id: b.id, name: b.name, summary: summarize(b.name, b.input) });
    }
  } else if (type === 'user') {
    if (typeof content === 'string') {
      if (withUserText) out.push({ type: 'user', text: content, files: [] });
    } else if (Array.isArray(content)) {
      const texts: string[] = [];
      let images = 0;
      for (const b of content) {
        if (b.type === 'tool_result') out.push({ type: 'tool_result', id: b.tool_use_id, ok: !b.is_error, output: clip(resultText(b.content), 3000) });
        else if (b.type === 'text') texts.push(b.text);
        else if (b.type === 'image') images++;
      }
      if (withUserText && (texts.length || images)) {
        out.push({ type: 'user', text: texts.join('\n'), files: Array.from({ length: images }, (_, n) => `이미지 ${n + 1}`) });
      }
    }
  }
  return out;
}

// ── 작업 실행 (한 번에 하나) ──

interface Run {
  id: string;
  sessionId: string | null;
  events: BuilderEvent[];
  listeners: Set<(e: BuilderEvent) => void>;
  done: boolean;
  abort: AbortController;
  q: Query | null;
}
let current: Run | null = null;

function emit(run: Run, e: BuilderEvent) {
  run.events.push(e);
  for (const l of run.listeners) l(e);
}

function handle(run: Run, m: SDKMessage) {
  if ('session_id' in m && m.session_id && !run.sessionId) {
    run.sessionId = m.session_id;
    emit(run, { type: 'session', sessionId: m.session_id });
  }
  if (m.type === 'assistant' || m.type === 'user') {
    if (m.parent_tool_use_id) return; // 서브에이전트 안쪽 대화는 접는다
    for (const e of toEvents(m.type, m.message, false)) {
      if (e.type === 'tool') app.log.info({ run: run.id, tool: e.name, summary: e.summary }, 'tool');
      emit(run, e);
    }
  } else if (m.type === 'result') {
    const ok = m.subtype === 'success' && !m.is_error;
    emit(run, { type: 'result', ok, costUsd: m.total_cost_usd, turns: m.num_turns, ms: m.duration_ms, error: ok ? undefined : m.subtype });
  }
}

type UserContent = Exclude<Extract<SDKUserMessage['message'], { role: 'user' }>['content'], string>;

function startRun(content: UserContent, echo: BuilderEvent, sessionId: string | undefined): Run {
  const run: Run = { id: randomUUID(), sessionId: sessionId ?? null, events: [], listeners: new Set(), done: false, abort: new AbortController(), q: null };
  current = run;
  emit(run, echo);
  if (sessionId) emit(run, { type: 'session', sessionId });

  async function* prompt(): AsyncGenerator<SDKUserMessage> {
    yield { type: 'user', message: { role: 'user', content }, parent_tool_use_id: null, origin: { kind: 'human' } };
  }
  const q = query({
    prompt: prompt(),
    options: {
      cwd: WORK_DIR,
      additionalDirectories: [UPLOAD_DIR, ...EXTRA_DIRS],
      resume: sessionId,
      model: MODEL,
      effort: EFFORT,
      maxTurns: MAX_TURNS,
      maxBudgetUsd: MAX_BUDGET_USD,
      abortController: run.abort,
      env: claudeEnv,
      // 검사는 훅이 하고, 훅을 통과한 도구는 묻지 않고 실행한다 (화면에서 하나하나 승인하지 않는다)
      permissionMode: 'default',
      hooks: { PreToolUse: [{ hooks: [guard] }] },
      canUseTool: async (_name, input) => ({ behavior: 'allow', updatedInput: input }),
      disallowedTools: ['AskUserQuestion'],
      settingSources: ['project'],
      systemPrompt: { type: 'preset', preset: 'claude_code', append: SYSTEM_APPEND },
      stderr: (d) => app.log.warn({ claude: d.trim() }, 'claude stderr'),
    },
  });
  run.q = q;

  (async () => {
    try {
      for await (const m of q) handle(run, m);
    } catch (e) {
      emit(run, { type: 'error', message: run.abort.signal.aborted ? '작업을 멈췄어요.' : (e as Error).message });
    } finally {
      run.done = true;
      emit(run, { type: 'done' });
      app.log.info({ run: run.id, session: run.sessionId }, 'run finished');
    }
  })();
  return run;
}

/** 진행 중(또는 막 끝난) 작업의 이벤트를 처음부터 SSE 로 흘려보낸다. 새로고침해도 이어서 볼 수 있다 */
function streamRun(run: Run, req: FastifyRequest, reply: FastifyReply) {
  reply.hijack();
  const res = reply.raw;
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const send = (e: BuilderEvent) => res.write(`data: ${JSON.stringify(e)}\n\n`);
  run.events.forEach(send);
  if (run.done) return res.end();
  const ping = setInterval(() => res.write(': ping\n\n'), 20_000);
  const listener = (e: BuilderEvent) => {
    send(e);
    if (e.type === 'done') res.end();
  };
  run.listeners.add(listener);
  res.on('close', () => {
    clearInterval(ping);
    run.listeners.delete(listener);
  });
  req.log.info({ run: run.id }, 'stream attached');
}

// ── API ──

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const INLINE_IMAGE_MAX = 4.5 * 1024 * 1024; // API 이미지 한도(5MB) 아래만 메시지에 직접 넣고, 큰 건 경로만 알려 준다
const safeName = (n: string) => n.replace(/[^\w.\-가-힣]+/g, '_').slice(-80) || 'file';

const app = Fastify({ logger: { level: 'info' }, trustProxy: true });
await app.register(multipart, { limits: { fileSize: 20 * 1024 * 1024, files: 10 } });

app.get('/health', async () => ({ ok: true }));

app.get('/status', { preHandler: requireAdmin }, async () => ({
  workDir: WORK_DIR,
  model: MODEL,
  // API 키가 없으면 서버의 Claude Code 로그인(구독 계정)을 쓴다. 이때 비용은 청구액이 아니라 API 요금 환산값이다
  auth: process.env.ANTHROPIC_API_KEY ? 'api_key' : 'login',
  maxBudgetUsd: MAX_BUDGET_USD,
  running: !!current && !current.done,
  sessionId: current?.sessionId ?? null,
}));

app.get('/sessions', { preHandler: requireAdmin }, async () => {
  const list = await listSessions({ dir: WORK_DIR, limit: 30 });
  return { sessions: list.map((s) => ({ id: s.sessionId, title: s.customTitle ?? s.summary, updatedAt: s.lastModified })) };
});

app.get<{ Params: { id: string } }>('/sessions/:id', { preHandler: requireAdmin }, async (req) => {
  const messages = await getSessionMessages(req.params.id, { dir: WORK_DIR });
  const events = messages.filter((m) => !m.parent_tool_use_id && m.type !== 'system').flatMap((m) => toEvents(m.type, m.message, true));
  return { events };
});

// 새 요청: multipart (text, sessionId?, files…) → 작업 시작 후 SSE 로 응답
app.post('/chat', { preHandler: requireAdmin }, async (req, reply) => {
  if (current && !current.done) return reply.code(409).send({ error: '이미 작업 중이에요. 끝나거나 멈춘 뒤에 보내 주세요.' });
  let text = '';
  let sessionId: string | undefined;
  const content: UserContent = [];
  const saved: string[] = [];
  const dir = path.join(UPLOAD_DIR, new Date().toISOString().slice(0, 10));
  for await (const part of req.parts()) {
    if (part.type === 'field') {
      if (part.fieldname === 'text') text = String(part.value ?? '');
      if (part.fieldname === 'sessionId' && part.value) sessionId = String(part.value);
      continue;
    }
    const buf = await part.toBuffer();
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, `${Date.now()}-${safeName(part.filename)}`);
    await writeFile(file, buf);
    saved.push(file);
    if (IMAGE_TYPES.has(part.mimetype) && buf.length <= INLINE_IMAGE_MAX) {
      const media_type = part.mimetype as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
      content.push({ type: 'image', source: { type: 'base64', media_type, data: buf.toString('base64') } });
    }
  }
  if (!text.trim() && saved.length === 0) return reply.code(400).send({ error: '내용을 입력하거나 파일을 첨부해 주세요.' });
  if (current && !current.done) return reply.code(409).send({ error: '이미 작업 중이에요.' });

  const note = saved.length ? `\n\n[첨부 파일 — 서버에 저장됨]\n${saved.map((f) => `- ${f}`).join('\n')}` : '';
  content.push({ type: 'text', text: (text.trim() || '첨부한 파일을 확인해 줘.') + note });
  req.log.info({ by: req.user.email, session: sessionId, files: saved.length, text: text.slice(0, 200) }, 'chat');
  const run = startRun(content, { type: 'user', text, files: saved.map((f) => path.basename(f)) }, sessionId);
  streamRun(run, req, reply);
});

// 진행 중인 작업에 다시 붙기 (새로고침 · 다른 기기)
app.get('/run/stream', { preHandler: requireAdmin }, async (req, reply) => {
  if (!current) return reply.code(404).send({ error: '진행 중인 작업이 없어요.' });
  streamRun(current, req, reply);
});

app.post('/run/stop', { preHandler: requireAdmin }, async (req) => {
  const run = current;
  if (!run || run.done) return { ok: true };
  req.log.info({ by: req.user.email, run: run.id }, 'stop');
  await run.q?.interrupt().catch(() => undefined);
  // 멈춤 요청을 받지 않으면 프로세스를 끊는다
  setTimeout(() => !run.done && run.abort.abort(), 5_000);
  return { ok: true };
});

// 작업실 자신의 재시작 (작업실 코드를 바꾼 뒤). 응답을 보낸 다음 pm2 가 이 프로세스를 다시 띄운다
app.post('/restart-self', { preHandler: requireAdmin }, async (req, reply) => {
  if (current && !current.done) return reply.code(409).send({ error: '작업이 끝난 뒤에 재시작해 주세요.' });
  req.log.info({ by: req.user.email }, 'restart-self');
  setTimeout(() => spawn('pm2', ['restart', SELF], { detached: true, stdio: 'ignore', shell: process.platform === 'win32' }).unref(), 300);
  return { ok: true };
});

const port = Number(process.env.BUILDER_PORT ?? 8095);
const host = process.env.HOST ?? '127.0.0.1';
app.listen({ port, host }).then(() => app.log.info({ workDir: WORK_DIR, model: MODEL }, 'Claude 작업실 준비'));
