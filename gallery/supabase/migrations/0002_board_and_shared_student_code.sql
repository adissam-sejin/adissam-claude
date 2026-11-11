-- 전시회 현황판(기간·포스터) + 수강생 공용 코드로 개인 코드 자동 발급

alter table public.exhibitions
  add column student_code text unique,
  add column starts_on date,
  add column ends_on date,
  add column poster_path text,
  add column max_students int not null default 30 check (max_students between 1 and 500);

create unique index student_codes_name_key
  on public.student_codes (exhibition_id, lower(student_name)) where student_name <> '';

drop function if exists public.admin_create_exhibition(uuid, text, int, int, text[]);
drop function if exists public.admin_update_exhibition(uuid, uuid, text, text, int);
drop function if exists public.admin_add_codes(uuid, uuid, int, text[]);
drop function if exists public.enter(text, text);

create or replace function public._gen_code() returns text
language plpgsql security definer set search_path = '' as $$
declare
  chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  c text;
begin
  loop
    c := '';
    for i in 1..6 loop
      c := c || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    exit when not exists (select 1 from public.exhibitions where visitor_code = c or student_code = c)
          and not exists (select 1 from public.student_codes where code = c);
  end loop;
  return c;
end $$;

update public.exhibitions set student_code = public._gen_code() where student_code is null;
alter table public.exhibitions alter column student_code set not null;

-- 전시 상태: upcoming(시작 전) / active(진행중) / ended(종료). 날짜는 한국 시간 기준
create or replace function public._state(p_status text, p_starts date, p_ends date) returns text
language sql stable set search_path = '' as $$
  select case
    when p_status = 'ended' then 'ended'
    when p_ends is not null and (now() at time zone 'Asia/Seoul')::date > p_ends then 'ended'
    when p_starts is not null and (now() at time zone 'Asia/Seoul')::date < p_starts then 'upcoming'
    else 'active' end;
$$;

create or replace function public._exhibition_state(p_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select public._state(status, starts_on, ends_on) from public.exhibitions where id = p_id;
$$;

-- 현황판: 코드 없이 누구나 볼 수 있는 전시회 목록 (코드는 포함하지 않음)
create or replace function public.list_exhibitions() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id, 'name', e.name, 'starts_on', e.starts_on, 'ends_on', e.ends_on,
    'state', public._state(e.status, e.starts_on, e.ends_on), 'poster', e.poster_path,
    'artworks', (select count(*) from public.artworks a where a.exhibition_id = e.id)
  ) order by e.created_at desc), '[]'::jsonb)
  from public.exhibitions e;
$$;

create or replace function public.admin_list(p_token uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform public._admin_ok(p_token);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', e.id, 'name', e.name, 'visitor_code', e.visitor_code, 'student_code', e.student_code,
      'status', e.status, 'state', public._state(e.status, e.starts_on, e.ends_on),
      'starts_on', e.starts_on, 'ends_on', e.ends_on, 'poster', e.poster_path,
      'max_per_student', e.max_per_student, 'max_students', e.max_students, 'created_at', e.created_at,
      'codes', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', s.id, 'code', s.code, 'student_name', s.student_name,
          'used', (select count(*) from public.artworks a where a.student_code_id = s.id)
        ) order by s.created_at, s.code)
        from public.student_codes s where s.exhibition_id = e.id), '[]'::jsonb),
      'artworks', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', a.id, 'title', a.title, 'author_name', a.author_name, 'thumb_path', a.thumb_path,
          'created_at', a.created_at,
          'hearts', (select count(*) from public.hearts h where h.artwork_id = a.id)
        ) order by a.created_at)
        from public.artworks a where a.exhibition_id = e.id), '[]'::jsonb)
    ) order by e.created_at desc)
    from public.exhibitions e), '[]'::jsonb);
end $$;

create or replace function public.admin_create_exhibition(
  p_token uuid, p_name text, p_max_per_student int, p_max_students int,
  p_starts_on date default null, p_ends_on date default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare eid uuid;
begin
  perform public._admin_ok(p_token);
  if length(trim(coalesce(p_name, ''))) = 0 then
    raise exception 'NAME_REQUIRED';
  end if;
  insert into public.exhibitions (name, visitor_code, student_code, max_per_student, max_students, starts_on, ends_on)
  values (left(trim(p_name), 60), public._gen_code(), 'TMP' || gen_random_uuid()::text,
          greatest(1, least(50, coalesce(p_max_per_student, 3))),
          greatest(1, least(500, coalesce(p_max_students, 30))), p_starts_on, p_ends_on)
  returning id into eid;
  update public.exhibitions set student_code = public._gen_code() where id = eid;
  return eid;
end $$;

create or replace function public.admin_update_exhibition(
  p_token uuid, p_id uuid, p_name text default null, p_status text default null,
  p_max_per_student int default null, p_max_students int default null,
  p_set_dates boolean default false, p_starts_on date default null, p_ends_on date default null
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public._admin_ok(p_token);
  update public.exhibitions set
    name = case when length(trim(coalesce(p_name, ''))) > 0 then left(trim(p_name), 60) else name end,
    status = case when p_status in ('active', 'ended') then p_status else status end,
    max_per_student = case when p_max_per_student is not null
                           then greatest(1, least(50, p_max_per_student)) else max_per_student end,
    max_students = case when p_max_students is not null
                        then greatest(1, least(500, p_max_students)) else max_students end,
    starts_on = case when p_set_dates then p_starts_on else starts_on end,
    ends_on = case when p_set_dates then p_ends_on else ends_on end
  where id = p_id;
end $$;

-- 입장: 관람 코드 / 수강생 공용 코드(+이름 → 개인 코드 발급) / 수강생 개인 코드
create or replace function public.enter(p_code text, p_visitor text, p_name text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  nm text := left(trim(coalesce(p_name, '')), 30);
  e public.exhibitions;
  s public.student_codes;
  v_role text := 'visitor';
  v_state text;
  v_new boolean := false;
begin
  select * into e from public.exhibitions where visitor_code = c;
  if not found then
    select * into e from public.exhibitions where student_code = c;
    if found then
      v_role := 'student';
    else
      select * into s from public.student_codes where code = c;
      if not found then
        return jsonb_build_object('error', 'not_found');
      end if;
      select * into e from public.exhibitions where id = s.exhibition_id;
      v_role := 'student';
    end if;
  end if;

  v_state := public._state(e.status, e.starts_on, e.ends_on);
  if v_state <> 'active' then
    return jsonb_build_object('error', v_state, 'name', e.name, 'starts_on', e.starts_on);
  end if;

  -- 공용 수강생 코드로 들어온 경우: 이름으로 개인 코드를 발급
  if v_role = 'student' and s.id is null then
    if nm = '' then
      return jsonb_build_object('error', 'name_required');
    end if;
    perform 1 from public.exhibitions where id = e.id for update;
    if exists (select 1 from public.student_codes
                where exhibition_id = e.id and lower(student_name) = lower(nm)) then
      return jsonb_build_object('error', 'name_taken', 'exhibition_id', e.id);
    end if;
    if (select count(*) from public.student_codes where exhibition_id = e.id) >= e.max_students then
      return jsonb_build_object('error', 'full');
    end if;
    insert into public.student_codes (exhibition_id, code, student_name)
    values (e.id, public._gen_code(), nm) returning * into s;
    v_new := true;
  end if;

  return jsonb_build_object(
    'role', v_role,
    'exhibition', jsonb_build_object('id', e.id, 'name', e.name, 'max_per_student', e.max_per_student),
    'student', case when v_role = 'student' then jsonb_build_object(
        'id', s.id, 'name', s.student_name, 'code', s.code, 'issued', v_new,
        'used', (select count(*) from public.artworks a where a.student_code_id = s.id)) end,
    'artworks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'title', a.title, 'author', a.author_name,
        'image', a.image_path, 'thumb', a.thumb_path, 'w', a.width, 'h', a.height,
        'hearts', (select count(*) from public.hearts h where h.artwork_id = a.id),
        'hearted', exists (select 1 from public.hearts h where h.artwork_id = a.id and h.visitor_id = p_visitor),
        'mine', (v_role = 'student' and a.student_code_id = s.id)
      ) order by a.created_at, a.id)
      from public.artworks a where a.exhibition_id = e.id), '[]'::jsonb)
  );
end $$;

create or replace function public.toggle_heart(p_code text, p_artwork uuid, p_visitor text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  eid uuid;
  v_hearted boolean;
begin
  if p_visitor is null or length(p_visitor) < 8 or length(p_visitor) > 64 then
    return jsonb_build_object('error', 'bad_visitor');
  end if;
  select e.id into eid from public.exhibitions e
   where public._state(e.status, e.starts_on, e.ends_on) = 'active'
     and (e.visitor_code = c or e.student_code = c or exists (
           select 1 from public.student_codes s where s.exhibition_id = e.id and s.code = c));
  if eid is null or not exists (select 1 from public.artworks where id = p_artwork and exhibition_id = eid) then
    return jsonb_build_object('error', 'not_found');
  end if;
  delete from public.hearts where artwork_id = p_artwork and visitor_id = p_visitor;
  if found then
    v_hearted := false;
  else
    insert into public.hearts (artwork_id, visitor_id) values (p_artwork, p_visitor);
    v_hearted := true;
  end if;
  return jsonb_build_object(
    'hearted', v_hearted,
    'hearts', (select count(*) from public.hearts where artwork_id = p_artwork));
end $$;

revoke all on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.admin_status(), public.admin_setup(text), public.admin_login(text), public.admin_logout(uuid),
  public.admin_change_password(uuid, text, text), public.admin_list(uuid),
  public.admin_create_exhibition(uuid, text, int, int, date, date),
  public.admin_update_exhibition(uuid, uuid, text, text, int, int, boolean, date, date),
  public.admin_update_code(uuid, uuid, text), public.admin_delete_code(uuid, uuid),
  public.list_exhibitions(), public.enter(text, text, text), public.toggle_heart(text, uuid, text)
to anon, authenticated;
grant execute on function public._exhibition_state(uuid) to service_role;
