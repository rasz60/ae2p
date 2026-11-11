import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent, type FormEvent, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { UserMenu } from '../components/UserMenu';
import { builderApi, builderStream } from '../lib/api';

// server/builder.ts 의 BuilderEvent 와 같은 모양
type BuilderEvent =
  | { type: 'session'; sessionId: string }
  | { type: 'user'; text: string; files: string[] }
  | { type: 'text'; text: string }
  | { type: 'tool'; id: string; name: string; summary: string }
  | { type: 'tool_result'; id: string; ok: boolean; output: string }
  | { type: 'result'; ok: boolean; costUsd: number; turns: number; ms: number; error?: string }
  | { type: 'error'; message: string }
  | { type: 'done' };

interface Status {
  workDir: string;
  model: string;
  auth: 'api_key' | 'login';
  maxBudgetUsd: number;
  running: boolean;
  sessionId: string | null;
}

interface Session {
  id: string;
  title: string;
  updatedAt: number;
}

const RESULT_ERRORS: Record<string, string> = {
  error_max_turns: '최대 턴 수에 닿아 멈췄어요',
  error_max_budget_usd: '비용 상한에 닿아 멈췄어요',
  error_during_execution: '실행 중 오류로 멈췄어요',
};

const when = (ms: number) =>
  new Date(ms).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const duration = (ms: number) => (ms < 60_000 ? `${Math.round(ms / 1000)}초` : `${Math.floor(ms / 60_000)}분 ${Math.round((ms % 60_000) / 1000)}초`);

/** Claude 답변: ``` 코드 블록만 나누고 나머지는 줄바꿈을 살려 그대로 보여 준다 */
function Prose({ text }: { text: string }) {
  const parts = text.split(/```[\w-]*\n?/);
  return (
    <div className="bd-prose">
      {parts.map((p, i) => (i % 2 ? <pre key={i}>{p.replace(/\n$/, '')}</pre> : p.trim() && <p key={i}>{p.trim()}</p>))}
    </div>
  );
}

/** Claude 작업실 (관리자, 테스트 서버): 채팅 · 이미지 · 파일로 요청하면 Claude 가 코드를 고치고 빌드 · 재기동한다 */
export function Builder() {
  const [status, setStatus] = useState<Status | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [events, setEvents] = useState<BuilderEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const loadSessions = useCallback(() => {
    builderApi<{ sessions: Session[] }>('/sessions')
      .then((r) => setSessions(r.sessions))
      .catch(() => undefined);
  }, []);

  /** 이벤트 스트림을 끝까지 읽는다 (새 요청 또는 진행 중인 작업에 다시 붙기) */
  const follow = useCallback(
    async (path: string, init: RequestInit = {}) => {
      setRunning(true);
      try {
        await builderStream<BuilderEvent>(path, init, (e) => {
          if (e.type === 'session') setSessionId(e.sessionId);
          setEvents((prev) => [...prev, e]);
        });
      } catch (err) {
        setError((err as Error).message);
      }
      setRunning(false);
      loadSessions();
    },
    [loadSessions],
  );

  useEffect(() => {
    builderApi<Status>('/status')
      .then((s) => {
        setStatus(s);
        if (s.running) follow('/run/stream');
      })
      .catch((e: Error) => setError(`작업실에 연결하지 못했어요. 테스트 서버에서만 열려요. (${e.message})`));
    loadSessions();
  }, [follow, loadSessions]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [events]);

  async function openSession(id: string | null) {
    if (running) return;
    setError('');
    setNotice('');
    setSessionId(id);
    setEvents([]);
    if (!id) return;
    try {
      const r = await builderApi<{ events: BuilderEvent[] }>(`/sessions/${id}`);
      setEvents(r.events);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function send(e?: FormEvent) {
    e?.preventDefault();
    if (running || (!text.trim() && files.length === 0)) return;
    setError('');
    setNotice('');
    const form = new FormData();
    form.append('text', text);
    if (sessionId) form.append('sessionId', sessionId);
    for (const f of files) form.append('files', f, f.name);
    setText('');
    setFiles([]);
    await follow('/chat', { method: 'POST', body: form });
  }

  async function stop() {
    try {
      await builderApi('/run/stop', { method: 'POST' });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function restartSelf() {
    if (!window.confirm('작업실 서버를 재시작할까요? 작업실 코드를 바꾼 뒤에만 필요해요.')) return;
    try {
      await builderApi('/restart-self', { method: 'POST' });
      setNotice('재시작했어요. 몇 초 뒤에 새로고침해 주세요.');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const addFiles = (list: FileList | File[]) => setFiles((prev) => [...prev, ...Array.from(list)].slice(0, 10));
  const onPaste = (e: ClipboardEvent) => e.clipboardData.files.length && (e.preventDefault(), addFiles(e.clipboardData.files));
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send();
  };

  // 도구 호출 옆에 결과를 붙여 보여 준다
  const results = useMemo(() => {
    const m = new Map<string, Extract<BuilderEvent, { type: 'tool_result' }>>();
    for (const e of events) if (e.type === 'tool_result') m.set(e.id, e);
    return m;
  }, [events]);

  return (
    <div className="page">
      <header className="topbar">
        <Link to="/" aria-label="홈">
          <Brand kind="mark" height={30} />
        </Link>
        <UserMenu />
      </header>
      <main className="builder">
        <aside className="card bd-side">
          <div className="bd-side-head">
            <h2>대화</h2>
            <button className="btn btn-ghost bd-small" disabled={running} onClick={() => openSession(null)}>
              새 대화
            </button>
          </div>
          <ul className="bd-sessions">
            {sessions.map((s) => (
              <li key={s.id}>
                <button className={s.id === sessionId ? 'active' : ''} disabled={running} onClick={() => openSession(s.id)}>
                  <span className="bd-session-title">{s.title || '제목 없음'}</span>
                  <span className="bd-session-meta">{when(s.updatedAt)}</span>
                </button>
              </li>
            ))}
            {sessions.length === 0 && <li className="muted bd-empty">아직 대화가 없어요.</li>}
          </ul>
          {status && (
            <div className="bd-env">
              <span>작업 폴더 {status.workDir}</span>
              <span>
                {status.model} · {status.auth === 'login' ? '구독 계정 로그인' : 'API 키'}
              </span>
              <span>
                {status.auth === 'login'
                  ? `요청당 작업량 상한: API 요금 환산 $${status.maxBudgetUsd} (청구되지 않음)`
                  : `요청당 비용 상한 $${status.maxBudgetUsd}`}
              </span>
              <button className="link" onClick={restartSelf}>
                작업실 재시작
              </button>
            </div>
          )}
        </aside>

        <section className="card bd-chat">
          <div className="bd-log">
            {events.length === 0 && (
              <div className="bd-intro">
                <h1 className="page-title">Claude 작업실</h1>
                <p className="muted">
                  바꾸고 싶은 것을 말하거나 스크린샷 · 파일을 붙여 넣으세요. Claude 가 테스트 서버의 코드를 고치고, 빌드하고, 필요하면
                  재기동까지 해요.
                </p>
              </div>
            )}
            {events.map((e, i) => (
              <Fragment key={i}>
                {e.type === 'user' && (
                  <div className="bd-user">
                    {e.text && <p>{e.text}</p>}
                    {e.files.length > 0 && (
                      <div className="bd-files">
                        {e.files.map((f, n) => (
                          <span key={n} className="chip">
                            {f}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {e.type === 'text' && <Prose text={e.text} />}
                {e.type === 'tool' && (
                  <details className={`bd-tool ${results.get(e.id)?.ok === false ? 'bad' : ''}`}>
                    <summary>
                      <b>{e.name}</b> <code>{e.summary}</code>
                      {!results.has(e.id) && running && <span className="bd-spin" aria-label="실행 중" />}
                    </summary>
                    {results.get(e.id) && <pre>{results.get(e.id)!.output || '(출력 없음)'}</pre>}
                  </details>
                )}
                {e.type === 'result' && (
                  <p className={`bd-result ${e.ok ? '' : 'error'}`}>
                    {e.ok ? '완료' : (RESULT_ERRORS[e.error ?? ''] ?? '멈췄어요')} · {e.turns}턴 · {duration(e.ms)} · ${e.costUsd.toFixed(2)}
                    {status?.auth === 'login' && ' (API 요금 환산)'}
                  </p>
                )}
                {e.type === 'error' && <p className="error">{e.message}</p>}
              </Fragment>
            ))}
            {running && <p className="muted bd-working">작업 중이에요…</p>}
            <div ref={bottom} />
          </div>

          <form
            className={`bd-composer ${dragging ? 'drag' : ''}`}
            onSubmit={send}
            onDragOver={(e) => (e.preventDefault(), setDragging(true))}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            {error && <p className="error">{error}</p>}
            {notice && <p className="notice">{notice}</p>}
            {files.length > 0 && (
              <div className="bd-files">
                {files.map((f, n) => (
                  <button key={n} type="button" className="chip" onClick={() => setFiles(files.filter((_, k) => k !== n))} aria-label={`${f.name} 빼기`}>
                    {f.name} ✕
                  </button>
                ))}
              </div>
            )}
            <textarea
              rows={3}
              placeholder={sessionId ? '이어서 요청하기 (Ctrl+Enter 로 보내기)' : '무엇을 바꿀까요? 이미지는 붙여 넣거나 끌어다 놓아도 돼요. (Ctrl+Enter 로 보내기)'}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onPaste={onPaste}
              onKeyDown={onKeyDown}
              disabled={!status}
            />
            <div className="bd-actions">
              <input ref={fileInput} type="file" multiple hidden onChange={(e) => (e.target.files && addFiles(e.target.files), (e.target.value = ''))} />
              <button type="button" className="btn btn-ghost bd-small" onClick={() => fileInput.current?.click()} disabled={!status}>
                파일 첨부
              </button>
              {running ? (
                <button type="button" className="btn btn-ghost bd-small danger" onClick={stop}>
                  멈추기
                </button>
              ) : (
                <button className="btn btn-primary bd-small" disabled={!status || (!text.trim() && files.length === 0)}>
                  보내기
                </button>
              )}
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
