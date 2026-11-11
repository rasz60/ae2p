import type { ReactNode } from 'react';
import { Brand } from './Brand';

/** 로그인·비밀번호 화면 공통 틀: 가운데 카드 */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="page auth-page">
      <main className="auth-card">
        <div className="auth-brand">
          <Brand kind="wordmark" height={104} />
        </div>
        {children}
      </main>
      <p className="auth-foot">All your life, in one log.</p>
    </div>
  );
}
