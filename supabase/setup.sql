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

-- 3) 공용 테스터 계정 (P-0004): 먼저 계정 관리에서 ae2p.tester@gmail.com 을 초대하고 한 번 로그인해 둔다.
--    아래는 '기본 데이터 편집 중'으로 지정한다 (계정 관리의 '테스터로 지정'과 같다).
--    기본 데이터를 다 넣으면 계정 관리의 '잠그기'를 누른다. 관리자 계정에는 실행하지 말 것
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "tester", "tester_editing": true}'::jsonb
where email = 'ae2p.tester@gmail.com'
  and coalesce(raw_app_meta_data ->> 'role', '') <> 'admin';

-- 확인
select email, raw_app_meta_data ->> 'role' as role, raw_app_meta_data ->> 'agent_share' as agent_share,
       raw_app_meta_data ->> 'tester_editing' as tester_editing, raw_app_meta_data ->> 'tester_baseline_at' as tester_baseline_at,
       raw_user_meta_data ->> 'password_set' as password_set
from auth.users order by created_at;
