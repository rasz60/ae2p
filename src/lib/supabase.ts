import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 가 설정되지 않았습니다. .env 를 확인하세요.');
}

// 같은 도메인의 앱들이 같은 Supabase 프로젝트를 쓰면 세션(localStorage)을 같이 본다 → 한 번 로그인
export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
