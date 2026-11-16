-- 로컬 개발용 데이터. 실제 서비스에는 들어가지 않는다.
insert into public.invite_codes (code, label, role) values
  ('NFB2026', '로컬 회원용', 'member'),
  ('ADMIN-LOCAL', '로컬 관리자용', 'admin');

insert into public.courses (title, kind, session_count, sort, reward_item_id) values
  ('(예시) AI 기초', 'course', 6, 1, (select id from public.items where name = '수료 메달')),
  ('(예시) SNS 콘텐츠', 'course', 8, 2, (select id from public.items where name = '수료 트로피')),
  ('(예시) 무료특강 #62 굿바이 챗봇', 'free', 1, 3, null);

insert into public.books (title, author, month) values
  ('(예시) 셀프 디자인', '아는디자이너', '2026-11-01');
