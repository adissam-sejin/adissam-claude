-- 메시지 나무 (크리스마스 트리 / 감나무 / 벚꽃나무) — Supabase 스키마
-- Supabase 대시보드 > SQL Editor 에 전체를 붙여넣고 실행하세요.
-- 실행 후 맨 아래 안내대로 관리자 비밀번호를 한 번 설정해야 합니다.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.trees (
  code       text primary key check (code ~ '^[A-Z0-9]{4,12}$'),
  name       text not null check (char_length(name) between 1 and 40),
  theme      text not null check (theme in ('christmas', 'persimmon', 'cherry')),
  start_at   timestamptz,
  end_at     timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.cards (
  id         bigint generated always as identity primary key,
  tree_code  text not null references public.trees(code) on delete cascade,
  author     text not null check (char_length(author) between 1 and 12),
  body       text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists cards_tree_code_idx on public.cards(tree_code, id);

create table if not exists public.app_admin (
  id            int primary key default 1 check (id = 1),
  password_hash text not null
);

-- 테이블은 직접 접근을 막고, 아래 함수로만 읽고 씁니다.
alter table public.trees     enable row level security;
alter table public.cards     enable row level security;
alter table public.app_admin enable row level security;

-- ───────────── 내부 함수 ─────────────
create or replace function public._check_admin(p_pw text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_pw is null or not exists (
    select 1 from app_admin where id = 1 and password_hash = crypt(p_pw, password_hash)
  ) then
    raise exception 'BAD_PASSWORD';
  end if;
end $$;

create or replace function public.set_admin_password(p_pw text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if char_length(coalesce(p_pw, '')) < 8 then
    raise exception '비밀번호는 8자 이상이어야 합니다';
  end if;
  insert into app_admin (id, password_hash) values (1, crypt(p_pw, gen_salt('bf', 10)))
  on conflict (id) do update set password_hash = excluded.password_hash;
end $$;

-- ───────────── 사용자용 ─────────────
create or replace function public.get_tree(p_code text) returns json
language plpgsql stable security definer set search_path = public as $$
declare t trees;
begin
  select * into t from trees where code = upper(trim(p_code));
  if not found then raise exception 'TREE_NOT_FOUND'; end if;
  return json_build_object(
    'tree', json_build_object('code', t.code, 'name', t.name, 'theme', t.theme,
                              'start_at', t.start_at, 'end_at', t.end_at),
    'cards', coalesce((
      select json_agg(json_build_object('id', c.id, 'author', c.author, 'body', c.body,
                                        'created_at', c.created_at) order by c.id)
      from cards c where c.tree_code = t.code), '[]'::json)
  );
end $$;

create or replace function public.add_card(p_code text, p_author text, p_body text) returns json
language plpgsql security definer set search_path = public as $$
declare t trees; c cards;
begin
  select * into t from trees where code = upper(trim(p_code));
  if not found then raise exception 'TREE_NOT_FOUND'; end if;
  p_author := trim(coalesce(p_author, ''));
  p_body   := trim(coalesce(p_body, ''));
  if char_length(p_author) not between 1 and 12 or char_length(p_body) not between 1 and 500 then
    raise exception 'BAD_INPUT';
  end if;
  if t.start_at is not null and now() < t.start_at then raise exception 'NOT_STARTED'; end if;
  if t.end_at   is not null and now() > t.end_at   then raise exception 'ENDED'; end if;
  insert into cards (tree_code, author, body) values (t.code, p_author, p_body) returning * into c;
  return json_build_object('id', c.id, 'author', c.author, 'body', c.body, 'created_at', c.created_at);
end $$;

-- ───────────── 관리자용 (비밀번호 필요) ─────────────
create or replace function public.admin_list_trees(p_pw text) returns json
language plpgsql stable security definer set search_path = public as $$
begin
  perform _check_admin(p_pw);
  return coalesce((
    select json_agg(json_build_object(
      'code', t.code, 'name', t.name, 'theme', t.theme, 'start_at', t.start_at,
      'end_at', t.end_at, 'created_at', t.created_at,
      'card_count', (select count(*) from cards c where c.tree_code = t.code)
    ) order by t.created_at desc)
    from trees t), '[]'::json);
end $$;

create or replace function public.admin_save_tree(
  p_pw text, p_code text, p_name text, p_theme text,
  p_start timestamptz, p_end timestamptz, p_is_new boolean
) returns json
language plpgsql security definer set search_path = public as $$
declare v_code text := upper(trim(coalesce(p_code, '')));
        v_name text := trim(coalesce(p_name, ''));
begin
  perform _check_admin(p_pw);
  if v_code !~ '^[A-Z0-9]{4,12}$' then raise exception 'BAD_CODE'; end if;
  if char_length(v_name) not between 1 and 40
     or p_theme not in ('christmas', 'persimmon', 'cherry') then
    raise exception 'BAD_INPUT';
  end if;
  if p_start is not null and p_end is not null and p_end <= p_start then
    raise exception 'BAD_PERIOD';
  end if;
  if p_is_new then
    if exists (select 1 from trees where code = v_code) then raise exception 'CODE_EXISTS'; end if;
    insert into trees (code, name, theme, start_at, end_at)
    values (v_code, v_name, p_theme, p_start, p_end);
  else
    update trees set name = v_name, theme = p_theme, start_at = p_start, end_at = p_end
    where code = v_code;
    if not found then raise exception 'TREE_NOT_FOUND'; end if;
  end if;
  return json_build_object('code', v_code);
end $$;

create or replace function public.admin_delete_tree(p_pw text, p_code text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  perform _check_admin(p_pw);
  delete from trees where code = upper(trim(p_code));
  return true;
end $$;

create or replace function public.admin_delete_card(p_pw text, p_id bigint) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  perform _check_admin(p_pw);
  delete from cards where id = p_id;
  return true;
end $$;

-- ───────────── 권한 ─────────────
revoke all on function public._check_admin(text)        from public, anon, authenticated;
revoke all on function public.set_admin_password(text)  from public, anon, authenticated;

grant execute on function public.get_tree(text)                 to anon, authenticated;
grant execute on function public.add_card(text, text, text)     to anon, authenticated;
grant execute on function public.admin_list_trees(text)         to anon, authenticated;
grant execute on function public.admin_save_tree(text, text, text, text, timestamptz, timestamptz, boolean) to anon, authenticated;
grant execute on function public.admin_delete_tree(text, text)  to anon, authenticated;
grant execute on function public.admin_delete_card(text, bigint) to anon, authenticated;

-- ───────────── 마지막 단계: 관리자 비밀번호 설정 ─────────────
-- 아래 줄의 비밀번호를 원하는 값(8자 이상, 길고 추측하기 어려운 값)으로 바꿔 따로 실행하세요.
-- select public.set_admin_password('여기에-관리자-비밀번호');
