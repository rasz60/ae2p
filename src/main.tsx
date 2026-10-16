import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { Admin } from './pages/Admin';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { SetPassword } from './pages/SetPassword';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './styles.css';

/** 로그인 필요. 비밀번호를 아직 안 정했으면 먼저 정하게 한다 */
function RequireAuth({ admin, children }: { admin?: boolean; children: ReactNode }) {
  const { ready, session, needsPassword, isAdmin } = useAuth();
  const { pathname, search } = useLocation();
  if (!ready) return null;
  const next = encodeURIComponent(pathname + search);
  if (!session) return <Navigate to={`/login?next=${next}`} replace />;
  if (needsPassword) return <Navigate to={`/set-password?next=${next}`} replace />;
  if (admin && !isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/set-password" element={<SetPassword />} />
          <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth admin><Admin /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
);
