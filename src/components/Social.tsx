import type { Provider } from '@supabase/supabase-js';
import type { ReactElement } from 'react';

// 각 사 브랜드 가이드의 기본 아이콘 (18×18)
export const GOOGLE_ICON = (
  <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden>
    <path fill="#EA4335" d="M9 3.48c1.69 0 2.83.73 3.48 1.34l2.54-2.48C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l2.91 2.26C4.6 5.05 6.62 3.48 9 3.48z" />
    <path fill="#4285F4" d="M17.64 9.2c0-.74-.06-1.28-.19-1.84H9v3.34h4.96c-.1.83-.64 2.08-1.84 2.92l2.84 2.2c1.7-1.57 2.68-3.88 2.68-6.62z" />
    <path fill="#FBBC05" d="M3.88 10.78A5.54 5.54 0 0 1 3.58 9c0-.62.11-1.22.29-1.78L.96 4.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l2.92-2.26z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.84-2.2c-.76.53-1.78.9-3.12.9-2.38 0-4.4-1.57-5.12-3.74L.97 13.04C2.45 15.98 5.48 18 9 18z" />
  </svg>
);
export const KAKAO_ICON = (
  <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden>
    <path fill="#191919" d="M9 1.5C4.58 1.5 1 4.32 1 7.8c0 2.24 1.49 4.2 3.73 5.31l-.95 3.48c-.08.3.26.54.52.37l4.15-2.75c.18.01.36.02.55.02 4.42 0 8-2.82 8-6.3S13.42 1.5 9 1.5z" />
  </svg>
);
export const NAVER_ICON = (
  <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden>
    <path fill="currentColor" d="M3 2.5h4.1l3.8 5.6V2.5H15v13h-4.1L7.1 9.9v5.6H3z" />
  </svg>
);

/** 네이버 로그인은 Supabase 공급자가 아니라 포털 API 가 처리한다 (server/naver.ts). 빌드 때 켜고 끈다 */
export const NAVER_ENABLED = import.meta.env.VITE_NAVER_ENABLED === 'true';

interface SocialBase {
  key: string;
  label: string;
  icon: ReactElement;
  className: string;
}
/** Supabase OAuth (signInWithOAuth) 로 로그인하는 것과, 포털 API 주소로 페이지 이동하는 것 */
export type SocialItem = SocialBase & ({ provider: Provider } | { href: (next: string) => string });

export const SOCIAL: SocialItem[] = [
  { key: 'google', provider: 'google', label: 'Google로 계속하기', icon: GOOGLE_ICON, className: 'btn-google' },
  { key: 'kakao', provider: 'kakao', label: '카카오로 계속하기', icon: KAKAO_ICON, className: 'btn-kakao' },
  ...(NAVER_ENABLED
    ? [
        {
          key: 'naver',
          href: (next: string) => `/api/portal/naver/start?next=${encodeURIComponent(next)}`,
          label: '네이버로 계속하기',
          icon: NAVER_ICON,
          className: 'btn-naver',
        },
      ]
    : []),
];
