-- 강의 도장은 회원이 신청하고, 관리자가 확인한 뒤에 찍힌다 (운영자 결정, 2026-11-17).
-- 별도 확인될 때 준다. 관리자는 하나씩, 모두 한꺼번에, 또는 강의를 골라 여러 명에게 바로 줄 수 있다.

alter table public.lecture_stamps
  add column status text not null default 'approved' check (status in ('requested', 'approved')),
  add column decided_at timestamptz;
create index lecture_stamps_waiting on public.lecture_stamps (created_at) where status = 'requested';

-- 회원: 도장 신청. "듣는 강의"로 고르는 단계는 없앴다 (확인을 받으므로 필요 없다).
create or replace function public.stamp_lecture(p_course_id uuid, p_session_no int default 1, p_note text default '')
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_member();
  c public.courses; sid uuid;
begin
  select * into c from public.courses where id = p_course_id and active;
  if not found or not c.stamp_open then raise exception 'NO_COURSE'; end if;

  insert into public.lecture_stamps (user_id, course_id, session_no, note, status)
  values (uid, c.id, 1, coalesce(trim(p_note), ''), 'requested')
  on conflict (user_id, course_id, session_no) do nothing
  returning id into sid;
  if sid is null then raise exception 'ALREADY_STAMPED'; end if;
  return jsonb_build_object('stamp_id', sid, 'status', 'requested', 'stars', 0, 'balance', private.balance(uid));
end $$;

-- 회원: 아직 확인되지 않은 신청을 거둔다.
create function public.cancel_lecture_stamp(p_course_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_member();
begin
  delete from public.lecture_stamps where user_id = uid and course_id = p_course_id and status = 'requested';
end $$;

create function private.approve_stamp(p_id uuid) returns boolean
language plpgsql set search_path = '' as $$
declare s public.lecture_stamps;
begin
  update public.lecture_stamps set status = 'approved', decided_at = now()
   where id = p_id and status = 'requested' returning * into s;
  if not found then return false; end if;
  perform private.give_stars(s.user_id, private.setting_int('star_lecture_stamp', 2), 'lecture', s.id::text);
  return true;
end $$;

-- 관리자: 신청 하나를 확인하거나 돌려보낸다 (돌려보내면 신청이 지워져 다시 신청할 수 있다).
create function public.admin_decide_stamp(p_id uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare aid uuid := private.require_admin();
begin
  if p_approve then
    perform private.approve_stamp(p_id);
  else
    delete from public.lecture_stamps where id = p_id and status = 'requested';
  end if;
  perform private.log(case when p_approve then 'stamp_approve' else 'stamp_reject' end, p_id::text);
end $$;

-- 관리자: 기다리는 신청을 모두 확인한다.
create function public.admin_approve_all_stamps() returns int
language plpgsql security definer set search_path = '' as $$
declare aid uuid := private.require_admin(); r record; n int := 0;
begin
  for r in select id from public.lecture_stamps where status = 'requested' order by created_at loop
    if private.approve_stamp(r.id) then n := n + 1; end if;
  end loop;
  perform private.log('stamp_approve_all', '', jsonb_build_object('count', n));
  return n;
end $$;

-- 관리자: 강의를 골라 여러 회원에게 도장을 바로 준다 (신청이 있었으면 그것을 확인 처리한다).
create function public.admin_grant_stamps(p_course_id uuid, p_user_ids uuid[]) returns int
language plpgsql security definer set search_path = '' as $$
declare aid uuid := private.require_admin(); u uuid; sid uuid; n int := 0;
begin
  if not exists (select 1 from public.courses where id = p_course_id) then raise exception 'NO_COURSE'; end if;
  foreach u in array p_user_ids loop
    if not exists (select 1 from public.profiles where id = u) then continue; end if;
    insert into public.lecture_stamps (user_id, course_id, session_no, status)
    values (u, p_course_id, 1, 'requested')
    on conflict (user_id, course_id, session_no) do nothing;
    select id into sid from public.lecture_stamps where user_id = u and course_id = p_course_id and session_no = 1;
    if private.approve_stamp(sid) then n := n + 1; end if;
  end loop;
  perform private.log('stamp_grant', p_course_id::text, jsonb_build_object('count', n));
  return n;
end $$;

revoke all on function public.cancel_lecture_stamp(uuid), public.admin_decide_stamp(uuid, boolean), public.admin_approve_all_stamps(), public.admin_grant_stamps(uuid, uuid[]) from public, anon;
grant execute on function public.cancel_lecture_stamp(uuid), public.admin_decide_stamp(uuid, boolean), public.admin_approve_all_stamps(), public.admin_grant_stamps(uuid, uuid[]) to authenticated;

-- 건물 정보: 확인된 도장만 도장으로 세고, 기다리는 신청은 따로 알려 준다.
create or replace function private.building_json(p_uid uuid, p_public boolean) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  p public.profiles;
  w date := private.week_start(private.kst_today());
  result jsonb;
begin
  select * into p from public.profiles where id = p_uid;
  if not found then return null; end if;

  select jsonb_build_object(
    'profile', jsonb_build_object(
      'id', p.id, 'nickname', p.nickname, 'brand_name', p.brand_name, 'tagline', p.tagline,
      'brand_color', p.brand_color, 'plot_no', p.plot_no, 'is_public', p.is_public,
      'public_key', case when p_public then null else p.public_key end,
      'weekly_goal', p.weekly_goal, 'created_at', p.created_at),
    'floors', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id, 'kind', f.kind, 'channel_type', f.channel_type, 'channel_name', f.channel_name,
        'channel_url', f.channel_url, 'position', f.position, 'wall_color', f.wall_color,
        'record_count', (select count(*) from public.records r where r.floor_id = f.id and r.voided_at is null),
        'recent_records', coalesce((
          select jsonb_agg(x) from (
            select jsonb_build_object('id', r.id, 'url', r.url, 'note', r.note, 'day', r.day, 'input_type', r.input_type) x
              from public.records r where r.floor_id = f.id and r.voided_at is null
             order by r.created_at desc limit 12) s), '[]'::jsonb),
        'placements', coalesce((
          select jsonb_agg(jsonb_build_object(
            'slot_key', pl.slot_key, 'inventory_id', pl.inventory_id,
            'item', jsonb_build_object('id', i.id, 'name', i.name, 'emoji', i.emoji, 'image_url', i.image_url, 'slot', i.slot, 'size', i.size)))
            from public.placements pl
            join public.inventory v on v.id = pl.inventory_id
            join public.items i on i.id = v.item_id
           where pl.floor_id = f.id), '[]'::jsonb)
      ) order by f.position)
      from public.floors f where f.user_id = p_uid), '[]'::jsonb),
    'stars_earned', (select coalesce(sum(amount), 0) from public.star_ledger where user_id = p_uid and amount > 0),
    'stamps', (select count(*) from public.weekly_stamps where user_id = p_uid),
    'records', (select count(*) from public.records where user_id = p_uid and voided_at is null),
    'week', jsonb_build_object(
      'start', w,
      'count', (select count(*) from public.records where user_id = p_uid and week_start = w and voided_at is null),
      'goal', p.weekly_goal,
      'stamped', exists (select 1 from public.weekly_stamps where user_id = p_uid and week_start = w)),
    'courses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'course_id', c.id, 'title', c.title, 'kind', c.kind, 'session_count', c.session_count,
        'enrolled', exists (select 1 from public.enrollments e where e.user_id = p_uid and e.course_id = c.id),
        'stamps', coalesce((select jsonb_agg(ls.session_no order by ls.session_no)
                              from public.lecture_stamps ls where ls.user_id = p_uid and ls.course_id = c.id and ls.status = 'approved'), '[]'::jsonb),
        'pending', exists (select 1 from public.lecture_stamps ls where ls.user_id = p_uid and ls.course_id = c.id and ls.status = 'requested')
      ) order by c.sort, c.title)
      from public.courses c
      where exists (select 1 from public.enrollments e where e.user_id = p_uid and e.course_id = c.id)
         or exists (select 1 from public.lecture_stamps ls where ls.user_id = p_uid and ls.course_id = c.id)), '[]'::jsonb),
    'completions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', cm.id, 'cert_no', cm.cert_no, 'course_id', c.id, 'title', c.title, 'completed_on', cm.completed_on,
        'status', cm.status,
        'item', (select jsonb_build_object('name', i.name, 'emoji', i.emoji, 'image_url', i.image_url)
                   from public.items i where i.id = c.reward_item_id)
      ) order by cm.completed_on nulls last, cm.requested_at)
      from public.completions cm join public.courses c on c.id = cm.course_id
      where cm.user_id = p_uid and (cm.status = 'approved' or not p_public)), '[]'::jsonb),
    'readings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', rd.id, 'book_id', b.id, 'title', b.title, 'author', b.author, 'cover_url', b.cover_url,
        'note', rd.note, 'attended', rd.attended, 'created_at', rd.created_at) order by rd.created_at)
      from public.readings rd join public.books b on b.id = rd.book_id where rd.user_id = p_uid), '[]'::jsonb),
    'taste', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'kind', t.kind, 'shape', t.shape, 'label', t.label, 'emoji', t.emoji, 'photo_path', t.photo_path)
        order by t.created_at)
      from public.taste_items t where t.user_id = p_uid), '[]'::jsonb),
    'news', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', n.id, 'kind', n.kind, 'note', n.note, 'url', n.url, 'photo_path', n.photo_path,
        'created_at', n.created_at, 'featured', n.featured_at is not null,
        'consent', case when p_public then null else n.consent end,
        'name_display', case when p_public then null else n.name_display end,
        'on_banner', n.created_at > now() - make_interval(days => private.setting_int('banner_days', 14)))
        order by n.created_at desc)
      from public.news n where n.user_id = p_uid and n.hidden_at is null), '[]'::jsonb),
    'my_books', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', mb.id, 'title', mb.title, 'stage', mb.stage, 'cover_url', mb.cover_url,
        'isbn', mb.isbn, 'buy_url', mb.buy_url) order by mb.created_at)
      from public.my_books mb where mb.user_id = p_uid), '[]'::jsonb),
    'cheers', (select count(*) from public.cheers where to_user = p_uid)
  ) into result;
  return result;
end $$;

create or replace function public.admin_summary() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  aid uuid := private.require_admin();
  this_w date := private.week_start(private.kst_today());
  last_w date := private.week_start(private.kst_today()) - 7;
  prev_w date := private.week_start(private.kst_today()) - 14;
begin
  return jsonb_build_object(
    'last_week_start', last_w,
    'members', (select count(*) from public.profiles),
    'achieved', (select count(*) from public.weekly_stamps where week_start = last_w),
    'active_last_week', (select count(distinct user_id) from public.records where week_start = last_w and voided_at is null),
    'records_last_week', (select count(*) from public.records where week_start = last_w and voided_at is null),
    'first_stopped', coalesce((
      select jsonb_agg(p.nickname order by p.nickname) from public.profiles p
       where p.created_at < last_w::timestamp at time zone 'Asia/Seoul'
         and exists (select 1 from public.records r where r.user_id = p.id and r.week_start = prev_w and r.voided_at is null)
         and not exists (select 1 from public.records r where r.user_id = p.id and r.week_start = last_w and r.voided_at is null)
    ), '[]'::jsonb),
    'long_stopped', coalesce((
      select jsonb_agg(p.nickname order by p.nickname) from public.profiles p
       where p.created_at < prev_w::timestamp at time zone 'Asia/Seoul'
         and not exists (select 1 from public.records r where r.user_id = p.id and r.week_start in (last_w, prev_w) and r.voided_at is null)
    ), '[]'::jsonb),
    'pending_completions', (select count(*) from public.completions where status = 'requested'),
    'pending_stamps', (select count(*) from public.lecture_stamps where status = 'requested'),
    'news_waiting', (select count(*) from public.news where consent and featured_at is null and hidden_at is null),
    'this_week_records', (select count(*) from public.records where week_start = this_w and voided_at is null)
  );
end $$;
