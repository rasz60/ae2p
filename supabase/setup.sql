-- ae:p 포털 설정 — Supabase SQL Editor 에서 한 번 실행 (업무일지와 같은 프로젝트)

-- 1) 관리자 지정: 아래 이메일을 내 로그인 이메일로 바꿔서 실행.
--    app_metadata 는 사용자가 스스로 바꿀 수 없어 권한 판단에 쓴다 (JWT 에도 실린다)
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
where email = '<관리자 이메일>';

-- 2) 이미 비밀번호가 있는 기존 계정은 '비밀번호를 정해 주세요' 화면을 건너뛰게 한다
update auth.users
set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"password_set": true}'::jsonb
where coalesce(encrypted_password, '') <> '';

-- 확인
select email, raw_app_meta_data ->> 'role' as role, raw_user_meta_data ->> 'password_set' as password_set
from auth.users order by created_at;
