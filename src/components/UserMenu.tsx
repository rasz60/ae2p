import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useInstall } from '../lib/install';
import { disablePush, enablePush, getPushState, type PushState } from '../lib/push';
import { supabase } from '../lib/supabase';

/** 오른쪽 위 계정 버튼: 이메일 · 푸시 알림 · 앱 설치 · 비밀번호 변경 · 계정 관리(관리자) · 로그아웃 */
export function UserMenu() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const install = useInstall();
  const [push, setPush] = useState<PushState | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) getPushState().then(setPush);
  }, [open]);

  async function togglePush() {
    setPushBusy(true);
    setNote('');
    try {
      await (push === 'on' ? disablePush() : enablePush());
    } catch (e) {
      setNote((e as Error).message);
    }
    setPush(await getPushState());
    setPushBusy(false);
  }

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
          {(push === 'on' || push === 'off') && (
            <button role="menuitem" disabled={pushBusy} onClick={togglePush}>
              {push === 'on' ? '푸시 알림 끄기' : '푸시 알림 켜기'}
            </button>
          )}
          {push === 'denied' && <p className="menu-note">알림이 차단돼 있어요. 기기·브라우저 설정에서 허용해 주세요.</p>}
          {install.state === 'prompt' && (
            <button role="menuitem" onClick={install.install}>
              앱으로 설치
            </button>
          )}
          {install.state === 'ios' && (
            <p className="menu-note">Safari 공유(⬆) → "홈 화면에 추가"로 설치하면 푸시 알림도 받을 수 있어요.</p>
          )}
          {note && <p className="menu-note error">{note}</p>}
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
