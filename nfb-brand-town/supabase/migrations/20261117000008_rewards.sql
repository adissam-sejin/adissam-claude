-- 보상 규칙 고치기 (운영자 결정, 2026-11-17)
--  · 좋은 소식 별은 하루 한 번이 아니라 일주일에 한 번
--  · 소식이 소개되면 별 20개, 수료가 확인되면 별 10개
--  · 강의 도장은 회차마다가 아니라 강의 하나에 하나

update public.settings set value = '20' where key = 'star_featured';
update public.settings set value = '10' where key = 'star_completion';
update public.settings set label = '좋은 소식을 알리면 주는 별 (일주일에 한 번)' where key = 'star_news';
update public.settings set label = '강의 도장 1개에 주는 별 (강의 하나에 도장 하나)' where key = 'star_lecture_stamp';

create or replace function public.post_news(
  p_kind text, p_note text, p_url text default null, p_photo_path text default null,
  p_course_id uuid default null, p_consent boolean default false, p_name_display text default 'nick'
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_member(); nid uuid; got int := 0; w date := private.week_start(private.kst_today());
begin
  insert into public.news (user_id, kind, note, url, photo_path, course_id, consent, name_display)
  values (uid, p_kind, trim(p_note), nullif(trim(coalesce(p_url, '')), ''), p_photo_path, p_course_id,
          coalesce(p_consent, false), coalesce(p_name_display, 'nick'))
  returning id into nid;
  -- 소식은 몇 번이든 알릴 수 있지만, 별은 한 주(월~일)에 한 번만 준다
  got := private.give_stars(uid, private.setting_int('star_news', 2), 'news', 'week-' || w::text);
  return jsonb_build_object('news_id', nid, 'stars', got, 'balance', private.balance(uid));
end $$;

-- 강의 도장: 강의 하나에 도장 하나. (p_session_no 는 예전 화면과 맞추려고 남겨 두었고 쓰지 않는다.)
create or replace function public.stamp_lecture(p_course_id uuid, p_session_no int default 1, p_note text default '')
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_member();
  c public.courses; sid uuid; got int := 0;
begin
  select * into c from public.courses where id = p_course_id and active;
  if not found or not c.stamp_open then raise exception 'NO_COURSE'; end if;
  if c.kind = 'course' and not exists
     (select 1 from public.enrollments where user_id = uid and course_id = c.id) then
    raise exception 'NOT_ENROLLED';
  end if;

  insert into public.lecture_stamps (user_id, course_id, session_no, note)
  values (uid, c.id, 1, coalesce(trim(p_note), ''))
  on conflict (user_id, course_id, session_no) do nothing
  returning id into sid;
  if sid is null then raise exception 'ALREADY_STAMPED'; end if;

  got := private.give_stars(uid, private.setting_int('star_lecture_stamp', 2), 'lecture', sid::text);
  return jsonb_build_object('stamp_id', sid, 'stars', got, 'balance', private.balance(uid));
end $$;

-- 예전 방식으로 찍힌 2회차 이후 도장은 치운다 (강의마다 하나만 남긴다). 이미 받은 별은 그대로 둔다.
delete from public.lecture_stamps where session_no > 1;
update public.courses set session_count = 1 where session_count <> 1;

-- 주간 목표는 1개부터 10개까지 고를 수 있다 (채널이 여러 개인 사람을 위해).
alter table public.profiles drop constraint profiles_weekly_goal_check;
alter table public.profiles add constraint profiles_weekly_goal_check check (weekly_goal between 1 and 10);
