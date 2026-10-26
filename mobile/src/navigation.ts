import * as WebBrowser from 'expo-web-browser';

// 앱 안(WebView)에서 열 곳과 밖(사파리)으로 보낼 곳.

export const HOME = 'https://ae2p.duckdns.org/';
const HOST = 'ae2p.duckdns.org';
/** Google · 카카오 로그인이 끝나면 돌아올 앱 주소. Supabase Redirect URLs 에 aep://** 가 있어야 한다 */
export const AUTH_CALLBACK = 'aep://auth';

const parse = (url: string): URL | null => {
  try {
    return new URL(url);
  } catch {
    return null;
  }
};

/** 앱 안에서 그대로 연다: 포털과 모든 앱(같은 도메인), Supabase(로그인 · 메일 링크), 빈 페이지 */
export const isInternal = (url: string): boolean => {
  if (url.startsWith('about:') || url.startsWith('data:') || url.startsWith('blob:')) return true;
  const u = parse(url);
  if (!u) return false;
  return u.hostname === HOST || u.hostname.endsWith('.supabase.co');
};

/** Supabase 의 Google · 카카오 로그인 시작 주소인지 (…supabase.co/auth/v1/authorize?provider=…) */
export const isOAuthStart = (url: string): boolean => {
  const u = parse(url);
  return !!u && u.hostname.endsWith('.supabase.co') && u.pathname.endsWith('/auth/v1/authorize') && u.searchParams.has('provider');
};

/**
 * Google 은 앱 안 WebView 로그인을 막는다. 그래서 로그인만 시스템 브라우저 창(ASWebAuthenticationSession)에서 하고,
 * 돌아온 토큰(#access_token …)을 원래 돌아갈 주소(포털 /login?next=…)에 붙여 WebView 에 다시 연다.
 * 포털의 supabase-js 가 주소의 토큰을 읽어 WebView 안에 세션을 만든다.
 * 실패하거나 닫으면 null (WebView 는 그대로).
 */
export const signInWithSystemBrowser = async (startUrl: string): Promise<string | null> => {
  const u = new URL(startUrl);
  const back = u.searchParams.get('redirect_to') ?? `${HOME}login`;
  u.searchParams.set('redirect_to', AUTH_CALLBACK);

  const result = await WebBrowser.openAuthSessionAsync(u.toString(), AUTH_CALLBACK, { preferEphemeralSession: false });
  if (result.type !== 'success') return null;

  const returned = parse(result.url.replace(/^aep:\/\//, 'https://aep.local/'));
  if (!returned) return null;
  const target = new URL(back);
  // PKCE 면 ?code=, implicit 면 #access_token=… — 둘 다 그대로 넘긴다
  returned.searchParams.forEach((v, k) => target.searchParams.set(k, v));
  target.hash = returned.hash;
  return target.toString();
};
