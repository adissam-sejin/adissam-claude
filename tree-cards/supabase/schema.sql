-- 메시지 나무 — Supabase 스키마
-- 실시간 저장소는 Supabase, 노션은 자동으로 복사되는 기록 보관소입니다.
-- 표는 외부에 노출되지 않는 msgtree 스키마에 두고, public 에는 mt_ 로 시작하는 함수만 둡니다.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists msgtree;

create table if not exists msgtree.trees (
  id             bigint generated always as identity primary key,
  code           text not null check (code ~ '^[A-Z0-9]{4,12}$'),
  name           text not null check (char_length(name) between 1 and 40),
  theme          text not null check (theme in ('christmas', 'persimmon', 'cherry')),
  start_at       timestamptz,
  end_at         timestamptz,
  created_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  notion_page_id text,
  notion_dirty   boolean not null default true
);
create unique index if not exists trees_code_live on msgtree.trees(code) where deleted_at is null;

create table if not exists msgtree.cards (
  id             bigint generated always as identity primary key,
  tree_id        bigint not null references msgtree.trees(id) on delete cascade,
  author         text not null check (char_length(author) between 1 and 12),
  body           text not null check (char_length(body) between 1 and 500),
  created_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  notion_page_id text
);
create index if not exists cards_tree_live on msgtree.cards(tree_id, id) where deleted_at is null;
create index if not exists cards_sync_todo on msgtree.cards(id) where notion_page_id is null or deleted_at is not null;

create table if not exists msgtree.settings (
  id                int primary key default 1 check (id = 1),
  admin_hash        text,
  sync_url          text,
  sync_secret       text,
  sync_locked_until timestamptz
);
insert into msgtree.settings (id) values (1) on conflict do nothing;

alter table msgtree.trees    enable row level security;
alter table msgtree.cards    enable row level security;
alter table msgtree.settings enable row level security;

-- ───────────── 내부 함수 ─────────────
create or replace function msgtree.check_admin(p_pw text) returns void
language plpgsql security definer set search_path = msgtree, extensions as $$
begin
  if p_pw is null or not exists (
    select 1 from settings where id = 1 and admin_hash is not null and admin_hash = crypt(p_pw, admin_hash)
  ) then
    raise exception 'BAD_PASSWORD';
  end if;
end $$;

-- 같은 나무를 보고 있는 화면들에 "바뀌었다"고 알린다 (Supabase Realtime)
create or replace function msgtree.notify(p_code text) returns void
language plpgsql security definer set search_path = msgtree as $$
begin
  perform realtime.send(jsonb_build_object('at', extract(epoch from clock_timestamp())),
                        'changed', 'tree:' || p_code, false);
exception when others then
  null; -- 알림이 실패해도 저장은 되어야 한다 (화면은 주기적으로도 새로 읽는다)
end $$;

create or replace function public.mt_set_admin_password(p_pw text) returns void
language plpgsql security definer set search_path = msgtree, extensions as $$
begin
  if char_length(coalesce(p_pw, '')) < 8 then
    raise exception '비밀번호는 8자 이상이어야 합니다';
  end if;
  update settings set admin_hash = crypt(p_pw, gen_salt('bf', 10)) where id = 1;
end $$;

-- ───────────── 사용자용 ─────────────
create or replace function public.mt_get_tree(p_code text) returns json
language plpgsql stable security definer set search_path = msgtree as $$
declare t trees;
begin
  select * into t from trees where code = upper(trim(p_code)) and deleted_at is null;
  if not found then raise exception 'TREE_NOT_FOUND'; end if;
  return json_build_object(
    'tree', json_build_object('code', t.code, 'name', t.name, 'theme', t.theme,
                              'start_at', t.start_at, 'end_at', t.end_at),
    'cards', coalesce((
      select json_agg(json_build_object('id', c.id, 'author', c.author, 'body', c.body,
                                        'created_at', c.created_at) order by c.id)
      from cards c where c.tree_id = t.id and c.deleted_at is null), '[]'::json)
  );
end $$;

create or replace function public.mt_add_card(p_code text, p_author text, p_body text) returns json
language plpgsql security definer set search_path = msgtree as $$
declare t trees; c cards;
begin
  select * into t from trees where code = upper(trim(p_code)) and deleted_at is null;
  if not found then raise exception 'TREE_NOT_FOUND'; end if;
  p_author := trim(coalesce(p_author, ''));
  p_body   := trim(coalesce(p_body, ''));
  if char_length(p_author) not between 1 and 12 or char_length(p_body) not between 1 and 500 then
    raise exception 'BAD_INPUT';
  end if;
  if t.start_at is not null and now() < t.start_at then raise exception 'NOT_STARTED'; end if;
  if t.end_at   is not null and now() > t.end_at   then raise exception 'ENDED'; end if;
  insert into cards (tree_id, author, body) values (t.id, p_author, p_body) returning * into c;
  perform notify(t.code);
  return json_build_object('id', c.id, 'author', c.author, 'body', c.body, 'created_at', c.created_at);
end $$;

-- ───────────── 관리자용 (비밀번호 필요) ─────────────
create or replace function public.mt_admin_list_trees(p_pw text) returns json
language plpgsql stable security definer set search_path = msgtree as $$
begin
  perform check_admin(p_pw);
  return coalesce((
    select json_agg(json_build_object(
      'code', t.code, 'name', t.name, 'theme', t.theme, 'start_at', t.start_at,
      'end_at', t.end_at, 'created_at', t.created_at,
      'card_count', (select count(*) from cards c where c.tree_id = t.id and c.deleted_at is null)
    ) order by t.created_at desc)
    from trees t where t.deleted_at is null), '[]'::json);
end $$;

create or replace function public.mt_admin_save_tree(
  p_pw text, p_code text, p_name text, p_theme text,
  p_start timestamptz, p_end timestamptz, p_is_new boolean
) returns json
language plpgsql security definer set search_path = msgtree as $$
declare v_code text := upper(trim(coalesce(p_code, '')));
        v_name text := trim(coalesce(p_name, ''));
begin
  perform check_admin(p_pw);
  if v_code !~ '^[A-Z0-9]{4,12}$' then raise exception 'BAD_CODE'; end if;
  if char_length(v_name) not between 1 and 40
     or p_theme is null or p_theme not in ('christmas', 'persimmon', 'cherry') then
    raise exception 'BAD_INPUT';
  end if;
  if p_start is not null and p_end is not null and p_end <= p_start then
    raise exception 'BAD_PERIOD';
  end if;
  if p_is_new then
    if exists (select 1 from trees where code = v_code and deleted_at is null) then
      raise exception 'CODE_EXISTS';
    end if;
    insert into trees (code, name, theme, start_at, end_at)
    values (v_code, v_name, p_theme, p_start, p_end);
  else
    update trees set name = v_name, theme = p_theme, start_at = p_start, end_at = p_end,
                     notion_dirty = true
    where code = v_code and deleted_at is null;
    if not found then raise exception 'TREE_NOT_FOUND'; end if;
    perform notify(v_code);
  end if;
  return json_build_object('code', v_code);
end $$;

create or replace function public.mt_admin_delete_tree(p_pw text, p_code text) returns boolean
language plpgsql security definer set search_path = msgtree as $$
declare v_id bigint;
begin
  perform check_admin(p_pw);
  update trees set deleted_at = now() where code = upper(trim(p_code)) and deleted_at is null
  returning id into v_id;
  if v_id is not null then
    update cards set deleted_at = now() where tree_id = v_id and deleted_at is null;
    perform notify(upper(trim(p_code)));
  end if;
  return true;
end $$;

create or replace function public.mt_admin_delete_card(p_pw text, p_id bigint) returns boolean
language plpgsql security definer set search_path = msgtree as $$
declare v_code text;
begin
  perform check_admin(p_pw);
  update cards c set deleted_at = now() from trees t
  where c.id = p_id and c.deleted_at is null and t.id = c.tree_id
  returning t.code into v_code;
  if v_code is not null then perform notify(v_code); end if;
  return true;
end $$;

-- ───────────── 노션 복사용 (서버 함수 notion-sync 만 호출) ─────────────
-- 호출 암호(DB 가 만들어 보관)가 맞고, 다른 실행이 없을 때만 시작한다
create or replace function public.mt_sync_begin(p_secret text) returns boolean
language plpgsql security definer set search_path = msgtree as $$
declare ok boolean;
begin
  update settings set sync_locked_until = now() + interval '50 seconds'
  where id = 1 and sync_secret is not null and sync_secret = p_secret
    and (sync_locked_until is null or sync_locked_until < now())
  returning true into ok;
  return coalesce(ok, false);
end $$;

create or replace function public.mt_sync_end() returns void
language sql security definer set search_path = msgtree as $$
  update settings set sync_locked_until = null where id = 1;
$$;

-- 노션에 반영할 일거리를 조금씩 꺼낸다
create or replace function public.mt_sync_pending() returns json
language plpgsql security definer set search_path = msgtree as $$
begin
  -- 노션에 올라간 적 없는 삭제분은 바로 지운다
  delete from cards where deleted_at is not null and notion_page_id is null;
  delete from trees t where t.deleted_at is not null and t.notion_page_id is null
    and not exists (select 1 from cards c where c.tree_id = t.id);

  return json_build_object(
    'trees_upsert', coalesce((select json_agg(x) from (
      select id, code, name, theme, start_at, end_at, notion_page_id
      from trees where deleted_at is null and (notion_page_id is null or notion_dirty)
      order by id limit 10) x), '[]'::json),
    'cards_create', coalesce((select json_agg(x) from (
      select c.id, c.author, c.body, t.notion_page_id as tree_page_id
      from cards c join trees t on t.id = c.tree_id
      where c.deleted_at is null and c.notion_page_id is null and t.notion_page_id is not null
      order by c.id limit 40) x), '[]'::json),
    'cards_archive', coalesce((select json_agg(x) from (
      select id, notion_page_id from cards
      where deleted_at is not null and notion_page_id is not null order by id limit 40) x), '[]'::json),
    'trees_archive', coalesce((select json_agg(x) from (
      select t.id, t.notion_page_id from trees t
      where t.deleted_at is not null and t.notion_page_id is not null
        and not exists (select 1 from cards c where c.tree_id = t.id)
      order by t.id limit 10) x), '[]'::json)
  );
end $$;

create or replace function public.mt_sync_tree_done(p_id bigint, p_page_id text) returns void
language sql security definer set search_path = msgtree as $$
  update trees set notion_page_id = p_page_id, notion_dirty = false where id = p_id;
$$;
create or replace function public.mt_sync_card_done(p_id bigint, p_page_id text) returns void
language sql security definer set search_path = msgtree as $$
  update cards set notion_page_id = p_page_id where id = p_id;
$$;
create or replace function public.mt_sync_card_purged(p_id bigint) returns void
language sql security definer set search_path = msgtree as $$
  delete from cards where id = p_id and deleted_at is not null;
$$;
create or replace function public.mt_sync_tree_purged(p_id bigint) returns void
language sql security definer set search_path = msgtree as $$
  delete from trees where id = p_id and deleted_at is not null;
$$;

-- 주기적으로 불려서, 할 일이 있을 때만 notion-sync 서버 함수를 깨운다
create or replace function public.mt_sync_kick() returns void
language plpgsql security definer set search_path = msgtree as $$
declare s settings;
begin
  select * into s from settings where id = 1;
  if s.sync_url is null or s.sync_secret is null then return; end if;
  if s.sync_locked_until is not null and s.sync_locked_until > now() then return; end if;
  if not exists (select 1 from trees where notion_page_id is null or notion_dirty or deleted_at is not null)
     and not exists (select 1 from cards where notion_page_id is null or deleted_at is not null) then
    return;
  end if;
  perform net.http_post(
    url := s.sync_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-sync-secret', s.sync_secret),
    body := '{}'::jsonb
  );
end $$;

-- ───────────── 권한 ─────────────
revoke all on all functions in schema msgtree from public, anon, authenticated;
revoke all on function public.mt_set_admin_password(text) from public, anon, authenticated;
revoke all on function public.mt_sync_begin(text), public.mt_sync_end(), public.mt_sync_pending(),
  public.mt_sync_tree_done(bigint, text), public.mt_sync_card_done(bigint, text),
  public.mt_sync_card_purged(bigint), public.mt_sync_tree_purged(bigint), public.mt_sync_kick()
  from public, anon, authenticated;
grant execute on function public.mt_sync_begin(text), public.mt_sync_end(), public.mt_sync_pending(),
  public.mt_sync_tree_done(bigint, text), public.mt_sync_card_done(bigint, text),
  public.mt_sync_card_purged(bigint), public.mt_sync_tree_purged(bigint) to service_role;

grant execute on function public.mt_get_tree(text)                  to anon, authenticated;
grant execute on function public.mt_add_card(text, text, text)      to anon, authenticated;
grant execute on function public.mt_admin_list_trees(text)          to anon, authenticated;
grant execute on function public.mt_admin_save_tree(text, text, text, text, timestamptz, timestamptz, boolean) to anon, authenticated;
grant execute on function public.mt_admin_delete_tree(text, text)   to anon, authenticated;
grant execute on function public.mt_admin_delete_card(text, bigint) to anon, authenticated;

-- 관리자 비밀번호 설정 (SQL Editor 에서 한 번 실행):
-- select public.mt_set_admin_password('여기에-관리자-비밀번호');
