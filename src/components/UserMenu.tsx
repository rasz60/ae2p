import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

/** 오른쪽 위 계정 버튼: 이메일 · 비밀번호 변경 · 계정 관리(관리자) · 로그아웃 */
export function UserMenu() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => (document.removeEventListener('pointerdown', onDown), document.removeEventListener('keydown', onKey));
  }, [open]);

  async function logout() {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  }

  const email = user?.email ?? '';
  return (
    <div className="user-menu" ref={ref}>
      <button className="avatar" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="계정 메뉴">
        {email.slice(0, 1).toUpperCase()}
      </button>
      {open && (
        <div className="menu" role="menu">
          <p className="menu-email">{email}</p>
          <Link role="menuitem" to="/set-password">
            비밀번호 변경
          </Link>
          {isAdmin && (
            <Link role="menuitem" to="/admin">
              계정 관리
            </Link>
          )}
          <button role="menuitem" className="danger" onClick={logout}>
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}
