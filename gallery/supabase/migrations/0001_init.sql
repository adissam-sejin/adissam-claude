-- 온라인 3D 전시관 스키마
-- 모든 테이블은 RLS로 잠그고, 아래 security definer 함수(RPC)로만 접근합니다.

create table public.app_admin (
  id int primary key default 1 check (id = 1),
  pass_hash text not null,
  failed_count int not null default 0,
  locked_until timestamptz
);

create table public.admin_sessions (
  token uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '12 hours'
);

create table public.exhibitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  visitor_code text not null unique,
  status text not null default 'active' check (status in ('active', 'ended')),
  max_per_student int not null default 3 check (max_per_student between 1 and 50),
  created_at timestamptz not null default now()
);

create table public.student_codes (
  id uuid primary key default gen_random_uuid(),
  exhibition_id uuid not null references public.exhibitions(id) on delete cascade,
  code text not null unique,
  student_name text not null default '',
  created_at timestamptz not null default now()
);
create index on public.student_codes (exhibition_id);

create table public.artworks (
  id uuid primary key default gen_random_uuid(),
  exhibition_id uuid not null references public.exhibitions(id) on delete cascade,
  student_code_id uuid references public.student_codes(id) on delete set null,
  title text not null default '',
  author_name text not null default '',
  image_path text not null,
  thumb_path text not null,
  width int not null default 1,
  height int not null default 1,
  created_at timestamptz not null default now()
);
create index on public.artworks (exhibition_id, created_at);
create index on public.artworks (student_code_id);

create table public.hearts (
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  visitor_id text not null,
  created_at timestamptz not null default now(),
  primary key (artwork_id, visitor_id)
);

alter table public.app_admin enable row level security;
alter table public.admin_sessions enable row level security;
alter table public.exhibitions enable row level security;
alter table public.student_codes enable row level security;
alter table public.artworks enable row level security;
alter table public.hearts enable row level security;

-- 작품 이미지 저장소 (공개 읽기, 쓰기는 Edge Function의 서비스 키로만)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('artworks', 'artworks', true, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- ───────────────────────── 내부 도우미 ─────────────────────────

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
    exit when not exists (select 1 from public.exhibitions where visitor_code = c)
          and not exists (select 1 from public.student_codes where code = c);
  end loop;
  return c;
end $$;

create or replace function public._admin_ok(p_token uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_token is null or not exists (
    select 1 from public.admin_sessions where token = p_token and expires_at > now()
  ) then
    raise exception 'UNAUTHORIZED';
  end if;
end $$;

create or replace function public._new_session() returns uuid
language plpgsql security definer set search_path = '' as $$
declare t uuid;
begin
  delete from public.admin_sessions where expires_at < now();
  insert into public.admin_sessions default values returning token into t;
  return t;
end $$;

-- ───────────────────────── 관리자 로그인 ─────────────────────────

create or replace function public.admin_status() returns jsonb
language sql security definer set search_path = '' as $$
  select jsonb_build_object('initialized', exists (select 1 from public.app_admin));
$$;

-- 최초 1회: 관리자 비밀번호 설정
create or replace function public.admin_setup(p_password text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.app_admin) then
    return jsonb_build_object('error', 'already_initialized');
  end if;
  if p_password is null or length(p_password) < 8 then
    return jsonb_build_object('error', 'weak_password');
  end if;
  insert into public.app_admin (id, pass_hash)
  values (1, extensions.crypt(p_password, extensions.gen_salt('bf', 10)));
  return jsonb_build_object('token', public._new_session());
end $$;

create or replace function public.admin_login(p_password text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.app_admin;
begin
  select * into a from public.app_admin where id = 1 for update;
  if not found then
    return jsonb_build_object('error', 'not_initialized');
  end if;
  if a.locked_until is not null and a.locked_until > now() then
    return jsonb_build_object('error', 'locked');
  end if;
  if a.pass_hash = extensions.crypt(coalesce(p_password, ''), a.pass_hash) then
    update public.app_admin set failed_count = 0, locked_until = null where id = 1;
    return jsonb_build_object('token', public._new_session());
  end if;
  update public.app_admin
     set failed_count = case when failed_count >= 4 then 0 else failed_count + 1 end,
         locked_until = case when failed_count >= 4 then now() + interval '1 minute' else null end
   where id = 1;
  return jsonb_build_object('error', 'wrong_password');
end $$;

create or replace function public.admin_logout(p_token uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.admin_sessions where token = p_token;
$$;

create or replace function public.admin_change_password(p_token uuid, p_old text, p_new text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.app_admin;
begin
  perform public._admin_ok(p_token);
  select * into a from public.app_admin where id = 1;
  if a.pass_hash <> extensions.crypt(coalesce(p_old, ''), a.pass_hash) then
    return jsonb_build_object('error', 'wrong_password');
  end if;
  if p_new is null or length(p_new) < 8 then
    return jsonb_build_object('error', 'weak_password');
  end if;
  update public.app_admin set pass_hash = extensions.crypt(p_new, extensions.gen_salt('bf', 10)) where id = 1;
  delete from public.admin_sessions where token <> p_token;
  return jsonb_build_object('ok', true);
end $$;

-- ───────────────────────── 관리자: 전시회 관리 ─────────────────────────

create or replace function public.admin_list(p_token uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform public._admin_ok(p_token);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', e.id, 'name', e.name, 'visitor_code', e.visitor_code, 'status', e.status,
      'max_per_student', e.max_per_student, 'created_at', e.created_at,
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

create or replace function public.admin_add_codes(p_token uuid, p_exhibition uuid, p_count int, p_names text[] default null)
returns int
language plpgsql security definer set search_path = '' as $$
declare
  n int := 0;
  nm text;
begin
  perform public._admin_ok(p_token);
  if not exists (select 1 from public.exhibitions where id = p_exhibition) then
    raise exception 'NOT_FOUND';
  end if;
  if (select count(*) from public.student_codes where exhibition_id = p_exhibition)
     + coalesce(p_count, 0) + coalesce(array_length(p_names, 1), 0) > 500 then
    raise exception 'TOO_MANY';
  end if;
  if p_names is not null then
    foreach nm in array p_names loop
      if length(trim(nm)) > 0 then
        insert into public.student_codes (exhibition_id, code, student_name)
        values (p_exhibition, public._gen_code(), left(trim(nm), 30));
        n := n + 1;
      end if;
    end loop;
  end if;
  for i in 1..greatest(coalesce(p_count, 0), 0) loop
    insert into public.student_codes (exhibition_id, code) values (p_exhibition, public._gen_code());
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.admin_create_exhibition(
  p_token uuid, p_name text, p_max_per_student int, p_student_count int, p_names text[] default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare eid uuid;
begin
  perform public._admin_ok(p_token);
  if length(trim(coalesce(p_name, ''))) = 0 then
    raise exception 'NAME_REQUIRED';
  end if;
  insert into public.exhibitions (name, visitor_code, max_per_student)
  values (left(trim(p_name), 60), public._gen_code(), greatest(1, least(50, coalesce(p_max_per_student, 3))))
  returning id into eid;
  perform public.admin_add_codes(p_token, eid, p_student_count, p_names);
  return eid;
end $$;

create or replace function public.admin_update_exhibition(
  p_token uuid, p_id uuid, p_name text default null, p_status text default null, p_max_per_student int default null
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public._admin_ok(p_token);
  update public.exhibitions set
    name = case when length(trim(coalesce(p_name, ''))) > 0 then left(trim(p_name), 60) else name end,
    status = case when p_status in ('active', 'ended') then p_status else status end,
    max_per_student = case when p_max_per_student is not null
                           then greatest(1, least(50, p_max_per_student)) else max_per_student end
  where id = p_id;
end $$;

create or replace function public.admin_update_code(p_token uuid, p_code_id uuid, p_name text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public._admin_ok(p_token);
  update public.student_codes set student_name = left(trim(coalesce(p_name, '')), 30) where id = p_code_id;
end $$;

create or replace function public.admin_delete_code(p_token uuid, p_code_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public._admin_ok(p_token);
  delete from public.student_codes where id = p_code_id;
end $$;

-- ───────────────────────── 관람객 / 수강생 ─────────────────────────

-- 코드(관람코드 또는 수강생 코드)로 입장. 작품 목록도 함께 반환.
create or replace function public.enter(p_code text, p_visitor text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  e public.exhibitions;
  s public.student_codes;
  v_role text := 'visitor';
begin
  select * into e from public.exhibitions where visitor_code = c;
  if not found then
    select * into s from public.student_codes where code = c;
    if not found then
      return jsonb_build_object('error', 'not_found');
    end if;
    select * into e from public.exhibitions where id = s.exhibition_id;
    v_role := 'student';
  end if;
  if e.status <> 'active' then
    return jsonb_build_object('error', 'ended', 'name', e.name);
  end if;
  return jsonb_build_object(
    'role', v_role,
    'exhibition', jsonb_build_object('id', e.id, 'name', e.name, 'max_per_student', e.max_per_student),
    'student', case when v_role = 'student' then jsonb_build_object(
        'id', s.id, 'name', s.student_name,
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

-- 하트 스티커 붙이기/떼기 (관람객 1명당 작품별 1개)
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
   where e.status = 'active'
     and (e.visitor_code = c or exists (
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

-- ───────────────────────── 권한 ─────────────────────────

revoke all on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.admin_status(), public.admin_setup(text), public.admin_login(text), public.admin_logout(uuid),
  public.admin_change_password(uuid, text, text), public.admin_list(uuid),
  public.admin_add_codes(uuid, uuid, int, text[]),
  public.admin_create_exhibition(uuid, text, int, int, text[]),
  public.admin_update_exhibition(uuid, uuid, text, text, int),
  public.admin_update_code(uuid, uuid, text), public.admin_delete_code(uuid, uuid),
  public.enter(text, text), public.toggle_heart(text, uuid, text)
to anon, authenticated;
