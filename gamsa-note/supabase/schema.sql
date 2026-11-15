-- =====================================================================
-- 감사노트 · 감 농장  —  Supabase 스키마
-- Supabase 대시보드 > SQL Editor 에 전체를 붙여넣고 Run 하세요.
-- (여러 번 실행해도 안전하도록 작성되어 있습니다)
-- =====================================================================

-- ---------- 프로필 ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  kakao_name  text,
  nickname    text not null default '감사러',
  avatar_url  text,
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now(),
  constraint nickname_len check (char_length(nickname) between 1 and 20)
);

-- 가입 시 카카오 정보로 프로필 자동 생성
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  kname text := coalesce(
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'nickname',
    new.raw_user_meta_data->>'user_name',
    '감사러');
begin
  insert into public.profiles (id, kakao_name, nickname, avatar_url)
  values (new.id, kname, left(kname, 20),
          coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- ---------- 감나무(그룹) ----------
create table if not exists public.trees (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 30),
  code        text not null unique check (code ~ '^[A-Z0-9]{4,16}$'),
  start_date  date not null,
  end_date    date not null,
  created_at  timestamptz not null default now(),
  constraint period_ok check (end_date >= start_date)
);

create table if not exists public.tree_members (
  tree_id    uuid not null references public.trees(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (tree_id, user_id)
);

-- ---------- 감사노트 ----------
create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  note_date   date not null,
  content     text not null check (char_length(content) between 1 and 600),
  photo_path  text,
  is_public   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, note_date)
);
create index if not exists notes_public_idx on public.notes (created_at desc) where is_public;
create index if not exists notes_user_date_idx on public.notes (user_id, note_date);

create table if not exists public.likes (
  note_id    uuid not null references public.notes(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (note_id, user_id)
);

create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  note_id    uuid not null references public.notes(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  content    text not null check (char_length(content) between 1 and 300),
  created_at timestamptz not null default now()
);
create index if not exists comments_note_idx on public.comments (note_id, created_at);

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.profiles     enable row level security;
alter table public.trees        enable row level security;
alter table public.tree_members enable row level security;
alter table public.notes        enable row level security;
alter table public.likes        enable row level security;
alter table public.comments     enable row level security;

-- profiles: 로그인 사용자는 닉네임/아바타 조회 가능, 본인 것만 수정 (is_admin 은 수정 불가)
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (true);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated, anon;
grant update (nickname, avatar_url) on public.profiles to authenticated;

-- trees: 관리자만 직접 접근 (일반 사용자는 아래 함수로만 조회 → 코드 비공개)
drop policy if exists trees_admin on public.trees;
create policy trees_admin on public.trees for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- tree_members: 본인 소속만 조회/탈퇴, 관리자는 전체
drop policy if exists members_select on public.tree_members;
create policy members_select on public.tree_members for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists members_delete on public.tree_members;
create policy members_delete on public.tree_members for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- notes: 본인 것 + 공개된 것만 조회, 본인 것만 작성/수정/삭제
drop policy if exists notes_select on public.notes;
create policy notes_select on public.notes for select to authenticated
  using (user_id = auth.uid() or is_public);
drop policy if exists notes_insert on public.notes;
create policy notes_insert on public.notes for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists notes_update on public.notes;
create policy notes_update on public.notes for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists notes_delete on public.notes;
create policy notes_delete on public.notes for delete to authenticated
  using (user_id = auth.uid());

-- likes / comments: 볼 수 있는 노트에만
drop policy if exists likes_select on public.likes;
create policy likes_select on public.likes for select to authenticated
  using (exists (select 1 from public.notes n where n.id = note_id and (n.is_public or n.user_id = auth.uid())));
drop policy if exists likes_insert on public.likes;
create policy likes_insert on public.likes for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.notes n where n.id = note_id and (n.is_public or n.user_id = auth.uid())));
drop policy if exists likes_delete on public.likes;
create policy likes_delete on public.likes for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments for select to authenticated
  using (exists (select 1 from public.notes n where n.id = note_id and (n.is_public or n.user_id = auth.uid())));
drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.notes n where n.id = note_id and (n.is_public or n.user_id = auth.uid())));
drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments for delete to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.notes n where n.id = note_id and n.user_id = auth.uid()));

-- =====================================================================
-- 함수 (RPC)
-- =====================================================================

-- 감 농장: 모든 감나무 현황 (코드는 노출하지 않음)
create or replace function public.farm_stats()
returns table (id uuid, name text, start_date date, end_date date,
               member_count int, note_count int, is_member boolean)
language sql stable security definer set search_path = public as $$
  select t.id, t.name, t.start_date, t.end_date,
    (select count(*)::int from tree_members m where m.tree_id = t.id),
    (select count(*)::int from notes n
       join tree_members m on m.user_id = n.user_id and m.tree_id = t.id
      where n.note_date between t.start_date and t.end_date),
    exists (select 1 from tree_members m where m.tree_id = t.id and m.user_id = auth.uid())
  from trees t
  where auth.uid() is not null
  order by t.start_date desc, t.created_at desc;
$$;

-- 내가 속한 감나무
create or replace function public.my_trees()
returns table (id uuid, name text, start_date date, end_date date, joined_at timestamptz)
language sql stable security definer set search_path = public as $$
  select t.id, t.name, t.start_date, t.end_date, m.joined_at
  from tree_members m join trees t on t.id = m.tree_id
  where m.user_id = auth.uid()
  order by m.joined_at desc;
$$;

-- 감나무 코드로 참여
create or replace function public.join_tree(p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare t record;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  select * into t from trees where code = upper(trim(p_code));
  if not found then raise exception '존재하지 않는 감나무 코드예요'; end if;
  if t.end_date < current_date then raise exception '이미 키우기가 끝난 감나무예요'; end if;
  insert into tree_members (tree_id, user_id) values (t.id, auth.uid())
  on conflict do nothing;
  return t.name;
end $$;

-- 관리자: 감나무별 참여자 목록 + 감사노트 개수 (내용은 제공하지 않음)
create or replace function public.admin_tree_members(p_tree uuid)
returns table (user_id uuid, nickname text, kakao_name text, joined_at timestamptz,
               period_count int, total_count int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '관리자만 볼 수 있어요'; end if;
  return query
  select p.id, p.nickname, p.kakao_name, m.joined_at,
    (select count(*)::int from notes n, trees t
      where t.id = p_tree and n.user_id = p.id and n.note_date between t.start_date and t.end_date),
    (select count(*)::int from notes n where n.user_id = p.id)
  from tree_members m join profiles p on p.id = m.user_id
  where m.tree_id = p_tree
  order by 5 desc, m.joined_at;
end $$;

-- 관리자: 감나무 목록 + 집계
create or replace function public.admin_trees()
returns table (id uuid, name text, code text, start_date date, end_date date,
               member_count int, note_count int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '관리자만 볼 수 있어요'; end if;
  return query
  select t.id, t.name, t.code, t.start_date, t.end_date,
    (select count(*)::int from tree_members m where m.tree_id = t.id),
    (select count(*)::int from notes n
       join tree_members m on m.user_id = n.user_id and m.tree_id = t.id
      where n.note_date between t.start_date and t.end_date)
  from trees t order by t.start_date desc, t.created_at desc;
end $$;

revoke execute on function public.farm_stats(), public.my_trees(), public.join_tree(text),
  public.admin_tree_members(uuid), public.admin_trees(), public.handle_new_user() from public, anon;
grant execute on function public.farm_stats(), public.my_trees(), public.join_tree(text),
  public.admin_tree_members(uuid), public.admin_trees() to authenticated;

-- =====================================================================
-- Storage: 사진 버킷 (비공개) — 본인 사진 + 공개된 노트의 사진만 열람
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists photos_insert on storage.objects;
create policy photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists photos_select on storage.objects;
create policy photos_select on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.notes n where n.photo_path = name and n.is_public)));
drop policy if exists photos_delete on storage.objects;
create policy photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- =====================================================================
-- 관리자 지정: 카카오로 한 번 로그인한 뒤, 아래에서 닉네임을 바꿔 실행하세요.
--   update public.profiles set is_admin = true where nickname = '내닉네임';
-- =====================================================================

-- 함수 실행 권한 정리
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- =====================================================================
-- 피드: 같은 감나무에 속한 사람의 공개 글만 보이기 (사진 없어도 공개 가능)
-- =====================================================================
alter table public.notes drop constraint if exists public_needs_photo;

create or replace function public.shares_tree(other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from tree_members a join tree_members b on a.tree_id = b.tree_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;
revoke execute on function public.shares_tree(uuid) from public, anon;
grant execute on function public.shares_tree(uuid) to authenticated;

drop policy if exists notes_select on public.notes;
create policy notes_select on public.notes for select to authenticated
  using (user_id = (select auth.uid()) or (is_public and public.shares_tree(user_id)));

drop policy if exists likes_select on public.likes;
create policy likes_select on public.likes for select to authenticated
  using (exists (select 1 from public.notes n where n.id = note_id and (n.user_id = (select auth.uid()) or (n.is_public and public.shares_tree(n.user_id)))));
drop policy if exists likes_insert on public.likes;
create policy likes_insert on public.likes for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.notes n where n.id = note_id and (n.user_id = (select auth.uid()) or (n.is_public and public.shares_tree(n.user_id)))));
drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments for select to authenticated
  using (exists (select 1 from public.notes n where n.id = note_id and (n.user_id = (select auth.uid()) or (n.is_public and public.shares_tree(n.user_id)))));
drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.notes n where n.id = note_id and (n.user_id = (select auth.uid()) or (n.is_public and public.shares_tree(n.user_id)))));

drop policy if exists photos_select on storage.objects;
create policy photos_select on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (select 1 from public.notes n where n.photo_path = storage.objects.name and n.is_public and public.shares_tree(n.user_id))));
