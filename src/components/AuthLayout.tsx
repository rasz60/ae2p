import type { ReactNode } from 'react';

/** 로그인·비밀번호 화면 공통 틀: 자판기 한 대. 위 간판, 가운데 유리창(폼), 아래 꺼내는 곳 */
export function AuthLayout({ children, sub = '초대 전용' }: { children: ReactNode; sub?: string }) {
  return (
    <div className="page auth-page">
      <main className="vend">
        <div className="sign">
          <strong aria-label="ae:p">
            AE<i>:</i>P
          </strong>
          <small>{sub}</small>
        </div>
        <div className="glass">{children}</div>
        <div className="out" aria-hidden="true">
          <div className="coin">
            <i />
          </div>
          <div className="tray">All your life, in one log.</div>
        </div>
      </main>
    </div>
  );
}
