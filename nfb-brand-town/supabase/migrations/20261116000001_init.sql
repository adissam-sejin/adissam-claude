-- NFb 브랜드 타운: 기본 구조
-- 원칙
--  * 별·도장은 누적 숫자가 아니라 원장(star_ledger, weekly_stamps)에서 집계한다.
--  * 별이 오가는 동작은 전부 서버 함수(RPC)로만 한다. 화면에서 직접 표를 고칠 수 없다.
--  * 보상 수치는 settings 표의 설정값이다.

create schema if not exists private;

-- ───────────────────────── 설정 ─────────────────────────
create table public.settings (
  key text primary key,
  value jsonb not null,
  label text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.settings (key, value, label) values
  ('star_welcome',            '5',  '처음 건물을 지을 때 주는 별'),
  ('star_per_record',         '1',  '기록 1건에 주는 별'),
  ('record_star_daily_cap',   '1',  '한 층에서 하루에 별을 받을 수 있는 기록 수'),
  ('record_daily_max',        '20', '하루에 남길 수 있는 기록 수'),
  ('star_weekly_bonus',       '5',  '주간 목표를 채우면 주는 별'),
  ('star_lecture_stamp',      '2',  '강의 도장 1개에 주는 별'),
  ('star_reading',            '3',  '북클럽 책 기록에 주는 별'),
  ('star_cheer',              '1',  '그날 첫 응원을 보내면 주는 별'),
  ('star_news',               '2',  '좋은 소식을 알리면 주는 별'),
  ('star_featured',           '10', '아디쌤이 소식을 소개하면 주는 별'),
  ('star_completion',         '5',  '수료가 확인되면 주는 별'),
  ('max_sns_floors',          '6',  '지을 수 있는 채널 층 수'),
  ('banner_days',             '14', '현수막이 걸려 있는 날 수'),
  ('taste_max',               '300','취향의 방에 놓을 수 있는 물건 수');

create function private.setting_int(k text, fallback int) returns int
language sql stable set search_path = '' as $$
  select coalesce((select (value #>> '{}')::int from public.settings where key = k), fallback)
$$;

create function private.kst_today() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Seoul')::date
$$;

create function private.week_start(d date) returns date
language sql immutable set search_path = '' as $$
  select (date_trunc('week', d::timestamp))::date
$$;

-- ───────────────────────── 회원 ─────────────────────────
create sequence public.plot_seq;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 20),
  brand_name text not null default '' check (char_length(brand_name) <= 30),
  tagline text not null default '' check (char_length(tagline) <= 80),
  brand_color text not null default '#B5403A' check (brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  role text not null default 'member' check (role in ('member','admin')),
  public_key text not null unique default replace(gen_random_uuid()::text, '-', ''),
  is_public boolean not null default false,
  weekly_goal int not null default 3 check (weekly_goal in (2,3,5)),
  plot_no int not null unique default nextval('public.plot_seq'),
  created_at timestamptz not null default now()
);

create table public.invite_codes (
  code text primary key check (char_length(code) between 3 and 40),
  label text not null default '',
  role text not null default 'member' check (role in ('member','admin')),
  max_uses int,
  used_count int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin')
$$;

create function private.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()))
$$;

create function private.require_member() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not exists (select 1 from public.profiles where id = uid) then
    raise exception 'NOT_MEMBER';
  end if;
  return uid;
end $$;

create function private.require_admin() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not exists (select 1 from public.profiles where id = uid and role = 'admin') then
    raise exception 'NOT_ADMIN';
  end if;
  return uid;
end $$;

-- ───────────────────────── 건물 (층) ─────────────────────────
create table public.floors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('lobby','classroom','library','sns','rooftop')),
  channel_type text check (channel_type in ('blog','instagram','youtube','threads','etc')),
  channel_name text not null default '' check (char_length(channel_name) <= 30),
  channel_url text not null default '' check (char_length(channel_url) <= 300),
  position int not null,
  wall_color text check (wall_color is null or wall_color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  check ((kind = 'sns') = (channel_type is not null))
);
create unique index floors_one_fixed on public.floors (user_id, kind) where kind <> 'sns';
create index floors_user on public.floors (user_id, position);

-- ───────────────────────── 기록 · 별 · 도장 ─────────────────────────
create table public.records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  floor_id uuid not null references public.floors(id) on delete cascade,
  input_type text not null check (input_type in ('url','photo','check')),
  url text check (url is null or char_length(url) <= 500),
  photo_path text,
  note text not null default '' check (char_length(note) <= 200),
  day date not null,
  week_start date not null,
  starred boolean not null default false,
  voided_at timestamptz,
  voided_by uuid,
  created_at timestamptz not null default now()
);
create unique index records_url_once on public.records (user_id, url) where url is not null and voided_at is null;
create index records_user_week on public.records (user_id, week_start) where voided_at is null;
create index records_floor on public.records (floor_id, created_at desc) where voided_at is null;

create table public.star_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount int not null check (amount <> 0),
  reason text not null,
  ref text not null,
  created_at timestamptz not null default now(),
  unique (user_id, reason, ref)
);
create index star_ledger_user on public.star_ledger (user_id);

create table public.weekly_stamps (
  user_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  goal int not null,
  created_at timestamptz not null default now(),
  primary key (user_id, week_start)
);

create function private.balance(uid uuid) returns int
language sql stable set search_path = '' as $$
  select coalesce(sum(amount), 0)::int from public.star_ledger where user_id = uid
$$;

create function private.give_stars(uid uuid, n int, p_reason text, p_ref text) returns int
language plpgsql set search_path = '' as $$
declare got int := 0;
begin
  if n is null or n = 0 then return 0; end if;
  insert into public.star_ledger (user_id, amount, reason, ref)
  values (uid, n, p_reason, p_ref)
  on conflict (user_id, reason, ref) do nothing;
  get diagnostics got = row_count;
  return case when got > 0 then n else 0 end;
end $$;

-- ───────────────────────── 물건 · 보관함 · 배치 ─────────────────────────
create table public.items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 30),
  kind text not null default 'object' check (kind in ('object','wall_paint')),
  slot text not null default 'floor' check (slot in ('floor','wall')),
  price int not null default 0 check (price >= 0),
  image_url text,
  emoji text,
  color text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  source text not null default 'shop' check (source in ('shop','reward')),
  season text not null default '',
  sale_start date,
  sale_end date,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table public.inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id uuid not null references public.items(id),
  source text not null default 'shop',
  acquired_at timestamptz not null default now()
);
create index inventory_user on public.inventory (user_id);

create table public.placements (
  inventory_id uuid primary key references public.inventory(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  floor_id uuid not null references public.floors(id) on delete cascade,
  slot_key text not null check (slot_key ~ '^[fw][1-9]$'),
  unique (floor_id, slot_key)
);
create index placements_user on public.placements (user_id);

-- ───────────────────────── 강의실 ─────────────────────────
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  liveklass_seq text unique,
  title text not null,
  kind text not null default 'course' check (kind in ('course','free')),
  session_count int not null default 1 check (session_count between 1 and 60),
  thumbnail_url text,
  product_url text,
  reward_item_id uuid references public.items(id),
  stamp_open boolean not null default true,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table public.enrollments (
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, course_id)
);

create table public.lecture_stamps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  session_no int not null check (session_no >= 1),
  note text not null default '' check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  unique (user_id, course_id, session_no)
);

create table public.completions (
  id uuid primary key default gen_random_uuid(),
  cert_no int generated always as identity,
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  status text not null default 'requested' check (status in ('requested','approved','rejected')),
  completed_on date,
  note text not null default '' check (char_length(note) <= 200),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid,
  unique (user_id, course_id)
);

-- ───────────────────────── 서재 (북클럽) ─────────────────────────
create table public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text not null default '',
  cover_url text,
  month date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  note text not null default '' check (char_length(note) <= 200),
  attended boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, book_id)
);

-- ───────────────────────── 로비: 취향 · 좋은 소식 · 내 책 ─────────────────────────
create table public.taste_catalog (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  emoji text not null,
  tag text not null default '',
  sort int not null default 0
);

create table public.taste_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('pick','text','photo')),
  shape text not null default 'object' check (shape in ('object','book','record','note','photo')),
  label text not null default '' check (char_length(label) <= 60),
  emoji text,
  photo_path text,
  created_at timestamptz not null default now()
);
create index taste_user on public.taste_items (user_id, created_at);

create table public.news (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('first_lecture','book','press','income','collab','award','etc')),
  note text not null check (char_length(note) between 1 and 200),
  url text check (url is null or char_length(url) <= 500),
  photo_path text,
  course_id uuid references public.courses(id),
  consent boolean not null default false,
  name_display text not null default 'nick' check (name_display in ('real','nick','anon')),
  featured_at timestamptz,
  featured_note text,
  hidden_at timestamptz,
  created_at timestamptz not null default now()
);
create index news_user on public.news (user_id, created_at desc);

create table public.my_books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 60),
  stage text not null default 'plan' check (stage in ('plan','toc','draft','cover','published')),
  cover_url text,
  isbn text,
  buy_url text,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.cheers (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles(id) on delete cascade,
  to_user uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  news_id uuid references public.news(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (from_user, to_user, day),
  check (from_user <> to_user)
);
create index cheers_to on public.cheers (to_user, created_at desc);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  admin_id uuid,
  action text not null,
  target text not null default '',
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ═════════════════════════ 회원 동작 (RPC) ═════════════════════════

create function public.join_town(
  p_code text, p_nickname text, p_brand_name text, p_brand_color text,
  p_channel_type text default null, p_channel_name text default '', p_channel_url text default ''
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  c public.invite_codes;
begin
  if uid is null then raise exception 'NOT_SIGNED_IN'; end if;
  if exists (select 1 from public.profiles where id = uid) then raise exception 'ALREADY_JOINED'; end if;

  select * into c from public.invite_codes where code = upper(trim(p_code)) for update;
  if not found or not c.active or (c.max_uses is not null and c.used_count >= c.max_uses) then
    raise exception 'BAD_CODE';
  end if;
  update public.invite_codes set used_count = used_count + 1 where code = c.code;

  insert into public.profiles (id, nickname, brand_name, brand_color, role)
  values (uid, trim(p_nickname), coalesce(trim(p_brand_name), ''), coalesce(p_brand_color, '#B5403A'), c.role);

  insert into public.floors (user_id, kind, position) values
    (uid, 'lobby', 0), (uid, 'classroom', 1), (uid, 'library', 2), (uid, 'rooftop', 1000);

  if p_channel_type is not null then
    insert into public.floors (user_id, kind, channel_type, channel_name, channel_url, position)
    values (uid, 'sns', p_channel_type, coalesce(trim(p_channel_name), ''), coalesce(trim(p_channel_url), ''), 10);
  end if;

  perform private.give_stars(uid, private.setting_int('star_welcome', 5), 'welcome', 'welcome');
end $$;

create function public.add_channel_floor(p_channel_type text, p_channel_name text default '', p_channel_url text default '')
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_member();
  n int; pos int; fid uuid;
begin
  select count(*), coalesce(max(position), 9) + 1 into n, pos
    from public.floors where user_id = uid and kind = 'sns';
  if n >= private.setting_int('max_sns_floors', 6) then raise exception 'TOO_MANY_FLOORS'; end if;
  insert into public.floors (user_id, kind, channel_type, channel_name, channel_url, position)
  values (uid, 'sns', p_channel_type, coalesce(trim(p_channel_name), ''), coalesce(trim(p_channel_url), ''), pos)
  returning id into fid;
  return fid;
end $$;

create function public.update_floor_channel(p_floor_id uuid, p_channel_name text, p_channel_url text)
returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_member();
begin
  update public.floors
     set channel_name = coalesce(trim(p_channel_name), ''), channel_url = coalesce(trim(p_channel_url), '')
   where id = p_floor_id and user_id = uid and kind = 'sns';
  if not found then raise exception 'NOT_YOURS'; end if;
end $$;

-- 기록 남기기: 별(하루 상한)과 주간 도장을 그 자리에서 계산한다.
create function public.add_record(
  p_floor_id uuid, p_input_type text, p_url text default null, p_photo_path text default null, p_note text default ''
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_member();
  d date := private.kst_today();
  w date := private.week_start(private.kst_today());
  v_url text := nullif(trim(coalesce(p_url, '')), '');
  rid uuid;
  today_n int; floor_starred int; week_n int; v_goal int;
  star_got int := 0; bonus_got int := 0; stamped boolean := false; is_star boolean := false;
begin
  perform pg_advisory_xact_lock(hashtext(uid::text));

  if not exists (select 1 from public.floors where id = p_floor_id and user_id = uid and kind = 'sns') then
    raise exception 'NOT_YOURS';
  end if;
  if p_input_type = 'url' then
    if v_url is null or v_url !~* '^https?://' then raise exception 'BAD_URL'; end if;
    if exists (select 1 from public.records where user_id = uid and url = v_url and voided_at is null) then
      raise exception 'DUPLICATE_URL';
    end if;
  else
    v_url := null;
  end if;
  if p_input_type = 'photo' and nullif(p_photo_path, '') is null then raise exception 'NO_PHOTO'; end if;

  select count(*) into today_n from public.records where user_id = uid and day = d and voided_at is null;
  if today_n >= private.setting_int('record_daily_max', 20) then raise exception 'DAILY_MAX'; end if;

  select count(*) into floor_starred from public.records
   where floor_id = p_floor_id and day = d and voided_at is null and starred;
  is_star := floor_starred < private.setting_int('record_star_daily_cap', 1);

  insert into public.records (user_id, floor_id, input_type, url, photo_path, note, day, week_start, starred)
  values (uid, p_floor_id, p_input_type, v_url,
          case when p_input_type = 'photo' then p_photo_path end,
          coalesce(trim(p_note), ''), d, w, is_star)
  returning id into rid;

  if is_star then
    star_got := private.give_stars(uid, private.setting_int('star_per_record', 1), 'record', rid::text);
  end if;

  select count(*) into week_n from public.records where user_id = uid and week_start = w and voided_at is null;
  select weekly_goal into v_goal from public.profiles where id = uid;

  if week_n >= v_goal then
    insert into public.weekly_stamps (user_id, week_start, goal) values (uid, w, v_goal)
    on conflict do nothing;
    if found then
      stamped := true;
      bonus_got := private.give_stars(uid, private.setting_int('star_weekly_bonus', 5), 'weekly', w::text);
    end if;
  end if;

  return jsonb_build_object(
    'record_id', rid, 'stars', star_got, 'week_count', week_n, 'goal', v_goal,
    'stamped', stamped, 'bonus', bonus_got, 'balance', private.balance(uid));
end $$;

-- 기록 되돌리기 (본인): 받은 별도 함께 되돌린다. 목표 아래로 내려가면 그 주 도장도 되돌린다.
create function private.void_record(rid uuid, actor uuid) returns void
language plpgsql set search_path = '' as $$
declare r public.records; week_n int; g int;
begin
  select * into r from public.records where id = rid and voided_at is null for update;
  if not found then return; end if;
  update public.records set voided_at = now(), voided_by = actor where id = rid;
  delete from public.star_ledger where user_id = r.user_id and reason = 'record' and ref = rid::text;

  select count(*) into week_n from public.records
   where user_id = r.user_id and week_start = r.week_start and voided_at is null;
  select goal into g from public.weekly_stamps where user_id = r.user_id and week_start = r.week_start;
  if g is not null and week_n < g then
    delete from public.weekly_stamps where user_id = r.user_id and week_start = r.week_start;
    delete from public.star_ledger where user_id = r.user_id and reason = 'weekly' and ref = r.week_start::text;
  end if;
end $$;

create function public.undo_record(p_record_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_member();
begin
  perform pg_advisory_xact_lock(hashtext(uid::text));
  if not exists (select 1 from public.records where id = p_record_id and user_id = uid) then
    raise exception 'NOT_YOURS';
  end if;
  perform private.void_record(p_record_id, uid);
end $$;

-- 가게: 사기
create function public.buy_item(p_item_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_member();
  it public.items; inv uuid; d date := private.kst_today();
begin
  perform pg_advisory_xact_lock(hashtext(uid::text));
  select * into it from public.items where id = p_item_id;
  if not found or not it.active or it.source <> 'shop'
     or (it.sale_start is not null and d < it.sale_start)
     or (it.sale_end is not null and d > it.sale_end) then
    raise exception 'NOT_FOR_SALE';
  end if;
  if it.kind = 'wall_paint' and exists (select 1 from public.inventory where user_id = uid and item_id = it.id) then
    raise exception 'ALREADY_OWNED';
  end if;
  if private.balance(uid) < it.price then raise exception 'NOT_ENOUGH_STARS'; end if;

  insert into public.inventory (user_id, item_id, source) values (uid, it.id, 'shop') returning id into inv;
  if it.price > 0 then
    insert into public.star_ledger (user_id, amount, reason, ref) values (uid, -it.price, 'buy', inv::text);
  end if;
  return jsonb_build_object('inventory_id', inv, 'balance', private.balance(uid));
end $$;

-- 놓기 / 치우기 (치운 물건은 보관함에 남는다)
create function public.place_item(p_inventory_id uuid, p_floor_id uuid, p_slot_key text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_member();
  v_slot text; v_kind text;
begin
  select i.slot, i.kind into v_slot, v_kind
    from public.inventory v join public.items i on i.id = v.item_id
   where v.id = p_inventory_id and v.user_id = uid;
  if not found then raise exception 'NOT_YOURS'; end if;
  if v_kind <> 'object' then raise exception 'NOT_PLACEABLE'; end if;
  if not exists (select 1 from public.floors where id = p_floor_id and user_id = uid) then
    raise exception 'NOT_YOURS';
  end if;
  if p_slot_key !~ '^[fw][1-9]$'
     or (v_slot = 'floor' and left(p_slot_key, 1) <> 'f')
     or (v_slot = 'wall' and left(p_slot_key, 1) <> 'w') then
    raise exception 'WRONG_SLOT';
  end if;
  delete from public.placements where floor_id = p_floor_id and slot_key = p_slot_key;
  delete from public.placements where inventory_id = p_inventory_id;
  insert into public.placements (inventory_id, user_id, floor_id, slot_key)
  values (p_inventory_id, uid, p_floor_id, p_slot_key);
end $$;

create function public.unplace_item(p_inventory_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_member();
begin
  delete from public.placements where inventory_id = p_inventory_id and user_id = uid;
end $$;

-- 벽 색 바꾸기: 가진 페인트만 칠할 수 있다. p_inventory_id 가 없으면 처음 색으로.
create function public.paint_wall(p_floor_id uuid, p_inventory_id uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_member(); v_color text;
begin
  if p_inventory_id is not null then
    select i.color into v_color from public.inventory v join public.items i on i.id = v.item_id
     where v.id = p_inventory_id and v.user_id = uid and i.kind = 'wall_paint';
    if not found then raise exception 'NOT_YOURS'; end if;
  end if;
  update public.floors set wall_color = v_color where id = p_floor_id and user_id = uid;
  if not found then raise exception 'NOT_YOURS'; end if;
end $$;

-- 강의실
create function public.set_enrollment(p_course_id uuid, p_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_member();
begin
  if p_on then
    if not exists (select 1 from public.courses where id = p_course_id and active and kind = 'course') then
      raise exception 'NO_COURSE';
    end if;
    insert into public.enrollments (user_id, course_id) values (uid, p_course_id) on conflict do nothing;
  else
    delete from public.enrollments where user_id = uid and course_id = p_course_id;
  end if;
end $$;

-- 도장은 지금 듣는 강의와 무료특강에만 찍힌다.
create function public.stamp_lecture(p_course_id uuid, p_session_no int default 1, p_note text default '')
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
  if c.kind = 'free' then p_session_no := 1; end if;
  if p_session_no < 1 or p_session_no > c.session_count then raise exception 'BAD_SESSION'; end if;

  insert into public.lecture_stamps (user_id, course_id, session_no, note)
  values (uid, c.id, p_session_no, coalesce(trim(p_note), ''))
  on conflict (user_id, course_id, session_no) do nothing
  returning id into sid;
  if sid is null then raise exception 'ALREADY_STAMPED'; end if;

  got := private.give_stars(uid, private.setting_int('star_lecture_stamp', 2), 'lecture', sid::text);
  return jsonb_build_object('stamp_id', sid, 'stars', got, 'balance', private.balance(uid));
end $$;

-- 수료 신청 (예전 강의도 가능). 관리자가 확인하면 수료 아이템이 놓인다.
create function public.request_completion(p_course_id uuid, p_completed_on date default null, p_note text default '')
returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_member();
begin
  if not exists (select 1 from public.courses where id = p_course_id and kind = 'course') then
    raise exception 'NO_COURSE';
  end if;
  insert into public.completions (user_id, course_id, completed_on, note)
  values (uid, p_course_id, p_completed_on, coalesce(trim(p_note), ''))
  on conflict (user_id, course_id) do update
    set status = 'requested', completed_on = excluded.completed_on, note = excluded.note,
        requested_at = now(), decided_at = null, decided_by = null
    where public.completions.status = 'rejected';
end $$;

-- 서재
create function public.add_reading(p_book_id uuid, p_note text default '', p_attended boolean default false)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_member(); rid uuid; got int := 0;
begin
  if not exists (select 1 from public.books where id = p_book_id and active) then raise exception 'NO_BOOK'; end if;
  insert into public.readings (user_id, book_id, note, attended)
  values (uid, p_book_id, coalesce(trim(p_note), ''), coalesce(p_attended, false))
  on conflict (user_id, book_id) do update set note = excluded.note, attended = excluded.attended
  returning id into rid;
  got := private.give_stars(uid, private.setting_int('star_reading', 3), 'reading', rid::text);
  return jsonb_build_object('reading_id', rid, 'stars', got, 'balance', private.balance(uid));
end $$;

-- 취향의 방 (별과 무관, 마음껏)
create function public.add_taste(p_kind text, p_shape text, p_label text, p_emoji text default null, p_photo_path text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_member(); n int; tid uuid;
begin
  select count(*) into n from public.taste_items where user_id = uid;
  if n >= private.setting_int('taste_max', 300) then raise exception 'TASTE_FULL'; end if;
  insert into public.taste_items (user_id, kind, shape, label, emoji, photo_path)
  values (uid, p_kind, p_shape, coalesce(trim(p_label), ''), p_emoji, p_photo_path)
  returning id into tid;
  return tid;
end $$;

create function public.remove_taste(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_member();
begin
  delete from public.taste_items where id = p_id and user_id = uid;
end $$;

-- 좋은 소식 알리기
create function public.post_news(
  p_kind text, p_note text, p_url text default null, p_photo_path text default null,
  p_course_id uuid default null, p_consent boolean default false, p_name_display text default 'nick'
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_member(); nid uuid; got int := 0; d date := private.kst_today();
begin
  insert into public.news (user_id, kind, note, url, photo_path, course_id, consent, name_display)
  values (uid, p_kind, trim(p_note), nullif(trim(coalesce(p_url, '')), ''), p_photo_path, p_course_id,
          coalesce(p_consent, false), coalesce(p_name_display, 'nick'))
  returning id into nid;
  -- 하루 한 번만 별을 준다
  got := private.give_stars(uid, private.setting_int('star_news', 2), 'news', d::text);
  return jsonb_build_object('news_id', nid, 'stars', got, 'balance', private.balance(uid));
end $$;

create function public.update_news(p_id uuid, p_consent boolean, p_name_display text, p_hidden boolean default false)
returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_member();
begin
  update public.news
     set consent = p_consent, name_display = p_name_display,
         hidden_at = case when p_hidden then coalesce(hidden_at, now()) else null end
   where id = p_id and user_id = uid;
  if not found then raise exception 'NOT_YOURS'; end if;
end $$;

-- 응원: 같은 사람에게는 하루 한 번. 그날 첫 응원에만 별.
create function public.cheer(p_to_user uuid, p_news_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_member(); d date := private.kst_today(); cid uuid; got int := 0;
begin
  if p_to_user = uid then raise exception 'SELF'; end if;
  if not exists (select 1 from public.profiles where id = p_to_user) then raise exception 'NO_USER'; end if;
  insert into public.cheers (from_user, to_user, day, news_id) values (uid, p_to_user, d, p_news_id)
  on conflict (from_user, to_user, day) do nothing
  returning id into cid;
  if cid is not null then
    got := private.give_stars(uid, private.setting_int('star_cheer', 1), 'cheer', d::text);
  end if;
  return jsonb_build_object('sent', cid is not null, 'stars', got, 'balance', private.balance(uid));
end $$;

-- 내 책 (출간 단계). 출간 확인은 관리자가 한다.
create function public.save_my_book(p_id uuid, p_title text, p_stage text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_member(); bid uuid;
begin
  if p_stage = 'published' then p_stage := 'cover'; end if;
  if p_id is null then
    if (select count(*) from public.my_books where user_id = uid) >= 10 then raise exception 'TOO_MANY'; end if;
    insert into public.my_books (user_id, title, stage) values (uid, trim(p_title), p_stage) returning id into bid;
  else
    update public.my_books set title = trim(p_title), stage = p_stage
     where id = p_id and user_id = uid and stage <> 'published' returning id into bid;
    if bid is null then raise exception 'NOT_YOURS'; end if;
  end if;
  return bid;
end $$;

-- ═════════════════════════ 조회 (건물 한 채를 한 번에) ═════════════════════════

create function private.building_json(p_uid uuid, p_public boolean) returns jsonb
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
            'item', jsonb_build_object('id', i.id, 'name', i.name, 'emoji', i.emoji, 'image_url', i.image_url, 'slot', i.slot)))
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
                              from public.lecture_stamps ls where ls.user_id = p_uid and ls.course_id = c.id), '[]'::jsonb)
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

create function public.get_building(p_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := private.require_member(); b jsonb;
begin
  b := private.building_json(p_user_id, p_user_id <> uid);
  if b is null then raise exception 'NO_USER'; end if;
  return b || jsonb_build_object(
    'cheered_today', exists (select 1 from public.cheers
                              where from_user = uid and to_user = p_user_id and day = private.kst_today()));
end $$;

-- 로그인 없이 보는 공개 건물. 본인이 공개로 바꾼 건물만 열린다.
create function public.get_public_building(p_key text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid;
begin
  select id into uid from public.profiles where public_key = p_key and is_public;
  if uid is null then return null; end if;
  return private.building_json(uid, true);
end $$;

-- 「오늘」 화면에 필요한 것
create function public.get_today() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := private.require_member();
  w date := private.week_start(private.kst_today());
begin
  return jsonb_build_object(
    'today', private.kst_today(),
    'week_start', w,
    'balance', private.balance(uid),
    'week_records', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'floor_id', r.floor_id, 'input_type', r.input_type, 'url', r.url, 'note', r.note,
        'day', r.day, 'starred', r.starred, 'created_at', r.created_at) order by r.created_at desc)
      from public.records r where r.user_id = uid and r.week_start = w and r.voided_at is null), '[]'::jsonb),
    'stamp_weeks', coalesce((
      select jsonb_agg(ws.week_start order by ws.week_start)
        from public.weekly_stamps ws where ws.user_id = uid), '[]'::jsonb),
    'recent_cheers', coalesce((
      select jsonb_agg(x) from (
        select jsonb_build_object('from', pr.nickname, 'day', c.day) x
          from public.cheers c join public.profiles pr on pr.id = c.from_user
         where c.to_user = uid and c.created_at > now() - interval '7 days'
         order by c.created_at desc limit 10) s), '[]'::jsonb),
    'pending_completions', (select count(*) from public.completions where user_id = uid and status = 'requested')
  );
end $$;

-- 마을 지도: 건물 요약 목록
create function public.get_town() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := private.require_member();
  w date := private.week_start(private.kst_today());
  d date := private.kst_today();
begin
  return jsonb_build_object(
    'me', uid,
    'buildings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'nickname', p.nickname, 'brand_name', p.brand_name, 'brand_color', p.brand_color,
        'plot_no', p.plot_no,
        'floors', (select jsonb_agg(jsonb_build_object('kind', f.kind, 'channel_type', f.channel_type,
                                                        'wall_color', f.wall_color) order by f.position)
                     from public.floors f where f.user_id = p.id),
        'week_count', (select count(*) from public.records r
                        where r.user_id = p.id and r.week_start = w and r.voided_at is null),
        'banner', (select jsonb_build_object('id', n.id, 'kind', n.kind, 'note', n.note)
                     from public.news n
                    where n.user_id = p.id and n.hidden_at is null
                      and n.created_at > now() - make_interval(days => private.setting_int('banner_days', 14))
                    order by n.created_at desc limit 1),
        'cheered_today', exists (select 1 from public.cheers c
                                  where c.from_user = uid and c.to_user = p.id and c.day = d)
      ) order by p.plot_no)
      from public.profiles p), '[]'::jsonb),
    'news', coalesce((
      select jsonb_agg(x) from (
        select jsonb_build_object('id', n.id, 'user_id', n.user_id, 'nickname', pr.nickname, 'kind', n.kind,
                                  'note', n.note, 'created_at', n.created_at, 'featured', n.featured_at is not null) x
          from public.news n join public.profiles pr on pr.id = n.user_id
         where n.hidden_at is null
         order by n.created_at desc limit 20) s), '[]'::jsonb),
    'week_total', (select count(*) from public.records r where r.week_start = w and r.voided_at is null)
  );
end $$;

-- ═════════════════════════ 관리자 동작 ═════════════════════════

create function private.log(p_action text, p_target text, p_detail jsonb default '{}') returns void
language sql set search_path = '' as $$
  insert into public.audit_logs (admin_id, action, target, detail) values (auth.uid(), p_action, p_target, p_detail)
$$;

create function private.approve_completion(p_id uuid, p_completed_on date, p_admin uuid) returns void
language plpgsql set search_path = '' as $$
declare cm public.completions; c public.courses;
begin
  select * into cm from public.completions where id = p_id for update;
  if not found then raise exception 'NO_REQUEST'; end if;
  select * into c from public.courses where id = cm.course_id;
  update public.completions
     set status = 'approved', completed_on = coalesce(p_completed_on, completed_on, private.kst_today()),
         decided_at = now(), decided_by = p_admin
   where id = p_id;
  if c.reward_item_id is not null and not exists
     (select 1 from public.inventory where user_id = cm.user_id and source = 'completion:' || c.id::text) then
    insert into public.inventory (user_id, item_id, source)
    values (cm.user_id, c.reward_item_id, 'completion:' || c.id::text);
  end if;
  perform private.give_stars(cm.user_id, private.setting_int('star_completion', 5), 'completion', c.id::text);
end $$;

create function public.admin_decide_completion(p_id uuid, p_approve boolean, p_completed_on date default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare aid uuid := private.require_admin();
begin
  if p_approve then
    perform private.approve_completion(p_id, p_completed_on, aid);
  else
    update public.completions set status = 'rejected', decided_at = now(), decided_by = aid
     where id = p_id and status = 'requested';
  end if;
  perform private.log('completion_' || case when p_approve then 'approve' else 'reject' end, p_id::text);
end $$;

-- 한꺼번에 수료 처리 (예전 수강생 소급)
create function public.admin_grant_completions(p_course_id uuid, p_user_ids uuid[], p_completed_on date default null)
returns int
language plpgsql security definer set search_path = '' as $$
declare aid uuid := private.require_admin(); u uuid; cid uuid; n int := 0;
begin
  foreach u in array p_user_ids loop
    insert into public.completions (user_id, course_id, completed_on)
    values (u, p_course_id, p_completed_on)
    on conflict (user_id, course_id) do update set completed_on = coalesce(excluded.completed_on, public.completions.completed_on)
    returning id into cid;
    perform private.approve_completion(cid, p_completed_on, aid);
    n := n + 1;
  end loop;
  perform private.log('completion_bulk', p_course_id::text, jsonb_build_object('count', n));
  return n;
end $$;

create function public.admin_void_record(p_record_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare aid uuid := private.require_admin();
begin
  perform private.void_record(p_record_id, aid);
  perform private.log('record_void', p_record_id::text);
end $$;

create function public.admin_feature_news(p_id uuid, p_on boolean, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare aid uuid := private.require_admin(); n public.news;
begin
  select * into n from public.news where id = p_id;
  if not found then raise exception 'NO_NEWS'; end if;
  if p_on and not n.consent then raise exception 'NO_CONSENT'; end if;
  update public.news set featured_at = case when p_on then coalesce(featured_at, now()) end,
                         featured_note = case when p_on then p_note end
   where id = p_id;
  if p_on then
    perform private.give_stars(n.user_id, private.setting_int('star_featured', 10), 'featured', p_id::text);
  end if;
  perform private.log('news_feature', p_id::text, jsonb_build_object('on', p_on));
end $$;

create function public.admin_approve_book(p_id uuid, p_isbn text, p_buy_url text, p_cover_url text) returns void
language plpgsql security definer set search_path = '' as $$
declare aid uuid := private.require_admin();
begin
  update public.my_books
     set stage = 'published', isbn = nullif(trim(coalesce(p_isbn, '')), ''),
         buy_url = nullif(trim(coalesce(p_buy_url, '')), ''),
         cover_url = coalesce(nullif(trim(coalesce(p_cover_url, '')), ''), cover_url),
         approved_at = now()
   where id = p_id;
  perform private.log('book_approve', p_id::text);
end $$;

create function public.admin_give_stars(p_user_id uuid, p_amount int, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare aid uuid := private.require_admin();
begin
  insert into public.star_ledger (user_id, amount, reason, ref)
  values (p_user_id, p_amount, 'admin', gen_random_uuid()::text);
  perform private.log('stars_give', p_user_id::text, jsonb_build_object('amount', p_amount, 'note', p_note));
end $$;

create function public.admin_give_item(p_user_id uuid, p_item_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare aid uuid := private.require_admin();
begin
  insert into public.inventory (user_id, item_id, source) values (p_user_id, p_item_id, 'gift');
  perform private.log('item_give', p_user_id::text, jsonb_build_object('item', p_item_id));
end $$;

-- 월요일 아침 요약: 지난주(월~일) 기준
create function public.admin_summary() returns jsonb
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
    'news_waiting', (select count(*) from public.news where consent and featured_at is null and hidden_at is null),
    'this_week_records', (select count(*) from public.records where week_start = this_w and voided_at is null)
  );
end $$;

-- ═════════════════════════ 권한 ═════════════════════════

alter table public.settings        enable row level security;
alter table public.profiles        enable row level security;
alter table public.invite_codes    enable row level security;
alter table public.floors          enable row level security;
alter table public.records         enable row level security;
alter table public.star_ledger     enable row level security;
alter table public.weekly_stamps   enable row level security;
alter table public.items           enable row level security;
alter table public.inventory       enable row level security;
alter table public.placements      enable row level security;
alter table public.courses         enable row level security;
alter table public.enrollments     enable row level security;
alter table public.lecture_stamps  enable row level security;
alter table public.completions     enable row level security;
alter table public.books           enable row level security;
alter table public.readings        enable row level security;
alter table public.taste_catalog   enable row level security;
alter table public.taste_items     enable row level security;
alter table public.news            enable row level security;
alter table public.my_books        enable row level security;
alter table public.cheers          enable row level security;
alter table public.audit_logs      enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;

grant usage on schema private to authenticated;
grant execute on function private.is_admin(), private.is_member() to authenticated;

-- 읽기: 회원끼리는 서로의 건물을 구경할 수 있다. 별 원장은 본인만 본다.
grant select on public.settings, public.profiles, public.floors, public.records, public.star_ledger,
  public.weekly_stamps, public.items, public.inventory, public.placements, public.courses,
  public.enrollments, public.lecture_stamps, public.completions, public.books, public.readings,
  public.taste_catalog, public.taste_items, public.news, public.my_books, public.cheers,
  public.invite_codes, public.audit_logs
  to authenticated;

-- 본인이 직접 고칠 수 있는 것은 이 칸들뿐이다 (역할·공개키는 못 고친다).
grant update (nickname, brand_name, tagline, brand_color, is_public, weekly_goal) on public.profiles to authenticated;

-- 관리자가 화면에서 직접 관리하는 표 (RLS 가 관리자로 제한한다)
grant insert, update, delete on public.settings, public.items, public.courses, public.books,
  public.taste_catalog, public.invite_codes to authenticated;

create policy "members read"  on public.settings      for select to authenticated using ((select private.is_member()));
create policy "admin write"   on public.settings      for all    to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "members read"  on public.profiles      for select to authenticated using ((select private.is_member()) or id = (select auth.uid()));
create policy "own update"    on public.profiles      for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "admin all"     on public.invite_codes  for all    to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "members read"  on public.floors        for select to authenticated using ((select private.is_member()));
create policy "members read"  on public.records       for select to authenticated using (user_id = (select auth.uid()) or (select private.is_admin()) or (voided_at is null and (select private.is_member())));
create policy "own read"      on public.star_ledger   for select to authenticated using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "members read"  on public.weekly_stamps for select to authenticated using ((select private.is_member()));

create policy "members read"  on public.items         for select to authenticated using ((select private.is_member()));
create policy "admin write"   on public.items         for all    to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "members read"  on public.inventory     for select to authenticated using ((select private.is_member()));
create policy "members read"  on public.placements    for select to authenticated using ((select private.is_member()));

create policy "members read"  on public.courses       for select to authenticated using ((select private.is_member()));
create policy "admin write"   on public.courses       for all    to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "members read"  on public.enrollments   for select to authenticated using ((select private.is_member()));
create policy "members read"  on public.lecture_stamps for select to authenticated using ((select private.is_member()));
create policy "own or admin"  on public.completions   for select to authenticated using (user_id = (select auth.uid()) or (select private.is_admin()) or (status = 'approved' and (select private.is_member())));

create policy "members read"  on public.books         for select to authenticated using ((select private.is_member()));
create policy "admin write"   on public.books         for all    to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "members read"  on public.readings      for select to authenticated using ((select private.is_member()));

create policy "members read"  on public.taste_catalog for select to authenticated using ((select private.is_member()));
create policy "admin write"   on public.taste_catalog for all    to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "members read"  on public.taste_items   for select to authenticated using ((select private.is_member()));

create policy "members read"  on public.news          for select to authenticated using (user_id = (select auth.uid()) or (select private.is_admin()) or (hidden_at is null and (select private.is_member())));
create policy "members read"  on public.my_books      for select to authenticated using ((select private.is_member()));
create policy "members read"  on public.cheers        for select to authenticated using ((select private.is_member()));
create policy "admin read"    on public.audit_logs    for select to authenticated using ((select private.is_admin()));

-- 회원이 부를 수 있는 동작
grant execute on function
  public.join_town(text, text, text, text, text, text, text),
  public.add_channel_floor(text, text, text),
  public.update_floor_channel(uuid, text, text),
  public.add_record(uuid, text, text, text, text),
  public.undo_record(uuid),
  public.buy_item(uuid),
  public.place_item(uuid, uuid, text),
  public.unplace_item(uuid),
  public.paint_wall(uuid, uuid),
  public.set_enrollment(uuid, boolean),
  public.stamp_lecture(uuid, int, text),
  public.request_completion(uuid, date, text),
  public.add_reading(uuid, text, boolean),
  public.add_taste(text, text, text, text, text),
  public.remove_taste(uuid),
  public.post_news(text, text, text, text, uuid, boolean, text),
  public.update_news(uuid, boolean, text, boolean),
  public.cheer(uuid, uuid),
  public.save_my_book(uuid, text, text),
  public.get_building(uuid),
  public.get_today(),
  public.get_town(),
  public.admin_decide_completion(uuid, boolean, date),
  public.admin_grant_completions(uuid, uuid[], date),
  public.admin_void_record(uuid),
  public.admin_feature_news(uuid, boolean, text),
  public.admin_approve_book(uuid, text, text, text),
  public.admin_give_stars(uuid, int, text),
  public.admin_give_item(uuid, uuid),
  public.admin_summary()
  to authenticated;

-- 로그인 없이 부를 수 있는 것은 공개 건물 조회 하나뿐이다.
grant execute on function public.get_public_building(text) to anon, authenticated;

-- 앞으로 만드는 함수도 기본으로는 아무에게도 열지 않는다.
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated;

-- ═════════════════════════ 사진 보관 ═════════════════════════
-- shared: 취향·소식 사진, 물건 그림 (누구나 볼 수 있음, 경로는 추측 불가)
-- proofs: 기록 캡처 (본인과 관리자만)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('shared', 'shared', true,  3145728, array['image/jpeg','image/png','image/webp']),
  ('proofs', 'proofs', false, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "shared: own folder upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'shared' and (storage.foldername(name))[1] = (select auth.uid())::text and (select private.is_member()));
create policy "shared: own folder delete" on storage.objects for delete to authenticated
  using (bucket_id = 'shared' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "shared: admin items upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'shared' and (storage.foldername(name))[1] = 'items' and (select private.is_admin()));
create policy "proofs: own folder upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'proofs' and (storage.foldername(name))[1] = (select auth.uid())::text and (select private.is_member()));
create policy "proofs: own or admin read" on storage.objects for select to authenticated
  using (bucket_id = 'proofs' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_admin())));
