import { authorizeHealth, healthAvailable, readWorkouts } from './health';

// 웹 ↔ 앱 다리. 웹 페이지에는 window.aepNative 가 생긴다:
//   aepNative.features.health          Apple 건강을 읽을 수 있는지
//   aepNative.call('health.authorize')  읽기 권한 묻기
//   aepNative.call('health.workouts', { since: ISO 시각 })  → IngestWorkout[]
// 웹은 이 값이 있으면 앱 안이라고 보고 기능을 켠다 (운동기록의 appleHealth.ts).

export const APP_VERSION = '1.0.0';

/** 페이지가 뜨기 전에 넣는 스크립트 */
export const bridgeScript = (): string => `
(function () {
  if (window.aepNative) return;
  var pending = {};
  var seq = 0;
  window.aepNative = {
    platform: 'ios',
    version: ${JSON.stringify(APP_VERSION)},
    features: { health: ${healthAvailable() ? 'true' : 'false'} },
    call: function (method, params) {
      return new Promise(function (resolve, reject) {
        var id = ++seq;
        pending[id] = { resolve: resolve, reject: reject };
        window.ReactNativeWebView.postMessage(JSON.stringify({ aep: 1, id: id, method: method, params: params || {} }));
      });
    },
    _settle: function (id, ok, value) {
      var p = pending[id];
      if (!p) return;
      delete pending[id];
      if (ok) p.resolve(value); else p.reject(new Error(value));
    }
  };
})();
true;`;

interface Request {
  aep: 1;
  id: number;
  method: string;
  params: Record<string, unknown>;
}

export const parseRequest = (data: string): Request | null => {
  try {
    const msg = JSON.parse(data) as Partial<Request>;
    return msg.aep === 1 && typeof msg.id === 'number' && typeof msg.method === 'string' ? (msg as Request) : null;
  } catch {
    return null;
  }
};

const handlers: Record<string, (params: Record<string, unknown>) => Promise<unknown>> = {
  'health.authorize': async () => {
    if (!healthAvailable()) throw new Error('이 기기에서는 Apple 건강을 쓸 수 없어요.');
    await authorizeHealth();
    return true;
  },
  'health.workouts': async (params) => {
    if (!healthAvailable()) throw new Error('이 기기에서는 Apple 건강을 쓸 수 없어요.');
    const since = typeof params.since === 'string' ? new Date(params.since) : new Date(Date.now() - 90 * 86_400_000);
    if (Number.isNaN(since.getTime())) throw new Error('since 가 올바른 시각이 아니에요.');
    return readWorkouts(since);
  },
};

/** 요청을 처리하고, 페이지에 돌려줄 스크립트를 만든다 */
export const handleRequest = async (req: Request): Promise<string> => {
  const handler = handlers[req.method];
  let ok = false;
  let value: unknown;
  try {
    if (!handler) throw new Error(`모르는 기능이에요: ${req.method}`);
    value = await handler(req.params);
    ok = true;
  } catch (err) {
    value = err instanceof Error ? err.message : String(err);
  }
  return `window.aepNative && window.aepNative._settle(${req.id}, ${ok}, ${JSON.stringify(value ?? null)}); true;`;
};
