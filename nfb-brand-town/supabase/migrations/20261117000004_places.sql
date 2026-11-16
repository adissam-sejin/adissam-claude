-- 마을의 함께 쓰는 건물: 오브북 도서관, 미술관 (학교는 courses 표를 그대로 쓴다)

-- 오브북 도서관: 층(분류)마다 펴낸 책이 꽂힌다. 북클럽 책은 books 표를 쓴다.
create table public.shelf_books (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('essay', 'picture', 'self', 'adi')),
  title text not null check (char_length(title) between 1 and 80),
  author text not null default '',
  cover_url text,
  buy_url text,
  isbn text,
  note text not null default '' check (char_length(note) <= 300),
  author_user_id uuid references public.profiles(id) on delete set null,
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 미술관: 함께 연 전시를 회차별로 보여준다.
create table public.exhibitions (
  id uuid primary key default gen_random_uuid(),
  round int not null unique check (round >= 1),
  title text not null check (char_length(title) between 1 and 80),
  held_on text not null default '',
  note text not null default '' check (char_length(note) <= 500),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.exhibition_works (
  id uuid primary key default gen_random_uuid(),
  exhibition_id uuid not null references public.exhibitions(id) on delete cascade,
  title text not null default '' check (char_length(title) <= 80),
  artist text not null default '' check (char_length(artist) <= 40),
  image_url text not null,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index exhibition_works_ex on public.exhibition_works (exhibition_id, sort);

alter table public.shelf_books      enable row level security;
alter table public.exhibitions      enable row level security;
alter table public.exhibition_works enable row level security;

revoke all on public.shelf_books, public.exhibitions, public.exhibition_works from anon, authenticated;
grant select, insert, update, delete on public.shelf_books, public.exhibitions, public.exhibition_works to authenticated;

create policy "members read" on public.shelf_books      for select to authenticated using ((select private.is_member()));
create policy "admin write"  on public.shelf_books      for all    to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "members read" on public.exhibitions      for select to authenticated using ((select private.is_member()));
create policy "admin write"  on public.exhibitions      for all    to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "members read" on public.exhibition_works for select to authenticated using ((select private.is_member()));
create policy "admin write"  on public.exhibition_works for all    to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- 관리자는 책 표지·전시 작품 그림도 올릴 수 있다.
create policy "shared: admin place upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'shared' and (storage.foldername(name))[1] in ('covers', 'works') and (select private.is_admin()));
create policy "shared: admin place delete" on storage.objects for delete to authenticated
  using (bucket_id = 'shared' and (storage.foldername(name))[1] in ('items', 'covers', 'works') and (select private.is_admin()));
